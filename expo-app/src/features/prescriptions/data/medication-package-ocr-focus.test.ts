import { getPackageLabelRegion, prioritizePrintedPackageLabel, selectPackageLabelReading } from './medication-package-ocr-focus';

describe('focused packaging OCR without hallucination', () => {
  it('prioritizes a name read in the focus region while retaining the raw source text', () => {
    const raw = 'Thuốc kê đơn\nThuốc giảm đau - hạ sốt\nHộp 10 vỉ x 10 viên';
    const result = prioritizePrintedPackageLabel(raw, 'Paracetamol 500 mg\nThuốc giảm đau - hạ sốt');
    expect(result.usedFocusedPass).toBe(true);
    expect(result.text.startsWith('Paracetamol 500 mg\n')).toBe(true);
    expect(result.text).toContain('Thuốc kê đơn');
    expect(result.text).toContain('Hộp 10 vỉ');
  });
  it('does not invent a drug from expiry or marketing instructions', () => {
    const original = 'Hộp 10 vỉ x 10 viên\nThuốc giảm đau - hạ sốt';
    expect(prioritizePrintedPackageLabel(original, 'Thuốc giảm đau 500 mg\nHSD 12/2028')).toEqual({
      text: original, usedFocusedPass: false,
    });
  });
  it('does not add a duplicate line', () => {
    const value = 'Paracetamol 500 mg\nThuốc kê đơn';
    expect(prioritizePrintedPackageLabel(value, 'Paracetamol 500 mg').text).toBe(value);
  });
  it('builds a bounded focus rectangle from the original image size', () => {
    expect(getPackageLabelRegion(1662, 1482)).toEqual({ left: 66, top: 177, width: 1529, height: 918 });
    expect(getPackageLabelRegion(0, 0)).toBeNull();
  });

  it('uses actual high-contrast OCR evidence rather than guessing 500 mg from SOO', () => {
    expect(selectPackageLabelReading('Paracetamol SOO', 'Paracetamol 500 mg')).toEqual({
      text: 'Paracetamol 500 mg', enhancedSelected: true,
    });
    expect(selectPackageLabelReading('Paracetamol SOO', 'Paracetamol SOO')).toEqual({
      text: 'Paracetamol SOO', enhancedSelected: false,
    });
    expect(selectPackageLabelReading('Paracetamol SOO', 'Paracetamol 500')).toEqual({
      text: 'Paracetamol SOO', enhancedSelected: false,
    });
  });
  it('does not override an already legible name-strength pair with a different guess', () => {
    expect(selectPackageLabelReading('Paracetamol 500 mg', 'Paracetamol 800 mg')).toEqual({
      text: 'Paracetamol 500 mg', enhancedSelected: false,
    });
    expect(selectPackageLabelReading('Thuốc giảm đau 500 mg', 'Thuốc giảm đau 500 mg')).toEqual({
      text: 'Thuốc giảm đau 500 mg', enhancedSelected: false,
    });
  });
});
