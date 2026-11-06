'use strict';
/* RUN-049: synthetic-only queue contract, no user inputs or cloud writes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const queueModule=require('../telemetry/browser-queue.es5.js');
const policy=require('../telemetry/telemetry-contract.cjs');
const PROJECT=policy.PROJECT;
const build='test-v3-rc1';
const start=Date.parse('2026-11-05T10:00:00Z');
const env={browser:'SAFARI',browserMajor:12,os:'IOS',network:'OFFLINE'};
const codes=Object.keys(policy.CODE_POLICY);
function create(opts){return queueModule.create({project:PROJECT,testModeEnabled:true,build,...opts});}
test('browser queue code policy exactly matches server codes/modules/severity',()=>{
  assert.deepEqual(Object.keys(queueModule.CODES).sort(),codes.sort());
  for(const code of codes)assert.deepEqual(queueModule.CODES[code],policy.CODE_POLICY[code]);
});
test('queue is off by default; no auto initialization',()=>{
  const q=queueModule.create({project:PROJECT,build});
  assert.equal(q.startSession(),false);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start),false);
  assert.equal(q.size(),0);
});
test('wrong project disables queue even with testModeEnabled',()=>{
  const q=create({project:'riveria-sanasto-community-test'});
  assert.equal(q.startSession(),false);
  assert.equal(q.size(),0);
});
test('no authorization session means zero data accepted',()=>{
  const q=create();
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start),false);
  assert.equal(q.peek(start).events.length,0);
});
test('single approved code produces allowlisted payload only',()=>{
  const q=create();assert.equal(q.startSession(),true);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start),true);
  const b=q.peek(start);
  assert.equal(b.events.length,1);
  assert.equal(b.events[0].seq,1);
  assert.deepEqual(Object.keys(b.events[0].event).sort(),policy.KEYS.slice().sort());
  assert.deepEqual(policy.normalize(b.events[0].event,{project:PROJECT,
    nowUtc:new Date(start).toISOString(),allowedBuilds:[build]}),b.events[0].event);
});
test('arbitrary error text and PII are not accepted even as extra env fields',()=>{
  const q=create();q.startSession();
  for(const name of ['email','uid','stack','message','url','patientData','privateWord',
    'answer','deviceId','userAgent']){
    assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',{...env,[name]:'secret value'},start),false);
  }
  assert.equal(q.size(),0);
});
test('unknown code, browser, OS, network or major rejects without side effect',()=>{
  const q=create();q.startSession();
  for(const [code,e] of [
    ['UNKNOWN',{...env}],['SYNC_UPLOAD_FAILED',{...env,browser:'FREEFORM'}],
    ['SYNC_UPLOAD_FAILED',{...env,os:'PRIVATE'}],
    ['SYNC_UPLOAD_FAILED',{...env,network:'http://private'}],
    ['SYNC_UPLOAD_FAILED',{...env,browserMajor:-1}],
    ['SYNC_UPLOAD_FAILED',{...env,browserMajor:12.5}],
    ['SYNC_UPLOAD_FAILED',{...env,browserMajor:300}]
  ])assert.equal(q.enqueue(code,e,start),false);
  assert.equal(q.size(),0);
});
test('duplicate code within 30 seconds is suppressed',()=>{
  const q=create();q.startSession();
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start),true);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start+29999),false);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,start+30000),true);
  assert.equal(q.size(),2);
});
test('six events per minute limit persists after transport acknowledgment',()=>{
  const q=create();q.startSession();
  const sent=[];
  for(let i=0;i<6;i++){
    assert.equal(q.enqueue(codes[i],env,start),true);
    sent.push(i+1);
  }
  const batch=q.peek(start,20);
  assert.equal(q.ack(batch.generation,sent,true),true);
  assert.equal(q.size(),0);
  assert.equal(q.enqueue(codes[6],env,start),false);
  assert.equal(q.enqueue(codes[6],env,start+60000),true);
});
test('queue never exceeds 60 entries even if rates are under threshold',()=>{
  const q=create();q.startSession();
  for(let i=0;i<60;i++)
    assert.equal(q.enqueue(codes[i%codes.length],env,start+i*61000),true);
  assert.equal(q.size(),60);
  assert.equal(q.enqueue(codes[0],env,start+60*61000),false);
});
test('expire offline entries older than seven days',()=>{
  const q=create();q.startSession();q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  assert.equal(q.peek(start+8*86400000).events.length,0);
  assert.equal(q.size(),0);
});
test('clock rollback discards queue and locks session until reauthorized',()=>{
  const q=create();q.startSession();
  q.enqueue('SYNC_UPLOAD_FAILED',env,start+2000);
  assert.equal(q.peek(start).events.length,0);
  assert.equal(q.enqueue('SYNC_DOWNLOAD_FAILED',env,start+3000),false);
  assert.equal(q.size(),0);
  assert.equal(q.startSession(),true);
  assert.equal(q.enqueue('SYNC_DOWNLOAD_FAILED',env,start+4000),true);
});
test('invalid clock does not create event',()=>{
  const q=create();q.startSession();
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,NaN),false);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,Infinity),false);
  assert.equal(q.enqueue('SYNC_UPLOAD_FAILED',env,-1),false);
  assert.equal(q.size(),0);
});
test('readBatch returns copy; consumer cannot mutate internal payload',()=>{
  const q=create();q.startSession();q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  const b=q.peek(start);
  b.events[0].event.code='BROKEN';
  assert.equal(q.peek(start).events[0].event.code,'SYNC_UPLOAD_FAILED');
});
test('ack without actual delivery confirmation does nothing',()=>{
  const q=create();q.startSession();q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  const b=q.peek(start);
  assert.equal(q.ack(b.generation,[1],false),false);
  assert.equal(q.size(),1);
  assert.equal(q.ack(b.generation,[1],true),true);
  assert.equal(q.size(),0);
});
test('ack refuses duplicate, nonexistent or oversized identifiers atomically',()=>{
  const q=create();q.startSession();
  q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  const b=q.peek(start);
  for(const ids of [[1,1],[1,999],[0],[1.5],[],Array.from({length:21},()=>1)]){
    assert.equal(q.ack(b.generation,ids,true),false);
    assert.equal(q.size(),1);
  }
});
test('auth session switch clears queue and rejects earlier acknowledgements',()=>{
  const q=create();q.startSession();q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  const old=q.peek(start);
  assert.equal(q.startSession(),true);
  assert.equal(q.ack(old.generation,[1],true),false);
  assert.equal(q.size(),0);
});
test('explicit logout clears all data and forbids enqueue until reauthorized',()=>{
  const q=create();q.startSession();
  q.enqueue('SYNC_UPLOAD_FAILED',env,start);q.clearSession();
  assert.equal(q.size(),0);
  assert.equal(q.enqueue('SYNC_DOWNLOAD_FAILED',env,start+1),false);
});
test('disable is permanent for current instance even if caller starts again',()=>{
  const q=create();q.startSession();q.enqueue('SYNC_UPLOAD_FAILED',env,start);
  q.disable();assert.equal(q.size(),0);
  assert.equal(q.startSession(),false);
  assert.equal(q.enqueue('SYNC_DOWNLOAD_FAILED',env,start+1),false);
});
test('peek caps request to 20 and has no built-in transport',()=>{
  const q=create();q.startSession();
  for(let i=0;i<25;i++)q.enqueue(codes[i%codes.length],env,start+i*61000);
  assert.equal(q.peek(start+25*61000,200).events.length,10);
  assert.equal(q.peek(start+25*61000,20).events.length,20);
  assert.equal(typeof q.send,'undefined');
  assert.equal(typeof q.upload,'undefined');
});
test('ES5 source is isolated from pages, no network/local storage APIs',()=>{
  const text=fs.readFileSync(path.join(__dirname,'../telemetry/browser-queue.es5.js'),'utf8');
  const p=fs.readFileSync(path.join(__dirname,'../../v3-unified-preview/index.html'),'utf8');
  const a=fs.readFileSync(path.join(__dirname,'../../v3-unified-preview/admin/index.html'),'utf8');
  const sw=fs.readFileSync(path.join(__dirname,'../../v3-unified-preview/sw.js'),'utf8');
  assert.ok(!p.includes('browser-queue.es5.js')&&!a.includes('browser-queue.es5.js')&&
    !sw.includes('browser-queue.es5.js'));
  assert.doesNotMatch(text,/\b(?:const|let|class)\b|=>|\?\.|\?\?/);
  assert.doesNotMatch(text,/\b(?:fetch|XMLHttpRequest|localStorage|indexedDB|sendBeacon)\s*[.(]/);
});
test('ES5 browser VM can execute without CommonJS, network or DOM',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../telemetry/browser-queue.es5.js'),'utf8');
  // Keep JS built-ins and config objects in ONE browser realm: injecting a
  // host Object constructor would incorrectly reject VM-local plain objects.
  const ctx={};
  vm.runInNewContext(source,ctx,{timeout:1500});
  assert.ok(ctx.RS_TEST_TELEMETRY_QUEUE);
  const answer=vm.runInNewContext(
    'var q=RS_TEST_TELEMETRY_QUEUE.create({project:"'+PROJECT+
    '",testModeEnabled:true,build:"'+build+
    '"});q.startSession()&&q.enqueue("SYNC_UPLOAD_FAILED",'+
    '{browser:"SAFARI",browserMajor:12,os:"IOS",network:"OFFLINE"},'+start+')',ctx);
  assert.equal(answer,true);
  assert.equal(vm.runInNewContext('q.peek('+start+').events.length',ctx),1);
});
