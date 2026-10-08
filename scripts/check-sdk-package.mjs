import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sdkDirectory = new URL('../packages/browser-print-sdk/', import.meta.url);
const sdk = JSON.parse(readFileSync(new URL('package.json', sdkDirectory), 'utf8'));
const extension = JSON.parse(readFileSync(new URL('../apps/extension/package.json', import.meta.url), 'utf8'));
assert.equal(sdk.version, extension.version, 'SDK and extension versions must match');
if (process.argv[2]) {
  assert.equal(process.argv[2], `v${sdk.version}`, 'Release tag must match SDK and extension versions');
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const [packed] = JSON.parse(execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: sdkDirectory,
  encoding: 'utf8',
}));
const files = new Set(packed.files.map(({ path }) => path));
for (const entry of Object.values(sdk.exports)) {
  for (const path of Object.values(entry)) {
    assert(files.has(path.replace(/^\.\//, '')), `Missing exported file: ${path}`);
  }
}
assert(files.has('README.md'), 'SDK tarball must include README.md');
for (const path of files) {
  if (/\.d\.(?:ts|cts|mts)$/.test(path)) {
    const declaration = readFileSync(new URL(path, sdkDirectory), 'utf8');
    assert(!declaration.includes('@xdev/shared-types') && !declaration.includes('@xdev/core'),
      `Declaration references an unpublished workspace package: ${path}`);
  }
}
for (const dependency of Object.values({ ...sdk.dependencies, ...sdk.optionalDependencies, ...sdk.peerDependencies })) {
  assert(!dependency.startsWith('workspace:'), 'Published dependencies must not use workspace ranges');
}
// SDK_VERSION is sent to the extension in the handshake; a stale value misreports the client version.
const bundle = readFileSync(new URL('dist/index.js', sdkDirectory), 'utf8');
assert(bundle.includes(`'${sdk.version}'`) || bundle.includes(`"${sdk.version}"`),
  `dist/index.js does not contain SDK_VERSION ${sdk.version}`);
console.log(`SDK pack verified: ${packed.filename} (${files.size} files)`);
