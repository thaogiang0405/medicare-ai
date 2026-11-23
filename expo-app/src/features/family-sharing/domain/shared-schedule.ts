/**
 * A manually forwarded, read-only schedule snapshot.
 *
 * This is not a signed token, authentication, permission grant, or live link.
 * The recipient cannot verify its provenance, and it must never be used to
 * authorize a Firestore read or to register a dose response.
 */
export type SharedSchedule = Readonly<{
  kind: 'medicare-ai-planned-schedule';
  version: 1;
  date: string;
  items: readonly Readonly<{ time: string; name: string }>[];
}>;

type PlannedItem = Readonly<{
  schedule: Readonly<{ localTime: string }>;
  medication: Readonly<{ name: string }>;
}>;

const legacyPrefix = 'MEDICARE-AI-LICH-THUOC-V1';
const friendlyHeader = 'LỊCH THUỐC DỰ KIẾN - MediCare AI';
const friendlyFooter = 'Chỉ là lịch dự kiến, chưa xác nhận đã uống. (MediCare AI V2)';
const friendlyItemSeparator = ' — ';
const maxItems = 20;
const maxMessageLength = 8192;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function isCalendarDay(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const time = new Date(Date.UTC(year, month - 1, day));
  return time.getUTCFullYear() === year
    && time.getUTCMonth() + 1 === month
    && time.getUTCDate() === day;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function hasExactKeys(input: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(input);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

/**
 * Only the currently loaded real schedule may be exported. No UID, contact,
 * drug strength, directions, adherence status, OCR, or notification metadata.
 * An empty/invalid list is not exportable, and demo events are never passed in.
 */
export function buildSharedScheduleText(
  date: string,
  planned: readonly PlannedItem[],
): string | null {
  if (!isCalendarDay(date) || planned.length === 0 || planned.length > maxItems) return null;

  const items = planned.map(({ schedule, medication }) => ({
    time: schedule.localTime,
    name: medication.name.replace(/\s+/g, ' ').trim(),
  }));

  if (items.some(({ time, name }) => !timePattern.test(time)
    || name.length < 1 || name.length > 120 || /[\u0000-\u001f]/.test(name))) return null;

  items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
  const [year, month, day] = date.split('-');
  // A chat message a family member can read directly in Zalo/Messenger.
  // This is still just unverified forwarded text, never an access token.
  const text = [
    friendlyHeader,
    `Ngày: ${day}/${month}/${year}`,
    ...items.map(({ time, name }) => time + friendlyItemSeparator + name),
    friendlyFooter,
  ].join('\n');
  return text.length <= maxMessageLength ? text : null;
}

/**
 * Untrusted pasted text is parsed strictly and never persisted. Even a valid
 * snapshot is only self-reported text forwarded via another app.
 */
export function parseSharedScheduleText(text: string): SharedSchedule | null {
  if (!text || text.length > maxMessageLength) return null;
  const value = text.trim();
  if (value.startsWith(friendlyHeader + '\n')) {
    return parseFriendlySchedule(value);
  }
  if (!value.startsWith(legacyPrefix + '\n')) return null;
  const json = value.slice(legacyPrefix.length + 1).trim();
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(decoded)
    || !hasExactKeys(decoded, ['kind', 'version', 'date', 'items'])
    || decoded.kind !== 'medicare-ai-planned-schedule'
    || decoded.version !== 1
    || typeof decoded.date !== 'string' || !isCalendarDay(decoded.date)
    || !Array.isArray(decoded.items)
    || decoded.items.length < 1 || decoded.items.length > maxItems) return null;

  const items: { time: string; name: string }[] = [];
  for (const item of decoded.items) {
    if (!isRecord(item) || !hasExactKeys(item, ['time', 'name'])
      || typeof item.time !== 'string' || !timePattern.test(item.time)
      || typeof item.name !== 'string'
      || item.name.length < 1 || item.name.length > 120
      || item.name !== item.name.trim().replace(/\s+/g, ' ')
      || /[\u0000-\u001f]/.test(item.name)) return null;
    items.push({ time: item.time, name: item.name });
  }

  return {
    kind: 'medicare-ai-planned-schedule',
    version: 1,
    date: decoded.date,
    items: items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name)),
  };
}

/**
 * Accept only the complete forwarded, readable message. Its marker, date,
 * schedule rows, and disclaimer are required. Never infer a missing row.
 * The content is not cryptographically signed, so the caregiver must review.
 */
function parseFriendlySchedule(text: string): SharedSchedule | null {
  const lines = text.split(/\r?\n/);
  if (lines.length < 4 || lines.length > maxItems + 3
    || lines[0] !== friendlyHeader
    || lines[lines.length - 1] !== friendlyFooter) return null;

  const dateLine = lines[1]?.match(/^Ngày: (\d{2})\/(\d{2})\/(20\d{2})$/);
  if (!dateLine) return null;
  const date = `${dateLine[3]}-${dateLine[2]}-${dateLine[1]}`;
  if (!isCalendarDay(date)) return null;

  const items: { time: string; name: string }[] = [];
  for (const line of lines.slice(2, -1)) {
    const split = line.indexOf(friendlyItemSeparator);
    if (split < 0) return null;
    const time = line.slice(0, split);
    const name = line.slice(split + friendlyItemSeparator.length);
    if (!timePattern.test(time)
      || name.length < 1 || name.length > 120
      || name !== name.trim().replace(/\s+/g, ' ')
      || /[\u0000-\u001f]/.test(name)) return null;
    items.push({ time, name });
  }
  if (items.length === 0 || items.length > maxItems) return null;
  return {
    kind: 'medicare-ai-planned-schedule',
    version: 1,
    date,
    items: items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name)),
  };
}
