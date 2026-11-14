const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
function extract(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return source.slice(i,j)}
test('autosave failure offers a JSON backup, and later success clears the error',async()=>{
  const state={generation:1,sessionKey:'hash',file:{name:'a.pdf'},sessionPersistenceDisabled:false,lastSavedAt:'',sessionPersistenceError:false};
  const events=[],record={id:'hash',savedAt:'now'};let fail=true;
  const ctx=vm.createContext({state,buildSessionRecord:()=>record,idbPut:async()=>{if(fail)throw Error('quota');return record;},AppToast:{show:(message,options)=>events.push({message,options})},t:x=>x,setStatus:x=>events.push(x),updateSessionStatus:()=>events.push('status')});
  vm.runInContext(extract('async function persistSession()','async function restoreSavedSession()'),ctx);
  await ctx.persistSession();assert.equal(state.sessionPersistenceError,true);assert(events.some(x=>x.message==='sessionSaveFailed'&&x.options.actionLabel==='exportSession'));
  fail=false;await ctx.persistSession();assert.equal(state.sessionPersistenceError,false);assert.equal(state.lastSavedAt,'now');
});
test('rapid PDF source replacement skips stale resets and serializes disposal',async()=>{
  const state={generation:0,sourceChangeQueue:null,autosaveTimer:0};
  const els={exportDialog:{open:false},reviewDialog:{open:false},includePdf:{checked:true,disabled:false},includeAreaImages:{checked:true}};
  let resume,disposals=0;const held=new Promise(resolve=>{resume=resolve});
  const ctx=vm.createContext({state,els,AppToast:{hide(){}},cancelReportExport(){},hideSelectionToolbar(){},clearTextSelection(){},clearTimeout(){},disposeDocument:async()=>{disposals++;if(disposals===1)await held},renderReviewList(){},syncFilterUI(){},updateAreaModeUI(){},updateSessionStatus(){}});
  vm.runInContext(extract('async function beginSourceChange()','async function ensurePdfJs()'),ctx);
  const old=ctx.beginSourceChange();await Promise.resolve();await Promise.resolve();const fresh=ctx.beginSourceChange();resume();
  assert.equal(await old,null);assert.equal(await fresh,2);assert.equal(disposals,2);assert.equal(state.generation,2);
});
test('HTML compatibility options and embedding limit remain explicit',()=>{
  assert.match(source,/<input id="compressReport" type="checkbox">/);
  assert.match(source,/snapshot\.compressReport&&typeof CompressionStream/);
  assert.match(source,/state\.file\?\.size>64\*1024\*1024/);
});
test('viewer and area render canvas allocation limits remain present',()=>{
  assert.equal((source.match(/Math\.sqrt\(10000000\/Math\.max\(1,viewport\.width\*viewport\.height\)\)/g)||[]).length,2);
  assert.match(source,/Math\.sqrt\(10000000\/Math\.max\(1,baseViewport\.width\*baseViewport\.height\)\)/);
});

test('new PDF.js runs without external worker rendering or WASM downloads',()=>{
  assert.equal((source.match(/useWorkerFetch:false,useWasm:false,disableWorkerRendering:true/g)||[]).length,2);
});

test('oversized PDF remains excluded when export retries after a failure',()=>{
  assert.match(source,/if\(!busy&&state\.file\?\.size>64\*1024\*1024\)els\.includePdf\.disabled=true/);
});
