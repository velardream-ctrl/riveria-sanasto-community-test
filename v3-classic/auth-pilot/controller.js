/* SANASTOYHTEISO v3 — STAGING AUTH CONTROLLER (ES5).
 * A framework-independent Firebase identity state machine. No Firebase SDK,
 * network access, browser storage or service credentials in this file.
 * It refuses to initialize without the isolated staging-project guard.
 * TEST identities are never interchangeable with production Firebase UIDs.
 *
 * Production migration requirement: KEEP the existing production Firebase
 * Auth project/identities; this module is only for a separate STAGING pilot.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_AUTH_CONTROLLER=api;
})(this,function(){
 'use strict';
 function validUID(id){
   return typeof id==='string'&&id.length>=1&&id.length<=128&&
     /^[a-zA-Z0-9_-]+$/.test(id);
 }
 function safeError(e){
   var code=e&&e.code;
   if(typeof code==='string'&&/^auth\/[a-z-]{1,60}$/.test(code))
     return code;
   return 'auth/unavailable';
 }
 function userView(user){
   if(!user)return null;
   if(!validUID(user.uid)||typeof user.email!=='string'||
       user.email.length>320||!user.email||user.email.indexOf('@')<1)
     throw Error('Untrusted identity from Auth SDK');
   return {uid:user.uid,email:user.email,verified:user.emailVerified===true,
     displayName:typeof user.displayName==='string'?
       user.displayName.slice(0,80):''};
 }
 function create(opts){
   if(!opts||!opts.guard||typeof opts.guard.validate!=='function'||
      !opts.adapter||!opts.adapter.onAuthStateChanged||
      !opts.adapter.signInWithGoogle||!opts.adapter.signOut||
      !opts.adapter.currentUser||!opts.adapter.getIdToken||
      !opts.adapter.reloadCurrentUser)
     throw Error('Incomplete isolated Auth dependencies');
   // MUST fail before SDK subscribe, initialize, reads, token work or writes.
   var configuration=opts.guard.validate({
     site:opts.site,firebase:opts.firebase,
     expectedProjectId:opts.expectedProjectId,
     productionProjectId:opts.productionProjectId
   });
   if(!configuration||configuration.isolated!==true)
     throw Error('Unverified isolation is not authorization');
   var status='signed_out',current=null,revision=0,started=false,
     disposed=false,watchers=[],unsubscribe=null,pending=false,
     blockedAfterLogout=false,
     initFailed=null;
   function publish(){
     var state=snapshot();
     watchers.slice().forEach(function(fn){try{fn(state);}catch(ignore){}});
   }
   function snapshot(){
     var u=current?{uid:current.uid,email:current.email,
       verified:current.verified,displayName:current.displayName}:null;
     return {status:status,user:u,revision:revision,
       projectId:configuration.projectId,error:initFailed};
   }
   function change(next,user,error){
     revision++;status=next;current=user||null;initFailed=error||null;publish();
   }
   function applyAuth(user){
     // A late SDK callback must never re-open a session after explicit logout.
     if(disposed||blockedAfterLogout)return;
     try{
       var safe=userView(user);
       change(safe?(safe.verified?'verified':'unverified'):'signed_out',safe,null);
     }catch(err){change('error',null,'auth/untrusted-identity');}
   }
   function start(){
     if(disposed)throw Error('Controller already closed');
     if(started)return snapshot();
     started=true;change('checking',null,null);
     // The adapter has already been guarded and may safely subscribe.
     try{
       var off=opts.adapter.onAuthStateChanged(function(u){applyAuth(u);},
         function(e){change('error',null,safeError(e));});
       if(typeof off!=='function')throw Error('Auth observer did not return unsubscribe');
       unsubscribe=off;
     }catch(e){change('error',null,'auth/unavailable');}
     return snapshot();
   }
   function subscribe(fn){
     if(typeof fn!=='function')throw Error('Observer must be a function');
     watchers.push(fn);fn(snapshot());
     return function(){
       var i=watchers.indexOf(fn);if(i>=0)watchers.splice(i,1);
     };
   }
   function signIn(){
     if(disposed||!started)return Promise.reject(Error('Auth not started'));
     if(pending)return Promise.reject(Error('Sign-in already underway'));
     pending=true;blockedAfterLogout=false;
     change('signing_in',null,null);
     // Popup must open synchronously within the original user click.
     // Delaying it to Promise.then() loses activation on some Safari versions.
     var loginPromise;
     try{loginPromise=opts.adapter.signInWithGoogle();}
     catch(e){pending=false;change('error',null,safeError(e));
       return Promise.reject(Error(safeError(e)));}
     return Promise.resolve(loginPromise).then(function(result){
         pending=false;
         if(disposed)return snapshot();
         // The observer is authoritative, not arbitrary result fields.
         if(result&&result.user&&opts.adapter.currentUser()===result.user)
           applyAuth(result.user);
         return snapshot();
       },function(err){
         pending=false;change('error',null,safeError(err));
         throw Error(safeError(err));
       });
   }
   function verifiedUser(){
     var user=opts.adapter.currentUser();
     if(blockedAfterLogout||status!=='verified'||!current||!current.verified||!user||
        user.uid!==current.uid||user.emailVerified!==true)
       throw Error('Verified authenticated account required');
     return {user:user,uid:current.uid,revision:revision};
   }
   function token(){
     var session;
     try{session=verifiedUser();}
     catch(e){return Promise.reject(e);}
     return Promise.resolve().then(function(){
       return opts.adapter.getIdToken(session.user);
     }).then(function(value){
       var latest=opts.adapter.currentUser();
       if(disposed||revision!==session.revision||
          status!=='verified'||!current||current.uid!==session.uid||
          !latest||latest.uid!==session.uid||latest.emailVerified!==true||
          typeof value!=='string'||!value)
         throw Error('Auth session changed; discard token');
       return value; // never save, log, emit, or expose through snapshot
     });
   }
   function refreshVerification(){
     if(!started||disposed||blockedAfterLogout)
       return Promise.reject(Error('Auth not started'));
     var user=opts.adapter.currentUser();
     if(!user||!current||user.uid!==current.uid)
       return Promise.reject(Error('No signed-in account'));
     var id=user.uid;
     return Promise.resolve().then(function(){
       return opts.adapter.reloadCurrentUser(user);
     }).then(function(){
       var latest=opts.adapter.currentUser();
       if(disposed||!latest||latest.uid!==id)
         throw Error('Account changed during verification check');
       applyAuth(latest);
       return snapshot();
     });
   }
   function logout(){
     if(disposed)return Promise.reject(Error('Controller closed'));
     // Deny all token access immediately, even if sign-out takes time
     // or a delayed Firebase callback tries to restore an old user.
     blockedAfterLogout=true;
     change('signed_out',null,null);
     return Promise.resolve().then(function(){
       return opts.adapter.signOut();
     }).then(function(){return snapshot();},function(err){
       change('error',null,safeError(err));
       throw Error(safeError(err));
     });
   }
   function close(){
     disposed=true;pending=false;blockedAfterLogout=true;
     if(unsubscribe)unsubscribe();
     unsubscribe=null;current=null;status='signed_out';watchers=[];
     revision++;
   }
   return {start:start,subscribe:subscribe,getState:snapshot,
     signInWithGoogle:signIn,getVerifiedIdToken:token,
     refreshEmailVerification:refreshVerification,signOut:logout,close:close};
 }
 return {create:create,validUID:validUID};
});
