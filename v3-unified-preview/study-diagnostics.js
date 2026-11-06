/* TEST-only browser-tab diagnostics for Sanastoyhteiso V3.
 * Purpose: meaningful local admin troubleshooting before protected aggregate
 * backend exists. Not global telemetry, not monitoring, not backup.
 * Stores ONLY allowlisted error CODES plus time rounded to minute in this
 * tab's sessionStorage; NEVER raw exceptions, study answers, URL, UID,
 * email, patient notes, stack, user agent, password, or Firebase tokens.
 * No network/Firestore/Google calls. ES5 Safari iOS12 compatible.
 */
(function(root,factory){
 var api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.RS_V3_LOCAL_DIAGNOSTICS=api;
})(this,function(w){
 'use strict';
 var KEY='rs_v3_test_local_diagnostic_codes_v1';
 var PROJECT='sanastoyhteiso-v3-development';
 var LIMIT=30,MAX_AGE=86400000;
 var CODES={
  APP_RENDER_FAILED:1,SYNC_UPLOAD_FAILED:1,SYNC_DOWNLOAD_FAILED:1,
  SYNC_QUEUE_STUCK:1,INDEXEDDB_UNAVAILABLE:1,CACHE_MISMATCH:1,
  OFFLINE_REPLAY_FAILED:1,FIRESTORE_PERMISSION_DENIED:1,
  AUTH_REFRESH_FAILED:1,AUTH_PERMISSION_DENIED:1,
  STORAGE_QUOTA_EXCEEDED:1,BACKUP_VERIFY_FAILED:1
 };
 var started=false;
 function allowedSite(){
   var c=w.RS_FIREBASE_CONFIG||{},l=w.location||{};
   return c.projectId===PROJECT&&
     typeof l.pathname==='string'&&
     l.pathname.indexOf('/v3-unified-preview/')>=0;
 }
 function storage(){
   try{
     var s=w.sessionStorage;
     if(s&&typeof s.getItem==='function'&&typeof s.setItem==='function')return s;
   }catch(ignore){}
   return null;
 }
 function valid(x,now){
   return !!(x&&typeof x==='object'&&
     Object.keys(x).length===2&&
     typeof x.code==='string'&&
     Object.prototype.hasOwnProperty.call(CODES,x.code)&&
     typeof x.minute==='number'&&isFinite(x.minute)&&
     Math.floor(x.minute)===x.minute&&
     x.minute>=0&&x.minute<=now+300000&&now-x.minute<=MAX_AGE);
 }
 function readAt(now){
   if(!allowedSite())return [];
   var s=storage(),raw;
   if(!s)return [];
   try{raw=s.getItem(KEY);}catch(ignore){return [];}
   if(!raw||raw.length>5000)return [];
   try{
     var parsed=JSON.parse(raw),items;
     if(!parsed||parsed.v!==1||!Array.isArray(parsed.items))return [];
     items=parsed.items.filter(function(x){return valid(x,now);}).slice(-LIMIT);
     return items.map(function(x){return {code:x.code,minute:x.minute};});
   }catch(ignore){return [];}
 }
 function record(code){
   if(!started||!allowedSite()||!Object.prototype.hasOwnProperty.call(CODES,code))return false;
   var s=storage();if(!s)return false;
   var now=Date.now(),minute=Math.floor(now/60000)*60000,entries=readAt(now);
   var latest=entries.length?entries[entries.length-1]:null;
   // Stored times are minute-rounded for privacy; deduplicate at the same precision.
   if(latest&&latest.code===code&&latest.minute===minute)return false;
   entries.push({code:code,minute:minute});
   entries=entries.slice(-LIMIT);
   try{s.setItem(KEY,JSON.stringify({v:1,items:entries}));return true;}
   catch(ignore){return false;}
 }
 function entries(){
   return readAt(Date.now());
 }
 function storageReady(){return !!(allowedSite()&&storage());}
 function start(){
   if(started||!allowedSite())return false;
   started=true;
   if(w.addEventListener){
     // Do not read or store event.message, reason, filename, target or stack.
     w.addEventListener('error',function(){record('APP_RENDER_FAILED');},true);
     w.addEventListener('unhandledrejection',function(){record('APP_RENDER_FAILED');});
   }
   return true;
 }
 var api={start:start,record:record,entries:entries,storageReady:storageReady,
   allowedSite:allowedSite};
 if(typeof module==='undefined'||!module.exports)start();
 return api;
});
