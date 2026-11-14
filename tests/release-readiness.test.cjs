'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/index.template.html'),'utf8');
const release=fs.readFileSync(path.join(__dirname,'../.github/workflows/release-on-main.yml'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return source.slice(i,j)}
function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes});return {resolve,promise}}
test('automatic release runs on main rather than publishing from PR heads',()=>{
 assert.match(release,/push:\s*\n\s*branches:\s*\[main\]/);
 assert.match(release,/permissions:\s*\n\s*contents:\s*write/);
 assert.match(release,/\.\/scripts\/check-repository\.ps1/);
 assert.match(release,/gh release create \$tag/);
 assert.match(release,/--target \$env:GITHUB_SHA/);
 assert.match(release,/--generate-notes/);
 assert.match(release,/SHA256SUMS\.txt/);
 assert.match(release,/Tag \$tag already points to/);
 assert.doesNotMatch(release,/--force/);
});
test('zoom buttons respect the actual fit scale and can shrink below 50 percent',async()=>{
 const state={zoomMode:'fit-width',zoom:100,viewport:{scale:.37}};
 const ctx=vm.createContext({state,updateToolbar(){},scheduleAutosave(){},renderCurrentPage:async()=>{},Math});
 vm.runInContext(section('async function setNumericZoom(','async function zoomAroundPointer('),ctx);
 vm.runInContext(section('function currentZoomPercent()','function clearTextSelection()'),ctx);
 assert.equal(ctx.currentZoomPercent(),37);
 await ctx.setNumericZoom(ctx.currentZoomPercent()-25);
 assert.equal(state.zoom,20);assert.equal(state.zoomMode,'percent');
 assert.equal(ctx.currentZoomPercent(),20);
 await ctx.setNumericZoom(62);
 assert.equal(state.zoom,62);
 assert.match(source,/zoomOut\.addEventListener\('click',\(\)=>void setNumericZoom\(currentZoomPercent\(\)-25\)\)/);
 assert.match(source,/zoomIn\.addEventListener\('click',\(\)=>void setNumericZoom\(currentZoomPercent\(\)\+25\)\)/);
});
test('a superseded source change does not enter a false loading state',async()=>{
 class File{}
 const calls=[];
 const ctx=vm.createContext({File,beginSourceChange:async()=>null,setPhase:x=>calls.push(x),setStatus:x=>calls.push(x)});
 vm.runInContext(section('async function openPdf(file)','function showError('),ctx);
 await ctx.openPdf(new File());assert.deepEqual(calls,[]);
});
function importHarness(){
 class File{constructor(text,size=100){this.size=size;this.text=text}}
 const state={generation:5,sessionKey:'hash-A',file:{name:'A.pdf'},reviews:[{id:'current'}]};
 const calls={applied:0,saved:0,render:0,toasts:[],confirm:0};
 let ask=()=>Promise.resolve(true);
 const ctx=vm.createContext({File,MiB:1024*1024,state,JSON,AppConfirm:{ask:()=>{calls.confirm++;return ask()}},AppToast:{show:x=>calls.toasts.push(x)},setStatus(){},t:x=>x,fmt:(s,v)=>s.replace(/\{count\}/g,v.count),applySessionRecord:raw=>{calls.applied++;state.reviews=raw.reviews},renderCurrentPage:async()=>{calls.render++},scheduleAutosave:()=>{calls.saved++}});
 vm.runInContext(section('async function importSessionFile(file)','async function clearSavedSessionRecord()'),ctx);
 return {ctx,File,state,calls,setConfirm:f=>{ask=f}};
}
test('JSON import cannot overwrite a different PDF after file.text resolves',async()=>{
 const h=importHarness(),read=deferred(),file=new h.File(()=>read.promise);
 const load=h.ctx.importSessionFile(file);h.state.generation++;h.state.sessionKey='hash-B';h.state.file={name:'B.pdf'};
 read.resolve(JSON.stringify({pdf:{sha256:'hash-A'},reviews:[{id:'old'}]}));await load;
 assert.equal(h.calls.applied,0);assert.equal(h.calls.saved,0);assert.deepEqual(h.calls.toasts,[]);
});
test('JSON import confirmation cannot overwrite a changed source',async()=>{
 const h=importHarness(),wait=deferred();
 h.setConfirm(()=>wait.promise);
 const file=new h.File(async()=>JSON.stringify({pdf:{sha256:'hash-A'},reviews:[{id:'A'}]}));
 const load=h.ctx.importSessionFile(file);
 for(let i=0;i<6&&!h.calls.confirm;i++)await Promise.resolve();
 assert.equal(h.calls.confirm,1);
 h.state.generation++;h.state.sessionKey='hash-B';h.state.file={name:'B.pdf'};
 wait.resolve(true);await load;assert.equal(h.calls.applied,0);
});
test('malformed or oversized JSON import is rejected without replacing reviews',async()=>{
 const h=importHarness();
 await h.ctx.importSessionFile(new h.File(async()=>JSON.stringify({pdf:{sha256:'hash-A'}})));
 await h.ctx.importSessionFile(new h.File(async()=>{throw Error('must not read')},51*1024*1024));
 assert.equal(h.calls.applied,0);assert.deepEqual(h.state.reviews,[{id:'current'}]);assert.deepEqual(h.calls.toasts,['sessionImportFailed','sessionImportFailed']);
});
test('valid JSON import replaces the correct session and schedules persistence',async()=>{
 const h=importHarness(),file=new h.File(async()=>JSON.stringify({pdf:{sha256:'hash-A'},reviews:[{id:'new'}]}));
 await h.ctx.importSessionFile(file);
 assert.equal(h.calls.applied,1);assert.equal(h.calls.saved,1);assert.equal(h.calls.render,1);
 assert.deepEqual(h.state.reviews,[{id:'new'}]);
});
test('autosave marks only the newest revision as persisted',async()=>{
 const state={generation:1,file:{name:'A.pdf'},sessionKey:'hash',sessionPersistenceDisabled:false,sessionPersistenceError:false,saveRevision:0,savedRevision:-1,lastSavedAt:'',autosaveTimer:0};
 const pending=deferred(),record={id:'hash',savedAt:'today'};let puts=0;
 const ctx=vm.createContext({state,setTimeout:()=>1,clearTimeout(){},updateSessionStatus(){},buildSessionRecord:()=>record,idbPut:()=>{puts++;return puts===1?pending.promise:Promise.resolve(record)},AppToast:{show(){}},setStatus(){},t:x=>x});
 vm.runInContext(section('function scheduleAutosave()','async function restoreSavedSession()'),ctx);
 ctx.scheduleAutosave();const first=ctx.persistSession();ctx.scheduleAutosave();
 pending.resolve(record);await first;
 assert.equal(state.saveRevision,2);assert.equal(state.savedRevision,-1);assert.equal(state.lastSavedAt,'');
 await ctx.persistSession();assert.equal(state.savedRevision,2);assert.equal(state.lastSavedAt,'today');
});
test('imported anchors require four finite numbers and page numbers stay within PDF',()=>{
 const state={pageCount:4},ctx=vm.createContext({state,Date,crypto:{randomUUID:()=> 'id'},Number,Math});
 vm.runInContext(section('function normalizeReview(raw)','function buildSessionRecord()'),ctx);
 const item=ctx.normalizeReview({page:999,anchor:{rects:[[1,2,3,4],[1,2,NaN,4],[5,6]]}});
 assert.equal(item.page,4);assert.equal(item.anchor.rects.length,1);
});
