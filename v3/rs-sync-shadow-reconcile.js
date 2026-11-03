/* STAGING ONLY. Explicit preview -> isolated IndexedDB shadow transaction.
 * Does not update the running application's 3 localStorage keys or write to
 * Firestore, Google Drive, Firebase Auth or the public dictionary.
 * Cross-tab writes are serialized in the shadow store and reject stale revisions.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_SYNC_SHADOW_RECONCILE=api;
})(this,function(){
 'use strict';
 function create(opts){
   if(!opts||opts.shadowOnly!==true||!opts.shadow||
      typeof opts.shadow.read!=='function'||
      typeof opts.shadow.stageCloud!=='function'||
      !opts.cloudReader||typeof opts.cloudReader.load!=='function'||
      typeof opts.activeUid!=='function'||
      typeof opts.legacySyncDisabled!=='function')
     throw Error('Explicit shadow-only reconciliation dependencies required');
   var busy=false;
   function run(uid,approval){
     if(approval!=='VERIFIED_STAGING_RECONCILIATION_ONLY')
       return Promise.reject(Error('Shadow reconciliation not authorized'));
     if(busy)return Promise.reject(Error('Shadow reconciliation already running'));
     if(!uid||opts.activeUid()!==uid||opts.legacySyncDisabled()!==true)
       return Promise.reject(Error('Owner account or migration gate changed'));
     if(opts.online&&opts.online()!==true)
       return Promise.reject(Error('Offline; preserve existing shadow state'));
     busy=true;
     var before;
     return Promise.resolve().then(function(){
       return opts.shadow.read(uid);
     }).then(function(existing){
       if(!existing||existing.phase!=='shadow')
         throw Error('Verified per-user shadow initialization required');
       before=existing;
       if(opts.activeUid()!==uid)throw Error('Account changed before cloud read');
       return opts.cloudReader.load(uid,existing.pending);
     }).then(function(preview){
       if(opts.activeUid()!==uid||opts.legacySyncDisabled()!==true)
         throw Error('Owner account changed during cloud read');
       if(opts.online&&opts.online()!==true)
         throw Error('Connection lost during cloud read');
       if(!preview||preview.ok!==true||preview.readyToApply!==false||
          !Array.isArray(preview.includedPendingIds))
         throw Error('Unverified or incomplete remote preview');
       return opts.shadow.stageCloud(uid,preview,before.revision,
         'VERIFIED_READ_ONLY_PREVIEW_TO_SHADOW');
     }).then(function(status){
       return {ok:true,shadowOnly:true,revision:status.revision,
         pending:status.pending,scoreCount:status.scoreCount,
         wordCount:status.wordCount};
     }).then(function(result){busy=false;return result;},function(e){
       busy=false;throw e;
     });
   }
   return {run:run};
 }
 return {create:create};
});
