'use strict';
/* RUN-020 static policy regressions; no Firebase credential or network. */
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const p=require('node:path');
const x=require('./assign-test-admin.cjs');
function user(overrides={}){return Object.assign({uid:'test-user',disabled:false,email:'owner@example.invalid',emailVerified:true,providerData:[{providerId:'google.com'}]},overrides);}
test('only isolated development Firebase project is allowed',()=>a.equal(x.PROJECT_ID,'sanastoyhteiso-v3-development'));
test('verified Google user passes local checks',()=>a.equal(x.validateAccount(user()),null));
test('unverified user rejected',()=>a.match(x.validateAccount(user({emailVerified:false})),/not verified/));
test('disabled user rejected',()=>a.match(x.validateAccount(user({disabled:true})),/disabled/));
test('non-Google provider rejected',()=>a.match(x.validateAccount(user({providerData:[{providerId:'password'}]})),/Google/));
test('missing linked provider rejected',()=>a.match(x.validateAccount(user({providerData:[]})),/Google/));
test('missing user rejected',()=>a.match(x.validateAccount(null),/No target/));
test('missing email rejected',()=>a.match(x.validateAccount(user({email:''})),/email/));
test('does not mutate existing claim map',()=>{const c={feature:'a',admin:false};const merged=x.mergeClaims(c);a.equal(c.admin,false);a.deepEqual(merged,{feature:'a',admin:true});});
test('keeps unrelated privilege and metadata claims',()=>{const c={level:3,team:'student'};a.deepEqual(x.mergeClaims(c),{level:3,team:'student',admin:true});});
test('handles no claims',()=>a.deepEqual(x.mergeClaims(undefined),{admin:true}));
test('defaults to read-only dry run',()=>a.equal(x.runMode([]),'dry-run'));
test('explicit dry run remains read-only',()=>a.equal(x.runMode(['--dry-run']),'dry-run'));
test('explicit apply is the only write mode',()=>a.equal(x.runMode(['--apply']),'apply'));
test('rejects unexpected arguments',()=>a.throws(()=>x.runMode(['--apply','--uid','other']),/Use:/));
test('does not bundle credentials or call Firestore writes',()=>{const s=fs.readFileSync(p.join(__dirname,'assign-test-admin.cjs'),'utf8');a.ok(!s.includes('serviceAccountKey.json'));a.ok(!s.includes('getFirestore('));a.ok(s.includes('process.stdin.isTTY'));a.ok(s.includes('setCustomUserClaims('));});
