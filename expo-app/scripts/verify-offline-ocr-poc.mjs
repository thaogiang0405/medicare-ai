import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorker } from 'tesseract.js';

if (process.platform !== 'win32') {
  throw new Error('POC tự động này tạo ảnh tổng hợp bằng Windows System.Drawing. Dùng poc.html để kiểm tra browser trên hệ điều hành khác.');
}

const languageDirectory = fileURLToPath(new URL('../public/ocr/lang/', import.meta.url));
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'medicare-offline-ocr-'));
const imagePath = join(temporaryDirectory, 'synthetic-vietnamese-prescription.png');
const statusEvents = new Set();
const powershellImagePath = imagePath.replace(/'/g, "''");

const createSyntheticImage = `
Add-Type -AssemblyName System.Drawing
$imagePath = '${powershellImagePath}'
$bitmap = New-Object System.Drawing.Bitmap 1400, 420
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $titleFont = New-Object System.Drawing.Font 'Arial', 54, ([System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font 'Arial', 44
  $brush = [System.Drawing.Brushes]::Black
  try {
    $graphics.DrawString('ĐƠN THUỐC TỔNG HỢP', $titleFont, $brush, 60, 30)
    $graphics.DrawString('Paracetamol 500 mg', $bodyFont, $brush, 60, 130)
    $graphics.DrawString('Uống sau ăn — cần kiểm tra', $bodyFont, $brush, 60, 220)
    $bitmap.Save($imagePath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $titleFont.Dispose()
    $bodyFont.Dispose()
  }
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}
`;

try {
  // The test image is synthetic and is deleted before the script exits.
  execFileSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    createSyntheticImage,
  ], { stdio: 'pipe' });

  const worker = await createWorker(['vie', 'eng'], 1, {
    langPath: languageDirectory,
    cacheMethod: 'none',
    logger: (event) => {
      if (typeof event.status === 'string') statusEvents.add(event.status);
    },
  });

  try {
    const { data } = await worker.recognize(imagePath);
    const normalized = data.text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const requiredText = ['paracetamol', '500', 'uong sau an'];
    const loadedLocally = [...statusEvents].some((status) => status.includes('language traineddata'));
    const loadedWasmCore = [...statusEvents].some((status) => status.includes('tesseract core'));
    if (requiredText.some((value) => !normalized.includes(value)) || !loadedLocally || !loadedWasmCore) {
      throw new Error('OCR cục bộ không nhận ra nội dung tổng hợp bắt buộc.');
    }

    console.log(JSON.stringify({
      passed: true,
      confidence: Math.round(data.confidence),
      loadedLocally,
      loadedWasmCore,
      textAssertions: requiredText,
    }));
  } finally {
    await worker.terminate();
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
