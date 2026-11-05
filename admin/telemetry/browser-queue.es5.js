/* RUN-049: TEST-only ES5 in-memory diagnostic code queue.
 * Not imported into any site. No network, storage, URL, user ID, text message,
 * raw stack, patient notes or study answers. No consent/transport backend.
 * A browser is untrusted: true server acknowledgments must be established by
 * an authorized backend outside this module before the caller invokes ack().
 */
(function(root){
 'use strict';
 var PROJECT='sanastoyhteiso-v3-development';
 var LIMIT=60,PER_MINUTE=6,MINUTE=60000,DEDUP_MS=30000,TTL=7*86400000;
 var CODES={
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
 };
 var BROWSERS=['SAFARI','CHROME','FIREFOX','EDGE','OTHER'];
 var SYSTEMS=['IOS','IPADOS','ANDROID','MACOS','WINDOWS','LINUX','OTHER'];
 var NETWORKS=['ONLINE','OFFLINE','UNKNOWN'];
 function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
 function plain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)&&
   Object.getPrototypeOf(x)===Object.prototype;}
 function saneTime(x){return typeof x==='number'&&isFinite(x)&&x>=0&&Math.floor(x)===x;}
 function keysAre(o,fields){
   if(!plain(o)||Object.keys(o).length!==fields.length)return false;
   for(var i=0;i<fields.length;i++)if(!has(o,fields[i]))return false;
   return true;
 }
 function allowedCode(s){return typeof s==='string'&&has(CODES,s);}
 function copyEvent(src){
   return {schemaVersion:src.schemaVersion,code:src.code,module:src.module,
     severity:src.severity,browser:src.browser,browserMajor:src.browserMajor,
     os:src.os,build:src.build,network:src.network,occurredAt:src.occurredAt};
 }
 function create(options){
   var config=plain(options)?options:{};
   var enabled=config.project===PROJECT&&config.testModeEnabled===true&&
     typeof config.build==='string'&&/^[-A-Za-z0-9_.]{1,32}$/.test(config.build);
   var queue=[],recent=[],generation=0,serial=0,open=false,lastClock=null;
   function erase(){queue=[];recent=[];lastClock=null;}
   function tick(now){
     if(!saneTime(now))return false;
     if(lastClock!==null&&now<lastClock){erase();open=false;generation++;return false;}
     lastClock=now;
     queue=queue.filter(function(x){return now-x.time<=TTL&&x.time<=now+300000;});
     recent=recent.filter(function(t){return now-t<MINUTE;});
     return true;
   }
   function startSession(){
     erase();generation++;open=enabled;return enabled;
   }
   function clearSession(){erase();generation++;open=false;}
   function disable(){enabled=false;clearSession();}
   function enqueue(code,env,now){
     if(!enabled||!open||!tick(now)||!allowedCode(code)||queue.length>=LIMIT||
       !keysAre(env,['browser','browserMajor','os','network'])||
       BROWSERS.indexOf(env.browser)<0||SYSTEMS.indexOf(env.os)<0||
       NETWORKS.indexOf(env.network)<0||
       typeof env.browserMajor!=='number'||!isFinite(env.browserMajor)||
       Math.floor(env.browserMajor)!==env.browserMajor||
       env.browserMajor<0||env.browserMajor>250||
       recent.length>=PER_MINUTE)return false;
     for(var i=0;i<queue.length;i++){
       if(queue[i].event.code===code&&now-queue[i].time<DEDUP_MS)return false;
     }
     var policy=CODES[code];
     var item={schemaVersion:1,code:code,module:policy[0],severity:policy[1],
       browser:env.browser,browserMajor:env.browserMajor,os:env.os,
       build:config.build,network:env.network,occurredAt:new Date(now).toISOString()};
     serial++;
     queue.push({seq:serial,time:now,event:item});
     recent.push(now);
     return true;
   }
   function peek(now,max){
     if(!enabled||!open||!tick(now))return {generation:generation,events:[]};
     var size=(typeof max==='number'&&Math.floor(max)===max&&max>0&&max<=20)?max:10;
     return {generation:generation,events:queue.slice(0,size).map(function(entry){
       return {seq:entry.seq,event:copyEvent(entry.event)};
     })};
   }
   function ack(expectedGeneration,ids,transportConfirmed){
     if(!enabled||!open||transportConfirmed!==true||
       expectedGeneration!==generation||!Array.isArray(ids)||ids.length===0||
       ids.length>20)return false;
     var used={};
     for(var i=0;i<ids.length;i++){
       var n=ids[i],found=false;
       if(!saneTime(n)||has(used,String(n)))return false;
       used[String(n)]=true;
       for(var j=0;j<queue.length;j++)if(queue[j].seq===n){found=true;break;}
       if(!found)return false;
     }
     queue=queue.filter(function(entry){return !has(used,String(entry.seq));});
     return true;
   }
   function size(){return queue.length;}
   return {startSession:startSession,clearSession:clearSession,disable:disable,
     enqueue:enqueue,peek:peek,ack:ack,size:size};
 }
 var api={PROJECT:PROJECT,CODES:CODES,create:create};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.RS_TEST_TELEMETRY_QUEUE=api;
})(this);
