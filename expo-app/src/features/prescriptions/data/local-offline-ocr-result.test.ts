import { toLocalOfflineOcrPageResult } from './local-offline-ocr-result';

describe('toLocalOfflineOcrPageResult', () => {
  it('marks an empty OCR response for manual review rather than inventing medication data', () => {
    expect(toLocalOfflineOcrPageResult({ text: '  ', confidence: 0 })).toEqual({
      text: '',
      confidence: 0,
      qualityWarnings: [
        'Không nhận được chữ từ ảnh này. Hãy kiểm tra lại ảnh gốc hoặc thêm thuốc thủ công.',
        'Chất lượng nhận dạng thấp. Vui lòng đối chiếu kỹ với đơn gốc.',
      ],
    });
  });

  it('normalizes low confidence and unavailable confidence conservatively', () => {
    expect(toLocalOfflineOcrPageResult({ text: 'Paracetamol 500 mg', confidence: 42 })).toEqual({
      text: 'Paracetamol 500 mg',
      confidence: 0.42,
      qualityWarnings: ['Chất lượng nhận dạng thấp. Vui lòng đối chiếu kỹ với đơn gốc.'],
    });
    expect(toLocalOfflineOcrPageResult({ text: 'Thuốc cần kiểm tra', confidence: undefined })).toEqual({
      text: 'Thuốc cần kiểm tra',
      confidence: null,
      qualityWarnings: ['Không có mức độ tin cậy. Vui lòng kiểm tra lại từng trường.'],
    });
  });
});
