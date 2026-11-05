/* STAGING CONTRACT ONLY: does NOT deploy anything and does NOT read archives.
 * Backend must independently verify ZIP paths, bytes, hashes, auth and base commit.
 * ES5-compatible for old Safari/iOS 12.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_RELEASE_MANIFEST=api;
})(this,function(){
 'use strict';
 var TARGET='sanastoyhteiso/sanastoyhteiso.github.io';
 var APPROVED={
   'app.js':1,'i18n.js':1,'style.css':1,'index.html':1,
   'family.js':1,'community.js':1,'mobile-nav.js':1,'home-refresh.js':1,
   'account-settings.js':1,'sw.js':1,'about.html':1,
   'privacy.html':1,'terms.html':1,'data.js':1
 };
 var SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
 var NAME=/^[a-z0-9][a-z0-9._-]{4,79}$/;
 function keys(obj){return obj&&typeof obj==='object'&&!Array.isArray(obj)?Object.keys(obj):[];}
 function exact(obj,allowed){
   if(!obj||typeof obj!=='object'||Array.isArray(obj))return false;
   var k=Object.keys(obj);
   return k.every(function(x){return allowed.indexOf(x)>=0;});
 }
 function validate(m,expectedBase){
   var errors=[],seen={},sum=0;
   if(!exact(m,['schemaVersion','packageId','target','baseCommit','releaseType','files','description']))
     return {valid:false,errors:['Invalid manifest object/fields'],readyToPublish:false};
   if(m.schemaVersion!==1)errors.push('Unsupported schema');
   if(!NAME.test(m.packageId||''))errors.push('Invalid package id');
   if(m.target!==TARGET)errors.push('Wrong target repository');
   if(!SHA40.test(m.baseCommit||''))errors.push('Invalid base commit');
   // No verified CURRENT HEAD means no trustworthy approval, even for preview.
   // A future backend must fetch this from GitHub, never accept client input.
   if(typeof expectedBase!=='string'||!SHA40.test(expectedBase))
     errors.push('Trusted current base commit missing: review required');
   else if(m.baseCommit!==expectedBase)
     errors.push('Base commit mismatch: review required');
   if(m.releaseType!=='application'&&m.releaseType!=='catalog')
     errors.push('Unsupported release type');
   if(m.description!==undefined&&(typeof m.description!=='string'||m.description.length>500))
     errors.push('Description is invalid');
   if(!Array.isArray(m.files)||!m.files.length||m.files.length>20){
     errors.push('Invalid number of files');
   }else m.files.forEach(function(file,i){
     if(!exact(file,['path','sha256','bytes'])){errors.push('File '+i+' has unexpected fields');return;}
     var p=file.path;
     if(typeof p!=='string'||p.length>100||p.charAt(0)==='/'||
        p.indexOf('..')!==-1||p.indexOf('\\')!==-1||
        !/^[a-zA-Z0-9_.\/-]+$/.test(p)||!APPROVED[p]){
       errors.push('Disallowed path '+i);return;
     }
     if(seen[p])errors.push('Duplicate path '+p);seen[p]=true;
     if(m.releaseType==='catalog'&&p!=='data.js')errors.push('Catalog may only update data.js');
     if(!SHA64.test(file.sha256||''))errors.push('Invalid SHA-256 for '+p);
     if(typeof file.bytes!=='number'||!isFinite(file.bytes)||
        Math.floor(file.bytes)!==file.bytes||file.bytes<1||file.bytes>1048576){
       errors.push('Invalid or oversized byte size for '+p);
     }else sum+=file.bytes;
   });
   if(sum>4194304)errors.push('Package exceeds size limit');
   return {valid:errors.length===0,errors:errors,readyToPublish:false,
     reviewedFileCount:Array.isArray(m.files)?m.files.length:0,
     declaredBytes:sum,needsBackendValidation:true};
 }
 return {target:TARGET,validate:validate};
});
