import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../ui/pdf-upload.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../ui/pdf-upload.js', import.meta.url), 'utf8');
assert.match(html, /name="referrer" content="no-referrer"/);
assert.match(html, /default-src 'none'/);
assert.match(html, /script-src 'self'/);
assert.match(html, /connect-src 'self'/);
assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
assert.doesNotMatch(html + script, /localStorage|document\.cookie|analytics/i);
assert.match(script, /location\.hash/);
assert.match(script, /history\.replaceState/);
assert.match(script, /Authorization/);
assert.match(script, /XMLHttpRequest/);
assert.match(script, /upload\.onprogress/);
assert.match(script, /search/);
assert.doesNotMatch(script, /console\.|file\.name/);
console.log('pdf-upload-ui: PASS');
