'use strict';
// RUN-038: synthetic-only tests for strict TEST project, read-only Rules API
// resource checks and redacted summary. NO gcloud or HTTP calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const inspect=require('./inspect-test-rules-readonly.cjs');
const project=inspect.PROJECT;
const rel={name:inspect.RESOURCE,
  rulesetName:'projects/'+project+'/rulesets/abc123-safe',
  updateTime:'2026-11-05T10:00:00Z'};
function rules(content){
  return {name:rel.rulesetName,createTime:'2026-11-05T09:59:00Z',
    source:{files:[{name:'firestore.rules',content}]}};
}
const old="service cloud.firestore { request.resource.data.target.matches('^T[0-9]{5,7}$') }";
const newer="service cloud.firestore { request.resource.data.target.matches('^[TMPH][0-9]{5,7}$') match /admin_metrics/{metricId} { } }";
test('only the correct exact TEST project can be inspected',async()=>{
  let calls=0;
  await assert.rejects(inspect.inspect('riveria-sanasto-community-test',
    async()=>{calls++;return rel;},async()=>{calls++;return rules(old);}),/Project mismatch/);
  assert.equal(calls,0,'must reject before any gcloud/API request');
  assert.equal(inspect.assertProject(project),true);
});
test('read-only release and ruleset names verified before fetching source',async()=>{
  const seen=[];
  const result=await inspect.inspect(project,async p=>{seen.push(p);return rel;},
    async p=>{seen.push(p);return rules(newer);});
  assert.deepEqual(seen,[inspect.RESOURCE,rel.rulesetName]);
  assert.equal(result.project,project);
  assert.equal(result.findsMarker,'PREPARED_TMPH_MARKER_PRESENT');
  assert.equal(result.adminMetricsMarker,'PRESENT_TEXT_ONLY');
  assert.match(result.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(result.sourceFileCount,1);
  assert.equal(result.releaseUpdatedUtc,rel.updateTime);
  assert.equal(result.note.includes('no live allow/deny'),true);
  assert.equal(JSON.stringify(result).includes('service cloud.firestore'),false,
    'raw rules contents must never appear in the summary');
});
test('historic T-only candidate is reported but never treated as new',()=>{
  const result=inspect.summarize(rel,rules(old));
  assert.equal(result.findsMarker,'HISTORIC_T_ONLY_MARKER_PRESENT');
  assert.equal(result.adminMetricsMarker,'ABSENT');
});
test('ambiguous mixed markers fail toward manual review',()=>{
  const result=inspect.summarize(rel,rules(old+'\n'+newer));
  assert.equal(result.findsMarker,'MIXED_MARKERS_REVIEW_REQUIRED');
});
test('rules from foreign project cannot be read or summarized',async()=>{
  await assert.rejects(inspect.inspect(project,async()=>({...rel,
    rulesetName:'projects/foreign-project/rulesets/abc'}),async()=>{throw Error('should not call');}),
    /unexpected project/i);
  assert.throws(()=>inspect.summarize(rel,{...rules(old),name:'projects/foreign-project/rulesets/abc'}),
    /unexpected project/i);
});
test('no rules source, duplicates and too-large files are rejected',()=>{
  assert.throws(()=>inspect.summarize(rel,{...rules(old),source:{files:[]}}),/missing/);
  assert.throws(()=>inspect.summarize(rel,{...rules(old),source:{files:[
    {name:'firestore.rules',content:old},{name:'firestore.rules',content:old}]} }),/duplicate/);
  assert.throws(()=>inspect.summarize(rel,{...rules(old),source:{files:[
    {name:'firestore.rules',content:'a'.repeat(500001)}]} }),/Invalid/);
});
test('hash is deterministic irrespective of source file order',()=>{
  const one={name:rel.rulesetName,source:{files:[
    {name:'b.rules',content:old},{name:'a.rules',content:newer}]}};
  const two={name:rel.rulesetName,source:{files:one.source.files.slice().reverse()}};
  assert.equal(inspect.summarize(rel,one).sourceSha256,
    inspect.summarize(rel,two).sourceSha256);
});
test('no mutating requests or response dumps in strictly GET-only tool',()=>{
  const script=fs.readFileSync(path.join(__dirname,'inspect-test-rules-readonly.cjs'),'utf8');
  assert.match(script,/method:'GET'/);
  assert.doesNotMatch(script,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(script,/console\.log\(\s*token/);
  assert.match(script,/assertProject\(project\);[\s\S]*?const token=gcloud/);
});
