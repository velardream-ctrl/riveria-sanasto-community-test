/* STAGING V3: opted-in clean-start study engine for real public FI/RU terms.
 * Release candidate: integrates via existing verified Firebase UID; no automatic legacy import.
 * IndexedDB shadow transaction precedes every remote write. ES5/iOS12.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_STUDY_ENGINE=api;
})(this,function(){
 'use strict';
 var MAX_REMOTE=10000;
 function empty(){return {scores:{},words:{},favorites:{},finds:{}};}
 function safeUid(x){return typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);}
 function isTerm(x){return typeof x==='string'&&/^[TMH][0-9]{5,7}$/.test(x);}
 function isWord(x){return typeof x==='string'&&/^W_[a-f0-9]{32}$/.test(x);}
 function validTarget(kind,id){
   if(kind==='word_upsert')return isWord(id);
   return ['answer','learned_set','favorite_set','collection_set'].indexOf(kind)>=0&&
     (isTerm(id)||isWord(id));
 }
 function canonical(v){
   if(v===null||typeof v!=='object')return JSON.stringify(v);
   if(Object.prototype.toString.call(v)==='[object Array]')
     return '['+v.map(canonical).join(',')+']';
   return '{'+Object.keys(v).sort().map(function(k){
     return JSON.stringify(k)+':'+canonical(v[k]);
   }).join(',')+'}';
 }
 function same(a,b){
   return !!a&&!!b&&a.id===b.id&&a.device===b.device&&
     a.kind===b.kind&&a.target===b.target&&a.time===b.time&&
     canonical(a.data)===canonical(b.data);
 }
 function normalized(x,uid,core){
   if(!x||x.v!==3||x.uid!==uid||!core.valid(x)||
     !/^E_[a-f0-9]{32}$/.test(x.id)||!/^D_[a-f0-9]{32}$/.test(x.device)||
     !validTarget(x.kind,x.target))
     throw Error('Untrusted V3 study event; preserve local data');
   return {id:x.id,device:x.device,kind:x.kind,target:x.target,
     time:x.time,data:x.data};
 }
 function create(opts){
   if(!opts||opts.stagingOnly!==true||!safeUid(opts.uid)||
     !opts.core||!opts.shadow||!opts.remote||typeof opts.remote.list!=='function'||
     typeof opts.remote.put!=='function'||typeof opts.activeUid!=='function'||
     !/^D_[a-f0-9]{32}$/.test(opts.device)||!opts.random)
     throw Error('Isolated verified study pilot dependencies missing');
   var uid=opts.uid,core=opts.core,shadow=opts.shadow,remote=opts.remote;
   var started=false,working=Promise.resolve(),ready=false,checking=false,lastError='';
   var onStatus=opts.onStatus||function(){};
   var active=function(){return opts.activeUid()===uid;};
   function assertActive(){if(!active())throw Error('Study account changed');}
   function status(){return {ready:ready,checking:checking,lastError:lastError};}
   function emit(){try{onStatus(status());}catch(e){}}
   function seq(action){
     var task=working.then(function(){assertActive();return action();});
     working=task.then(function(){},function(){});
     return task;
   }
   function current(){
     assertActive();
     return shadow.read(uid).then(function(record){
       assertActive();if(!record)throw Error('Study shadow not initialized');
       return record;
     });
   }
   function query(){
     assertActive();
     return remote.list(uid,MAX_REMOTE).then(function(events){
       assertActive();
       if(!Array.isArray(events)||events.length>=MAX_REMOTE)
         throw Error('Remote study history incomplete or above pilot cap');
       var seen={},output=[];
       events.forEach(function(x){
         var e=normalized(x,uid,core);
         if(seen[e.id]){
           if(!same(seen[e.id],e))throw Error('Conflicting cloud event IDs');
           throw Error('Duplicate cloud event ID');
         }
         seen[e.id]=e;output.push(e);
       });
       return output;
     });
   }
   function rebuild(remoteEvents){
     return current().then(function(old){
       var byId={},included=[];
       remoteEvents.forEach(function(e){byId[e.id]=e;});
       old.pending.forEach(function(e){
         if(!validTarget(e.kind,e.target))
           throw Error('Non-study pending event; stop');
         if(byId[e.id]){
           if(!same(byId[e.id],e))throw Error('Pending event collides with server');
         }else{byId[e.id]=e;}
         included.push(e.id);
       });
       var merged=core.fold(empty(),Object.keys(byId).map(function(k){return byId[k];}));
       if(merged.invalid||merged.duplicates||merged.applied!==Object.keys(byId).length)
         throw Error('Study fold incomplete');
       // stageCloud is fail-closed: no lost local scores and no stale revision.
       return shadow.stageCloud(uid,{
         ok:true,readyToApply:false,state:merged.state,includedPendingIds:included
       },old.revision,'VERIFIED_READ_ONLY_PREVIEW_TO_SHADOW').then(function(){
         return current();
       });
     });
   }
   function initialize(){
     return shadow.read(uid).then(function(record){
       assertActive();
       if(record)return record;
       return shadow.initialize(uid,empty(),'VERIFIED_STAGING_SHADOW_ONLY').then(function(){
         return shadow.read(uid);
       },function(err){
         // A second tab may initialize concurrently. Re-read, never reset.
         return shadow.read(uid).then(function(exists){if(exists)return exists;throw err;});
       });
     });
   }
   function start(){
     if(started)return seq(function(){return current();});
     started=true;checking=true;emit();
     return seq(function(){
       // Reopening a previously verified local study while disconnected must
       // not discard IndexedDB progress. First-ever startup still needs the
       // server, and no unseen account may be initialized while offline.
       if(opts.online&&opts.online()===false){
         return shadow.read(uid).then(function(record){
           if(!record||record.uid!==uid||record.phase!=='shadow')
             throw Error('First study start requires online verification');
           return record;
         });
       }
       return query().then(function(events){
         return initialize().then(function(){return rebuild(events);});
       });
     }).then(function(record){
       ready=true;checking=false;lastError='';emit();return record;
     }).catch(function(e){ready=false;checking=false;lastError=e.message||'Unsafe start';
       emit();throw e;});
   }
   function refresh(){
     if(!ready)return Promise.reject(Error('Study pilot not ready'));
     checking=true;emit();
     return seq(function(){
       return query().then(rebuild).then(function(record){
         checking=false;lastError='';emit();return record;
       });
     }).catch(function(e){checking=false;lastError=e.message||'Refresh failed';
       emit();throw e;});
   }
   function makeEvent(kind,target,value,when){
     assertActive();
     if(!validTarget(kind,target)||typeof when!=='number'||!isFinite(when)||when<=0||
       Math.floor(when)!==when)throw Error('Invalid real term target/date');
     var data;
     if(kind==='answer'&&typeof value==='boolean')
       data=value?{correct:true}:{correct:false,reviewLearned:true};
     else if(kind==='answer'&&value&&typeof value==='object'&&
       typeof value.correct==='boolean'&&typeof value.reviewLearned==='boolean')
       data={correct:value.correct,reviewLearned:value.reviewLearned};
     else if(kind==='learned_set'&&typeof value==='boolean')data={learned:value};
     else if(kind==='favorite_set'&&typeof value==='boolean')data={starred:value};
     else if(kind==='collection_set'&&value&&typeof value==='object'&&
       value.list==='finds'&&typeof value.added==='boolean'&&
       ['practice','study','other'].indexOf(value.topic)>=0&&
       typeof value.note==='string'&&value.note.length<=350){
       data={list:'finds',added:value.added,topic:value.topic,note:value.note};
     }
     else if(kind==='word_upsert'&&value&&typeof value==='object'&&
       typeof value.fi==='string'&&typeof value.ru==='string'&&
       value.fi.trim().length>=1&&value.ru.trim().length>=1&&
       value.fi.length<=120&&value.ru.length<=180&&
       (!value.en||typeof value.en==='string'&&value.en.length<=180)){
       data={id:target,fi:value.fi.trim(),ru:value.ru.trim(),
         en:(value.en||'').trim(),cat:'Omat sanat',
         catRu:'Мои слова',updatedAt:when};
     }else throw Error('Invalid learning action');
     var hex=opts.random();
     if(typeof hex!=='string'||!/^[a-f0-9]{32}$/.test(hex))
       throw Error('Secure event ID required');
     return core.event('E_'+hex,opts.device,kind,target,data,when);
   }
   function record(kind,target,value){
     if(!ready)return Promise.reject(Error('Study cloud not verified yet'));
     var event;
     try{event=makeEvent(kind,target,value,(opts.now||Date.now)());}
     catch(e){return Promise.reject(e);}
     return seq(function(){
       return current().then(function(old){
         if(old.pending.length>=4000)throw Error('Local study queue at safety limit');
         return shadow.appendLocal(uid,event,old.revision);
       }).then(function(){return current();});
     });
   }
   function upload(){
     if(!ready)return Promise.reject(Error('Study pilot not ready'));
     return seq(function(){
       return current().then(function(row){
         if(!row.pending.length)return row;
         var tasks=row.pending.slice(0,12),index=0;
         function next(){
           if(index>=tasks.length)return Promise.resolve();
           var e=tasks[index++];assertActive();
           return remote.put(uid,{v:3,uid:uid,id:e.id,device:e.device,
             kind:e.kind,target:e.target,time:e.time,data:e.data}).then(function(){
             return current();
           }).then(function(currentRow){
             var exists=currentRow.pending.some(function(a){return a.id===e.id;});
             if(!exists)return;
             return shadow.acknowledge(uid,[e.id],currentRow.revision,
               'VERIFIED_SERVER_EVENT_ACK_TO_SHADOW');
           }).then(next);
         }
         return next().then(current);
       });
     });
   }
   function view(){return seq(current);}
   return {start:start,refresh:refresh,record:record,upload:upload,
     view:view,status:status,makeEvent:makeEvent};
 }
 return {create:create,empty:empty,normalized:normalized,
   isTerm:isTerm,isWord:isWord,sameEvent:same};
});
