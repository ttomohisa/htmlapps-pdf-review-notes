const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
function normalize(html) {
 const match=html.match(/const BUILD_MANIFEST=(\{[^\n]+\});/);
 assert.ok(match,'generated build manifest exists');
 const manifest=JSON.parse(match[1]);
 assert.equal(typeof manifest.generatedAtUtc,'string');
 assert.ok(!Number.isNaN(Date.parse(manifest.generatedAtUtc)));
 html=html.replace(match[1],match[1].replace(/"generatedAtUtc":"[^"]+"/,'"generatedAtUtc":"<build-time>"'));
 const assets=html.match(/const assetBundle=(\{[^\n]+\});/);
 assert.ok(assets,'generated assets exist');
 const bundle=JSON.parse(assets[1]);
 for(const dependency of Object.values(bundle.dependencies))for(const asset of Object.values(dependency.assets)){
  if(asset.compression!=='gzip')continue;
  const bytes=Buffer.from(asset.base64,'base64');
  assert.equal(bytes[0],0x1f);assert.equal(bytes[1],0x8b);assert.equal(bytes[2],8);
  // RFC 1952 OS byte: .NET writes Unix=3 on Linux and FAT=0 on Windows.
  // Keep every compressed data byte and all length/hash/config metadata exact.
  bytes[9]=255;
  html=html.replace(JSON.stringify(asset.base64),JSON.stringify(bytes.toString('base64')));
 }
 return html;
}
test('root download matches the fresh readable release',()=>{const actual=normalize(read('pdf-review-notes.html')),expected=normalize(read('dist/index.html'));const firstDifference=Array.from(actual).findIndex((c,i)=>c!==expected[i]);assert.ok(actual===expected,`pdf-review-notes.html is stale at character ${firstDifference}; rebuild and commit the root download`);});
test('self-extract release restores exact readable bytes',()=>{const match=read('dist/index.self-extract.html').match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);assert.ok(match);assert.deepEqual(zlib.gunzipSync(Buffer.from(match[1],'base64')),fs.readFileSync(path.join(root,'dist/index.html')));});
test('release normalization still rejects stale runtime, config and assets',()=>{const html=read('dist/index.html'),normalized=normalize(html);assert.equal(normalize(html.replace(/"generatedAtUtc":"[^"]+"/,'"generatedAtUtc":"2000-01-01T00:00:00Z"')),normalized);for(const [before,after] of [['generation:0','generation:99'],['"slug":"pdf-review-notes"','"slug":"wrong-app"'],['const assetBundle={','const assetBundle={"stale":true,']]){assert.ok(html.includes(before));assert.notEqual(normalize(html.replace(before,after)),normalized);}});
test('gzip OS metadata differs between Windows and Unix without changing asset bytes',()=>{const html=read('dist/index.html'),match=html.match(/const assetBundle=(\{[^\n]+\});/),bundle=JSON.parse(match[1]);for(const dependency of Object.values(bundle.dependencies))for(const asset of Object.values(dependency.assets)){if(asset.compression==='gzip'){const bytes=Buffer.from(asset.base64,'base64'),raw=zlib.gunzipSync(bytes);bytes[9]=bytes[9]===0?3:0;assert.deepEqual(zlib.gunzipSync(bytes),raw);asset.base64=bytes.toString('base64');}}const otherOS=html.replace(match[1],JSON.stringify(bundle));assert.ok(normalize(otherOS)===normalize(html),'only the gzip OS marker may differ across platforms');});
