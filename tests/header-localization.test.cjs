const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.join(__dirname, '..');
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = source.indexOf('\n', start);
  return source.slice(start, end < 0 ? undefined : end);
}
function element(source, id) {
  const tag = source.match(new RegExp(`<[^>]*id="${id}"[^>]*>`));
  assert.ok(tag, `${id} exists`);
  const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  return { attrs, textContent: '', title: attrs.title || '', open: false, getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
}
for (const file of ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html', 'pdf-review-notes.html']) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.includes('self-extract')) {
    const payload = source.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
    assert.ok(payload, 'self-extract payload exists');
    source = zlib.gunzipSync(Buffer.from(payload[1], 'base64')).toString('utf8');
  }
  for (const [language, visible, label, help] of [['ja', 'EN', '英語に切り替え', 'ヘルプ'], ['en', 'JA', 'Switch to Japanese', 'Help']]) {
    test(`${file}: ${language} header uses target-language labels and localized accessibility`, () => {
      const languageButton = element(source, 'languageButton');
      const helpButton = element(source, 'helpButton');
      const badge = { textContent: '', getAttribute: () => 'localBadge' };
      const state = { phase: 'empty', reviews: [{ id: 'existing' }], file: { name: 'existing.pdf' } };
      const before = JSON.stringify(state);
      const document = { documentElement: {}, querySelectorAll: selector => ({ '[data-i18n]': [badge], '[data-i18n-title]': [helpButton], '[data-i18n-aria-label]': [helpButton] }[selector] || []) };
      const context = vm.createContext({ state, document, APP_CONFIG: { slug: 'pdf-review-notes' }, els: { language: languageButton, exportDialog: {} }, writeStorage() {}, updateFileMeta() {}, updateReviewDialogMode() {}, renderReviewList() {}, syncFilterUI() {}, updateToolbar() {}, updateAreaModeUI() {}, updateSessionStatus() {}, updateExportDialog() {} });
      const translations = source.slice(source.indexOf('const translations={'), source.indexOf('const $='));
      vm.runInContext(translations + '\nlet language;\nfunction t(k){return translations[language]?.[k]??translations.en[k]??k}\n' + functionSource(source, 'applyLanguage'), context);
      context.applyLanguage(language);
      assert.equal(languageButton.textContent, visible);
      assert.equal(languageButton.attrs['aria-label'], label);
      assert.equal(languageButton.title, label);
      assert.equal(helpButton.attrs['aria-label'], help);
      assert.equal(helpButton.title, help);
      assert.equal(badge.textContent, language === 'ja' ? '完全ローカル処理' : 'Fully local processing');
      assert.equal(JSON.stringify(state), before);
    });
  }
}
