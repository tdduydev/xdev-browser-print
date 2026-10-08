// Uploads a release ZIP to the Chrome Web Store and submits it for review.
// Credentials come only from environment variables (CI secrets); nothing is hardcoded.
// Success here means "submitted for review" — Google decides when it is published.
import { readFileSync } from 'node:fs';

const zipPath = process.argv[2];
const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_EXTENSION_ID } = process.env;

if (!zipPath) {
  console.error('usage: node scripts/publish-cws.mjs <zip>');
  process.exit(1);
}
if (!CWS_CLIENT_ID || !CWS_CLIENT_SECRET || !CWS_REFRESH_TOKEN || !CWS_EXTENSION_ID) {
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
const auth = { authorization: `Bearer ${token.access_token}`, 'x-goog-api-version': '2' };

const upload = await call(
  `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}`,
  { method: 'PUT', headers: auth, body: readFileSync(zipPath) },
  'upload',
);
if (upload.uploadState !== 'SUCCESS') {
  console.error('publish-cws: upload not accepted', JSON.stringify(upload));
  process.exit(1);
}
console.log('publish-cws: upload accepted');

const publish = await call(
  `https://www.googleapis.com/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}/publish`,
  { method: 'POST', headers: { ...auth, 'content-length': '0' } },
  'publish',
);
console.log('publish-cws: submitted for review, status:', JSON.stringify(publish.status ?? publish));
