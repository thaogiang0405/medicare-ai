type PlannedMedication = Readonly<{
  schedule: Readonly<{ localTime: string }>;
  medication: Readonly<{ name: string }>;
}>;

/** Read planned times as displayed, never give instructions to take a dose. */
export function buildTodayScheduleSpeech(plans: readonly PlannedMedication[]): string {
  const entries = plans.flatMap(({ schedule, medication }) => {
    const time = schedule.localTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    const name = medication.name.trim().replace(/\s+/g, ' ');
    if (!time || !name) return [];
    const minute = Number(time[2]);
    const at = Number(time[1]) + ' giờ' + (minute > 0 ? ' ' + minute + ' phút' : '');
    return [at + ', ' + name + '.'];
  });
  if (entries.length === 0) return '';
  return [
    'Lịch thuốc dự kiến hôm nay.',
    ...entries.slice(0, 20),
    ...(entries.length > 20 ? ['Xem màn hình để biết các mục còn lại.'] : []),
  ].join(' ');
}
