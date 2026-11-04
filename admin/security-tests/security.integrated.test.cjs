'use strict';
// Historical complete V3 TEST rules + additive NEW-003 contract. ONLY LOCAL EMULATOR.
// Автор проекта: Илья Дмитриев. No Firebase cloud, no deploy.
const {test,before,after}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc}=require('firebase/firestore');
const projectId='demo-sanastoyhteiso-integrated-20261104';
let env;
function user(uid,claim={}){return env.authenticatedContext(uid,claim).firestore();}
function pathDoc(db,...p){return doc(db,...p);}
const verified={email_verified:true,firebase:{sign_in_provider:'google.com'}};
const admin={...verified,admin:true};
function p(){return {alias:'Alpha',publicStats:false,learned:0,updatedAt:1730000000000};}
function settings(){return {scope:'mine',subscriptions:'',updatedAt:1730000000000};}
function lib(owner,visibility){return {ownerUid:owner,title:'Study cards',category:'Healthcare',visibility,revision:1,wordCount:0,updatedAt:1730000000000};}
function event(uid,eventId){return {v:3,uid,id:eventId,device:'D_'+'a'.repeat(32),kind:'answer',target:'T12345',time:1730000000000,data:{correct:true}};}
const evId='E_'+'b'.repeat(32);
before(async()=>{
  const rules=fs.readFileSync(path.join(__dirname,'fixtures/firestore.v3-development-plus-admin-metrics.rules'),'utf8');
  if(!rules.includes('TEST ONLY')||!rules.includes('match /admin_metrics/{metricId}'))
    throw Error('Do not use real Firebase rules in this test');
  env=await initializeTestEnvironment({projectId,firestore:{rules}});
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    await setDoc(pathDoc(db,'admin_metrics','current'),{siteStatus:'unknown'});
    await setDoc(pathDoc(db,'site_admin','summary'),{status:'legacy'});
    await setDoc(pathDoc(db,'users','alice'),p());
    await setDoc(pathDoc(db,'users','bob'),p());
    await setDoc(pathDoc(db,'settings','alice'),settings());
    await setDoc(pathDoc(db,'sync_v3','alice','events',evId),event('alice',evId));
    await setDoc(pathDoc(db,'libraries_v3','lib_public123'),lib('alice','public'));
    await setDoc(pathDoc(db,'libraries_v3','lib_private123'),lib('alice','private'));
  });
});
after(async()=>{if(env)await env.cleanup();});
test('admin_metrics current verified admin read succeeds',async()=>{const x=await assertSucceeds(getDoc(pathDoc(user('admin',admin),'admin_metrics','current')));if(!x.exists())throw Error('missing seeded metrics');});
test('admin_metrics cannot be read unauthenticated',async()=>{await assertFails(getDoc(pathDoc(env.unauthenticatedContext().firestore(),'admin_metrics','current')));});
test('admin_metrics cannot be read by normal student',async()=>{await assertFails(getDoc(pathDoc(user('alice',verified),'admin_metrics','current')));});
test('admin_metrics cannot be read by unverified admin',async()=>{await assertFails(getDoc(pathDoc(user('admin-unverified',{admin:true,email_verified:false,firebase:{sign_in_provider:'google.com'}}),'admin_metrics','current')));});
test('admin_metrics requires boolean admin claim',async()=>{await assertFails(getDoc(pathDoc(user('fake',{...verified,admin:'true'}),'admin_metrics','current')));});
test('admin_metrics rejects anonymous provider even if mock claim exists',async()=>{await assertFails(getDoc(pathDoc(user('anom',{...verified,admin:true,firebase:{sign_in_provider:'anonymous'}}),'admin_metrics','current')));});
test('admin_metrics rejects missing provider details',async()=>{await assertFails(getDoc(pathDoc(user('invalid',{email_verified:true,admin:true}),'admin_metrics','current')));});
test('admin cannot get other admin_metrics document',async()=>{await assertFails(getDoc(pathDoc(user('admin',admin),'admin_metrics','anything')));});
test('admin cannot list admin_metrics',async()=>{await assertFails(getDocs(collection(user('admin',admin),'admin_metrics')));});
test('admin cannot create admin_metrics',async()=>{await assertFails(setDoc(pathDoc(user('admin',admin),'admin_metrics','new'),{siteStatus:'ok'}));});
test('admin cannot update admin_metrics',async()=>{await assertFails(updateDoc(pathDoc(user('admin',admin),'admin_metrics','current'),{siteStatus:'ok'}));});
test('admin cannot delete admin_metrics',async()=>{await assertFails(deleteDoc(pathDoc(user('admin',admin),'admin_metrics','current')));});
test('existing site_admin still allows claimed verified admin read',async()=>{await assertSucceeds(getDoc(pathDoc(user('admin',admin),'site_admin','summary')));});
test('existing site_admin still denies student read',async()=>{await assertFails(getDoc(pathDoc(user('alice',verified),'site_admin','summary')));});
test('existing student owner reads own user profile',async()=>{await assertSucceeds(getDoc(pathDoc(user('alice',verified),'users','alice')));});
test('existing student cannot read other user profile',async()=>{await assertFails(getDoc(pathDoc(user('alice',verified),'users','bob')));});
test('existing student cannot list user profiles',async()=>{await assertFails(getDocs(collection(user('alice',verified),'users')));});
test('existing student still reads own settings',async()=>{await assertSucceeds(getDoc(pathDoc(user('alice',verified),'settings','alice')));});
test('existing student cannot read others settings',async()=>{await assertFails(getDoc(pathDoc(user('bob',verified),'settings','alice')));});
test('existing student can append valid sync event',async()=>{const id='E_'+'c'.repeat(32);await assertSucceeds(setDoc(pathDoc(user('alice',verified),'sync_v3','alice','events',id),event('alice',id)));});
test('existing student cannot append event to others UID',async()=>{const id='E_'+'d'.repeat(32);await assertFails(setDoc(pathDoc(user('bob',verified),'sync_v3','alice','events',id),event('alice',id)));});
test('existing student reads own sync event',async()=>{await assertSucceeds(getDoc(pathDoc(user('alice',verified),'sync_v3','alice','events',evId)));});
test('other student cannot read sync event',async()=>{await assertFails(getDoc(pathDoc(user('bob',verified),'sync_v3','alice','events',evId)));});
test('existing sync event cannot be deleted',async()=>{await assertFails(deleteDoc(pathDoc(user('alice',verified),'sync_v3','alice','events',evId)));});
test('student reads public library',async()=>{await assertSucceeds(getDoc(pathDoc(user('bob',verified),'libraries_v3','lib_public123')));});
test('student cannot read another private library',async()=>{await assertFails(getDoc(pathDoc(user('bob',verified),'libraries_v3','lib_private123')));});
test('owner reads own private library',async()=>{await assertSucceeds(getDoc(pathDoc(user('alice',verified),'libraries_v3','lib_private123')));});
test('unknown collection denied to admin',async()=>{await assertFails(getDoc(pathDoc(user('admin',admin),'secret','item')));});
