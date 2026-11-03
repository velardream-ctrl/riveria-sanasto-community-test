/* SANASTOYHTEISO V3 — STAGING ONLY verified owner-scoped Firestore
 * profile store adapter. NEVER include in production or offline classic demo.
 *
 * Requires the isolated v3 Firebase compat App created by the approved
 * Auth adapter and the owner-vetted Security Rules to be published first.
 * This adapter never initializes a Firebase app, never touches Google Drive,
 * and never uploads local scores, words or favorites. All profile updates are
 * transactions that REFUSE to overwrite a concurrent change.
 * ES5 syntax for legacy Safari.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_FIRESTORE_PROFILE_STORE=api;
})(this,function(){
 'use strict';
 var STAGING_APP='sanastoyhteiso-v3-staging-auth';
 function assertUid(uid){
   if(typeof uid!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
     throw Error('Invalid authenticated UID');
 }
 function create(opts){
   if(!opts||!opts.guard||typeof opts.guard.validate!=='function'||
     !opts.sdk||typeof opts.sdk.firestore!=='function'||
     !opts.sdk.apps||!opts.auth||typeof opts.auth.getState!=='function'||
     !opts.profiles||typeof opts.profiles.validProfile!=='function')
     throw Error('Staging Firestore profile dependencies missing');

   // Must run BEFORE ANY Firestore SDK call or document reference is created.
   var approved=opts.guard.validate({
     site:opts.site, firebase:opts.config,
     expectedProjectId:opts.expectedProjectId,
     productionProjectId:opts.productionProjectId
   });
   if(!approved||approved.isolated!==true||
      approved.projectId!==opts.config.projectId)
     throw Error('Unapproved staging Firestore project');

   var app=null;
   for(var i=0;i<opts.sdk.apps.length;i++){
     if(opts.sdk.apps[i].name===STAGING_APP){app=opts.sdk.apps[i];break;}
   }
   if(!app||!app.options||app.options.projectId!==approved.projectId||
     app.options.apiKey!==opts.config.apiKey)
     throw Error('Matching isolated Firebase Auth app is required');

   var db=opts.sdk.firestore(app);
   if(!db||typeof db.collection!=='function'||
      typeof db.runTransaction!=='function')
     throw Error('Firestore SDK transaction support required');

   function current(uid,revision){
     assertUid(uid);
     var s=opts.auth.getState();
     if(!s||s.status!=='verified'||!s.user||!s.user.verified||
        s.user.uid!==uid||s.projectId!==approved.projectId||
        (typeof revision==='number'&&s.revision!==revision))
       throw Error('Account changed; refuse cross-user profile action');
     return s.revision;
   }
   function reference(uid){return db.collection('users').doc(uid);}
   function validate(profile){
     if(!opts.profiles.validProfile(profile))
       throw Error('Invalid profile: no Firestore write performed');
     // Never allow hidden account identifiers, tokens or email in public profile.
     return {alias:profile.alias,publicStats:profile.publicStats,
       learned:profile.learned,updatedAt:profile.updatedAt};
   }
   function read(uid){
     var rev;
     try{rev=current(uid);}catch(err){return Promise.reject(err);}
     return Promise.resolve().then(function(){
       current(uid,rev);return reference(uid).get();
     }).then(function(snapshot){
       current(uid,rev);
       var existing=snapshot.exists?snapshot.data():null;
       if(existing!==null&&!opts.profiles.validProfile(existing))
         throw Error('Invalid existing profile; preserve original record');
       return existing;
     });
   }
   function createProfile(uid,profile){
     var rev,clean;
     try{rev=current(uid);clean=validate(profile);}
     catch(err){return Promise.reject(err);}
     return db.runTransaction(function(tx){
       current(uid,rev);
       var ref=reference(uid);
       return tx.get(ref).then(function(snapshot){
         current(uid,rev);
         if(snapshot.exists){
           var collision=Error('Profile already exists, not overwritten');
           collision.code='already-exists';
           throw collision;
         }
         tx.set(ref,clean);
       });
     }).then(function(){
       current(uid,rev);
     });
   }
   function updateProfile(uid,profile){
     var rev,clean;
     try{rev=current(uid);clean=validate(profile);}
     catch(err){return Promise.reject(err);}
     return db.runTransaction(function(tx){
       current(uid,rev);
       var ref=reference(uid);
       return tx.get(ref).then(function(snapshot){
         current(uid,rev);
         if(!snapshot.exists)throw Error('Cannot update nonexistent profile');
         var existing=snapshot.data();
         if(!opts.profiles.validProfile(existing))
           throw Error('Invalid existing profile; do not overwrite');
         // Higher-layer profile contract does not own learning count. It
         // must preserve whatever the transaction just read.
         if(clean.learned!==existing.learned)
           throw Error('Concurrent learning change detected; retry safely');
         if(clean.updatedAt<existing.updatedAt)
           throw Error('Stale profile edit; do not overwrite');
         tx.update(ref,clean);
       });
     }).then(function(){
       current(uid,rev);
     });
   }
   return {read:read,create:createProfile,update:updateProfile,
     projectId:approved.projectId};
 }
 return {create:create};
});
