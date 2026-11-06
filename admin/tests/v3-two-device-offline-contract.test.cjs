'use strict';
/*
 * RUN-082 (mirror RUN-081): Two REAL V3 engine instances, REAL IndexedDB shadow adapters,
 * synthetic Firebase transports and fake-indexeddb browser stores.
 * NO network, Google login, Firestore project, credentials, personal UID or
 * actual iOS device. This is NOT evidence of two physical devices.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const core=require('../../v3-unified-preview/v3-sync-core.js');
const engine=require('../../v3-unified-preview/v3-sync-engine.js');
const shadowApi=require('../../v3-unified-preview/v3-sync-shadow.js');
const OWNER='synthetic_owner_01',OTHER='synthetic_other_02';
const TARGET='T12345',FIND='M12345';
const WORD='W_'+'c'.repeat(32);
const clone=x=>JSON.parse(JSON.stringify(x));
function service(){
  const documents=new Map();let online=true;
  return {
    setOnline(v){online=!!v;},
    all(uid){return [...(documents.get(uid)||new Map()).values()].map(clone);},
    async list(uid,limit){
      if(!online)throw Error('Synthetic list network offline');
      const result=this.all(uid);
      if(result.length>limit)throw Error('Synthetic remote history limit');
      return result;
    },
    async put(uid,event){
      if(!online)throw Error('Synthetic write network offline');
      if(event.uid!==uid||event.v!==3)throw Error('Cross-user event rejected');
      if(!documents.has(uid))documents.set(uid,new Map());
      const bucket=documents.get(uid);
      if(bucket.has(event.id)){
        assert.deepEqual(bucket.get(event.id),event,'Idempotent repeat changed payload');
      }else bucket.set(event.id,clone(event));
    }
  };
}
function browser(uid,deviceNo,remote){
  let activeUid=uid,seq=0,clock=1793000000000;
  const db=new IDBFactory();
  const opts={enableStagingWrites:true,indexedDB:db,core,
    activeUid:()=>activeUid,now:()=>++clock};
  const shadow=shadowApi.create(opts);
  const id='D_'+deviceNo.toString(16).padStart(32,'0');
  const client=engine.create({
    stagingOnly:true,uid,core,shadow,device:id,
    remote:{list:(u,cap)=>remote.list(u,cap),put:(u,event)=>remote.put(u,event)},
    activeUid:()=>activeUid,online:()=>true,
    random:()=>((deviceNo*100000)+ ++seq).toString(16).padStart(32,'0'),
    now:()=>++clock
  });
  return {client,shadow,setActive:newUid=>{activeUid=newUid;}};
}
test('Two simulated devices merge answers, favorites and M/P/H personal finds',async()=>{
  const remote=service(),a=browser(OWNER,1,remote),b=browser(OWNER,2,remote);
  await a.client.start();await b.client.start();
  await a.client.record('answer',TARGET,true);
  assert.equal((await a.client.view()).pending.length,1);
  await a.client.upload();
  assert.equal((await a.client.view()).pending.length,0);
  const bAfter=await b.client.refresh();
  assert.equal(bAfter.state.scores[TARGET].correct,1);
  await b.client.record('favorite_set',TARGET,true);
  await b.client.upload();
  await a.client.refresh();
  assert.equal((await a.client.view()).state.favorites[TARGET],true);
  for(const [target,topic] of [['M12345','study'],['P12345','practice'],['H12345','other']]){
    await a.client.record('collection_set',target,
      {list:'finds',added:true,topic,note:''});
  }
  assert.equal((await a.client.view()).pending.length,3);
  await a.client.upload();
  await b.client.refresh();
  const finds=(await b.client.view()).state.finds;
  for(const k of ['M12345','P12345','H12345'])assert.equal(finds[k].added,true);
  assert.equal(remote.all(OWNER).length,5);
});
test('13 offline answers survive failed upload, 12+1 batching and reconverge',async()=>{
  const remote=service(),a=browser(OWNER,3,remote),b=browser(OWNER,4,remote);
  await a.client.start();await b.client.start();
  remote.setOnline(false);
  for(let i=0;i<13;i++)await a.client.record('answer',TARGET,true);
  await assert.rejects(a.client.upload(),/offline/);
  const before=await a.client.view();
  assert.equal(before.pending.length,13);
  assert.equal(before.state.scores[TARGET].seen,13);
  assert.equal(remote.all(OWNER).length,0);
  remote.setOnline(true);
  const batch1=await a.client.upload();
  assert.equal(batch1.pending.length,1,
    'One upload is intentionally limited to 12 events');
  assert.equal(remote.all(OWNER).length,12);
  const batch2=await a.client.upload();
  assert.equal(batch2.pending.length,0);
  assert.equal(remote.all(OWNER).length,13);
  const refreshed=await b.client.refresh();
  assert.equal(refreshed.state.scores[TARGET].correct,13);
  assert.equal(refreshed.state.scores[TARGET].seen,13);
});
test('Separate owner namespaces cannot mix remote events or shadow snapshots',async()=>{
  const remote=service(),a=browser(OWNER,5,remote),b=browser(OTHER,6,remote);
  await a.client.start();await b.client.start();
  await a.client.record('answer',TARGET,true);await a.client.upload();
  assert.equal(remote.all(OWNER).length,1);
  assert.equal(remote.all(OTHER).length,0);
  const outsider=await b.client.refresh();
  assert.equal(Object.keys(outsider.state.scores).length,0);
  assert.equal((await b.client.view()).pending.length,0);
  a.setActive(OTHER);
  await assert.rejects(a.client.record('answer',TARGET,false),/account changed/i);
  await assert.rejects(a.client.view(),/account changed/i);
  assert.equal(remote.all(OTHER).length,0);
});
test('Remote read error leaves verified local shadow unchanged',async()=>{
  const remote=service(),a=browser(OWNER,7,remote);
  await a.client.start();
  await a.client.record('answer',TARGET,false);
  const previous=await a.client.view();
  remote.setOnline(false);
  await assert.rejects(a.client.refresh(),/offline/);
  const after=await a.client.view();
  assert.deepEqual(after.state,previous.state);
  assert.deepEqual(after.pending,previous.pending);
});
test('Conflicting translations on two devices fail closed without erasing own word',async()=>{
  const remote=service(),a=browser(OWNER,8,remote),b=browser(OWNER,9,remote);
  await a.client.start();await b.client.start();
  await a.client.record('word_upsert',WORD,{fi:'terve',ru:'здоровый',en:'healthy'});
  await a.client.upload();
  await b.client.record('word_upsert',WORD,{fi:'terve',ru:'другое',en:'healthy'});
  await b.client.upload();
  const saved=await a.client.view();
  await assert.rejects(a.client.refresh(),/Conflicting definitions/);
  const unchanged=await a.client.view();
  assert.deepEqual(unchanged.state.words,saved.state.words);
  assert.equal(unchanged.state.words[WORD].ru,'здоровый');
});
