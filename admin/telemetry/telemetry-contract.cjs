'use strict';
/*
 * RUN-048 — isolated TEST-only allowlist for privacy-minimal diagnostics.
 * Backend contract ONLY; no browser import, Firestore writes, user identifiers,
 * secrets, network, schedule or telemetry emission.
 *
 * CRITICAL: This proves only input shape. Only a trusted backend with real
 * authentication, abuse/rate controls, retention and audited permissions may
 * receive data. Rejected raw inputs must never be logged or reflected.
 */
const PROJECT='sanastoyhteiso-v3-development';
const MAX_AGE_MS=7*24*60*60*1000;
const MAX_FUTURE_MS=5*60*1000;
const KEYS=['schemaVersion','code','module','severity','browser','browserMajor',
  'os','build','network','occurredAt'];
const CODE_POLICY=Object.freeze({
  AUTH_REFRESH_FAILED:['AUTH','warning'],
  AUTH_PERMISSION_DENIED:['AUTH','warning'],
  FIRESTORE_PERMISSION_DENIED:['SYNC','warning'],
  SYNC_UPLOAD_FAILED:['SYNC','warning'],
  SYNC_DOWNLOAD_FAILED:['SYNC','warning'],
  SYNC_QUEUE_STUCK:['SYNC','critical'],
  OFFLINE_REPLAY_FAILED:['SYNC','warning'],
  CACHE_MISMATCH:['STORAGE','warning'],
  INDEXEDDB_UNAVAILABLE:['STORAGE','critical'],
  STORAGE_QUOTA_EXCEEDED:['STORAGE','critical'],
  APP_RENDER_FAILED:['UI','critical'],
  MEDIATRI_VIEW_FAILED:['MEDIATRI','warning'],
  BACKUP_VERIFY_FAILED:['BACKUP','critical'],
  RELEASE_CHECK_FAILED:['RELEASE','critical'],
  TELEMETRY_SEND_FAILED:['TELEMETRY','warning']
});
const BROWSERS=Object.freeze(['SAFARI','CHROME','FIREFOX','EDGE','OTHER']);
const SYSTEMS=Object.freeze(['IOS','IPADOS','ANDROID','MACOS','WINDOWS','LINUX','OTHER']);
const NETWORKS=Object.freeze(['ONLINE','OFFLINE','UNKNOWN']);
function plain(o){
  return o!==null&&typeof o==='object'&&!Array.isArray(o)&&
    Object.getPrototypeOf(o)===Object.prototype;
}
function fail(){throw Error('REJECT_UNSAFE_TELEMETRY');}
function iso(s){
  return typeof s==='string'&&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(s)&&
    Number.isFinite(Date.parse(s));
}
function normalize(payload,context){
  if(!plain(context)||context.project!==PROJECT||
     !iso(context.nowUtc)||!Array.isArray(context.allowedBuilds)||
     context.allowedBuilds.length===0||context.allowedBuilds.length>16)fail();
  if(!plain(payload)||Object.keys(payload).length!==KEYS.length||
     KEYS.some(k=>!Object.prototype.hasOwnProperty.call(payload,k)))fail();
  const policy=CODE_POLICY[payload.code];
  // Own-key check avoids inherited/prototype values on untrusted input.
  if(typeof payload.code!=='string'||
     !Object.prototype.hasOwnProperty.call(CODE_POLICY,payload.code)||
     !policy||payload.schemaVersion!==1||
     payload.module!==policy[0]||payload.severity!==policy[1]||
     !BROWSERS.includes(payload.browser)||!SYSTEMS.includes(payload.os)||
     !NETWORKS.includes(payload.network)||!Number.isInteger(payload.browserMajor)||
     payload.browserMajor<0||payload.browserMajor>250||
     typeof payload.build!=='string'||!/^[-A-Za-z0-9_.]{1,32}$/.test(payload.build)||
     !context.allowedBuilds.includes(payload.build)||!iso(payload.occurredAt))fail();
  const now=Date.parse(context.nowUtc),occurred=Date.parse(payload.occurredAt);
  if(occurred>now+MAX_FUTURE_MS||now-occurred>MAX_AGE_MS)fail();
  // Whitelist-only projection: never return payload, URLs, userAgent or raw error.
  return Object.freeze({
    schemaVersion:1,code:payload.code,module:policy[0],severity:policy[1],
    browser:payload.browser,browserMajor:payload.browserMajor,os:payload.os,
    build:payload.build,network:payload.network,occurredAt:payload.occurredAt
  });
}
module.exports={PROJECT,MAX_AGE_MS,MAX_FUTURE_MS,CODE_POLICY,KEYS,normalize};
