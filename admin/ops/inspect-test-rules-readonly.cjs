'use strict';
/* RUN-038. Private Cloud Shell READ-ONLY Firebase Rules metadata inspection.
 * Exact TEST Firebase project; no Firebase Rules deploy, no writes, no Admin SDK.
 * Never logs OAuth token, raw rules source, private UID or email.
 * This helper must run locally only after deliberate owner invocation.
 */
const child=require('node:child_process');
const https=require('node:https');
const crypto=require('node:crypto');
const PROJECT='sanastoyhteiso-v3-development';
const HOST='firebaserules.googleapis.com';
const RESOURCE='projects/'+PROJECT+'/releases/cloud.firestore';
function assertProject(project){
  if(project!==PROJECT)throw Error('Project mismatch; STOP without any API call');
  return true;
}
function onlyRulesetName(name){
  if(typeof name!=='string'||!new RegExp('^projects/'+PROJECT+'/rulesets/[A-Za-z0-9_-]{1,128}$').test(name))
    throw Error('Ruleset belongs to unexpected project or has invalid name');
  return name;
}
function cleanIso(x){return typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)?x:'unknown';}
function summarize(release,ruleset){
  if(!release||release.name!=='projects/'+PROJECT+'/releases/cloud.firestore'||
     !ruleset||onlyRulesetName(ruleset.name)!==release.rulesetName)
    throw Error('Unexpected release/ruleset association');
  const files=ruleset.source&&ruleset.source.files;
  if(!Array.isArray(files)||files.length<1||files.length>40)
    throw Error('Ruleset source missing or too large');
  const names=new Set(),copy=[];
  let source='';
  for(const f of files){
    if(!f||typeof f.name!=='string'||f.name.length>200||
       typeof f.content!=='string'||f.content.length>500000||names.has(f.name))
      throw Error('Invalid or duplicate rules source entry');
    names.add(f.name);copy.push({name:f.name,content:f.content});source+='\n'+f.content;
  }
  if(source.length>1000000)throw Error('Rules source exceeds safe limit');
  copy.sort((a,b)=>a.name.localeCompare(b.name));
  const sourceSha256=crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
  const oldCount=source.split("request.resource.data.target.matches('^T[0-9]{5,7}$')").length-1;
  const newCount=source.split("request.resource.data.target.matches('^[TMPH][0-9]{5,7}$')").length-1;
  let finds='UNKNOWN';
  if(newCount===1&&oldCount===0)finds='PREPARED_TMPH_MARKER_PRESENT';
  else if(oldCount===1&&newCount===0)finds='HISTORIC_T_ONLY_MARKER_PRESENT';
  else if(newCount>0&&oldCount>0)finds='MIXED_MARKERS_REVIEW_REQUIRED';
  const adminMetricsMarker=source.includes('match /admin_metrics/{metricId} {');
  return Object.freeze({
    project:PROJECT,releaseName:release.name,rulesetName:ruleset.name,
    releaseUpdatedUtc:cleanIso(release.updateTime),rulesetCreatedUtc:cleanIso(ruleset.createTime),
    sourceSha256,sourceFileCount:files.length,findsMarker:finds,
    adminMetricsMarker:adminMetricsMarker?'PRESENT_TEXT_ONLY':'ABSENT',
    note:'Markers and hash are informational; no live allow/deny or login check performed'
  });
}
async function inspect(project,readRelease,readRuleset){
  assertProject(project);
  const rel=await readRelease(RESOURCE);
  if(!rel||rel.name!=='projects/'+PROJECT+'/releases/cloud.firestore')
    throw Error('Unexpected TEST Firestore release');
  onlyRulesetName(rel.rulesetName);
  const set=await readRuleset(rel.rulesetName);
  return summarize(rel,set);
}
function gcloud(args){
  try{
    return child.execFileSync('gcloud',args,{encoding:'utf8',
      timeout:12000,maxBuffer:100000,stdio:['ignore','pipe','ignore']}).trim();
  }catch(e){throw Error('gcloud config/authentication unavailable; STOP (no write)');}
}
function readJson(path,accessToken){
  if(!/^projects\/sanastoyhteiso-v3-development\/(releases\/cloud\.firestore|rulesets\/[A-Za-z0-9_-]{1,128})$/.test(path))
    return Promise.reject(Error('Unexpected read-only API path'));
  return new Promise((resolve,reject)=>{
    const req=https.request({hostname:HOST,path:'/v1/'+path,method:'GET',
      timeout:15000,headers:{Authorization:'Bearer '+accessToken,
        Accept:'application/json'}},res=>{
      if(res.statusCode!==200){
        res.resume();reject(Error('Rules read-only GET returned HTTP '+res.statusCode));return;
      }
      let result='',bytes=0;
      res.setEncoding('utf8');
      res.on('data',chunk=>{
        bytes+=Buffer.byteLength(chunk);
        if(bytes>1200000){req.destroy(Error('Rules response too large'));return;}
        result+=chunk;
      });
      res.on('end',()=>{try{resolve(JSON.parse(result));}
        catch(e){reject(Error('Invalid Rules API JSON'));}});
    });
    req.on('timeout',()=>req.destroy(Error('Rules read-only request timed out')));
    req.on('error',e=>reject(Error(/too large|timed out/.test(e.message)?e.message:'Rules GET transport failure')));
    req.end();
  });
}
async function main(){
  if(process.argv.slice(2).join(' ')!=='--inspect')
    throw Error('Use only --inspect in private Cloud Shell');
  const project=gcloud(['config','get-value','project']);
  assertProject(project);
  const token=gcloud(['auth','print-access-token']);
  if(!token||token.length<20)throw Error('No valid gcloud access token');
  const result=await inspect(project,path=>readJson(path,token),path=>readJson(path,token));
  // Print ONLY public project, release reference, hash and classification.
  for(const key of ['project','releaseName','rulesetName','releaseUpdatedUtc',
    'rulesetCreatedUtc','sourceSha256','sourceFileCount','findsMarker','adminMetricsMarker','note']){
    process.stdout.write(key+': '+result[key]+'\n');
  }
  process.stdout.write('READ-ONLY COMPLETE: no changes.\n');
}
if(require.main===module)main().catch(e=>{
  // All errors above are sanitized; never print token, raw rules, response bodies.
  process.stderr.write('STOP: '+(e&&e.message||'Unknown read-only error')+'\n');
  process.exitCode=1;
});
module.exports={PROJECT,RESOURCE,assertProject,onlyRulesetName,summarize,inspect};
