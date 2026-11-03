/* STAGING ONLY. Read-only recovery audit for the isolated shadow database.
 * No writes, no restore, no cloud, no Google Drive, no logs of user word text.
 * History is diagnostic, NOT an independent backup and NOT a permission to
 * roll back an answer. The published application does not load this script.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_SYNC_RECOVERY_AUDIT=api;
})(this,function(){
 'use strict';
 function safeNumber(x){return typeof x==='number'&&isFinite(x)&&
   Math.floor(x)===x&&x>=0&&x<=9007199254740991;}
 function create(opts){
   if(!opts||!opts.shadow||typeof opts.shadow.read!=='function'||
      typeof opts.normalizeSnapshot!=='function'||
      !opts.core||typeof opts.core.valid!=='function'||
      typeof opts.activeUid!=='function')
     throw Error('Read-only recovery auditor dependencies missing');
   function summary(s){
     var state=opts.normalizeSnapshot(s),seen=0,correct=0,wrong=0;
     Object.keys(state.scores).forEach(function(id){
       seen+=state.scores[id].seen;
       correct+=state.scores[id].correct;
       wrong+=state.scores[id].wrong;
     });
     if(!safeNumber(seen)||!safeNumber(correct)||!safeNumber(wrong))
       throw Error('Recovery totals overflow');
     return {terms:Object.keys(state.scores).length,
       words:Object.keys(state.words).length,
       favorites:Object.keys(state.favorites).filter(function(id){
         return state.favorites[id]===true;
       }).length,seen:seen,correct:correct,wrong:wrong};
   }
   function pending(queue){
     if(!Array.isArray(queue)||queue.length>5000)
       throw Error('Invalid recovery pending queue');
     var unique={};
     queue.forEach(function(e){
       if(!opts.core.valid(e)||!/^E_[a-f0-9]{32}$/.test(e.id)||
          !/^D_[a-f0-9]{32}$/.test(e.device)||
          Object.prototype.hasOwnProperty.call(unique,e.id))
         throw Error('Corrupt or duplicate event in recovery history');
       unique[e.id]=true;
     });
     return queue.length;
   }
   function audit(uid){
     if(!uid||opts.activeUid()!==uid)
       return Promise.reject(Error('Recovery account changed'));
     return Promise.resolve().then(function(){return opts.shadow.read(uid);})
       .then(function(record){
         if(opts.activeUid()!==uid)throw Error('Recovery account changed');
         if(!record||record.v!==3||record.phase!=='shadow'||record.uid!==uid||
            !safeNumber(record.revision)||!Array.isArray(record.history)||
            record.history.length>2)
           throw Error('Shadow recovery record missing or invalid');
         var current=summary(record.state);
         var count=pending(record.pending);
         var previews=[],last=-1;
         record.history.forEach(function(h){
           if(!h||!safeNumber(h.revision)||h.revision<=last||
              h.revision>=record.revision||!safeNumber(h.savedAt))
             throw Error('Invalid shadow recovery revision history');
           previews.push({revision:h.revision,savedAt:h.savedAt,
             progress:summary(h.state),pending:pending(h.pending)});
           last=h.revision;
         });
         return {ok:true,readOnly:true,canAutomaticallyRestore:false,
           revision:record.revision,current:current,
           pending:count,history:previews,
           needsExternalBackup:true,
           warning:count?
             'Pending answers exist; never roll back without a verified separate backup':
             'History is not an independent backup; restoration requires review'};
       });
   }
   return {audit:audit};
  }
  return {create:create};
});
