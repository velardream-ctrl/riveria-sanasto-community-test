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


/* RUN-055 fresh-claim state: all synthetic, no Admin SDK or Cloud. */
test('the exact same eligible account and claims snapshot is eligible for re-check',()=>{
  const first=user({customClaims:{level:3,flags:{a:true,b:[1,2]}}});
  const copy=user({customClaims:{flags:{b:[1,2],a:true},level:3}});
  a.equal(x.sameAccountSnapshot(first,copy),true,'object key order does not indicate a change');
});
test('a newly granted unrelated role stops pre-write rather than overwrites it',()=>{
  const first=user({customClaims:{level:3}});
  const changed=user({customClaims:{level:3,moderator:true}});
  a.equal(x.sameAccountSnapshot(first,changed),false);
});
test('a removed unrelated claim stops pre-write',()=>{
  const first=user({customClaims:{level:3,feature:'x'}});
  const changed=user({customClaims:{level:3}});
  a.equal(x.sameAccountSnapshot(first,changed),false);
});
test('a nested claim change also stops pre-write',()=>{
  const first=user({customClaims:{limits:{read:3}}});
  const changed=user({customClaims:{limits:{read:4}}});
  a.equal(x.sameAccountSnapshot(first,changed),false);
});
test('a custom admin claim assigned while prompts are open stops stale write',()=>{
  const first=user({customClaims:{admin:false}});
  const changed=user({customClaims:{admin:true}});
  a.equal(x.sameAccountSnapshot(first,changed),false);
});
test('different account email or UID stops pre-write even when original claims match',()=>{
  const first=user({customClaims:{level:3}});
  a.equal(x.sameAccountSnapshot(first,user({email:'other@example.invalid',customClaims:{level:3}})),false);
  a.equal(x.sameAccountSnapshot(first,user({uid:'other-synthetic',customClaims:{level:3}})),false);
});
test('disabled, unverified or changed sign-in provider stops pre-write',()=>{
  const first=user({customClaims:{level:3}});
  for(const changed of [{disabled:true},{emailVerified:false},{providerData:[{providerId:'password'}]}]){
    a.equal(x.sameAccountSnapshot(first,user({...changed,customClaims:{level:3}})),false);
  }
});
test('missing and empty custom claims map are both safe absence',()=>{
  a.equal(x.sameAccountSnapshot(user(),user({customClaims:{}})),true);
});
test('RUN-055 requires a fresh Firebase getUser before backup and setCustomUserClaims',()=>{
  const s=fs.readFileSync(p.join(__dirname,'assign-test-admin.cjs'),'utf8');
  const pos=s.indexOf('const fresh = await auth.getUser(uid)');
  a.ok(pos>0);
  a.ok(s.indexOf('sameAccountSnapshot(user, fresh)',pos)>pos);
  a.ok(s.indexOf('const backup = makeBackup(uid, freshClaims)',pos)>pos);
  a.ok(s.indexOf('auth.setCustomUserClaims(uid, mergeClaims(freshClaims))',pos)>pos);
  a.ok(s.indexOf('sameAccountSnapshot(user, fresh)',pos)<s.indexOf('makeBackup(uid, freshClaims)',pos));
});
