'use strict';
// RUN-018 / NEW-003: local-only, user-copied TEST rules snapshot vs additive admin_metrics.
// Project author: Илья Дмитриев. Never connects to live Firebase or deploys.
const {before,after,test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,limit}=require('firebase/firestore');
let beforeEnv,afterEnv,findsEnv;
const verified={email_verified:true,firebase:{sign_in_provider:'google.com'}};
const admin={...verified,admin:true};
const eventId='E_'+'a'.repeat(32);
const pilotId='P_'+'b'.repeat(32);
const pilotDelete='P_'+'c'.repeat(32);
const libraryId='lib_public123';
function who(env,uid,claims=verified){return env.authenticatedContext(uid,claims).firestore();}
function d(db,...parts){return doc(db,...parts);}
function userProfile(alias){return {alias,publicStats:false,learned:0,updatedAt:1730000000000};}
function settingsData(){return {scope:'mine',subscriptions:'',updatedAt:1730000000000};}
function event(uid,id,kind='answer',data={correct:true},target='T12345'){return {v:3,uid,id,device:'D_'+'d'.repeat(32),kind,target,time:1730000000000,data};}
function pilot(uid,id){return {v:1,uid,id,device:'D_'+'d'.repeat(32),kind:'answer',target:'DEMO_CARD_A',time:1730000000000,correct:true,demo:true};}
function library(visibility){return {ownerUid:'alice',title:'Healthcare vocab',category:'Healthcare',visibility,revision:1,wordCount:0,updatedAt:1730000000000};}
async function seed(env){
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    await setDoc(d(db,'admin_metrics','current'),{health:'unknown',collectedAt:1730000000000});
    await setDoc(d(db,'site_admin','summary'),{health:'historical'});
    await setDoc(d(db,'users','alice'),userProfile('Alice'));
    await setDoc(d(db,'users','bob'),userProfile('Bobby'));
    await setDoc(d(db,'settings','alice'),settingsData());
    await setDoc(d(db,'sync_v3','alice','events',eventId),event('alice',eventId));
    await setDoc(d(db,'sync_demo_v3','alice','events',pilotId),pilot('alice',pilotId));
    await setDoc(d(db,'sync_demo_v3','alice','events',pilotDelete),pilot('alice',pilotDelete));
    await setDoc(d(db,'libraries_v3',libraryId),library('public'));
    await setDoc(d(db,'libraries_v3','lib_private123'),library('private'));
  });
}
before(async()=>{
  const fixtureDir=path.join(__dirname,'fixtures');
  const baseline=fs.readFileSync(path.join(fixtureDir,'firestore.user-supplied-20261105.baseline.rules'),'utf8');
  const additive=fs.readFileSync(path.join(__dirname,'candidates/FIRESTORE_V3_DEVELOPMENT_FULL_FOR_MANUAL_REVIEW.rules'),'utf8');
  const findsRules=fs.readFileSync(path.join(__dirname,'candidates/FIRESTORE_V3_DEVELOPMENT_NEW006_FINDS_TMPH_REVIEW_ONLY.rules'),'utf8');
  const oldFindsCondition="(request.resource.data.target.matches('^T[0-9]{5,7}$') ||";
  const newFindsCondition="(request.resource.data.target.matches('^[TMPH][0-9]{5,7}$') ||";
  if(additive.split(oldFindsCondition).length!==2||
      findsRules!==additive.replace(oldFindsCondition,newFindsCondition))
    throw Error('NEW-006 candidate must change only one owner-only My Finds allowlist');
  if(!baseline.includes("kind == 'collection_set'")||!baseline.includes('match /sync_demo_v3/')||
      baseline.includes('match /admin_metrics/'))throw Error('Unexpected baseline for supplied rules');
  if(!additive.includes('NEW-003: TEST only')||!additive.includes("sign_in_provider == 'google.com'"))
    throw Error('Not a safe isolated additive fixture');
  beforeEnv=await initializeTestEnvironment({
    projectId:'demo-sanastoyhteiso-owner-rules-before-018',firestore:{rules:baseline}
  });
  afterEnv=await initializeTestEnvironment({
    projectId:'demo-sanastoyhteiso-owner-rules-after-018',firestore:{rules:additive}
  });
  await seed(beforeEnv);
  await seed(afterEnv);
  findsEnv=await initializeTestEnvironment({
    projectId:'demo-sanastoyhteiso-owner-rules-new006-finds',firestore:{rules:findsRules}
  });
  await seed(findsEnv);
});
after(async()=>{
  if(beforeEnv)await beforeEnv.cleanup();
  if(afterEnv)await afterEnv.cleanup();
  if(findsEnv)await findsEnv.cleanup();
});
test('original supplied rules block admin_metrics/current even for verified admin',async()=>{
  await assertFails(getDoc(d(who(beforeEnv,'admin',admin),'admin_metrics','current')));
});
test('original supplied rules preserve historical site_admin get for verified admin',async()=>{
  await assertSucceeds(getDoc(d(who(beforeEnv,'admin',admin),'site_admin','summary')));
});
test('original supplied rules keep owner profile readable',async()=>{
  await assertSucceeds(getDoc(d(who(beforeEnv,'alice'),'users','alice')));
});
test('original supplied rules keep collection_set event create for owner',async()=>{
  const id='E_'+'e'.repeat(32);
  await assertSucceeds(setDoc(d(who(beforeEnv,'alice'),'sync_v3','alice','events',id),
    event('alice',id,'collection_set',{list:'finds',added:true,topic:'practice',note:'review'})));
});
test('patched rules allow only verified Google admin to get current',async()=>{
  const snap=await assertSucceeds(getDoc(d(who(afterEnv,'admin',admin),'admin_metrics','current')));
  if(!snap.exists())throw Error('Missing seeded metrics');
});
test('patched admin metrics: deny unauthenticated',async()=>{
  await assertFails(getDoc(d(afterEnv.unauthenticatedContext().firestore(),'admin_metrics','current')));
});
test('patched admin metrics: deny ordinary student',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'alice'),'admin_metrics','current')));
});
test('patched admin metrics: deny unverified admin',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bad',{admin:true,email_verified:false,firebase:{sign_in_provider:'google.com'}}),'admin_metrics','current')));
});
test('patched admin metrics: reject nonboolean admin claim',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bad',{...verified,admin:'true'}),'admin_metrics','current')));
});
test('patched admin metrics: reject anonymous sign-in provider',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bad',{...admin,firebase:{sign_in_provider:'anonymous'}}),'admin_metrics','current')));
});
test('patched admin metrics: reject custom sign-in provider',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bad',{...admin,firebase:{sign_in_provider:'custom'}}),'admin_metrics','current')));
});
test('patched admin metrics: reject password sign-in provider',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bad',{...admin,firebase:{sign_in_provider:'password'}}),'admin_metrics','current')));
});
test('patched admin metrics: no admin read of sibling document',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'admin',admin),'admin_metrics','other')));
});
test('patched admin metrics: cannot list collection',async()=>{
  await assertFails(getDocs(collection(who(afterEnv,'admin',admin),'admin_metrics')));
});
test('patched admin metrics: admin cannot create',async()=>{
  await assertFails(setDoc(d(who(afterEnv,'admin',admin),'admin_metrics','new'),{health:'ok'}));
});
test('patched admin metrics: admin cannot update',async()=>{
  await assertFails(updateDoc(d(who(afterEnv,'admin',admin),'admin_metrics','current'),{health:'ok'}));
});
test('patched admin metrics: admin cannot delete',async()=>{
  await assertFails(deleteDoc(d(who(afterEnv,'admin',admin),'admin_metrics','current')));
});
test('patched rules keep existing site_admin available to admin',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'admin',admin),'site_admin','summary')));
});
test('patched rules deny site_admin to student',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'alice'),'site_admin','summary')));
});
test('patched rules keep owner user private',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'alice'),'users','alice')));
  await assertFails(getDoc(d(who(afterEnv,'bob'),'users','alice')));
});
test('patched rules preserve owner settings get',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'alice'),'settings','alice')));
  await assertFails(getDoc(d(who(afterEnv,'bob'),'settings','alice')));
});
test('patched rules preserve sync_v3 owner event read',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'alice'),'sync_v3','alice','events',eventId)));
  await assertFails(getDoc(d(who(afterEnv,'bob'),'sync_v3','alice','events',eventId)));
});
test('patched rules preserve valid collection_set event create',async()=>{
  const id='E_'+'f'.repeat(32);
  await assertSucceeds(setDoc(d(who(afterEnv,'alice'),'sync_v3','alice','events',id),
    event('alice',id,'collection_set',{list:'finds',added:true,topic:'study',note:'A'})));
});
test('patched rules reject malformed collection_set payload',async()=>{
  const id='E_'+'1'.repeat(32);
  await assertFails(setDoc(d(who(afterEnv,'alice'),'sync_v3','alice','events',id),
    event('alice',id,'collection_set',{list:'finds',added:true,topic:'invalid',note:'A'})));
});
test('patched rules block student from other users sync_v3',async()=>{
  const id='E_'+'2'.repeat(32);
  await assertFails(setDoc(d(who(afterEnv,'bob'),'sync_v3','alice','events',id),
    event('alice',id,'collection_set',{list:'finds',added:true,topic:'study',note:'A'})));
});
test('patched rules preserve sync_v3 immutability',async()=>{
  await assertFails(deleteDoc(d(who(afterEnv,'alice'),'sync_v3','alice','events',eventId)));
});
test('patched rules preserve pilot sync_demo GET for owner',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'alice'),'sync_demo_v3','alice','events',pilotId)));
});
test('patched rules deny pilot sync_demo GET for another user',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bob'),'sync_demo_v3','alice','events',pilotId)));
});
test('patched rules preserve limited pilot sync_demo list',async()=>{
  await assertSucceeds(getDocs(query(collection(who(afterEnv,'alice'),'sync_demo_v3','alice','events'),limit(10))));
});
test('patched rules deny unbounded pilot sync_demo list',async()=>{
  await assertFails(getDocs(collection(who(afterEnv,'alice'),'sync_demo_v3','alice','events')));
});
test('patched rules deny pilot sync_demo list for another user',async()=>{
  await assertFails(getDocs(query(collection(who(afterEnv,'bob'),'sync_demo_v3','alice','events'),limit(10))));
});
test('patched rules preserve pilot sync_demo create for owner',async()=>{
  const id='P_'+'3'.repeat(32);
  await assertSucceeds(setDoc(d(who(afterEnv,'alice'),'sync_demo_v3','alice','events',id),pilot('alice',id)));
});
test('patched rules deny cross-user pilot create',async()=>{
  const id='P_'+'4'.repeat(32);
  await assertFails(setDoc(d(who(afterEnv,'bob'),'sync_demo_v3','alice','events',id),pilot('alice',id)));
});
test('patched rules preserve owner-only deletion of pilot demo',async()=>{
  await assertFails(deleteDoc(d(who(afterEnv,'bob'),'sync_demo_v3','alice','events',pilotDelete)));
  await assertSucceeds(deleteDoc(d(who(afterEnv,'alice'),'sync_demo_v3','alice','events',pilotDelete)));
});
test('patched rules keep public library readable',async()=>{
  await assertSucceeds(getDoc(d(who(afterEnv,'bob'),'libraries_v3',libraryId)));
});
test('patched rules keep private library unreadable by other user',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'bob'),'libraries_v3','lib_private123')));
});
test('patched rules preserve library subscription create for owner',async()=>{
  await assertSucceeds(setDoc(d(who(afterEnv,'alice'),'library_subscriptions_v3','alice','items',libraryId),
    {libraryId,revision:1,addedAt:1730000000000,enabled:true}));
});
test('patched rules deny subscription create into someone else profile',async()=>{
  await assertFails(setDoc(d(who(afterEnv,'bob'),'library_subscriptions_v3','alice','items',libraryId),
    {libraryId,revision:1,addedAt:1730000000000,enabled:true}));
});
test('patched rules deny nonmatches even to admin',async()=>{
  await assertFails(getDoc(d(who(afterEnv,'admin',admin),'hidden','credentials')));
});

test('complete copy preserves all original rules byte-for-byte except one admin-only addition',()=>{
  const original=fs.readFileSync(path.join(__dirname,'fixtures/firestore.user-supplied-20261105.baseline.rules'),'utf8');
  const candidate=fs.readFileSync(path.join(__dirname,'candidates/FIRESTORE_V3_DEVELOPMENT_FULL_FOR_MANUAL_REVIEW.rules'),'utf8');
  const block="    // NEW-003: TEST only. Trusted backend assigns admin custom claims.\n    // Only the verified Google-signed-in administrator may read one aggregate.\n    match /admin_metrics/{metricId} {\n      allow get: if metricId == 'current' && isAdmin() &&\n        request.auth.token.firebase.sign_in_provider == 'google.com';\n      allow list, create, update, delete: if false;\n    }\n\n";
  if(!candidate.includes(block))throw Error('NEW-003 admin-only addition is missing');
  if(candidate.replace(block,'')!==original)
    throw Error('Original student rules changed: do NOT publish this candidate');
});


test('NEW-006 historical owner TEST rules still deny M find (do not rewrite history)',async()=>{
  const id='E_'+'5'.repeat(32);
  await assertFails(setDoc(d(who(beforeEnv,'alice'),'sync_v3','alice','events',id),
    event('alice',id,'collection_set',{list:'finds',added:true,topic:'study',note:''},'M00012')));
});
test('NEW-006 prepared TEST candidate permits owner My Finds M P H',async()=>{
  const samples=[['6','M00012'],['7','P00055'],['8','H00001']];
  for(const x of samples){
    const id='E_'+x[0].repeat(32);
    await assertSucceeds(setDoc(d(who(findsEnv,'alice'),'sync_v3','alice','events',id),
      event('alice',id,'collection_set',{list:'finds',added:true,topic:'study',note:''},x[1])));
  }
});
test('NEW-006 prepared candidate rejects unknown public class and cross-user writes',async()=>{
  const bad='E_'+'9'.repeat(32),cross='E_'+'0'.repeat(32);
  await assertFails(setDoc(d(who(findsEnv,'alice'),'sync_v3','alice','events',bad),
    event('alice',bad,'collection_set',{list:'finds',added:true,topic:'study',note:''},'L00012')));
  await assertFails(setDoc(d(who(findsEnv,'bob'),'sync_v3','alice','events',cross),
    event('alice',cross,'collection_set',{list:'finds',added:true,topic:'study',note:''},'P00055')));
});

test('NEW-006 old admin-only candidate still refuses M while new candidate preserves admin read',async()=>{
  const oldId='E_'+'4'.repeat(32);
  await assertFails(setDoc(d(who(afterEnv,'alice'),'sync_v3','alice','events',oldId),
    event('alice',oldId,'collection_set',{list:'finds',added:true,topic:'study',note:''},'M00012')));
  const metric=await assertSucceeds(getDoc(d(who(findsEnv,'admin',admin),'admin_metrics','current')));
  if(!metric.exists())throw Error('Metrics seed missing in isolated candidate');
  await assertFails(getDoc(d(who(findsEnv,'bob'),'admin_metrics','current')));
  await assertSucceeds(getDoc(d(who(findsEnv,'alice'),'users','alice')));
  await assertFails(getDoc(d(who(findsEnv,'bob'),'users','alice')));
});
