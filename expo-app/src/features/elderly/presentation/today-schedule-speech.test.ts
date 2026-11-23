import { buildTodayScheduleSpeech } from './today-schedule-speech';

const plan = (localTime: string, name: string) => ({ schedule: { localTime }, medication: { name } });

describe('buildTodayScheduleSpeech', () => {
  it('reads the displayed time and medicine name without adding dosage instructions', () => {
    expect(buildTodayScheduleSpeech([plan('08:00', 'Thuốc mẫu A'), plan('19:05', 'Thuốc mẫu B')]))
      .toBe('Lịch thuốc dự kiến hôm nay. 8 giờ, Thuốc mẫu A. 19 giờ 5 phút, Thuốc mẫu B.');
  });

  it('skips invalid times and missing names', () => {
    expect(buildTodayScheduleSpeech([plan('24:00', 'Thuốc mẫu'), plan('12:00', '  ')])).toBe('');
    expect(buildTodayScheduleSpeech([])).toBe('');
  });

  it('tells the listener to look at the screen if not all items are read', () => {
    const entries = Array.from({ length: 21 }, (_, index) => plan('09:00', 'Mẫu ' + (index + 1)));
    const speech = buildTodayScheduleSpeech(entries);
    expect(speech).toContain('Mẫu 20.');
    expect(speech).not.toContain('Mẫu 21.');
    expect(speech).toContain('Xem màn hình để biết các mục còn lại.');
  });
});
