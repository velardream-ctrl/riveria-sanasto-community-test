'use strict';
/*
 * RUN-051: isolated emulator-only server-owned telemetry_reports Rules.
 * This validates only the NEW-008 review candidate. No cloud API/deploy,
 * no personal data or real clients, no claim that Admin SDK/IAM is configured.
 */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}
  =require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc}
  =require('firebase/firestore');
const repoDir=path.join(__dirname,'candidates');
const basePath=path.join(repoDir,'FIRESTORE_V3_DEVELOPMENT_NEW006_FINDS_TMPH_REVIEW_ONLY.rules');
const candidatePath=path.join(repoDir,'FIRESTORE_V3_DEVELOPMENT_NEW008_TELEMETRY_SERVER_ONLY_REVIEW.rules');
const guard=`    // RUN-051 / NEW-008: TEST-only server-only diagnostics. REVIEW, NOT DEPLOY.
    // No browser SDK identity, including admins, may read raw reports or
    // create, update or delete them. A future audited Admin SDK backend must
    // enforce consent, schema, IAM, rate limits, TTL and aggregator privacy.
    // Rules allow conditions are OR-combined across matching paths: this
    // explicit denial is only effective while no other rule grants access.
    match /telemetry_reports/{reportId} {
      allow get, list, create, update, delete: if false;
    }

`;
const verified={email_verified:true,firebase:{sign_in_provider:'google.com'}};
const admin={...verified,admin:true};
const docId='report_0123456789';
const eventId='E_'+'a'.repeat(32);
let env;
function as(uid,claims=verified){return env.authenticatedContext(uid,claims).firestore();}
function ref(db,...parts){return doc(db,...parts);}
function payload(){return {code:'SYNC_UPLOAD_FAILED',module:'SYNC',occurredAt:'2026-11-05T12:00:00Z'};}
function profile(){return {alias:'Alice',publicStats:false,learned:0,updatedAt:1730000000000};}
before(async()=>{
  const base=fs.readFileSync(basePath,'utf8');
  const candidate=fs.readFileSync(candidatePath,'utf8');
  assert.equal(candidate.split(guard).length,2,'single server-only marker');
  assert.equal(candidate.replace(guard,''),base,'Only one additive section is permitted');
  assert.ok(candidate.includes('match /admin_metrics/{metricId}'));
  assert.ok(candidate.includes('match /sync_v3/{uid}/events/{eventId}'));
  // No real Firebase credentials, no writable production target.
  env=await initializeTestEnvironment({
    projectId:'demo-sanastoyhteiso-new008-private-telemetry',
    firestore:{rules:candidate}
  });
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await setDoc(ref(db,'telemetry_reports',docId),payload());
    await setDoc(ref(db,'admin_metrics','current'),{siteStatus:'unknown',monitoringActive:false});
    await setDoc(ref(db,'users','alice'),profile());
  });
});
after(async()=>{if(env)await env.cleanup();});
test('unauthenticated client cannot read raw diagnostics',async()=>{
  await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(),'telemetry_reports',docId)));
});
test('verified student cannot read raw diagnostics',async()=>{
  await assertFails(getDoc(ref(as('alice'),'telemetry_reports',docId)));
});
test('privileged TEST admin claim does not grant raw diagnostics',async()=>{
  await assertFails(getDoc(ref(as('owner-admin',admin),'telemetry_reports',docId)));
});
test('anonymous and unverified clients cannot read raw diagnostics',async()=>{
  await assertFails(getDoc(ref(as('guest',{firebase:{sign_in_provider:'anonymous'}}),'telemetry_reports',docId)));
  await assertFails(getDoc(ref(as('unverified',{email_verified:false}),'telemetry_reports',docId)));
});
test('no authenticated client, including admin, can list raw diagnostics',async()=>{
  await assertFails(getDocs(collection(as('alice'),'telemetry_reports')));
  await assertFails(getDocs(collection(as('owner-admin',admin),'telemetry_reports')));
});
test('anonymous client cannot create raw diagnostics',async()=>{
  await assertFails(setDoc(ref(env.unauthenticatedContext().firestore(),'telemetry_reports','raw_write'),payload()));
});
test('verified student cannot create raw diagnostics, even minimal',async()=>{
  await assertFails(setDoc(ref(as('alice'),'telemetry_reports','raw_write'),payload()));
});
test('verified admin cannot create raw diagnostics',async()=>{
  await assertFails(setDoc(ref(as('owner-admin',admin),'telemetry_reports','raw_write'),payload()));
});
test('admin cannot update existing raw diagnostics',async()=>{
  await assertFails(updateDoc(ref(as('owner-admin',admin),'telemetry_reports',docId),{module:'OTHER'}));
});
test('student and admin cannot delete existing raw diagnostics',async()=>{
  await assertFails(deleteDoc(ref(as('alice'),'telemetry_reports',docId)));
  await assertFails(deleteDoc(ref(as('owner-admin',admin),'telemetry_reports',docId)));
});
test('strict boolean verified TEST admin still gets only aggregated current metrics',async()=>{
  const result=await assertSucceeds(getDoc(ref(as('owner-admin',admin),'admin_metrics','current')));
  assert.equal(result.exists(),true);
});
test('ordinary student cannot read aggregated admin metrics',async()=>{
  await assertFails(getDoc(ref(as('alice'),'admin_metrics','current')));
});
test('admin cannot list or write metrics, even with admin=true',async()=>{
  await assertFails(getDocs(collection(as('owner-admin',admin),'admin_metrics')));
  await assertFails(setDoc(ref(as('owner-admin',admin),'admin_metrics','other'),{siteStatus:'ok'}));
});
test('own student profile remains readable after candidate addition',async()=>{
  const docSnapshot=await assertSucceeds(getDoc(ref(as('alice'),'users','alice')));
  assert.equal(docSnapshot.exists(),true);
  await assertFails(getDoc(ref(as('bob'),'users','alice')));
});
test('client can still create normal private immutable sync event',async()=>{
  const data={v:3,uid:'alice',id:eventId,device:'D_'+'b'.repeat(32),
    kind:'answer',target:'T12345',time:1730000000000,data:{correct:true}};
  await assertSucceeds(setDoc(ref(as('alice'),'sync_v3','alice','events',eventId),data));
});
test('diagnostic collection is denied even for a forged admin string claim',async()=>{
  await assertFails(getDoc(ref(as('evil',{...verified,admin:'true'}),'telemetry_reports',docId)));
});
