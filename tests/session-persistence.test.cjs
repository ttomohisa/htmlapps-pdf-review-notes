const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/index.template.html'), 'utf8');
function productionFunction(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const body = source.indexOf('{', start);
  let depth = 1, end = body + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(start, end);
}
function harness({ delayedOpen = false, confirmed = true } = {}) {
  const records = new Map();
  let resolveOpen, putTransactions = 0;
  const db = { transaction() { return { objectStore() { return {
    put(record) { putTransactions++; const request = {}; queueMicrotask(() => { records.set(record.id, record); request.onsuccess?.(); }); return request; },
    delete(id) { const request = {}; queueMicrotask(() => { records.delete(id); request.onsuccess?.(); }); return request; }
  }; } }; } };
  const pendingOpen = delayedOpen ? new Promise(resolve => { resolveOpen = () => resolve(db); }) : Promise.resolve(db);
  const state = { generation: 1, file: { name: 'synthetic.pdf' }, sessionKey: 'synthetic-hash', lastSavedAt: '', autosaveTimer: 0, sessionPersistenceDisabled: false };
  const context = vm.createContext({ state, records, setTimeout, clearTimeout, cancelReportExport() {}, els: { exportDialog: { open: false }, includePdf: {}, includeAreaImages: {} }, SESSION_STORE: 'reviewSessions', openSessionDb: () => pendingOpen,
    buildSessionRecord: () => ({ id: state.sessionKey, savedAt: 'now', reviews: [{ comment: 'synthetic secret' }] }),
    updateSessionStatus() {}, hideSelectionToolbar() {}, clearTextSelection() {}, async disposeDocument() {}, renderReviewList() {}, syncFilterUI() {}, updateAreaModeUI() {},
    t: key => key, AppToast: { show() {} }, setStatus() {}, AppConfirm: { ask: async () => confirmed } });
  for (const name of ['idbPut', 'idbDelete', 'scheduleAutosave', 'persistSession', 'clearSavedSessionRecord', 'beginSourceChange']) vm.runInContext(productionFunction(name), context);
  return { context, state, records, resolveOpen, putTransactions: () => putTransactions };
}
test('deleting saved reviews keeps visible notes out of later autosave and page-close persistence', async () => {
  const h = harness();
  await h.context.persistSession();
  assert.equal(h.records.has(h.state.sessionKey), true);
  await h.context.clearSavedSessionRecord();
  assert.equal(h.records.has(h.state.sessionKey), false);
  h.context.scheduleAutosave();
  await new Promise(resolve => setTimeout(resolve, 300));
  await h.context.persistSession();
  assert.equal(h.records.has(h.state.sessionKey), false);
});
test('cancelling saved-review deletion retains ordinary persistence', async () => {
  const h = harness({ confirmed: false });
  await h.context.clearSavedSessionRecord();
  await h.context.persistSession();
  assert.equal(h.records.has(h.state.sessionKey), true);
});
test('a pending database open cannot write a deleted session after a new source begins', async () => {
  const h = harness({ delayedOpen: true });
  const write = h.context.persistSession();
  const deletion = h.context.clearSavedSessionRecord();
  await Promise.resolve();
  await h.context.beginSourceChange();
  h.state.sessionKey = 'new-source-hash';
  h.state.sessionPersistenceDisabled = false;
  h.resolveOpen();
  await Promise.all([write, deletion]);
  assert.equal(h.putTransactions(), 0);
  assert.equal(h.records.has('synthetic-hash'), false);
});
test('opening a new source resumes ordinary autosave after a saved-review deletion', async () => {
  const h = harness();
  await h.context.clearSavedSessionRecord();
  await h.context.beginSourceChange();
  h.state.file = { name: 'new.pdf' };
  h.state.sessionKey = 'new-source-hash';
  await h.context.persistSession();
  assert.equal(h.records.has('new-source-hash'), true);
});
