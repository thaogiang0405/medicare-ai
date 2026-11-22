import type { PrescriptionOcrCandidate, PrescriptionOcrPage } from '../domain/prescription-ocr';

/** Reads printed lettering, not appearance-based pill identity or medical advice. */
const strengthPattern = /\b\d{1,5}(?:[.,]\d{1,4})?\s*(?:mg|mcg|µg|g|ml|iu|%)(?![a-z])/i;
const labeledName = /^(?:tên\s+thuốc|tên\s+sản\s+phẩm|medicine\s+name|product\s+name|thuốc)\s*[:：-]\s*(.+)$/i;
const exclude = /^(?:thành\s+phần|hoạt\s+chất|hàm\s+lượng|hướng\s+dẫn|liều\s+dùng|cách\s+dùng|công\s+dụng|chỉ\s+định|chống\s+chỉ\s+định|nhà\s+sản\s+xuất|nơi\s+sản\s+xuất|sản\s+xuất|công\s+ty|xuất\s+xứ|bảo\s+quản|hạn\s+sử\s+dụng|ngày\s+sản\s+xuất|số\s+lô|số\s+đăng\s+ký|sđk|hộp|viên\s+nén|viên\s+nang|đọc\s+kỹ|để\s+xa|trẻ\s+em|khối\s+lượng|thể\s+tích|manufactured|expiry|exp\b|mfg\b|lot\b|batch\b|registration\b|composition\b|ingredients\b|directions\b|dose\b)/i;
const descriptiveName = /^(?:thuốc\s+(?:giảm\s+đau|hạ\s+sốt|kê\s+đơn|không\s+kê\s+đơn)|giảm\s+đau|hạ\s+sốt|pain\s+relief)(?=\s|[:/–—-]|$)/i;
const strengthLabel = /^(?:hàm\s+lượng|strength)\s*[:：-]\s*(.+)$/i;
const standaloneStrength = new RegExp('^(?:' + strengthPattern.source + ')$', 'i');
const genericName = /^(?:thuốc|medicine|product|dược\s+phẩm|thực\s+phẩm|bổ\s+sung|chất\s+lượng)$/i;
// Unlabelled, stacked front-panel titles need stronger evidence than labelled
// fields: one word followed immediately by a standalone printed strength.
const stackedName = /^\p{L}[\p{L}\p{M}-]{4,39}$/u;
const stackedStrength = /^\d{1,5}(?:[.,]\d{1,4})?\s*(?:mg|mcg|µg|iu)$/i;
const detailsHeader = /^(?:thành\s+phần|hoạt\s+chất|chỉ\s+định|cách\s+dùng|liều\s+dùng|composition|ingredients|directions)(?=\s|[:：]|$)/i;
type Evidence = Readonly<{ name: string; strengthText: string; line: string; lineIndex: number; labelled: boolean }>;
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

function parseLine(line: string, lineIndex: number): Evidence | null {
  if (exclude.test(line)) return null;
  const labelled = line.match(labeledName);
  const value = normalize(labelled?.[1] ?? line);
  const strength = value.match(strengthPattern);
  if (!labelled && (!strength || strength.index === 0)) return null;
  const before = strength?.index === undefined ? value : value.slice(0, strength.index);
  const name = normalize(before.replace(/[\s,;:–—-]+$/, ''));
  if (name.length < 3 || name.length > 120 || genericName.test(name) || descriptiveName.test(name)) return null;
  if (!/^[A-Za-zÀ-ỹ]/.test(name)) return null;
  if (!labelled && name.split(/\s+/).length > 6) return null;
  const after = strength?.index === undefined ? '' : normalize(value.slice(strength.index + strength[0].length));
  if (!labelled && /\b(?:uống|ngày|lần|giờ|chỉ\s+định|cách\s+dùng)\b/i.test(after)) return null;
  return { name, strengthText: strength ? normalize(strength[0]) : '', line, lineIndex, labelled: !!labelled };
}

/** At most one candidate per photo; the caller must leave it unselected. */
export function parseMedicationPackageOcrPage(page: PrescriptionOcrPage): PrescriptionOcrCandidate[] {
  const lines = page.text.split(/\r?\n/).map(normalize);
  const evidence = lines.map((line, index): Evidence | null => {
    const item = parseLine(line, index);
    if (!item?.labelled || item.strengthText) return item;
    const nextLine = lines[index + 1] ?? '';
    const strength = nextLine.match(strengthLabel)?.[1] ?? '';
    if (!standaloneStrength.test(strength)) return item;
    return { ...item, strengthText: strength, line: item.line + '\n' + nextLine };
  }).filter((x): x is Evidence => x !== null);
  const stacked: Evidence[] = [];
  for (const [index, name] of lines.entries()) {
    if (detailsHeader.test(name)) break;
    const strengthText = lines[index + 1] ?? '';
    if (!stackedName.test(name) || exclude.test(name) || genericName.test(name)
      || descriptiveName.test(name) || !stackedStrength.test(strengthText)) continue;
    stacked.push({ name, strengthText, line: name + '\n' + strengthText, lineIndex: index, labelled: false });
  }
  const found = evidence.find((x) => x.labelled) ?? evidence.find((x) => !!x.strengthText)
    ?? (stacked.length === 1 ? stacked[0] : undefined);
  if (!found) return [];
  const warnings = [
    'Gợi ý từ chữ in trên bao bì, KHÔNG xác minh thuốc bằng hình dạng/màu sắc. Hãy kiểm tra tên trên hộp thật.',
    'Bao bì không thay thế đơn của bác sĩ. Không suy ra liều, tần suất hoặc lịch uống.',
    'Hướng dẫn sử dụng được để trống; chỉ nhập từ nguồn bạn đã kiểm tra.',
  ];
  if (!found.strengthText) warnings.push('Chưa nhận rõ hàm lượng hoặc quy cách.');
  if (page.confidence !== null && page.confidence < 0.65) warnings.push('OCR độ tin cậy thấp; hãy chụp lại ảnh rõ hơn.');
  page.qualityWarnings.forEach((warning) => { if (warning.trim()) warnings.push(warning.trim()); });
  return [{
    id: 'package-' + page.pageIndex + '-' + found.lineIndex,
    pageIndex: page.pageIndex,
    input: { name: found.name, strengthText: found.strengthText, directionsText: '' },
    sourceText: found.line,
    sourceReference: 'Ảnh bao bì ' + (page.pageIndex + 1) + ', dòng ' + (found.lineIndex + 1),
    warnings,
  }];
}
export function parseMedicationPackageOcrPages(pages: readonly PrescriptionOcrPage[]): PrescriptionOcrCandidate[] {
  return pages.slice().sort((a, b) => a.pageIndex - b.pageIndex).flatMap(parseMedicationPackageOcrPage);
}
