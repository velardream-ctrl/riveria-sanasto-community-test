/* STAGING ONLY — NOT LOADED BY THE LIVE WEBSITE.
 * Isolated IndexedDB v3 shadow storage. An IndexedDB readwrite transaction
 * serializes read/validate/write for a single user's snapshot + pending queue.
 * Never modifies the existing 3 localStorage keys, Firestore or Google Drive.
 * No automatic migration, activation, rollback, user impersonation or exports.
 *
 * IMPORTANT: This store is NOT yet the live app's source of truth. It allows
 * safe cross-tab transactional experiments before an explicitly approved cutover.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_SYNC_SHADOW_IDB=api;
})(this,function(){
 'use strict';
 var DB_NAME='sanastoyhteiso_real_terms_pilot_v3';
 var STORE='accounts';
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
 function safeNum(x){return typeof x==='number'&&isFinite(x)&&x>=0&&
   Math.floor(x)===x&&x<=9007199254740991;}
 function safeUid(x){return typeof x==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(x);}
 function canonical(x){
   if(x===null||typeof x!=='object')return JSON.stringify(x);
   if(Object.prototype.toString.call(x)==='[object Array]')
     return '['+x.map(canonical).join(',')+']';
   return '{'+Object.keys(x).sort().map(function(k){
     return JSON.stringify(k)+':'+canonical(x[k]);
   }).join(',')+'}';
 }
 function snapshot(input){
   if(!plain(input)||!plain(input.scores)||!plain(input.words)||!plain(input.favorites))
     throw Error('Incomplete shadow snapshot');
   Object.keys(input.scores).forEach(function(id){
     var s=input.scores[id];
     if(!id||!plain(s)||!safeNum(s.seen)||!safeNum(s.correct)||
        !safeNum(s.wrong)||s.seen!==s.correct+s.wrong)
       throw Error('Invalid or inconsistent score; abort shadow transaction');
   });
   Object.keys(input.words).forEach(function(id){
     var w=input.words[id];
     if(!id||!plain(w)||w.id!==id||typeof w.fi!=='string'||!w.fi||
        typeof w.ru!=='string'||!w.ru)
       throw Error('Invalid personal word; abort shadow transaction');
   });
   Object.keys(input.favorites).forEach(function(id){
     if(!id||typeof input.favorites[id]!=='boolean')
       throw Error('Invalid favorite; abort shadow transaction');
   });
   return clone({scores:input.scores,words:input.words,favorites:input.favorites});
 }
 function validatePending(queue,core){
   if(!Array.isArray(queue)||queue.length>5000)throw Error('Invalid shadow pending queue');
   var ids={};
   queue.forEach(function(e){
     if(!core.valid(e)||!/^E_[a-f0-9]{32}$/.test(e.id)||
        !/^D_[a-f0-9]{32}$/.test(e.device)||ids[e.id])
       throw Error('Invalid or duplicate shadow event');
     ids[e.id]=true;
   });
 }
 function checkMonotonic(before,after){
   Object.keys(before.scores).forEach(function(id){
     var a=before.scores[id],b=after.scores[id];
     if(!b||b.correct<a.correct||b.wrong<a.wrong||b.seen<a.seen)
       throw Error('Cloud preview would lose local answer counters');
   });
   Object.keys(before.words).forEach(function(id){
     // No word disappears without a separate, audited tombstone/restore plan.
     if(!Object.prototype.hasOwnProperty.call(after.words,id))
       throw Error('Cloud preview would remove a personal word');
   });
 }
 function create(opts){
   if(!opts||opts.enableStagingWrites!==true||
      !opts.indexedDB||typeof opts.indexedDB.open!=='function'||
      !opts.core||typeof opts.activeUid!=='function')
     throw Error('Isolated shadow storage must be explicitly enabled');
   var openPromise=null,now=opts.now||function(){return Date.now();};
   function active(uid){
     if(!safeUid(uid)||opts.activeUid()!==uid)
       throw Error('Shadow account changed or invalid');
   }
   function database(){
     if(openPromise)return openPromise;
     openPromise=new Promise(function(resolve,reject){
       var request;
       try{request=opts.indexedDB.open(DB_NAME,1);}
       catch(e){reject(e);return;}
       request.onupgradeneeded=function(){
         var db=request.result;
         if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
       };
       request.onerror=function(){reject(request.error||Error('Shadow IndexedDB open failed'));};
       request.onblocked=function(){reject(Error('Shadow IndexedDB upgrade blocked'));};
       request.onsuccess=function(){resolve(request.result);};
     }).catch(function(e){openPromise=null;throw e;});
     return openPromise;
   }
   function validateRecord(uid,r){
     if(!r||r.v!==3||r.uid!==uid||r.phase!=='shadow'||
        !safeNum(r.revision)||!safeNum(r.createdAt)||
        !Array.isArray(r.history)||r.history.length>2)
       throw Error('Corrupt shadow record; original bytes preserved');
     snapshot(r.state);validatePending(r.pending,opts.core);
     return r;
   }
   function read(uid){
     try{active(uid);}catch(e){return Promise.reject(e);}
     return database().then(function(db){
       return new Promise(function(resolve,reject){
         var tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(uid);
         request.onsuccess=function(){
           try{active(uid);
             resolve(request.result?clone(validateRecord(uid,request.result)):null);
           }catch(e){reject(e);}
         };
         request.onerror=function(){reject(request.error||Error('Shadow read failed'));};
         tx.onabort=function(){reject(tx.error||Error('Shadow read aborted'));};
       });
     });
   }
   function atomic(uid,transform){
     try{active(uid);}catch(e){return Promise.reject(e);}
     return database().then(function(db){
       return new Promise(function(resolve,reject){
         var tx,req,result,problem=null,finished=false;
         try{
           tx=db.transaction(STORE,'readwrite');
           req=tx.objectStore(STORE).get(uid);
         }catch(e){reject(e);return;}
         function doneError(e){if(!finished){finished=true;reject(e);}}
         tx.onabort=function(){doneError(problem||tx.error||Error('Shadow transaction aborted'));};
         tx.onerror=function(){/* onabort provides the final outcome */};
         tx.oncomplete=function(){
           if(finished)return;finished=true;
           try{active(uid);resolve(result);}
           catch(e){reject(e);}
         };
         req.onerror=function(){problem=req.error||Error('Shadow record lookup failed');};
         req.onsuccess=function(){
           try{
             active(uid);
             var original=req.result?validateRecord(uid,req.result):null;
             var updated=transform(original?clone(original):null);
             if(!updated||!updated.record)throw Error('Shadow transformation missing record');
             validateRecord(uid,updated.record);
             active(uid);
             tx.objectStore(STORE).put(updated.record,uid);
             result=updated.response;
           }catch(e){problem=e;try{tx.abort();}catch(ignored){doneError(problem);}}
         };
       });
     });
   }
   function statusView(r){
     return {uid:r.uid,revision:r.revision,pending:r.pending.length,
       scoreCount:Object.keys(r.state.scores).length,
       wordCount:Object.keys(r.state.words).length,
       historyCount:r.history.length,phase:r.phase};
   }
   function history(previous){
     var h=previous.history.slice(-1);
     h.push({revision:previous.revision,state:clone(previous.state),
       pending:clone(previous.pending),savedAt:now()});
     return h;
   }
   function initialize(uid,seed,approval){
     if(approval!=='VERIFIED_STAGING_SHADOW_ONLY')
       return Promise.reject(Error('Isolated shadow initialization not approved'));
     var state;
     try{state=snapshot(seed);}catch(e){return Promise.reject(e);}
     return atomic(uid,function(old){
       if(old)throw Error('Existing shadow record must never be overwritten');
       var r={v:3,uid:uid,phase:'shadow',revision:0,createdAt:now(),
         state:state,pending:[],history:[]};
       return {record:r,response:statusView(r)};
     });
   }
   function appendLocal(uid,event,expectedRevision){
     try{if(!opts.core.valid(event)||!/^E_[a-f0-9]{32}$/.test(event.id)||
       !/^D_[a-f0-9]{32}$/.test(event.device))
       throw Error('Invalid incremental event');}
     catch(e){return Promise.reject(e);}
     return atomic(uid,function(old){
       if(!old)throw Error('Shadow initialization required');
       if(old.revision!==expectedRevision)throw Error('Shadow revision conflict: re-read before retry');
       if(old.pending.length>=5000)throw Error('Shadow pending queue full');
       if(old.pending.some(function(e){return e.id===event.id;}))
         throw Error('Duplicate shadow pending event ID');
       var folded=opts.core.fold(old.state,[event]);
       if(folded.invalid||folded.duplicates||folded.applied!==1)
         throw Error('Could not fold local event');
       var r=clone(old);
       r.state=snapshot(folded.state);
       r.pending.push(clone(event));
       r.history=history(old);
       r.revision++;
       return {record:r,response:statusView(r)};
     });
   }
   function stageCloud(uid,preview,expectedRevision,approval){
     if(approval!=='VERIFIED_READ_ONLY_PREVIEW_TO_SHADOW')
       return Promise.reject(Error('Cloud preview staging not approved'));
     var candidate;
     try{
       if(!preview||preview.ok!==true||preview.readyToApply!==false||
          !Array.isArray(preview.includedPendingIds))
         throw Error('Unverified or incomplete cloud preview');
       candidate=snapshot(preview.state);
     }catch(e){return Promise.reject(e);}
     return atomic(uid,function(old){
       if(!old)throw Error('Shadow initialization required');
       if(old.revision!==expectedRevision)throw Error('Shadow revision conflict: re-read before retry');
       var localIds=old.pending.map(function(e){return e.id;}).sort();
       var included=preview.includedPendingIds.slice().sort();
       if(canonical(localIds)!==canonical(included))
         throw Error('Cloud preview does not include every local pending event');
       checkMonotonic(old.state,candidate);
       var r=clone(old);
       r.history=history(old);
       r.revision++;
       r.state=candidate; // New shadow snapshot and outbox remain in ONE transaction.
       return {record:r,response:statusView(r)};
     });
   }
   function acknowledge(uid,ids,expectedRevision,approval){
     if(approval!=='VERIFIED_SERVER_EVENT_ACK_TO_SHADOW')
       return Promise.reject(Error('Server acknowledgment not verified'));
     if(!Array.isArray(ids)||!ids.length||ids.length>12)
       return Promise.reject(Error('Invalid server acknowledgment batch'));
     var unique={},list=[];
     try{
       ids.forEach(function(id){
         if(typeof id!=='string'||!/^E_[a-f0-9]{32}$/.test(id)||unique[id])
           throw Error('Invalid or duplicate acknowledged event ID');
         unique[id]=true;list.push(id);
       });
     }catch(e){return Promise.reject(e);}
     return atomic(uid,function(old){
       if(!old)throw Error('Shadow initialization required');
       if(old.revision!==expectedRevision)
         throw Error('Shadow revision conflict: re-read before retry');
       var pending={};
       old.pending.forEach(function(e){pending[e.id]=true;});
       list.forEach(function(id){
         if(!pending[id])throw Error('Server ACK does not match pending shadow event');
       });
       var r=clone(old);
       r.pending=old.pending.filter(function(e){return !unique[e.id];});
       r.history=history(old);
       r.revision++;
       // Do not roll back counters: the server has merely confirmed an event
       // already reflected in this local shadow state.
       return {record:r,response:statusView(r)};
     });
   }
   return {read:read,initialize:initialize,appendLocal:appendLocal,
     stageCloud:stageCloud,acknowledge:acknowledge};
 }
 return {create:create,snapshot:snapshot};
});
