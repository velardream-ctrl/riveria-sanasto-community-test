'use strict';
/*
 * RUN-048: TEST-only, synthetic data; no Firebase, user identity, HTTP,
 * actual consent, real patient info, or browser telemetry uploads.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const telemetry=require('../telemetry/telemetry-contract.cjs');
const agg=require('../telemetry/aggregate-contract.cjs');
const PROJECT=telemetry.PROJECT,nowUtc='2026-11-05T12:00:00Z';
function context(extra={}){return {project:PROJECT,nowUtc,
  allowedBuilds:['test-v3-rc1'],...extra};}
function event(extra={}){return {schemaVersion:1,code:'SYNC_UPLOAD_FAILED',
  module:'SYNC',severity:'warning',browser:'SAFARI',browserMajor:12,
  os:'IOS',build:'test-v3-rc1',network:'OFFLINE',
  occurredAt:'2026-11-05T11:00:00Z',...extra};}
function unsafe(fn){assert.throws(fn,/REJECT_UNSAFE_TELEMETRY/);}
test('accepts only preapproved error enum and exact schema',()=>{
  const result=telemetry.normalize(event(),context());
  assert.equal(result.code,'SYNC_UPLOAD_FAILED');
  assert.equal(Object.keys(result).length,10);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(result.module,'SYNC');
});
test('unknown arbitrary error is not forwarded or logged',()=>{
  unsafe(()=>telemetry.normalize(event({code:'ERROR_PRIVATE_PATIENT_RECORD'}),context()));
});
test('wrong code/module and forged severity rejected',()=>{
  unsafe(()=>telemetry.normalize(event({module:'AUTH'}),context()));
  unsafe(()=>telemetry.normalize(event({severity:'critical'}),context()));
  const e=event({code:'STORAGE_QUOTA_EXCEEDED',module:'STORAGE',severity:'critical'});
  assert.equal(telemetry.normalize(e,context()).severity,'critical');
});
test('extraneous PII fields rejected rather than copied',()=>{
  for(const [field,value] of [
    ['uid','secret_user'],['email','user@example.org'],
    ['name','Student Name'],['stack','Error at private filename'],
    ['errorMessage','private learner word'],['patientNotes','not real'],
    ['url','https://example.com/?token=secret'],
    ['answers',['private answer']],['userAgent','Mozilla/5.0 full'],
    ['deviceId','private-uuid']]){
    unsafe(()=>telemetry.normalize({...event(),[field]:value},context()));
  }
});
test('reject unknown build that could encode user identity',()=>{
  unsafe(()=>telemetry.normalize(event({build:'person_email_address'}),context()));
  unsafe(()=>telemetry.normalize(event(),context({allowedBuilds:[]})));
});
test('reject production project without touching user payload',()=>{
  unsafe(()=>telemetry.normalize(event(),context({project:'riveria-sanasto-community-test'})));
});
test('reject malformed or nested values',()=>{
  for(const x of [null,[],42,'x',event({browser:[]}),event({os:{value:'IOS'}}),
    event({network:'free text'}),event({browserMajor:12.5}),event({browserMajor:251}),
    event({browserMajor:-1})])unsafe(()=>telemetry.normalize(x,context()));
});
test('expired offline event older than seven days rejected',()=>{
  unsafe(()=>telemetry.normalize(event({occurredAt:'2026-10-27T11:00:00Z'}),context()));
});
test('future injected timestamp beyond five minutes rejected',()=>{
  unsafe(()=>telemetry.normalize(event({occurredAt:'2026-11-05T12:06:00Z'}),context()));
});
test('valid recent offline event preserved without content',()=>{
  const e=event({network:'OFFLINE',occurredAt:'2026-11-05T12:03:00Z'});
  assert.equal(telemetry.normalize(e,context()).network,'OFFLINE');
});
test('missing timestamp or forged clock rejected',()=>{
  unsafe(()=>telemetry.normalize(event({occurredAt:'yesterday'}),context()));
  unsafe(()=>telemetry.normalize(event(),context({nowUtc:'garbage'})));
});
test('client cannot provide custom keys even with identical total key count',()=>{
  const x=event();delete x.code;x.uid='private';
  unsafe(()=>telemetry.normalize(x,context()));
});
test('aggregation rejects invalid events atomically, no partial results',()=>{
  const x=[event(),event({privateWord:'synthetic only'})];
  assert.throws(()=>agg.aggregate(x,context()),/REJECT_UNSAFE_TELEMETRY/);
});
test('aggregation never manufactures active monitoring or verified health',()=>{
  const x=agg.aggregate([event()],context());
  assert.equal(x.monitoringActive,false);
  assert.equal(x.monitoringCoverageVerified,false);
  assert.equal(x.ingestionHeartbeatAt,null);
  assert.equal(x.aggregationHeartbeatAt,null);
  assert.equal(x.siteStatus,'unknown');
  assert.equal(x.updatedAt,null);
  assert.equal(x.active7d,null);
  assert.equal(x.criticalOpen,null);
  assert.equal(x.canPublishAdminMetrics,false);
});
test('single event and small groups cannot expose granular breakdowns',()=>{
  const x=agg.aggregate([event()],context());
  assert.equal(x.observedEventCount24h,null);
  assert.deepEqual(x.errorGroups,[]);
  assert.deepEqual(x.browserGroups,[]);
  assert.equal(x.syncFailures24h,null);
});
test('five same code reports produce coarse aggregate without individual profiles',()=>{
  const reports=Array.from({length:6},()=>event());
  const x=agg.aggregate(reports,context());
  assert.equal(x.observedEventCount24h,6);
  assert.deepEqual(x.errorGroups,[{code:'SYNC_UPLOAD_FAILED',count:6}]);
  assert.deepEqual(x.browserGroups,[{browser:'SAFARI',count:6}]);
  assert.equal(x.syncFailures24h,6);
  assert.equal(x.active7d,null);
  assert.equal(x.monitoringActive,false);
});
test('older records inside 7-day retention do not inflate 24-hour metrics',()=>{
  const events=[...Array.from({length:5},()=>event()),
    event({occurredAt:'2026-11-03T10:00:00Z'})];
  assert.equal(agg.aggregate(events,context()).observedEventCount24h,5);
});
test('future records allowed within skew do not count until observed',()=>{
  const evs=[...Array.from({length:5},()=>event()),
    event({occurredAt:'2026-11-05T12:04:00Z'})];
  assert.equal(agg.aggregate(evs,context()).observedEventCount24h,5);
});
test('oversized telemetry batch rejected before processing',()=>{
  assert.throws(()=>agg.aggregate(Array.from({length:agg.MAX_EVENTS+1},()=>event()),context()),
    /REJECT_UNSAFE_TELEMETRY_BATCH/);
});
test('output does not echo private details, arbitrary text or original event',()=>{
  const e=event();
  const x=agg.aggregate(Array.from({length:5},()=>e),context());
  const rendered=JSON.stringify(x);
  for(const text of ['private_uid','@example','patientNotes','answer',
    'userAgent','https://','token='])assert.equal(rendered.includes(text),false);
});
test('multiple approved errors aggregate without leaking cross product dimensions',()=>{
  const errors=[...Array.from({length:5},()=>event()),
    ...Array.from({length:5},()=>event({code:'STORAGE_QUOTA_EXCEEDED',
      module:'STORAGE',severity:'critical',browser:'CHROME',browserMajor:110,os:'ANDROID'}))];
  const x=agg.aggregate(errors,context());
  assert.equal(x.errorGroups.length,2);
  assert.ok(x.errorGroups.every(g=>Object.keys(g).join(',')==='code,count'));
  assert.ok(x.browserGroups.every(g=>Object.keys(g).join(',')==='browser,count'));
  assert.equal(x.criticalOpen,null,'Cannot infer server triage status from client events');
});
