/**
 * Paths are intentionally relative to Expo's public root. In development,
 * Expo Go may serve them from the developer's Metro host; in an exported app
 * they are copied with the app. They never point to a third-party CDN.
 */
export const localOfflineOcrAssetPaths = Object.freeze({
  script: 'ocr/tesseract/tesseract.min.js',
  worker: 'ocr/tesseract/worker.min.js',
  coreDirectory: 'ocr/tesseract-core',
  languageDirectory: 'ocr/lang',
});

function normalizePublicBaseUrl(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim() ?? '';
  return trimmed ? `${trimmed.replace(/\/+$/, '')}/` : '/';
}

/**
 * Builds only application-local public URLs. The caller supplies
 * `EXPO_BASE_URL` from the DOM bundle; no hard-coded network origin exists.
 */
export function getLocalOfflineOcrAssetUrls(baseUrl?: string): Readonly<{
  script: string;
  worker: string;
  coreDirectory: string;
  languageDirectory: string;
}> {
  const base = normalizePublicBaseUrl(baseUrl);

  return {
    script: `${base}${localOfflineOcrAssetPaths.script}`,
    worker: `${base}${localOfflineOcrAssetPaths.worker}`,
    coreDirectory: `${base}${localOfflineOcrAssetPaths.coreDirectory}`,
    languageDirectory: `${base}${localOfflineOcrAssetPaths.languageDirectory}`,
  };
}

/** Useful for tests and audits: vendor paths must never encode an external origin. */
export function hasOnlyRelativeLocalOfflineOcrAssetPaths(): boolean {
  return Object.values(localOfflineOcrAssetPaths).every((path) => !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.startsWith('//'));
}
