import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const exportDirectory = resolve(process.argv[2] ?? 'dist');
const bundleExtensions = new Set(['.js', '.bundle', '.hbc']);
const forbiddenSignatures = [
  '@grpc/grpc-js',
  'grpc_connection',
  'getAuthContext',
];

async function collectBundles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectBundles(path));
    } else if (entry.isFile() && bundleExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const bundles = await collectBundles(exportDirectory);
if (bundles.length === 0) {
  throw new Error(`No Expo JavaScript bundles found in ${exportDirectory}`);
}

const findings = [];
for (const bundle of bundles) {
  const source = await readFile(bundle, 'utf8');
  for (const signature of forbiddenSignatures) {
    if (source.includes(signature)) {
      findings.push({ bundle, signature });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`Node-only Firestore transport signature "${finding.signature}" found in ${finding.bundle}`);
  }
  throw new Error('The Expo React Native bundle includes a Node-only Firestore gRPC transport signature.');
}

console.log(
  `PASS: checked ${bundles.length} Expo React Native JavaScript bundle(s); ` +
  'no Node-only Firestore gRPC transport signatures were found.',
);
