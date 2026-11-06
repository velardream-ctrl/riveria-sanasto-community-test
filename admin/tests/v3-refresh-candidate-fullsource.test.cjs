'use strict';
/*
 * RUN-085 NEW-009: real full TEST source + in-memory candidate (NO SOURCE WRITE).
 * This file MUST NOT be interpreted as a fixed release. The independent
 * mandatory v3-refresh-failclosed.test.cjs still tests the actual unpatched
 * repository file and MUST be green before any release/merge.
 *
 * No production/TEST Firebase, credentials, network, personal data, deploy,
 * disk mutation of v3-sync-release.js, or user-browser storage.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../v3-unified-preview/v3-sync-release.js'),'utf8');
const marker='w.RS_V3_RELEASE={';
const start=' function refresh(){\n';
const end=' function capture(){\n';
const begin=source.indexOf(start);
const finish=source.indexOf(end,begin);
assert.ok(begin>0&&finish>begin,'Could not identify exact refresh/capture boundaries');
assert.equal(source.indexOf(start,begin+start.length),-1,'Multiple refresh functions are forbidden');
assert.equal(source.split(marker).length,2,'Exactly one public release entrypoint required');
const actual=source.slice(begin,finish);
const OLD=` function refresh(){
   if(!active())return Promise.resolve(false);
   return orderly(function(){
     return engine.upload().catch(function(){return null;}).then(function(){
       return engine.refresh();
     }).then(function(r){
       row=r;
       return r;
     });
   }).then(function(r){
     // Do not overwrite UI changes that have not been captured or persisted.
     if(queued===0)apply(r);
     text('Данные V3 сверены с облаком.',false);return true;
   }).catch(function(e){text('Сверка V3 не выполнена: '+e.message,true);return false;});
 }
`;
const CANDIDATE=` function refresh(){
   if(!active())return Promise.resolve(false);
   var owner=uid,token=epoch;
   var job=orderly(function(){
     // A failed upload must never be reinterpreted as cloud success.
     return engine.upload().then(function(){
       return engine.refresh();
     }).then(function(r){
       if(!r||!r.state||!Array.isArray(r.pending))
         throw Error('Invalid V3 refresh result');
       if(r.pending.length)
         throw Error('Unsent V3 changes remain in IndexedDB');
       return r;
     });
   });
   // Wait for THIS operation's queue cleanup before applying cloud data.
   // If a new write appears meanwhile, do not overwrite the newer local UI.
   var settled=queue;
   return job.then(function(r){
     return settled.then(function(){
       if(token!==epoch||uid!==owner||!active())
         throw Error('V3 account changed during refresh');
       if(queued!==0)throw Error('New changes queued during refresh');
       if(!apply(r))throw Error('V3 cloud state not applied locally');
       text('Данные V3 сверены с облаком.',false);
       return true;
     });
   }).catch(function(e){
     text('Сверка V3 не выполнена: '+String(e.message||e),true);
     return false;
   });
 }
`;
const sourceIsOld=actual.includes('engine.upload().catch(function(){return null;})');
if(sourceIsOld)assert.equal(actual,OLD,'Old source drift: review manually; do not auto-patch');
else{
  assert.ok(actual.includes('Unsent V3 changes remain in IndexedDB'),
    'Unknown source: not an approved or tested NEW-009 fix');
  assert.ok(!actual.includes('engine.upload().catch(function(){return null;})'),
    'Source still swallows failed uploads');
}
const compiledSource=sourceIsOld?
  source.slice(0,begin)+CANDIDATE+source.slice(finish):source;
const label=sourceIsOld?'CANDIDATE_IN_MEMORY_ONLY':'ACTUAL_SOURCE_RECHECK';
function fixture(params={}){
  let writes=0;
  const owner='synthetic-owner-001';
  const state={scores:{},words:{},favorites:{},scope:{value:'all',updatedAt:1}};
  const w={
    RS_FAMILY:{
      uid:owner,
      getState:()=>state,
      putState:()=>{writes++;return !params.storageFull;}
    },
    RS_V3_DIFF:{project:v=>v}
  };
  const d={readyState:'loading',addEventListener:()=>{},getElementById:()=>null};
  const hook="w.__V3_TEST_ONLY__={setEngine:function(e,owner){"+
    "uid=owner;ready=true;engine=e;row={pending:[],state:{}};"+
    "auth={currentUser:{uid:owner,emailVerified:true}};},"+
    "switchAccount:function(next){uid=next;epoch++;auth.currentUser.uid=next;},"+
    "enqueue:function(){return orderly(function(){return Promise.resolve();});},"+
    "tip:function(){return tip;},pendingJobs:function(){return queued;}};\n";
  vm.runInNewContext(compiledSource.replace(marker,hook+marker),
    {window:w,document:d},{filename:'v3-sync-release.js [VM PREVIEW ONLY]',timeout:2000});
  const engine={
    upload(){
      return params.uploadError?Promise.reject(Error('synthetic offline')):
        Promise.resolve({pending:[]});
    },
    refresh(){
      if(params.switchOwner)w.__V3_TEST_ONLY__.switchAccount('synthetic-other-owner');
      if(params.concurrentWrite)w.__V3_TEST_ONLY__.enqueue();
      if(params.readError)return Promise.reject(Error('synthetic remote failure'));
      return Promise.resolve({
        pending:params.pending||[],
        state:params.corruptState?null:{
          scores:{syntheticTerm:{seen:1,correct:1,wrong:0}},
          words:{},favorites:{}
        }
      });
    }
  };
  w.__V3_TEST_ONLY__.setEngine(engine,owner);
  return {
    release:w.RS_V3_RELEASE,
    tip:()=>w.__V3_TEST_ONLY__.tip(),
    writes:()=>writes,
    queued:()=>w.__V3_TEST_ONLY__.pendingJobs()
  };
}
test('preflight: full source is parsed, protected file unchanged, preview mode explicit',()=>{
  new vm.Script(compiledSource);
  assert.ok(label==='CANDIDATE_IN_MEMORY_ONLY'||label==='ACTUAL_SOURCE_RECHECK');
  if(sourceIsOld)assert.notEqual(compiledSource,source);
  // An in-memory test cannot make the actual checked-out file safe.
  assert.equal(fs.readFileSync(path.resolve(__dirname,'../../v3-unified-preview/v3-sync-release.js'),'utf8'),source);
});
test('failed upload never claims successful cloud reconciliation',async()=>{
  const f=fixture({uploadError:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
  assert.doesNotMatch(f.tip(),/Данные V3 сверены с облаком/);
});
test('nonempty IndexedDB pending queue blocks cloud confirmation',async()=>{
  const f=fixture({pending:[{id:'synthetic-pending'}]});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
});
test('successful roundtrip applies state only after queue cleanup',async()=>{
  const f=fixture();
  assert.equal(await f.release.refresh(),true);
  assert.equal(f.queued(),0);
  assert.equal(f.writes(),1);
  assert.match(f.tip(),/Данные V3 сверены с облаком/);
});
test('full local storage refuses sync confirmation',async()=>{
  const f=fixture({storageFull:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),1);
  assert.doesNotMatch(f.tip(),/Данные V3 сверены с облаком/);
});
test('malformed cloud snapshot is rejected without local writes',async()=>{
  const f=fixture({corruptState:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
});
test('cloud read rejection is not interpreted as successful sync',async()=>{
  const f=fixture({readError:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
});
test('account change during cloud refresh cannot apply old user data',async()=>{
  const f=fixture({switchOwner:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
});
test('concurrent queued local event prevents stale cloud overwrite',async()=>{
  const f=fixture({concurrentWrite:true});
  assert.equal(await f.release.refresh(),false);
  assert.equal(f.writes(),0);
});
test('warning: in-memory preview is NOT release acceptance',()=>{
  assert.equal(sourceIsOld?actual===OLD:true,true);
  console.log('RUN-085 '+label+': mandatory real-source sync gate is independent; no deploy');
});
