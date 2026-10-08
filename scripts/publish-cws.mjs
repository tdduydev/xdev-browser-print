// Uploads a release ZIP to the Chrome Web Store and submits it for review (CWS API V2).
// V1 (v1.1) support ends 2026-10-15, hence V2: https://developer.chrome.com/blog/cws-api-v2
// CI passes a short-lived access token from Workload Identity Federation, so no long-lived credential exists.
// Success here means "submitted for review" — Google decides when it is published.
import { readFileSync } from 'node:fs';

const zipPath = process.argv[2];
const { CWS_ACCESS_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;

if (!zipPath) {
  console.error('usage: node scripts/publish-cws.mjs <zip>');
  process.exit(1);
}
if (!CWS_ACCESS_TOKEN || !CWS_PUBLISHER_ID || !CWS_EXTENSION_ID) {
  // Missing configuration is a setup state, not a failure of the release.
  console.log('publish-cws: Chrome Web Store not configured (CWS_SERVICE_ACCOUNT, CWS_PUBLISHER_ID, CWS_EXTENSION_ID) — skipping upload.');
  process.exit(0);
}

async function call(url, init, label) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`publish-cws: ${label} failed (HTTP ${res.status})`, JSON.stringify(body));
    process.exit(1);
  }
  return body;
}

const auth = { authorization: `Bearer ${CWS_ACCESS_TOKEN}` };
const item = `publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}`;
const api = 'https://chromewebstore.googleapis.com';

const upload = await call(
  `${api}/upload/v2/${item}:upload`,
  { method: 'POST', headers: { ...auth, 'content-type': 'application/zip' }, body: readFileSync(zipPath) },
  'upload',
);

// Large packages are processed asynchronously; publishing before processing ends would submit the old package.
let uploadState = upload.uploadState;
for (let attempt = 0; (uploadState === 'IN_PROGRESS' || uploadState === 'UPLOAD_IN_PROGRESS') && attempt < 30; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const status = await call(`${api}/v2/${item}:fetchStatus`, { headers: auth }, 'fetchStatus');
  uploadState = status.lastAsyncUploadState;
}
if (uploadState !== 'SUCCEEDED') {
  console.error('publish-cws: upload not accepted', JSON.stringify({ ...upload, uploadState }));
  process.exit(1);
}
console.log(`publish-cws: upload accepted (version ${upload.crxVersion})`);

const publish = await call(
  `${api}/v2/${item}:publish`,
  { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' },
  'publish',
);
console.log('publish-cws: submitted for review, state:', publish.state, publish.warningInfo ? JSON.stringify(publish.warningInfo) : '');
