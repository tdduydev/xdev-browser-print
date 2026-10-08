// Uploads a release ZIP to the Chrome Web Store and submits it for review (CWS API V2).
// V1 (v1.1) support ends 2026-10-15, hence V2: https://developer.chrome.com/blog/cws-api-v2
// Credentials come only from environment variables (CI secrets); nothing is hardcoded.
// Success here means "submitted for review" — Google decides when it is published.
import { readFileSync } from 'node:fs';

const zipPath = process.argv[2];
const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID, CWS_EXTENSION_ID } = process.env;

if (!zipPath) {
  console.error('usage: node scripts/publish-cws.mjs <zip>');
  process.exit(1);
}
if (!CWS_CLIENT_ID || !CWS_CLIENT_SECRET || !CWS_REFRESH_TOKEN || !CWS_PUBLISHER_ID || !CWS_EXTENSION_ID) {
  // Missing credentials is a configuration state, not a failure of the release.
  console.log('publish-cws: Chrome Web Store secrets not configured — skipping upload.');
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

const token = await call(
  'https://oauth2.googleapis.com/token',
  {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CWS_CLIENT_ID, client_secret: CWS_CLIENT_SECRET, refresh_token: CWS_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  },
  'OAuth token',
);
const auth = { authorization: `Bearer ${token.access_token}` };
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
