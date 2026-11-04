/* STAGING ONLY. Cryptographic, deterministic migration snapshot fingerprint.
 * Uses secure Web Crypto SHA-256, refuses to fall back to a weak hash.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_SHA256=api;
})(this,function(){
 'use strict';
 function canonical(x){
   if(x===null||typeof x!=='object')return JSON.stringify(x);
   if(Object.prototype.toString.call(x)==='[object Array]')
     return '['+x.map(canonical).join(',')+']';
   return '{'+Object.keys(x).sort().map(function(k){
     return JSON.stringify(k)+':'+canonical(x[k]);
   }).join(',')+'}';
 }
 function utf8(text){
   if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text);
   var binary=unescape(encodeURIComponent(text)),out=new Uint8Array(binary.length);
   for(var i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
   return out;
 }
 function digest(snapshot,webCrypto){
   if(!webCrypto||!webCrypto.subtle||typeof webCrypto.subtle.digest!=='function')
     return Promise.reject(Error('Secure SHA-256 unavailable, cannot migrate'));
   return Promise.resolve(webCrypto.subtle.digest('SHA-256',utf8(canonical(snapshot)))).then(function(bytes){
     var array=new Uint8Array(bytes),result='';
     for(var i=0;i<array.length;i++)result+=('0'+array[i].toString(16)).slice(-2);
     if(result.length!==64)throw Error('Invalid SHA-256 digest length');
     return result;
   });
 }
 return {canonical:canonical,digest:digest};
});
