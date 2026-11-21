import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

const publicRoot = resolve(process.cwd(), 'public');
const port = Number(process.env.PORT ?? '4173');
const mimeTypes = {
  '.gz': 'application/gzip',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
};

createServer((request, response) => {
  let rawPath;
  try {
    rawPath = decodeURIComponent(request.url?.split('?')[0] ?? '/');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Invalid path');
    return;
  }
  const requestedPath = rawPath === '/' ? '/ocr/poc.html' : rawPath;
  const filePath = resolve(publicRoot, `.${requestedPath.startsWith('/') ? requestedPath : `/${requestedPath}`}`);
  const pathFromRoot = relative(publicRoot, filePath);

  if (
    pathFromRoot === ''
    || pathFromRoot === '..'
    || pathFromRoot.startsWith(`..${sep}`)
    || isAbsolute(pathFromRoot)
    || !existsSync(filePath)
    || statSync(filePath).isDirectory()
  ) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Offline OCR POC: http://127.0.0.1:${port}/ocr/poc.html`);
});
