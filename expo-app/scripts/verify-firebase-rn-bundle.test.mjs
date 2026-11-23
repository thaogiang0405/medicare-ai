import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('./verify-firebase-rn-bundle.mjs', import.meta.url));

async function runVerifier(files) {
  const directory = await mkdtemp(join(tmpdir(), 'medicare-rn-bundle-test-'));
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const path = join(directory, relativePath);
      await mkdir(join(path, '..'), { recursive: true });
      await writeFile(path, contents);
    }
    return spawnSync(process.execPath, [verifier, directory], { encoding: 'utf8' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('accepts JS and Hermes bundles without Node-only transport signatures', async () => {
  const result = await runVerifier({
    'index.js': 'export const platform = "react-native";',
    'nested/index.hbc': 'hermes-bytecode-without-node-transport',
    'assets/icon.png': '@grpc/grpc-js',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checked 2 Expo React Native JavaScript bundle/);
});

test('fails closed when no JavaScript bundle was exported', async () => {
  const result = await runVerifier({ 'assets/icon.png': 'image' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No Expo JavaScript bundles found/);
});

for (const signature of ['@grpc/grpc-js', 'grpc_connection', 'getAuthContext']) {
  test(`rejects a bundle containing the Node-only signature: ${signature}`, async () => {
    const result = await runVerifier({ 'index.js': `const transport = "${signature}";` });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}
