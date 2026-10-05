const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
function normalize(html) {
 const match=html.match(/const BUILD_MANIFEST=(\{[^\n]+\});/),assets=html.match(/const assetBundle=(\{[^\n]+\});/);
 assert.ok(match,'generated build manifest exists');assert.ok(assets,'generated assets exist');
 const manifest=JSON.parse(match[1]),bundle=JSON.parse(assets[1]);
 assert.equal(typeof manifest.generatedAtUtc,'string');assert.ok(!Number.isNaN(Date.parse(manifest.generatedAtUtc)));
 let manifestText=match[1],bundleText=assets[1];
 const dependencies=manifest.dependencies;
 assert.equal(new Set(dependencies.map(d=>d.id)).size,dependencies.length,'unique manifest dependencies');
 assert.deepEqual(dependencies.map(d=>d.id).sort(),Object.keys(bundle.dependencies).sort(),'matching dependency identities');
 for(const [id,dependency] of Object.entries(bundle.dependencies)){
  const metadata=dependencies.find(d=>d.id===id);
  assert.equal(dependency.package,metadata.package);assert.equal(dependency.version,metadata.version);
  assert.equal(new Set(metadata.assets.map(a=>a.key)).size,metadata.assets.length,'unique manifest assets');
  assert.deepEqual(metadata.assets.map(a=>a.key).sort(),Object.keys(dependency.assets).sort(),'matching asset identities');
  for(const [key,asset] of Object.entries(dependency.assets)){
   const entry=metadata.assets.find(a=>a.key===key);
   assert.equal(asset.mime,entry.mime);assert.equal(asset.compression,entry.compression);
   if(asset.compression!=='gzip')continue;
   const bytes=Buffer.from(asset.base64,'base64');
   assert.equal(bytes.toString('base64'),asset.base64,'embedded asset must use canonical Base64');
   assert.equal(bytes.length,asset.storedBytes,'bundle storedBytes');assert.equal(bytes.length,entry.storedBytes,'manifest storedBytes');
   assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>=0,'valid decoded byte length');
   assert.equal(asset.originalBytes,entry.bytes,'matching decoded byte lengths');
   // Current builder: fixed gzip envelope, with only the existing OS marker variation.
   assert.ok(bytes.length>=18,'complete gzip member');
   assert.deepEqual(bytes.subarray(0,9),Buffer.from([31,139,8,0,0,0,0,0,0]),'fixed gzip header');
   // zlib/zlib-ng use OS_CODE 10 on current Windows; older .NET used 0.
   assert.ok([0,3,10,255].includes(bytes[9]),`recognized gzip OS marker: ${bytes[9]}`);
   const body=bytes.subarray(10,-8),decoded=zlib.inflateRawSync(body,{info:true,maxOutputLength:Math.max(1,entry.bytes)});
   assert.equal(decoded.engine.bytesWritten,body.length,'one complete deflate stream without padding or extra members');
   const raw=decoded.buffer;
   assert.equal(raw.length,entry.bytes,'decoded byte length');
   assert.deepEqual(zlib.gunzipSync(bytes,{maxOutputLength:Math.max(1,entry.bytes)}),raw,'valid CRC and ISIZE trailer');
   assert.equal(require('node:crypto').createHash('sha256').update(raw).digest('hex'),entry.sha256,'decoded SHA-256');
   // .NET versions/platforms may encode identical bytes differently. Normalize only
   // these verified encodings and their stored lengths; all other bytes stay exact.
   const canonical=zlib.gzipSync(raw,{level:6});canonical[9]=255;
   const originalAsset=JSON.stringify(asset),originalEntry=JSON.stringify(entry);
   assert.ok(bundleText.includes(originalAsset));assert.ok(manifestText.includes(originalEntry));
   bundleText=bundleText.replace(originalAsset,JSON.stringify({...asset,storedBytes:canonical.length,base64:canonical.toString('base64')}));
   manifestText=manifestText.replace(originalEntry,JSON.stringify({...entry,storedBytes:canonical.length}));
  }
 }
 manifestText=manifestText.replace(/"generatedAtUtc":"[^"]+"/,'"generatedAtUtc":"<build-time>"');
 return html.replace(match[1],manifestText).replace(assets[1],bundleText);
}
test('root download matches the fresh readable release',()=>{const actual=normalize(read('pdf-review-notes.html')),expected=normalize(read('dist/index.html'));const firstDifference=Array.from(actual).findIndex((c,i)=>c!==expected[i]);assert.ok(actual===expected,`pdf-review-notes.html is stale at character ${firstDifference}; rebuild and commit the root download`);});
test('self-extract release restores exact readable bytes',()=>{const match=read('dist/index.self-extract.html').match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);assert.ok(match);assert.deepEqual(zlib.gunzipSync(Buffer.from(match[1],'base64')),fs.readFileSync(path.join(root,'dist/index.html')));});
test('release normalization still rejects stale runtime, config and assets',()=>{const html=read('dist/index.html'),normalized=normalize(html);assert.equal(normalize(html.replace(/"generatedAtUtc":"[^"]+"/,'"generatedAtUtc":"2000-01-01T00:00:00Z"')),normalized);for(const [before,after] of [['generation:0','generation:99'],['"slug":"pdf-review-notes"','"slug":"wrong-app"'],['const assetBundle={','const assetBundle={"stale":true,']]){assert.ok(html.includes(before));assert.notEqual(normalize(html.replace(before,after)),normalized);}});
test('gzip OS metadata differs between Windows and Unix without changing asset bytes',()=>{const html=read('dist/index.html'),match=html.match(/const assetBundle=(\{[^\n]+\});/),bundle=JSON.parse(match[1]);for(const dependency of Object.values(bundle.dependencies))for(const asset of Object.values(dependency.assets)){if(asset.compression==='gzip'){const bytes=Buffer.from(asset.base64,'base64'),raw=zlib.gunzipSync(bytes);bytes[9]=bytes[9]===0?3:0;assert.deepEqual(zlib.gunzipSync(bytes),raw);asset.base64=bytes.toString('base64');}}const otherOS=html.replace(match[1],JSON.stringify(bundle));assert.ok(normalize(otherOS)===normalize(html),'only the gzip OS marker may differ across platforms');});
test('invalid base64 cannot be normalized into a working root download',()=>{const html=read('dist/index.html'),bundle=JSON.parse(html.match(/const assetBundle=(\{[^\n]+\});/)[1]),asset=Object.values(Object.values(bundle.dependencies)[0].assets)[0],invalid=asset.base64.slice(0,40)+'@'+asset.base64.slice(40);assert.throws(()=>normalize(html.replace(asset.base64,invalid)),/canonical Base64/);});
test('gzip header, compressed payload and trailer mutations remain detectable',()=>{const html=read('dist/index.html'),bundle=JSON.parse(html.match(/const assetBundle=(\{[^\n]+\});/)[1]),asset=Object.values(Object.values(bundle.dependencies)[0].assets)[0],original=Buffer.from(asset.base64,'base64');for(const offset of [4,20,original.length-1]){const changed=Buffer.from(original);changed[offset]^=1;assert.throws(()=>normalize(html.replace(asset.base64,changed.toString('base64'))),`corruption at byte ${offset} must be rejected`);}});
const gzipFixture=JSON.parse(read('tests/fixtures/gzip-runtime-encodings.json'));
function fixtureHtml(encoding=gzipFixture.encodings[0]){
 const manifest={schemaVersion:2,generatedAtUtc:'2026-10-05T00:00:00Z',dependencies:[{id:'synthetic',package:'synthetic',version:'1.0.0',assets:[{key:'main',path:'main.js',mime:'text/javascript',compression:'gzip',bytes:gzipFixture.originalBytes,storedBytes:encoding.storedBytes,sha256:gzipFixture.sha256}]}]};
 const bundle={dependencies:{synthetic:{package:'synthetic',version:'1.0.0',assets:{main:{mime:'text/javascript',compression:'gzip',originalBytes:gzipFixture.originalBytes,storedBytes:encoding.storedBytes,base64:encoding.base64}}}}};
 return `const APP_CONFIG={"slug":"fixture"};\nconst BUILD_MANIFEST=${JSON.stringify(manifest)};\nconst assetBundle=${JSON.stringify(bundle)};\nconst runtime='unchanged';`;
}
function mutateFixture(change){const html=fixtureHtml(),m=html.match(/const BUILD_MANIFEST=(\{[^\n]+\});/),b=html.match(/const assetBundle=(\{[^\n]+\});/),manifest=JSON.parse(m[1]),bundle=JSON.parse(b[1]);change(bundle.dependencies.synthetic.assets.main,manifest.dependencies[0].assets[0],bundle,manifest);return html.replace(m[1],JSON.stringify(manifest)).replace(b[1],JSON.stringify(bundle))}
test('frozen .NET and Node gzip encodings preserve identical complete decoded content',()=>{assert.notEqual(gzipFixture.encodings[0].base64,gzipFixture.encodings[1].base64);assert.notEqual(gzipFixture.encodings[0].storedBytes,gzipFixture.encodings[1].storedBytes);assert.equal(normalize(fixtureHtml(gzipFixture.encodings[0])),normalize(fixtureHtml(gzipFixture.encodings[1])))});
test('all fixed gzip header bytes, truncated streams and corrupt trailers are rejected',()=>{const original=Buffer.from(gzipFixture.encodings[0].base64,'base64');for(const offset of [0,1,2,3,4,5,6,7,8,20,original.length-8,original.length-1]){const b=Buffer.from(original);b[offset]^=1;assert.throws(()=>normalize(mutateFixture(a=>{a.base64=b.toString('base64')})),`byte ${offset}`)}assert.throws(()=>normalize(mutateFixture((a,m)=>{const b=original.subarray(0,-4);a.base64=b.toString('base64');a.storedBytes=m.storedBytes=b.length}))) });
test('trailing padding and additional gzip members cannot hide inside valid decoded content',()=>{for(const extra of [Buffer.from([0]),zlib.gzipSync(Buffer.alloc(0)),zlib.gzipSync(Buffer.from('extra'))])assert.throws(()=>normalize(mutateFixture((a,m)=>{const b=Buffer.concat([Buffer.from(a.base64,'base64'),extra]);a.base64=b.toString('base64');a.storedBytes=m.storedBytes=b.length}))) });
test('false compressed lengths, decoded lengths, hashes and mismatched identities are rejected',()=>{for(const change of [(a)=>a.storedBytes++,(a,m)=>m.storedBytes++,(a)=>a.originalBytes++,(a,m)=>m.bytes++,(a,m)=>m.sha256='0'.repeat(64),(a,m)=>m.mime='text/plain',(a,m)=>m.compression='none',(a,m)=>m.key='other',(a,m,b)=>b.dependencies.synthetic.version='2.0.0',(a,m,b,mf)=>mf.dependencies[0].id='other'])assert.throws(()=>normalize(mutateFixture(change)))});
test('changed decoded asset bytes remain different even with internally consistent rewritten metadata',()=>{const changed=mutateFixture((a,m)=>{const raw=Buffer.from('different source bytes'),encoded=zlib.gzipSync(raw,{level:6});a.base64=encoded.toString('base64');a.originalBytes=m.bytes=raw.length;a.storedBytes=m.storedBytes=encoded.length;m.sha256=require('node:crypto').createHash('sha256').update(raw).digest('hex')});assert.notEqual(normalize(changed),normalize(fixtureHtml()));for(const change of [(a,m)=>m.path='other.js',(a,m,b,mf)=>mf.dependencies[0].package=b.dependencies.synthetic.package='other-package',(a,m,b)=>b.extra='unexpected'])assert.notEqual(normalize(mutateFixture(change)),normalize(fixtureHtml()))});
test('current Windows zlib and zlib-ng OS marker 10 is accepted without changing content',()=>{const html=mutateFixture(a=>{const b=Buffer.from(a.base64,'base64');b[9]=10;a.base64=b.toString('base64')});assert.equal(normalize(html),normalize(fixtureHtml()))});
