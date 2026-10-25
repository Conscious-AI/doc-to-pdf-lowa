import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('server runtime resolves patched dependency versions', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(lock.packages['node_modules/next'].version, '15.5.28');
  assert.equal(lock.packages['node_modules/react'].version, '19.1.10');
  assert.equal(lock.packages['node_modules/react-dom'].version, '19.1.10');
  assert.equal(lock.packages['node_modules/sharp'].version, '0.35.5');
});

test('server image optimization remains disabled', async () => {
  const { default: config } = await import('../next.config.js');
  assert.equal(config.images.unoptimized, true);
});
