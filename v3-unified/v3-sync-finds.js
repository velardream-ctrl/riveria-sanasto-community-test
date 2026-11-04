/* Staging-only V3 "My finds": FI lemma matching and deterministic private IDs.
 * No network, Firebase, data writes, storage or patient data. ES5 for iOS12.
 * Exact match reuses the PUBLIC word ID; similar inflected forms are only
 * suggested for human confirmation, never silently joined.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_FINDS=api;
})(this,function(){
 'use strict';
 function normalize(input){
   if(typeof input!=='string')return '';
   var result=input.replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g,'')
     .replace(/\s+/g,' ').toLowerCase();
   return typeof result.normalize==='function'?result.normalize('NFC'):result;
 }
 function term(x){return !!x&&typeof x==='object'&&
   typeof x.id==='string'&&typeof x.fi==='string'&&normalize(x.fi)!=='';}
 function rank(x){return /^T[0-9]{5,7}$/.test(x.id)?0:1;}
 function stem(x){
   var s=normalize(x);
   // ONLY related suggestions: this must not auto-merge grammatical forms.
   return s.replace(/(ssa|ssä|sta|stä|lle|lla|llä|lta|ltä|ksi|nen|sen|ssa|ssä|n)$/,'');
 }
 function matching(all,input){
   var q=normalize(input),exact=[],similar=[],used={};
   if(!q||!Array.isArray(all))return {normalized:q,exact:[],similar:[]};
   var base=stem(q);
   all.forEach(function(x){
     if(!term(x)||used[x.id])return;
     used[x.id]=true;
     var v=normalize(x.fi);
     if(q===v)exact.push(x);
     else if(q.length>=5&&v.length>=5&&(
       v.indexOf(q)===0||q.indexOf(v)===0||
       (base.length>=6&&stem(v).indexOf(base.slice(0,6))===0)||
       (v.slice(0,7)===q.slice(0,7))))similar.push(x);
   });
   exact.sort(function(a,b){return rank(a)-rank(b)||
     String(a.id).localeCompare(String(b.id));});
   similar.sort(function(a,b){return rank(a)-rank(b)||
     String(a.fi).localeCompare(String(b.fi));});
   return {normalized:q,exact:exact,similar:similar.slice(0,8)};
 }
 function personalId(uid,fi,sha,crypto){
   var lemma=normalize(fi);
   if(typeof uid!=='string'||!uid||uid.length>128||!lemma||
     !sha||typeof sha.digest!=='function')
     return Promise.reject(Error('Cannot compute stable word identity'));
   return sha.digest({v:1,scope:'v3-personal-fi',uid:uid,lemma:lemma},crypto)
     .then(function(hex){
       if(!/^[a-f0-9]{64}$/.test(hex))throw Error('Unsafe personal word ID');
       return 'W_'+hex.slice(0,32);
     });
 }
 return {normalize:normalize,matching:matching,personalId:personalId};
});
