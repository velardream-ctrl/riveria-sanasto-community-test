'use strict';
/* RUN-073 / NEW-011: silent key disappearance from V3 local state.
 * TEST DRAFT only. Pure deterministic data; no Firebase, browser, IndexedDB,
 * user records, network or production access.
 * An explicit false favorite is an event; ABSENCE of a prior key is not.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const diff=require(path.resolve(__dirname,'../../v3-unified-preview/v3-sync-diff.js'));
const word='W_'+'a'.repeat(32);
const before={
  scores:{T00001:{seen:2,correct:1,wrong:1,learned:true}},
  favorites:{M00012:true},
  words:{[word]:{id:word,fi:'hoito',ru:'уход',en:'care'}}
};
function copy(x){return JSON.parse(JSON.stringify(x));}
test('previously learned card removed from local state must be flagged, never silently dropped',()=>{
  const now=copy(before);delete now.scores.T00001;
  const changed=diff.changes(before,now);
  assert.ok(changed.unsafe.includes('missing-score:T00001'),
    'local score disappearance must not be accepted as a successful empty sync');
});
test('previous personal word removed or tombstoned must not disappear without explicit audited deletion',()=>{
  const gone=copy(before);delete gone.words[word];
  assert.ok(diff.changes(before,gone).unsafe.includes('missing-word:'+word));
  const tombstone=copy(before);tombstone.words[word]={id:word,deleted:true,updatedAt:3};
  assert.ok(diff.changes(before,tombstone).unsafe.includes('missing-word:'+word));
});
test('previous favorite missing from storage must be flagged, not mistaken for explicit unstar',()=>{
  const gone=copy(before);delete gone.favorites.M00012;
  assert.ok(diff.changes(before,gone).unsafe.includes('missing-favorite:M00012'));
  const intentional=copy(before);intentional.favorites.M00012=false;
  const result=diff.changes(before,intentional);
  assert.deepEqual(result.unsafe,[]);
  assert.ok(result.events.some(e=>e.kind==='favorite_set'&&e.target==='M00012'&&e.value===false));
});
test('no-op, new score and new personal word remain valid (no false rollback warnings)',()=>{
  assert.deepEqual(diff.changes(before,copy(before)),{events:[],unsafe:[]});
  const latest=copy(before);latest.scores.P00055={seen:1,correct:1,wrong:0,learned:true};
  const next=diff.changes(before,latest);
  assert.deepEqual(next.unsafe,[]);
  assert.ok(next.events.some(e=>e.kind==='answer'&&e.target==='P00055'));
  const newUser={scores:{},favorites:{},words:{[word]:copy(before.words[word])}};
  assert.deepEqual(diff.changes({scores:{},favorites:{},words:{}},newUser).unsafe,[]);
});
