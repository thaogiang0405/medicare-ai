import type { DoseEvent } from '@/types/domain';

import { assertValidDoseEventLocalDate, assertValidDoseEventLocalTime } from './dose-tracking-repository';

export const doseHistoryDefaultPageSize = 20;
export const doseHistoryMaximumPageSize = 30;

export type DoseHistoryRange = 'day' | 'sevenDays' | 'thirtyDays';

export type DoseHistoryCursor = Readonly<{
  scheduledLocalDate: string;
  scheduledLocalTime: string;
  id: string;
}>;

export type DoseHistoryQuery = Readonly<{
  startLocalDate: string;
  endLocalDate: string;
  pageSize: number;
  cursor?: DoseHistoryCursor;
}>;

export type DoseHistoryPage = Readonly<{
  events: readonly DoseEvent[];
  nextCursor: DoseHistoryCursor | null;
}>;

export interface DoseHistoryRepository {
  listDoseHistory(userId: string, query: DoseHistoryQuery): Promise<DoseHistoryPage>;
}

export type DoseHistoryDateRange = Readonly<{
  startLocalDate: string;
  endLocalDate: string;
}>;

const hcmTimeZone = 'Asia/Ho_Chi_Minh';

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getHcmIsoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: hcmTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = Number(readPart('year'));
  const month = Number(readPart('month'));
  const day = Number(readPart('day'));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('Không thể xác định ngày lịch sử theo múi giờ Việt Nam.');
  }

  return formatIsoDate(year, month, day);
}

function addCalendarDays(isoDate: string, offset: number): string {
  const [year, month, day] = assertValidDoseEventLocalDate(isoDate).split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + offset));
  return formatIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

export function getDoseHistoryDateRange(range: DoseHistoryRange, now: Date = new Date()): DoseHistoryDateRange {
  const endLocalDate = getHcmIsoDate(now);
  const days = range === 'day' ? 1 : range === 'sevenDays' ? 7 : 30;

  return {
    startLocalDate: addCalendarDays(endLocalDate, -(days - 1)),
    endLocalDate,
  };
}

function normalizeId(value: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > 150 || normalized.includes('/')) {
    throw new Error('Con trỏ lịch sử uống thuốc không hợp lệ.');
  }

  return normalized;
}

export function normalizeDoseHistoryQuery(query: DoseHistoryQuery): DoseHistoryQuery {
  const startLocalDate = assertValidDoseEventLocalDate(query.startLocalDate);
  const endLocalDate = assertValidDoseEventLocalDate(query.endLocalDate);

  if (startLocalDate > endLocalDate) {
    throw new Error('Khoảng ngày lịch sử không hợp lệ.');
  }

  if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > doseHistoryMaximumPageSize) {
    throw new Error('Số lượng bản ghi lịch sử không hợp lệ.');
  }

  if (!query.cursor) {
    return { startLocalDate, endLocalDate, pageSize: query.pageSize };
  }

  const cursor = {
    scheduledLocalDate: assertValidDoseEventLocalDate(query.cursor.scheduledLocalDate),
    scheduledLocalTime: assertValidDoseEventLocalTime(query.cursor.scheduledLocalTime),
    id: normalizeId(query.cursor.id),
  };

  if (cursor.scheduledLocalDate < startLocalDate || cursor.scheduledLocalDate > endLocalDate) {
    throw new Error('Con trỏ lịch sử nằm ngoài khoảng ngày đang xem.');
  }

  return { startLocalDate, endLocalDate, pageSize: query.pageSize, cursor };
}

export function getDoseHistoryCursor(event: DoseEvent): DoseHistoryCursor {
  if (!event.scheduledLocalDate || !event.scheduledLocalTime) {
    throw new Error('Bản ghi lịch sử không có thời điểm địa phương hợp lệ.');
  }

  return {
    scheduledLocalDate: assertValidDoseEventLocalDate(event.scheduledLocalDate),
    scheduledLocalTime: assertValidDoseEventLocalTime(event.scheduledLocalTime),
    id: normalizeId(event.id),
  };
}

export function doseHistoryRangeLabel(range: DoseHistoryRange): string {
  const labels: Record<DoseHistoryRange, string> = {
    day: 'Hôm nay',
    sevenDays: '7 ngày',
    thirtyDays: '30 ngày',
  };

  return labels[range];
}
