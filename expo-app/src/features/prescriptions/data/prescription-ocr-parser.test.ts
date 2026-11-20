import { parsePrescriptionOcrPage, parsePrescriptionOcrPages } from './prescription-ocr-parser';

describe('prescription OCR parser', () => {
  it('keeps separate Vietnamese medicine lines and attaches only explicit direction continuations', () => {
    const candidates = parsePrescriptionOcrPage({
      pageIndex: 0,
      confidence: null,
      qualityWarnings: [],
      text: [
        'ĐƠN THUỐC',
        '1. Metformin 500 mg - Uống 1 viên sau ăn sáng',
        '2. Amlodipine 5mg',
        'Uống buổi tối',
      ].join('\n'),
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      input: {
        name: 'Metformin',
        strengthText: '500 mg',
        directionsText: 'Uống 1 viên sau ăn sáng',
      },
    });
    expect(candidates[1]).toMatchObject({
      input: {
        name: 'Amlodipine',
        strengthText: '5mg',
        directionsText: 'Uống buổi tối',
      },
    });
  });

  it('does not manufacture a medicine from headings or a directions-only OCR fragment', () => {
    const candidates = parsePrescriptionOcrPage({
      pageIndex: 0,
      confidence: null,
      qualityWarnings: [],
      text: [
        'Chẩn đoán: Tăng huyết áp',
        'Uống 1 viên vào buổi sáng',
        'Thuốc: Losartan',
      ].join('\n'),
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        input: { name: 'Losartan', strengthText: '', directionsText: '' },
        warnings: expect.arrayContaining([
          'Không nhận rõ hàm lượng hoặc quy cách.',
          'Không nhận rõ hướng dẫn sử dụng.',
        ]),
      }),
    ]);
  });

  it('preserves page source and quality warnings without joining different pages', () => {
    const candidates = parsePrescriptionOcrPages([
      {
        pageIndex: 1,
        confidence: 0.5,
        qualityWarnings: ['Ảnh trang 2 hơi mờ; hãy đối chiếu đơn gốc.'],
        text: '1) Atorvastatin 20 mg',
      },
      {
        pageIndex: 0,
        confidence: null,
        qualityWarnings: [],
        text: '1) Omeprazole 20 mg',
      },
    ]);

    expect(candidates.map((candidate) => candidate.input.name)).toEqual(['Omeprazole', 'Atorvastatin']);
    expect(candidates[1]).toMatchObject({ sourceReference: 'Trang 2, dòng 1' });
    expect(candidates[1]!.warnings).toContain('Ảnh trang 2 hơi mờ; hãy đối chiếu đơn gốc.');
  });
});
