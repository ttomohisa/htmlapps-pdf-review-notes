const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const mobile = css.slice(css.indexOf('@media(max-width:820px)'), css.indexOf('@media(max-width:430px)'));
function rule(selector) {
  return [...mobile.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, names]) => names.split(',').map(x => x.trim()).includes(selector)).map(([, , body]) => body).join('\n');
}
// Source contracts guard the geometry root cause. Actual English/JA layout,
// native Tab/zoom and input -> review -> export are checked in Chromium.
test('narrow viewer moves zoom/fit controls onto their own shrinkable row', () => {
  assert.match(rule('.viewer-toolbar'), /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s*;/);
  assert.match(rule('.viewer-controls'), /grid-column:\s*1\s*\/\s*-1\s*;/);
  assert.match(rule('.viewer-controls'), /grid-row:\s*2\s*;/);
  assert.match(rule('.viewer-controls'), /min-width:\s*0\s*;/);
  assert.match(rule('.area-toolbar-group'), /grid-column:\s*2\s*;/);
});
test('narrow zoom and fit groups can wrap without hiding later controls', () => {
  assert.match(rule('.viewer-controls'), /flex-wrap:\s*wrap\s*;/);
  assert.match(rule('.viewer-toolbar'), /position:\s*relative\s*;/);
  assert.match(rule('.viewer-toolbar'), /top:\s*auto\s*;/);
});
