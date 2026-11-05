'use strict';
/* RUN-066: TEST draft only. Node-only, no Firebase/network/users/IndexedDB.
 * The fingerprint is a stale-asset cache key, not a release signature.
 * The old iPad can retain cache-first JS indefinitely unless a changed
 * public asset forces a new service-worker CACHE_NAME.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../../v3-unified-preview');
const swSource=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const handlers={};
const sandbox={self:{addEventListener:function(type,fn){handlers[type]=fn;}}};
vm.runInNewContext(swSource,sandbox,{timeout:1000,filename:'sw.js'});
const urls=Array.from(sandbox.FILES);
function fileName(url){
  assert.ok(url==='./'||/^\.\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:js|css|html|png|webmanifest)(?:\?[a-z0-9._-]+)?$/.test(url),
    'Only safe, relative public shell asset paths are allowed: '+url);
  return url==='./'?'index.html':url.slice(2).split('?')[0];
}
function fingerprint(){
  // Reproduce Git blob IDs from actual file bytes including binary icons;
  // no git binary or external network is needed in CI.
  const unique=Array.from(new Set(urls.map(fileName))).sort();
  let record='';
  for(const p of unique){
    const bytes=fs.readFileSync(path.join(ROOT,p));
    const gitSha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    record+=p+'\0'+gitSha+'\n';
  }
  // 64-bit FNV-1a, used only as an accidental cache-drift detector.
  let hash=0xcbf29ce484222325n;
  for(const byte of Buffer.from(record,'utf8')){
    hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);
  }
  return hash.toString(16).padStart(16,'0');
}
function localAssets(htmlFile){
  const body=fs.readFileSync(path.join(ROOT,htmlFile),'utf8');
  const refs=[];
  for(const match of body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g))refs.push(match[1]);
  for(const match of body.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g))refs.push(match[1]);
  const base='https://example.invalid/v3-unified-preview/'+(htmlFile==='index.html'?'': 'admin/');
  const root='/v3-unified-preview/';
  return refs.filter(function(ref){return !/^https?:\/\//i.test(ref);}).map(function(ref){
    const u=new URL(ref,base);
    assert.ok(u.pathname.startsWith(root),'Asset URL must remain inside the V3 test shell: '+ref);
    return './'+u.pathname.slice(root.length)+u.search;
  });
}
test('all precached entries are safe and present (including both icon sizes)',function(){
  const unique=Array.from(new Set(urls.map(fileName)));
  assert.ok(unique.includes('index.html')&&unique.includes('data.js')&&unique.includes('family.js'));
  assert.ok(unique.includes('icon-192.png')&&unique.includes('icon-512.png'));
  assert.ok(unique.includes('v3-sync-core.js')&&unique.includes('v3-sync-release.js'));
  assert.equal(unique.length,31,'Review intentionally added/removed shell assets before updating the guard');
  for(const p of unique)assert.ok(fs.statSync(path.join(ROOT,p)).isFile(),'Missing public asset: '+p);
});
test('root AND admin HTML load only precached local JS/CSS with exact query versions',function(){
  const cached=new Set(urls);
  for(const file of ['index.html','admin/index.html']){
    const required=localAssets(file);
    assert.ok(required.length>3,'Missing HTML script/style references in '+file);
    for(const asset of required)assert.ok(cached.has(asset),'Stale/offline-missing '+file+' dependency: '+asset);
  }
});
test('cache namespace MUST change on every public source/image/HTML asset edit',function(){
  const expected='sanastoyhteiso-v3-unified-preview-assets-'+fingerprint();
  assert.equal(sandbox.CACHE_NAME,expected,
    'V3 offline assets changed: recompute cache fingerprint, update sw.js, rerun this test. Old iPad cache must not serve stale lessons.');
});
test('V3 offline SW is ES5-safe; does not cache cross-origin Google or private user data',function(){
  assert.doesNotMatch(swSource,/\?\.|\?\?|=>|\b(?:const|let|class)\b/);
  assert.ok(urls.every(function(s){return s.indexOf('https:')===-1&&s.indexOf('http:')===-1;}));
  assert.doesNotMatch(swSource,/indexedDB|localStorage|Authorization|Bearer /);
});
test('install precaches exactly shell assets; activate removes older V3 namespaces',async function(){
  const installed=[],deleted=[],claimed=[];
  const names=['unrelated-cache','sanastoyhteiso-v3-unified-preview-old',sandbox.CACHE_NAME];
  sandbox.caches={
    open:async function(name){assert.equal(name,sandbox.CACHE_NAME);return {addAll:async function(items){installed.push(...items);}};},
    keys:async function(){return names;},
    delete:async function(name){deleted.push(name);return true;}
  };
  sandbox.self.skipWaiting=async function(){claimed.push('skip');};
  sandbox.self.clients={claim:async function(){claimed.push('claim');}};
  let pending;
  handlers.install({waitUntil:function(p){pending=p;}});await pending;
  assert.deepEqual(Array.from(installed),urls);
  handlers.activate({waitUntil:function(p){pending=p;}});await pending;
  assert.deepEqual(deleted,['sanastoyhteiso-v3-unified-preview-old']);
  assert.deepEqual(claimed,['skip','claim']);
});
test('offline study navigation falls back to cached entry without a network request',async function(){
  const cachedPage={status:200,name:'cached educational entry'};
  sandbox.self.location={origin:'https://example.invalid'};
  sandbox.URL=URL;
  sandbox.fetch=async function(){throw new Error('offline');};
  sandbox.caches.match=async function(request){return request==='./index.html'?cachedPage:undefined;};
  let response;
  handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://example.invalid/v3-unified-preview/'},
    respondWith:function(p){response=p;}});
  assert.equal(await response,cachedPage);
  // The offline cached shell can display saved local lessons; cloud login/sync
  // and two-device acceptance still require a real browser/Firebase pilot.
});
