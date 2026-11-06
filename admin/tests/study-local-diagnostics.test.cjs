'use strict';
/* RUN-074.1 TEST-only privacy-safe browser diagnostics. Node VM, no network/cloud. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../v3-unified-preview/study-diagnostics.js'),'utf8');
function harness(project='sanastoyhteiso-v3-development',pathname='/riveria-sanasto-community-test/v3-unified-preview/index.html'){
  const stored={};const listeners={};let writes=0;
  const browser={
    RS_FIREBASE_CONFIG:{projectId:project},location:{pathname},
    sessionStorage:{
      getItem:function(k){return stored[k]||null;},
      setItem:function(k,v){writes++;stored[k]=v;}
    },
    addEventListener:function(type,cb){(listeners[type]||(listeners[type]=[])).push(cb);}
  };
  vm.runInNewContext(source,browser,{timeout:1500});
  return {browser,api:browser.RS_V3_LOCAL_DIAGNOSTICS,stored,listeners,get writes(){return writes;}};
}
function trigger(h,name,details){for(const f of h.listeners[name]||[])f(details);}
test('only allowlisted error codes and minute stamps survive even when exception contains personal data',()=>{
  const h=harness();assert.ok(h.api);
  trigger(h,'error',{message:'patient: private note, password=secret',filename:'https://example.invalid/?token=private',stack:'UID secret'});
  const rows=Array.from(h.api.entries());
  assert.equal(rows.length,1);assert.equal(rows[0].code,'APP_RENDER_FAILED');
  assert.equal(rows[0].minute%60000,0);
  const serialized=JSON.stringify(h.stored);
  for(const phrase of ['patient','password','secret','token','example.invalid','UID'])assert.ok(!serialized.includes(phrase),phrase);
});
test('unhandled promise rejection records only code, never reason or stack',()=>{
  const h=harness();trigger(h,'unhandledrejection',{reason:new Error('confidential email')});
  assert.equal(h.api.entries()[0].code,'APP_RENDER_FAILED');
  assert.ok(!JSON.stringify(h.stored).includes('email'));
});
test('no automatic network or Firebase calls: unexpected/PII-bearing codes rejected',()=>{
  const h=harness();assert.equal(h.api.record('user@example.com'),false);
  assert.equal(h.api.record('UNLISTED_CODE'),false);
  assert.equal(h.api.record('__proto__'),false);
  assert.equal(h.writes,0);
  assert.equal(h.api.record('SYNC_QUEUE_STUCK'),true);assert.equal(h.api.entries().length,1);
  assert.equal(h.api.record('SYNC_QUEUE_STUCK'),false);
});
test('NEW-013: minute-rounded error codes must deduplicate even at second 49 of minute',()=>{
  const h=harness(),base=1800000000000;
  let tick=base+49000; // within the last half of a minute, deterministic
  h.browser.Date={now:function(){return tick;}};
  assert.equal(h.api.record('SYNC_QUEUE_STUCK'),true);
  tick+=1000;
  assert.equal(h.api.record('SYNC_QUEUE_STUCK'),false,
    'Immediate duplicate must not pass merely because minute bucket is >30 seconds old');
  assert.equal(h.api.entries().length,1);
  tick=base+61000; // a new rounded minute is allowed as a distinct diagnostic
  assert.equal(h.api.record('SYNC_QUEUE_STUCK'),true);
  assert.equal(h.api.entries().length,2);
  assert.equal(h.api.entries()[0].minute%60000,0);
});

test('wrong Firebase project or wrong page path cannot enable this isolated TEST journal',()=>{
  for(const h of [harness('riveria-sanasto-community-test'),harness('sanastoyhteiso-v3-development','/other-page/')]){
    assert.equal(h.api.allowedSite(),false);
    assert.equal(h.api.record('APP_RENDER_FAILED'),false);
    trigger(h,'error',{message:'secret'});
    assert.equal(h.writes,0);assert.equal(h.api.entries().length,0);
  }
});
test('storage is bounded, schema-valid and corrupt/private rows cannot leak into admin view',()=>{
  const h=harness();
  for(let i=0;i<55;i++)assert.equal(h.api.record(i%2?'SYNC_QUEUE_STUCK':'APP_RENDER_FAILED'),true);
  assert.equal(h.api.entries().length,30);
  const key=Object.keys(h.stored)[0],now=Math.floor(Date.now()/60000)*60000;
  h.stored[key]=JSON.stringify({v:1,items:[
    {code:'SYNC_QUEUE_STUCK',minute:now,uid:'private'},
    {code:'UNLISTED_CODE',minute:now},
    {code:'APP_RENDER_FAILED',minute:now-3*86400000},
    {code:'APP_RENDER_FAILED',minute:now}
  ]});
  assert.deepEqual(Array.from(h.api.entries()).map(e=>e.code),['APP_RENDER_FAILED']);
  h.stored[key]='invalid JSON with patient';assert.equal(h.api.entries().length,0);
});
test('diagnostics code is ES5 compatible and never collects or sends telemetry',()=>{
  assert.doesNotMatch(source,/=>|\?\.|\?\?|\b(?:const|let|class)\s+[A-Za-z_$]/);
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|indexedDB)\s*\(/);
  assert.ok(source.includes('sessionStorage'));
  assert.ok(!source.includes('event.message')||source.includes('Do not read or store'));
});
