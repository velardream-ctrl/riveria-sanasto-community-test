'use strict';
/*
 * RUN-050: OFFLINE server-ingress candidate for TEST-only diagnostic events.
 *
 * No network, no Firebase, no database, no delivery, no token verification.
 * Context MUST be created only by future privileged auth middleware. A client
 * may forge its boolean flags; this module cannot establish trust itself.
 * In-memory dedup state is NOT durable. Never send a success ACK to a real
 * client based on this simulated acceptance.
 */
const crypto=require('node:crypto');
const telemetry=require('./telemetry-contract.cjs');
const PROJECT=telemetry.PROJECT;
const MAX_BATCH=20,MAX_PER_MINUTE=10,MAX_SESSION_EVENTS=200,MAX_SESSIONS=100;
function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;}
function own(x,k){return Object.prototype.hasOwnProperty.call(x,k);}
function deny(code){return {accepted:false,reasonCode:code,
  simulatedAckSeqs:[],safeForClientAck:false,durableCommitVerified:false,
  backendConnected:false,productionReady:false};}
function success(accepted,duplicates,seqs){
  return {accepted:true,reasonCode:'SIMULATED_IN_MEMORY_ACCEPT',
    acceptedCount:accepted,duplicateCount:duplicates,
    simulatedAckSeqs:seqs,safeForClientAck:false,
    durableCommitVerified:false,backendConnected:false,productionReady:false};
}
function keys(x,expected){
  return plain(x)&&Object.keys(x).length===expected.length&&
    expected.every(k=>own(x,k));
}
function time(t){
  return typeof t==='string'&&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(t)&&
    Number.isFinite(Date.parse(t));
}
function validContext(ctx,server){
  return keys(ctx,['project','scope','serverIdentityVerified','emailVerified',
    'sessionHandle','currentGeneration'])&&
    ctx.project===PROJECT&&ctx.scope==='TEST_TELEMETRY_PILOT'&&
    ctx.serverIdentityVerified===true&&ctx.emailVerified===true&&
    typeof ctx.sessionHandle==='string'&&/^[a-f0-9]{32}$/.test(ctx.sessionHandle)&&
    Number.isInteger(ctx.currentGeneration)&&ctx.currentGeneration>=1&&
    ctx.currentGeneration<=1000000000&&
    plain(server)&&server.project===PROJECT&&time(server.nowUtc)&&
    Array.isArray(server.allowedBuilds)&&server.allowedBuilds.length>0;
}
function create(){
  // Pure in-memory ephemeral mock; no persistent state and no user identifiers.
  const sessions=new Map();
  function simulate(batch,ctx,server){
    if(!validContext(ctx,server))return deny('TRUSTED_SERVER_CONTEXT_MISSING');
    if(!keys(batch,['generation','events'])||
       batch.generation!==ctx.currentGeneration||
       !Array.isArray(batch.events)||batch.events.length===0||
       batch.events.length>MAX_BATCH)return deny('INVALID_OR_STALE_BATCH');
    const parsed=[],received=new Set();
    const now=Date.parse(server.nowUtc);
    try{
      for(const item of batch.events){
        if(!keys(item,['seq','event'])||!Number.isInteger(item.seq)||
           item.seq<=0||item.seq>1000000000||received.has(item.seq))
          return deny('INVALID_OR_DUPLICATE_SEQUENCE');
        received.add(item.seq);
        const safe=telemetry.normalize(item.event,{
          project:PROJECT,nowUtc:server.nowUtc,allowedBuilds:server.allowedBuilds});
        parsed.push({seq:item.seq,digest:crypto.createHash('sha256')
          .update(JSON.stringify(safe),'utf8').digest('hex')});
      }
    }catch(_e){return deny('UNSAFE_TELEMETRY_BATCH');}
    const old=sessions.get(ctx.sessionHandle);
    if(old&&old.generation!==batch.generation)return deny('SESSION_EPOCH_CHANGED');
    if(!old&&sessions.size>=MAX_SESSIONS)return deny('SESSION_CAPACITY_LIMIT');
    // A replay must reproduce identical payload per sequence exactly.
    let accepted=0,duplicates=0;
    for(const item of parsed){
      if(old&&old.seen.has(item.seq)){
        if(old.seen.get(item.seq)!==item.digest)
          return deny('SEQUENCE_PAYLOAD_COLLISION');
        duplicates++;
      }else accepted++;
    }
    const recent=old?old.recent.filter(t=>now>=t&&now-t<60000):[];
    if(recent.length+accepted>MAX_PER_MINUTE)return deny('SESSION_RATE_LIMIT');
    if((old?old.seen.size:0)+accepted>MAX_SESSION_EVENTS)
      return deny('SESSION_EVENT_LIMIT');
    // Only after full input and quota validation do we mutate mock state.
    const target=old||{generation:batch.generation,seen:new Map(),recent:[]};
    for(const item of parsed)if(!target.seen.has(item.seq)){
      target.seen.set(item.seq,item.digest);
      target.recent.push(now);
    }
    target.recent=recent.concat(Array(accepted).fill(now));
    if(!old)sessions.set(ctx.sessionHandle,target);
    return success(accepted,duplicates,parsed.map(e=>e.seq));
  }
  function invalidate(handle){
    if(typeof handle!=='string'||!/^[a-f0-9]{32}$/.test(handle))return false;
    return sessions.delete(handle);
  }
  return {simulate:simulate,invalidate:invalidate};
}
module.exports={create,PROJECT,MAX_BATCH,MAX_PER_MINUTE,MAX_SESSION_EVENTS,MAX_SESSIONS};
