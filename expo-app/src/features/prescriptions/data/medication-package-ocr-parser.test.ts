import { parseMedicationPackageOcrPage, parseMedicationPackageOcrPages } from './medication-package-ocr-parser';

describe('conservative package-lettering parser', () => {
  it('reads name and strength without creating a dosage instruction', () => {
    const items = parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'Tên thuốc: Paracetamol 500 mg\nCách dùng: uống 2 viên\nSố lô: 123',
      confidence: 0.92, qualityWarnings: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0].input).toEqual({ name: 'Paracetamol', strengthText: '500 mg', directionsText: '' });
    expect(items[0].warnings.join(' ')).toContain('KHÔNG xác minh');
  });
  it('never interprets SOO or a missing strength unit as 500 mg', () => {
    expect(parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'Paracetamol SOO', confidence: 0.4, qualityWarnings: [],
    })).toEqual([]);
    expect(parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'Paracetamol 500', confidence: 0.4, qualityWarnings: [],
    })).toEqual([]);
  });

  it('accepts a brand-strength line', () => {
    const items = parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'HSD: 2028\nVitamin C 500 mg\nCách dùng: 2 viên',
      confidence: 0.95, qualityWarnings: [],
    });
    expect(items).toHaveLength(1);
    expect(items[0].input).toEqual({ name: 'Vitamin C', strengthText: '500 mg', directionsText: '' });
  });
  it('does not invent a drug from lot, expiry, ingredients or directions', () => {
    expect(parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'HSD: 12/2027\nThành phần: 500 mg\nSố lô: 034\nCách dùng: 2 viên',
      confidence: null, qualityWarnings: [],
    })).toEqual([]);
  });
  it('takes at most one candidate per photo and sorts photos', () => {
    const items = parseMedicationPackageOcrPages([
      { pageIndex: 2, text: 'Vitamin C 500 mg\nParacetamol 500 mg', confidence: null, qualityWarnings: [] },
      { pageIndex: 0, text: 'Tên thuốc: Panadol 500 mg', confidence: null, qualityWarnings: [] },
    ]);
    expect(items.map((x) => x.input.name)).toEqual(['Panadol', 'Vitamin C']);
  });
  it('passes along warnings about uncertainty', () => {
    const items = parseMedicationPackageOcrPage({
      pageIndex: 0, text: 'Tên thuốc: Vitamin C', confidence: 0.2,
      qualityWarnings: ['OCR_LOW_CONFIDENCE'],
    });
    expect(items).toHaveLength(1);
    expect(items[0].input.strengthText).toBe('');
    expect(items[0].warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('tin cậy thấp'), 'OCR_LOW_CONFIDENCE',
    ]));
  });

  it('ignores descriptive text ahead of the real name', () => {
    const page = { pageIndex: 0, confidence: 0.9, qualityWarnings: [] };
    expect(parseMedicationPackageOcrPage({ ...page, text: 'Thuốc giảm đau 500 mg\nParacetamol 500 mg' })[0]?.input.name)
      .toBe('Paracetamol');
    expect(parseMedicationPackageOcrPage({ ...page, text: 'Thuốc hạ sốt 500 mg' })).toEqual([]);
  });

  it('joins adjacent explicitly labelled fields without guessing an ambiguous strength', () => {
    const page = { pageIndex: 0, confidence: 0.9, qualityWarnings: [] };
    const read = (text: string) => parseMedicationPackageOcrPage({ ...page, text })[0];
    expect(read('Tên thuốc: Paracetamol\nHàm lượng: 500 mg')?.input.strengthText).toBe('500 mg');
    expect(read('Tên thuốc: Paracetamol\nHàm lượng: SOO mg')?.input.strengthText).toBe('');
    expect(read('Tên thuốc: Paracetamol\nThành phần khác: 500 mg')?.input.strengthText).toBe('');
    expect(read('Tên thuốc: Paracetamol\n\nHàm lượng: 500 mg')?.input.strengthText).toBe('');
  });
});
