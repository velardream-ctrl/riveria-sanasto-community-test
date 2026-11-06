'use strict';
/*
 * RUN-048: deterministic OFFLINE candidate reducer, NEVER a live monitoring
 * service or authorized admin_metrics writer. A trusted backend must provide
 * true ingress and aggregation heartbeats from independent observations.
 * No visitor IDs, error text, stacks, URLs, patient notes or study answers.
 */
const telemetry=require('./telemetry-contract.cjs');
const MAX_EVENTS=2000;
const MIN_GROUP=5;
const WINDOW_MS=24*60*60*1000;
function fail(){throw Error('REJECT_UNSAFE_TELEMETRY_BATCH');}
function aggregate(events,context){
  if(!Array.isArray(events)||events.length>MAX_EVENTS||
     !context||context.project!==telemetry.PROJECT||
     !Array.isArray(context.allowedBuilds))fail();
  // Do not skip invalid event and make a misleading "complete" report.
  const verified=events.map(e=>telemetry.normalize(e,context));
  const now=Date.parse(context.nowUtc);
  const inWindow=verified.filter(e=>{
    const t=Date.parse(e.occurredAt);
    return t<=now&&now-t<=WINDOW_MS;
  });
  const byCode=new Map(),byBrowser=new Map();
  let syncCount=0;
  for(const e of inWindow){
    byCode.set(e.code,(byCode.get(e.code)||0)+1);
    byBrowser.set(e.browser,(byBrowser.get(e.browser)||0)+1);
    if(e.module==='SYNC')syncCount++;
  }
  const groups=(map,key)=>Array.from(map.entries())
    .filter(([_,n])=>n>=MIN_GROUP).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .slice(0,30).map(([label,count])=>({[key]:label,count}));
  // Candidate only: no "OK", no claim that client telemetry actually arrived,
  // and no inference of user count from device-free events.
  return {
    schemaVersion:1,scope:'ONE_TEST_PROJECT_ONLY',
    project:telemetry.PROJECT,privacyMinimumGroup:MIN_GROUP,
    candidateGeneratedAt:context.nowUtc,windowHours:24,
    observedEventCount24h:inWindow.length>=MIN_GROUP?inWindow.length:null,
    errorGroups:groups(byCode,'code'),
    browserGroups:groups(byBrowser,'browser'),
    syncFailures24h:syncCount>=MIN_GROUP?syncCount:null,
    active7d:null,criticalOpen:null,releaseVersion:null,
    monitoringActive:false,monitoringCoverageVerified:false,
    ingestionHeartbeatAt:null,aggregationHeartbeatAt:null,
    siteStatus:'unknown',updatedAt:null,
    trustedServerAggregationVerified:false,canPublishAdminMetrics:false
  };
}
module.exports={aggregate,MAX_EVENTS,MIN_GROUP};
