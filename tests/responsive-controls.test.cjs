const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
test('narrow zoom and fit controls stay on a compact single row', () => {
  assert.match(rule('.viewer-controls'), /flex-wrap:\s*nowrap\s*;/);
  assert.match(rule('.mode-switch .mode-button span'), /display:\s*none\s*;?/);
  assert.match(rule('.zoom-stepper .zoom-value-button'), /min-width:\s*64px\s*;/);
  assert.match(rule('.viewer-toolbar'), /position:\s*relative\s*;/);
  assert.match(rule('.viewer-toolbar'), /top:\s*auto\s*;/);
});

test('an open modal locks the underlying document scroll', () => {
  assert.match(css, /html:has\(dialog\[open\]\)\s*\{[^}]*overflow:\s*hidden/);
});

test('mobile informational footer hides without removing PDF and Review destinations', () => {
  assert.match(rule('.app-footer'), /display:\s*none/);
  assert.match(rule('.mobile-tabs'), /display:\s*grid/);
  assert.match(rule('.main'), /padding:[^;]*84px/);
});

test('help content scrolls within the rounded dialog, also on mobile',()=>{
 assert.match(css,/#helpDialog\[open\]\{[^}]*display:flex;flex-direction:column;overflow:hidden/);
 assert.match(css,/#helpDialog \.dialog-body\{[^}]*flex:1 1 auto;min-height:0;overflow-y:auto/);
 assert.match(source,/class="dialog-body help-dialog-body"/);
 assert.match(rule('#helpDialog'),/margin:auto;/);
});
test('tapping only outside the help dialog rectangle dismisses it',()=>{
 const a=source.indexOf("els.helpDialog.addEventListener('click',event=>");
 const b=source.indexOf("els.helpDialog.addEventListener('cancel'",a);
 assert(a>=0&&b>a);
 let closeCount=0;const callbacks={},dialog={addEventListener:(k,f)=>{callbacks[k]=f},getBoundingClientRect:()=>({left:20,top:30,right:200,bottom:300}),close:()=>{closeCount++}};
 vm.runInNewContext(source.slice(a,b),{els:{helpDialog:dialog}});
 callbacks.click({target:{},clientX:10,clientY:10});
 callbacks.click({target:dialog,clientX:35,clientY:50});
 assert.equal(closeCount,0);
 callbacks.click({target:dialog,clientX:10,clientY:50});
 assert.equal(closeCount,1);
 callbacks.click({target:dialog,clientX:201,clientY:301});
 assert.equal(closeCount,2);
});
test('mobile viewer fit icons retain accessible Japanese/English labels',()=>{
 assert.match(source,/id="fitPageButton"[^>]*data-i18n-aria-label="fitPage"/);
 assert.match(source,/id="fitWidthButton"[^>]*data-i18n-aria-label="fitWidth"/);
});
