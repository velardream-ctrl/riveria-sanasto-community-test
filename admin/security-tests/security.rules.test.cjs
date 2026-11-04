'use strict';
// Isolated contract tests; this NEVER contacts Firebase cloud.
// Requires local Firestore emulator; no Google credentials, no deployment.
// Автор проекта: Илья Дмитриев.
const {test,before,after}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc}=require('firebase/firestore');
let env;
const projectId='demo-sanastoyhteiso-admin-rules';
function identity(name,claims) {return env.authenticatedContext(name, claims||{}).firestore();}
function record(db,name='current'){return doc(db,'admin_metrics',name);}
before(async()=>{
  env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync(path.join(__dirname,'firestore.contract.rules'),'utf8')}});
  await env.withSecurityRulesDisabled(async context=>{
    await setDoc(record(context.firestore()),{siteStatus:'unknown',monitoringActive:false});
  });
});
after(async()=>{if(env)await env.cleanup();});
test('not logged in cannot get admin/current',async()=>{await assertFails(getDoc(record(env.unauthenticatedContext().firestore())));});
test('signed in student with no claim cannot get',async()=>{await assertFails(getDoc(record(identity('student',{email_verified:true,firebase:{sign_in_provider:'google.com'}}))));});
test('false admin claim cannot get',async()=>{await assertFails(getDoc(record(identity('student-false',{admin:false,email_verified:true,firebase:{sign_in_provider:'google.com'}}))));});
test('string admin claim cannot get',async()=>{await assertFails(getDoc(record(identity('student-string',{admin:'true',email_verified:true,firebase:{sign_in_provider:'google.com'}}))));});
test('unverified admin cannot get',async()=>{await assertFails(getDoc(record(identity('admin-unverified',{admin:true,email_verified:false,firebase:{sign_in_provider:'google.com'}}))));});
test('anonymous provider even with forged admin and verified cannot get',async()=>{await assertFails(getDoc(record(identity('admin-anon',{admin:true,email_verified:true,firebase:{sign_in_provider:'anonymous'}}))));});
test('verified real admin can get only current',async()=>{
  const db=identity('admin',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});
  const snap=await assertSucceeds(getDoc(record(db)));
  if(!snap.exists())throw Error('admin did not receive seeded metric');
});
test('admin cannot get another metrics document',async()=>{await assertFails(getDoc(record(identity('admin-other',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}}),'private')));});
test('admin cannot list entire metrics collection',async()=>{const db=identity('admin-list',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});await assertFails(getDocs(collection(db,'admin_metrics')));});
test('student cannot list metrics collection',async()=>{await assertFails(getDocs(collection(identity('student-list',{email_verified:true}),'admin_metrics')));});
test('admin cannot create metrics',async()=>{const db=identity('admin-create',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});await assertFails(setDoc(record(db,'new'),{siteStatus:'ok'}));});
test('admin cannot update metrics',async()=>{const db=identity('admin-update',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});await assertFails(updateDoc(record(db),{siteStatus:'ok'}));});
test('admin cannot delete metrics',async()=>{const db=identity('admin-delete',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});await assertFails(deleteDoc(record(db)));});
test('student cannot overwrite metrics',async()=>{const db=identity('student-write',{email_verified:true});await assertFails(setDoc(record(db),{siteStatus:'ok'}));});
test('admin cannot read unrelated student collections through fixture',async()=>{const db=identity('admin-unrelated',{admin:true,email_verified:true,firebase:{sign_in_provider:'google.com'}});await assertFails(getDoc(doc(db,'users','student')));});
