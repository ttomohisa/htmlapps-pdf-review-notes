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
test('mobile PDF toolbar aligns page/zoom and fit/area in two rows',()=>{
 assert.match(rule('.viewer-toolbar'),/grid-template-rows:\s*44px\s+44px/);
 assert.match(rule('.viewer-controls'),/display:\s*contents/);
 assert.match(rule('.viewer-controls>.mode-switch'),/grid-row:\s*2/);
 assert.match(rule('.viewer-controls>.zoom-stepper'),/grid-row:\s*1/);
 assert.match(rule('.area-toolbar-group'),/grid-row:\s*2/);
 assert.match(rule('.page-toolbar-group'),/grid-row:\s*1/);
 assert.match(rule('.mode-switch .mode-button .mode-label-mobile'),/display:\s*inline/);
 assert.match(rule('.zoom-stepper .zoom-value-button'),/min-width:\s*54px/);
});
test('empty review navigation hides on phone',()=>{
 assert.match(rule('.review-navigation.is-empty'),/display:\s*none/);
 assert.match(source,/classList\.toggle\('is-empty',reviews\.length===0\)/);
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

test('area review toggle preserves its SVG icon and pressed semantics',()=>{
 assert.match(source,/id="areaReviewModeButton"[^>]*<svg class="area-action-icon"/);
 assert.match(source,/areaModeButton\.querySelector\('span\[data-i18n\]'\)/);
 assert.match(source,/areaModeButton\.setAttribute\('aria-pressed',state\.areaMode\?'true':'false'\)/);
 assert.doesNotMatch(source,/areaModeButton\.textContent=state\.areaMode/);
});
