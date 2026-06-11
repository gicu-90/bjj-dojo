// Ranged-download single members from the itch.io-hosted Universal Base Characters zip,
// without pulling the whole 122 MB archive. Zip central directory lives at the end of the
// file; S3/R2 presigned URLs support HTTP Range, so we fetch EOCD -> central dir -> member.
//
// Usage:
//   node itch-zip-fetch.mjs list                 # list zip members (name, size)
//   node itch-zip-fetch.mjs get <member> <out>   # extract one member to <out>
import { inflateRawSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ITCH_GAME = 'https://quaternius.itch.io/universal-base-characters';
const UPLOAD_ID = '15861669';
const CSRF = process.env.ITCH_CSRF;
const COOKIE = process.env.ITCH_COOKIE; // "itchio=..." session cookie

async function freshUrl() {
  const res = await fetch(`${ITCH_GAME}/file/${UPLOAD_ID}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: COOKIE },
    body: new URLSearchParams({ csrf_token: CSRF, source: 'game_download' }),
  });
  const j = await res.json();
  if (!j.url) throw new Error('no url: ' + JSON.stringify(j).slice(0, 300));
  return j.url;
}

async function ranged(start, end) { // inclusive byte range
  const url = await freshUrl(); // re-sign every call (60 s expiry)
  const res = await fetch(url, { headers: { range: `bytes=${start}-${end}` } });
  if (res.status !== 206 && res.status !== 200) throw new Error('range failed: ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function totalSize() { // presigned URL allows GET only — use a 1-byte range
  const url = await freshUrl();
  const res = await fetch(url, { headers: { range: 'bytes=0-0' } });
  const cr = res.headers.get('content-range'); // "bytes 0-0/127999999"
  if (!cr) throw new Error('no content-range, status ' + res.status);
  return Number(cr.split('/')[1]);
}

function parseCentralDirectory(buf, baseOffset) {
  const entries = [];
  let p = 0;
  while (p + 46 <= buf.length) {
    if (buf.readUInt32LE(p) !== 0x02014b50) { p++; continue; }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, compSize, uncompSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const size = await totalSize();
console.error(`zip total: ${size} bytes`);
// EOCD + central dir comfortably fit in the trailing 512 KB for a pack this size
const tailLen = Math.min(512 * 1024, size);
const tail = await ranged(size - tailLen, size - 1);
// find EOCD (0x06054b50) from the end
let eocd = -1;
for (let i = tail.length - 22; i >= 0; i--) {
  if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) throw new Error('EOCD not found in tail');
const cdSize = tail.readUInt32LE(eocd + 12);
const cdOffset = tail.readUInt32LE(eocd + 16);
const cdStartInTail = (size - tailLen) <= cdOffset ? cdOffset - (size - tailLen) : -1;
const cd = cdStartInTail >= 0
  ? tail.subarray(cdStartInTail, cdStartInTail + cdSize)
  : await ranged(cdOffset, cdOffset + cdSize - 1);
const entries = parseCentralDirectory(cd);

const cmd = process.argv[2];
if (cmd === 'list') {
  for (const e of entries) console.log(`${e.uncompSize}\t${e.compSize}\t${e.method}\t${e.name}`);
} else if (cmd === 'get') {
  const member = process.argv[3], out = process.argv[4];
  const e = entries.find(x => x.name === member);
  if (!e) throw new Error('member not found: ' + member);
  // local header is 30 bytes + name + extra (extra may differ from CD's) — fetch header first
  const lh = await ranged(e.localOffset, e.localOffset + 29);
  if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('bad local header');
  const lhNameLen = lh.readUInt16LE(26), lhExtraLen = lh.readUInt16LE(28);
  const dataStart = e.localOffset + 30 + lhNameLen + lhExtraLen;
  const raw = await ranged(dataStart, dataStart + e.compSize - 1);
  const data = e.method === 0 ? raw : inflateRawSync(raw);
  if (data.length !== e.uncompSize) throw new Error(`size mismatch ${data.length} != ${e.uncompSize}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
  console.log(`wrote ${out} (${data.length} bytes)`);
}
