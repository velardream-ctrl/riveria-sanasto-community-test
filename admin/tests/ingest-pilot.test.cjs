'use strict';
/* RUN-050: synthetic-only server ingestion simulation; NEVER real Firebase or patient data. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {create,PROJECT,MAX_BATCH,MAX_SESSION_EVENTS,MAX_SESSIONS}
  =require('../telemetry/ingest-pilot.cjs');
const date='2026-11-05T12:00:00Z';
const server={project:PROJECT,nowUtc:date,allowedBuilds:['test-v3-rc1']};
const handle='a'.repeat(32);
function ctx(extra={}){return {
  project:PROJECT,scope:'TEST_TELEMETRY_PILOT',serverIdentityVerified:true,
  emailVerified:true,sessionHandle:handle,currentGeneration:3,...extra};}
function event(extra={}){return {
  schemaVersion:1,code:'SYNC_UPLOAD_FAILED',module:'SYNC',severity:'warning',
  browser:'SAFARI',browserMajor:12,os:'IOS',build:'test-v3-rc1',
  network:'OFFLINE',occurredAt:'2026-11-05T11:58:00Z',...extra};}
function batch(ids=[1],alter={}){return {generation:3,
  events:ids.map(seq=>({seq,event:event(alter)}))};}
test('synthetic batch accepts only whitelist, never authorizes real ACK',()=>{
  const r=create().simulate(batch(),ctx(),server);
  assert.equal(r.accepted,true);assert.equal(r.acceptedCount,1);
  assert.deepEqual(r.simulatedAckSeqs,[1]);
  assert.equal(r.safeForClientAck,false);assert.equal(r.durableCommitVerified,false);
  assert.equal(r.backendConnected,false);assert.equal(r.productionReady,false);
});
test('identical replay is deduped without a second accepted event',()=>{
  const s=create();s.simulate(batch(),ctx(),server);
  const r=s.simulate(batch(),ctx(),server);
  assert.equal(r.accepted,true);assert.equal(r.acceptedCount,0);
  assert.equal(r.duplicateCount,1);
});
test('replayed sequence with different payload denied, never counts as accepted',()=>{
  const s=create();s.simulate(batch(),ctx(),server);
  const changed=s.simulate(batch([1],{network:'ONLINE'}),ctx(),server);
  assert.equal(changed.accepted,false);assert.equal(changed.reasonCode,'SEQUENCE_PAYLOAD_COLLISION');
  assert.equal(s.simulate(batch(),ctx(),server).duplicateCount,1);
});
test('unverified server context, anonymous and wrong project denied',()=>{
  for(const bad of [
    {serverIdentityVerified:false},{emailVerified:false},
    {project:'riveria-sanasto-community-test'},
    {scope:'PUBLIC'},{sessionHandle:'raw_uid@example.org'},
    {currentGeneration:0},{extraSecret:'patient_notes'}
  ]) {
    const s=create();const r=s.simulate(batch(),ctx(bad),server);
    assert.equal(r.accepted,false);
    assert.equal(r.simulatedAckSeqs.length,0);
  }
});
test('server metadata wrong project cannot authorize ingestion',()=>{
  const s=create();assert.equal(s.simulate(batch(),ctx(),{...server,project:'prod'}).accepted,false);
});
test('no events, too many events or stale generation are rejected',()=>{
  const s=create();
  for(const b of [{generation:3,events:[]},
    {generation:3,events:Array.from({length:MAX_BATCH+1},(_,i)=>({seq:i+1,event:event()}))},
    {generation:1,events:[{seq:1,event:event()}]}]){
    assert.equal(s.simulate(b,ctx(),server).accepted,false);
  }
});
test('one malicious record invalidates entire batch before state mutation',()=>{
  const s=create();
  const bad=batch([1,2]);bad.events[1].event.email='private@example.invalid';
  assert.equal(s.simulate(bad,ctx(),server).accepted,false);
  const good=s.simulate(batch([1,2]),ctx(),server);
  assert.equal(good.acceptedCount,2);
});
test('duplicate sequences inside same batch denied atomically',()=>{
  const s=create();
  const x=batch([1,1]);assert.equal(s.simulate(x,ctx(),server).accepted,false);
  assert.equal(s.simulate(batch([1]),ctx(),server).acceptedCount,1);
});
test('invalid sequence values reject prior to any state mutation',()=>{
  const s=create();
  for(const seq of [0,-1,1.5,1000000001,'1']){
    assert.equal(s.simulate({generation:3,events:[{seq,event:event()}]},ctx(),server).accepted,false);
  }
  assert.equal(s.simulate(batch([1]),ctx(),server).acceptedCount,1);
});
test('unknown fields on inner event wrapper rejected',()=>{
  const s=create();const b=batch();b.events[0].uid='sensitive';
  assert.equal(s.simulate(b,ctx(),server).accepted,false);
});
test('attempt to include raw error details or user text denied without echo',()=>{
  const s=create(),secret='patient private family details';
  const x=batch([1],{message:secret});
  const r=s.simulate(x,ctx(),server);
  assert.equal(r.accepted,false);assert.equal(JSON.stringify(r).includes(secret),false);
});
test('unknown code and forged severity fail-closed',()=>{
  const s=create();
  assert.equal(s.simulate(batch([1],{code:'SENSITIVE_FREE_TEXT'}),ctx(),server).accepted,false);
  assert.equal(s.simulate(batch([2],{severity:'critical'}),ctx(),server).accepted,false);
});
test('authenticated separate TEST session handles have independent replay state',()=>{
  const s=create();
  const a=s.simulate(batch(),ctx(),server);
  const b=s.simulate(batch(),ctx({sessionHandle:'b'.repeat(32)}),server);
  assert.equal(a.acceptedCount,1);assert.equal(b.acceptedCount,1);
});
test('trusted epoch change rejects stale session without clearing prior idempotency',()=>{
  const s=create();s.simulate(batch(),ctx(),server);
  const b={generation:4,events:[{seq:2,event:event()}]};
  const x=s.simulate(b,ctx({currentGeneration:4}),server);
  assert.equal(x.accepted,false);assert.equal(x.reasonCode,'SESSION_EPOCH_CHANGED');
  assert.equal(s.simulate(batch(),ctx(),server).duplicateCount,1);
});
test('explicit session invalidation discards state in simulator',()=>{
  const s=create();s.simulate(batch(),ctx(),server);
  assert.equal(s.invalidate(handle),true);
  assert.equal(s.simulate(batch(),ctx(),server).acceptedCount,1);
});
test('per-minute quota is enforced even if caller tries one more event',()=>{
  const s=create();
  assert.equal(s.simulate(batch(Array.from({length:10},(_,i)=>i+1)),ctx(),server).acceptedCount,10);
  const rejected=s.simulate(batch([11]),ctx(),server);
  assert.equal(rejected.accepted,false);assert.equal(rejected.reasonCode,'SESSION_RATE_LIMIT');
  const later={...server,nowUtc:'2026-11-05T12:01:01Z'};
  assert.equal(s.simulate(batch([11]),ctx(),later).acceptedCount,1);
});
test('quota denial is atomic for a mixed replay-plus-new batch',()=>{
  const s=create();
  s.simulate(batch([1,2,3,4,5,6,7,8,9,10]),ctx(),server);
  const mix=s.simulate(batch([1,11]),ctx(),server);
  assert.equal(mix.accepted,false);
  const later={...server,nowUtc:'2026-11-05T12:01:01Z'};
  assert.equal(s.simulate(batch([1,11]),ctx(),later).acceptedCount,1);
});
test('in-memory session event count is bounded',()=>{
  const s=create();
  for(let round=0;round<20;round++){
    const from=round*10+1;
    const t=new Date(Date.parse(date)+round*61000).toISOString();
    assert.equal(s.simulate(batch(Array.from({length:10},(_,i)=>from+i)),ctx(),
      {...server,nowUtc:t}).acceptedCount,10);
  }
  assert.equal(s.simulate(batch([MAX_SESSION_EVENTS+1]),ctx(),
    {...server,nowUtc:'2026-11-05T12:21:00Z'}).reasonCode,'SESSION_EVENT_LIMIT');
});
test('in-memory session handle count is bounded without eviction or leaking IDs',()=>{
  const s=create();
  for(let i=0;i<MAX_SESSIONS;i++){
    const sessionHandle=i.toString(16).padStart(32,'0');
    assert.equal(s.simulate(batch(),ctx({sessionHandle}),server).acceptedCount,1);
  }
  const r=s.simulate(batch(),ctx({sessionHandle:'f'.repeat(32)}),server);
  assert.equal(r.reasonCode,'SESSION_CAPACITY_LIMIT');
  assert.equal(JSON.stringify(r).includes('fffff'),false);
});
test('invalid session handle cannot be used for invalidation',()=>{
  const s=create();
  assert.equal(s.invalidate('uid@example.org'),false);
  assert.equal(s.invalidate(''),false);
});
test('old or future events rejected through RUN-048 privacy validator',()=>{
  const s=create();
  assert.equal(s.simulate(batch([1],{occurredAt:'2026-10-01T12:00:00Z'}),ctx(),server).accepted,false);
  assert.equal(s.simulate(batch([1],{occurredAt:'2026-11-05T12:06:00Z'}),ctx(),server).accepted,false);
});
test('no raw personal identifiers, event body, external URLs or credentials in output',()=>{
  const s=create();const r=s.simulate(batch(),ctx(),server);
  const serialized=JSON.stringify(r);
  for(const x of [handle,'test-v3-rc1','SYNC_UPLOAD_FAILED','https://','Bearer ',
    'user@example.org','private patient'])assert.equal(serialized.includes(x),false);
});
test('module explicitly has no Firebase/HTTP/credential/notification capability',()=>{
  const code=fs.readFileSync(path.join(__dirname,'../telemetry/ingest-pilot.cjs'),'utf8');
  assert.doesNotMatch(code,/\b(?:fetch|XMLHttpRequest|sendBeacon|writeBatch|setDoc|addDoc)\s*\(/);
  const s=create();assert.equal(typeof s.send,'undefined');
  assert.equal(typeof s.upload,'undefined');assert.equal(typeof s.writeFirestore,'undefined');
});
