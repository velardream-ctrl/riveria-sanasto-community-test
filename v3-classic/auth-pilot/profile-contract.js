/* STAGING ONLY — v3 profile/registration contract, compatible with existing
 * Firestore users/{uid} public profile fields, but not connected to a backend.
 * No network, tokens, Auth SDK, personal vocabulary or browser storage.
 * Keep the existing production Auth identities during final cutover.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_PROFILE_CONTRACT=api;
})(this,function(){
 'use strict';
 function cleanAlias(alias){
   if(typeof alias!=='string')throw Error('Profile alias must be text');
   var text=alias.replace(/^\s+|\s+$/g,'').replace(/\s+/g,' ');
   if(text.length<2||text.length>40||
      /[\u0000-\u001f\u007f<>]/.test(text)||
      /@/.test(text))
     throw Error('Invalid public alias');
   return text;
 }
 function validProfile(profile){
   if(!profile||typeof profile!=='object'||
      Object.prototype.toString.call(profile)!=='[object Object]')
     return false;
   var keys=Object.keys(profile).sort();
   if(keys.join(',')!=='alias,learned,publicStats,updatedAt')return false;
   try{cleanAlias(profile.alias);}catch(e){return false;}
   return typeof profile.publicStats==='boolean'&&
     typeof profile.learned==='number'&&isFinite(profile.learned)&&
     Math.floor(profile.learned)===profile.learned&&
     profile.learned>=0&&profile.learned<=1000000&&
     typeof profile.updatedAt==='number'&&isFinite(profile.updatedAt)&&
     Math.floor(profile.updatedAt)===profile.updatedAt&&profile.updatedAt>=1;
 }
 function initial(alias,now){
   var a;
   try{a=cleanAlias(alias);}
   catch(ignore){a='Opiskelija';}
   var p={alias:a,publicStats:false,learned:0,updatedAt:now};
   if(!validProfile(p))throw Error('Invalid creation timestamp');
   return p;
 }
 function edit(existing,alias,publicStats,now){
   if(!validProfile(existing))throw Error('Refuse to overwrite invalid profile');
   if(typeof publicStats!=='boolean')throw Error('Profile visibility must be explicit');
   if(typeof now!=='number'||!isFinite(now)||Math.floor(now)!==now||
      now<existing.updatedAt)throw Error('Profile timestamps must be monotonic');
   return {alias:cleanAlias(alias),publicStats:publicStats,
     learned:existing.learned,updatedAt:now};
 }
 function create(opts){
   if(!opts||!opts.auth||!opts.store||!opts.store.read||
     !opts.store.create||!opts.store.update||
     typeof opts.clock!=='function')
     throw Error('Missing owner-scoped profile dependencies');
   function active(){
     var current=opts.auth.getState();
     if(!current||current.status!=='verified'||!current.user||
        !current.user.verified||typeof current.user.uid!=='string'||
        !/^[A-Za-z0-9_-]{1,128}$/.test(current.user.uid))
       throw Error('Verified sign-in required for profile');
     return current.user.uid;
   }
   function assertSame(uid){
     if(active()!==uid)throw Error('Account changed during profile operation');
   }
   function read(){
     var uid;try{uid=active();}catch(e){return Promise.reject(e);}
     return Promise.resolve().then(function(){assertSame(uid);return opts.store.read(uid);})
       .then(function(profile){
         assertSame(uid);
         if(profile!==null&&!validProfile(profile))
           throw Error('Unexpected profile schema; never overwrite it');
         return profile;
       });
   }
   function ensure(){
     var uid;try{uid=active();}catch(e){return Promise.reject(e);}
     var identity=opts.auth.getState().user;
     return read().then(function(profile){
       assertSame(uid);
       if(profile)return profile; // never reset existing nickname, privacy or count
       var fresh=initial(identity.displayName,opts.clock());
       return Promise.resolve(opts.store.create(uid,fresh)).then(function(){
         assertSame(uid);return fresh;
       },function(err){
         // Concurrent registration on another device: read the winner.
         if(!err||err.code!=='already-exists')throw err;
         return read().then(function(found){
           if(!found)throw Error('Profile creation conflict without a record');
           return found;
         });
       });
     });
   }
   function update(alias,publicStats){
     var uid;try{uid=active();}catch(e){return Promise.reject(e);}
     return read().then(function(profile){
       assertSame(uid);
       if(!profile)throw Error('Profile missing; register before editing');
       var next=edit(profile,alias,publicStats,opts.clock());
       return Promise.resolve(opts.store.update(uid,next)).then(function(){
         assertSame(uid);return next;
       });
     });
   }
   return {read:read,ensureRegistered:ensure,updatePreferences:update};
 }
 return {initial:initial,edit:edit,validProfile:validProfile,
   cleanAlias:cleanAlias,create:create};
});
