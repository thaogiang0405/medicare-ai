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
});
