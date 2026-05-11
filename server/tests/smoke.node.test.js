const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

test('admin setup does not contain a built-in master key fallback', () => {
  const adminRoutes = readRepoFile('server', 'routes', 'admin.js');

  assert.doesNotMatch(adminRoutes, /medisync-elite-2026/);
  assert.match(adminRoutes, /process\.env\.MASTER_KEY/);
});

test('docker compose only references build contexts that exist', () => {
  const compose = readRepoFile('docker-compose.yml');
  const contexts = [...compose.matchAll(/context:\s*(.+)/g)].map((match) => match[1].trim());

  assert.ok(contexts.length > 0);
  for (const context of contexts) {
    const absoluteContext = path.resolve(repoRoot, context);
    assert.ok(fs.existsSync(absoluteContext), `${context} should exist`);
    assert.ok(fs.existsSync(path.join(absoluteContext, 'Dockerfile')), `${context}/Dockerfile should exist`);
  }
});

test('frontend entrypoint uses the TypeScript app only', () => {
  assert.ok(fs.existsSync(path.join(repoRoot, 'client', 'src', 'App.tsx')));
  assert.equal(fs.existsSync(path.join(repoRoot, 'client', 'src', 'App.jsx')), false);
});
