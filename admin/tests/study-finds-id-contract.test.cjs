'use strict';
/*
 * RUN-059: real V3 My Finds client format regression; synthetic IDs only.
 * No IDB creation, Firebase, network, personal words or actual profile reads.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../v3-unified-preview');
const core=require(path.join(root,'v3-sync-core.js'));
const shadow=require(path.join(root,'v3-sync-shadow.js'));
const device='D_'+'b'.repeat(32);
const id='E_'+'a'.repeat(32);
const personal='W_'+'c'.repeat(32);
const stamp=1730000000000;
function payload(added=true){return {list:'finds',added,topic:'study',note:'',};}
function ev(target,added=true){
  return {id,device,kind:'collection_set',target,time:stamp,data:payload(added)};
}
function base(findTargets){
  const finds={};
  for(const target of findTargets)finds[target]={
    added:true,topic:'study',note:'',updatedAt:stamp
  };
  return {scores:{},words:{},favorites:{},finds};
}
const supported=['T12345','M12345','P12345','H12345','T1234567','M1234567',
 'P1234567','H1234567',personal];
test('all approved T/M/P/H public catalog IDs and W private ID are valid My Finds events',()=>{
  for(const target of supported){
    const x=ev(target);
    assert.equal(core.valid(x),true,'Unexpected rejection of '+target);
    assert.equal(core.event(id,device,'collection_set',target,payload(),stamp).target,target);
  }
});
test('real fold retains M/P/H selections in reconstructed account snapshot',()=>{
  const events=['M12345','P12345','H12345'].map((target,i)=>({
    ...ev(target),id:'E_'+String.fromCharCode(97+i).repeat(32),time:stamp+i
  }));
  const out=core.fold(base([]),events);
  assert.equal(out.invalid,0);
  assert.equal(out.duplicates,0);
  assert.equal(out.applied,3);
  for(const e of events){
    assert.equal(out.state.finds[e.target].added,true);
    assert.equal(out.state.finds[e.target].updatedAt,e.time);
  }
});
test('false tombstone on valid M/P/H is saved instead of deleting selection',()=>{
  for(const target of ['M12345','P12345','H12345']){
    const out=core.fold(base([target]),[ev(target,false)]);
    assert.equal(out.invalid,0);
    assert.equal(out.state.finds[target].added,false);
    assert.equal(Object.prototype.hasOwnProperty.call(out.state.finds,target),true);
  }
});
test('shadow snapshot permits only the same approved ID families and preserves values',()=>{
  const original=base(supported),normalized=shadow.snapshot(original);
  assert.deepEqual(normalized,original);
  normalized.finds.M12345.note='modified synthetic';
  assert.equal(original.finds.M12345.note,'','normalization must clone');
});
test('invalid ID families and dangerous path-like values fail in core and shadow',()=>{
  const invalid=['X12345','m12345','T1234','T12345678','M1234',
    'P_12345','H12345678','W_'+'a'.repeat(31),
    'W_'+'G'.repeat(32),'M12345/../x','__proto__',
    'M12345#secret','M12345?x=1'];
  for(const target of invalid){
    assert.equal(core.valid(ev(target)),false,'must reject '+target);
    assert.throws(()=>core.event(id,device,'collection_set',target,payload(),stamp));
    assert.throws(()=>shadow.snapshot(base([target])),'shadow must reject '+target);
  }
});
test('invalid personal Find content is denied even for an approved M code',()=>{
  for(const data of [
    {list:'other',added:true,topic:'study',note:''},
    {list:'finds',added:'true',topic:'study',note:''},
    {list:'finds',added:true,topic:'unbounded',note:''},
    {list:'finds',added:true,topic:'study',note:'x'.repeat(351)}
  ])assert.equal(core.valid({...ev('M12345'),data}),false);
  assert.throws(()=>shadow.snapshot({scores:{},words:{},favorites:{},
    finds:{M12345:{added:true,topic:'study',note:'x'.repeat(351),updatedAt:stamp}}}));
});
test('source remains aligned with approved NEW-006 server rule candidate',()=>{
  const candidate=fs.readFileSync(path.resolve(__dirname,
    '../security-tests/candidates/FIRESTORE_V3_DEVELOPMENT_NEW006_FINDS_TMPH_REVIEW_ONLY.rules'),'utf8');
  assert.ok(candidate.includes(String.raw`request.resource.data.target.matches('^[TMPH][0-9]{5,7}$')`));
  const diff=fs.readFileSync(path.join(root,'v3-sync-diff.js'),'utf8');
  assert.ok(diff.includes('[TMPH]'));
});
test('TEST HTML and offline cache point to new My Finds source modules',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  for(const file of ['v3-sync-core.js','v3-sync-shadow.js']){
    const marker=file+'?v=v3-finds-tmph-2';
    assert.ok(html.includes(marker));
    assert.ok(sw.includes(marker));
  }
  assert.match(sw,/sanastoyhteiso-v3-unified-preview-20261105-v9/);
});
