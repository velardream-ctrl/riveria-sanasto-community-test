/* Staging-only LOCAL JSON backup audit. No network, no persistent storage.
 * Receives in-memory Riveria Sanasto exported JSON and returns aggregate metrics
 * only. Does not return words, profile identifiers, email or private vocabulary.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_PERSONAL_BACKUP_AUDIT=api;
})(this,function(){
 'use strict';
 function plain(o){return o!==null&&typeof o==='object'&&!Array.isArray(o);}
 function count(obj){return Object.keys(obj||{}).length;}
 function n(x){return typeof x==='number'&&isFinite(x)&&Math.floor(x)===x&&x>=0;}
 function check(input,reference){
   var errors=[],warnings=[],x;
   try{x=typeof input==='string'?JSON.parse(input):input;}catch(e){
     return{ok:false,errors:['JSON cannot be parsed'],warnings:[],metrics:null};
   }
   if(!plain(x)||x.app!=='Riveria Sanasto'||x.version!==1||
      !plain(x.scores)||!Array.isArray(x.userWords)||!plain(x.favorites)){
     return{ok:false,errors:['Not a supported Riveria Sanasto personal backup'],warnings:[],metrics:null};
   }
   var metrics={scoredTerms:count(x.scores),seen:0,correct:0,wrong:0,
     termsWithCorrectAnswer:0,markedLearned:0,userWords:x.userWords.length,
     favoriteTerms:0,deletedWordIds:count(x.deletedWords),formatVersion:x.version};
   var ids={};x.userWords.forEach(function(w,i){
     if(!plain(w)||typeof w.id!=='string'||!w.id||
        typeof w.fi!=='string'||typeof w.ru!=='string')
       errors.push('Invalid private word at index '+i);
     else if(ids[w.id])errors.push('Duplicate private word ID');
     else ids[w.id]=true;
   });
   Object.keys(x.scores).forEach(function(k){
     var s=x.scores[k];
     if(!plain(s)||!n(s.seen)||!n(s.correct)||!n(s.wrong)){
       errors.push('Invalid numeric counter');return;
     }
     if(s.seen!==s.correct+s.wrong)errors.push('Score counter mismatch');
     metrics.seen+=s.seen;metrics.correct+=s.correct;metrics.wrong+=s.wrong;
     if(s.correct>0)metrics.termsWithCorrectAnswer++;
     if(typeof s.learned==='boolean'?s.learned:s.correct>0)metrics.markedLearned++;
   });
   Object.keys(x.favorites).forEach(function(k){if(x.favorites[k]===true)metrics.favoriteTerms++;});
   if(metrics.markedLearned!==metrics.termsWithCorrectAnswer)
     warnings.push('Explicit learned flags differ from public correct-answer count; preserve both');
   if(plain(reference)){
     ['seen','correct','wrong','termsWithCorrectAnswer'].forEach(function(field){
       if(typeof reference[field]==='number'&&metrics[field]!==reference[field])
         warnings.push('Difference from historical Sheets snapshot: '+field);
     });
   }
   if(errors.length>20)errors=errors.slice(0,20).concat(['Additional invalid values omitted']);
   return{ok:errors.length===0,errors:errors,warnings:warnings,metrics:metrics,
     readyForMigration:false,
     message:'Read-only format and totals audit; individual word IDs and latest cloud events still require reconciliation'};
 }
 return{check:check};
});
