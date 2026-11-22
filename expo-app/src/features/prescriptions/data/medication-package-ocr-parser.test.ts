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

  it('reads a stacked package title without requiring printed field labels', () => {
    const page = { pageIndex: 0, confidence: 0.9, qualityWarnings: [] };
    const items = parseMedicationPackageOcrPage({
      ...page, text: 'PharmViet\nAcetaminophen\n500 mg\nGiảm đau - Hạ sốt\nChỉ định:',
    });
    expect(items[0]?.input).toEqual({ name: 'Acetaminophen', strengthText: '500 mg', directionsText: '' });
    expect(items[0]?.sourceText).toBe('Acetaminophen\n500 mg');
    expect(parseMedicationPackageOcrPage({
      ...page, text: 'MedPharma\nAmoxicillin\n500 mg\nThành phần:\nAmoxicillin 500 mg',
    })[0]?.input).toEqual({ name: 'Amoxicillin', strengthText: '500 mg', directionsText: '' });
  });

  it('does not guess a stacked title from ambiguous or unrelated lines', () => {
    const page = { pageIndex: 0, confidence: 0.9, qualityWarnings: [] };
    for (const text of [
      'Acetaminophen\nSOO mg',
      'Acetaminophen\n\n\n500 mg',
      'Acetaminophen\nPharmViet logo\n500 mg',
      'Acetsniili\n\nphen\n\n500mg',
      'Acetaminophen\n\n500 mg\nAmoxicillin\n250 mg',
      'Acetaminophen\n500',
      'Thành phần:\nAcetaminophen\n500 mg',
      'Acetaminophen\n500 mg\nAmoxicillin\n250 mg',
    ]) {
      expect(parseMedicationPackageOcrPage({ ...page, text })).toEqual([]);
    }
  });
  it('reads the two clearly printed fields separated by one empty OCR line', () => {
    const items = parseMedicationPackageOcrPage({
      pageIndex: 0, confidence: 0.9, qualityWarnings: [],
      text: "ARTES,\n\n`\n\nƒ PharmViet\n\n'10 vỉ x 10 viên nén\n\nÉ\n\nN\n\ni Vi sức khỏe cộng đồng\n\n|\n\nAcetaminophen\n\n500 mg\n\nGiảm dau - Hạ sốt\n\nChỉ định:\n\nDùng để giảm đau các mức độ nhẹ và\n\nhạ sốt.\n\nlướng\n\nng trướ\n\nLGMP-WHO }",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.input).toEqual({ name: 'Acetaminophen', strengthText: '500 mg', directionsText: '' });
    expect(items[0]?.sourceText).toBe('Acetaminophen\n\n500 mg');
  });
  it('ignores an OCR border mark after the title and keeps the original text for review', () => {
    const page = { pageIndex: 0, confidence: 0.9, qualityWarnings: [] };
    const items = parseMedicationPackageOcrPage({ ...page, text: "CỔ 2 8\n\node:\n\nPharmViet\n\na aati\n\n6p 0 vi x 10 viên nén\n\nVì sức khỏe cộng đồng\n\nW\n\nAcetaminophen |\n\n500 mg\n\nGiam dau - Ha sot\n\nChi dinh:\n\ntung\n\nDùng để giảm đau các mức độ nhẹ và\n\nhạ sốt.\n\nFy\n\nHO j\n\ndùng\n\nA ee" });
    expect(items).toHaveLength(1);
    expect(items[0]?.input).toEqual({ name: 'Acetaminophen', strengthText: '500 mg', directionsText: '' });
    expect(items[0]?.sourceText).toBe('Acetaminophen |\n\n500 mg');

    for (const text of [
      'Acetaminophen|\n500 mg',
      'Acetaminophen | Extra\n500 mg',
      'Acetaminophen |\n\n\n500 mg',
      'Acetaminophen |\nSOO mg',
      'Acetaminophen |\n500 mg\nAmoxicillin\n250 mg',
    ]) {
      expect(parseMedicationPackageOcrPage({ ...page, text })).toEqual([]);
    }
  });
});
