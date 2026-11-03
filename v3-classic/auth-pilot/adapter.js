/* SANASTOYHTEISO v3 — STAGING ONLY Firebase compat Auth adapter.
 * NEVER loaded in production or the public v3-classic offline demo.
 * This adapter must be constructed ONLY on a distinct staging Firebase project.
 * No hardcoded Firebase keys, secrets, accounts, ID token storage or Firestore.
 * Target Firebase v8 compat SDK; syntax restricted to ES5.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_FIREBASE_AUTH_ADAPTER=api;
})(this,function(){
 'use strict';
 var APP_NAME='sanastoyhteiso-v3-staging-auth';
 function create(opts){
   if(!opts||!opts.guard||typeof opts.guard.validate!=='function')
     throw Error('Staging project guard required');
   // No Firebase method can execute before this guard passes.
   var result=opts.guard.validate({
     site:opts.site,firebase:opts.config,
     expectedProjectId:opts.expectedProjectId,
     productionProjectId:opts.productionProjectId
   });
   if(!result||result.isolated!==true||result.projectId!==opts.config.projectId)
     throw Error('Unverified Firebase staging project');
   var sdk=opts.sdk;
   if(!sdk||!sdk.auth||!sdk.initializeApp||!sdk.apps)
     throw Error('Firebase compat Auth SDK unavailable');
   if(!sdk.auth.GoogleAuthProvider)
     throw Error('Firebase Google sign-in provider unavailable');
   var app=null,i;
   for(i=0;i<sdk.apps.length;i++){
     if(sdk.apps[i].name===APP_NAME){app=sdk.apps[i];break;}
   }
   if(app){
     if(!app.options||app.options.projectId!==result.projectId||
        app.options.apiKey!==opts.config.apiKey)
       throw Error('Existing staging SDK app points at another Firebase project');
   }else{
     app=sdk.initializeApp({
       apiKey:opts.config.apiKey,
       authDomain:opts.config.authDomain,
       projectId:opts.config.projectId,
       appId:opts.config.appId||undefined
     },APP_NAME);
   }
   var auth=sdk.auth(app);
   if(!auth||typeof auth.onAuthStateChanged!=='function'||
      typeof auth.signInWithPopup!=='function'||
      typeof auth.signOut!=='function')
     throw Error('Firebase compat Auth API incompatible');
   function current(){return auth.currentUser||null;}
   function watch(fn,onError){return auth.onAuthStateChanged(fn,onError);}
   function signIn(){
     // Call directly from a real user gesture. No background Google popups.
     var provider=new sdk.auth.GoogleAuthProvider();
     return auth.signInWithPopup(provider);
   }
   function signOut(){return auth.signOut();}
   function getIdToken(user){
     if(!user||!current()||current().uid!==user.uid)
       return Promise.reject(Error('Account changed before token request'));
     return user.getIdToken();
   }
   function reload(user){
     if(!user||!current()||current().uid!==user.uid)
       return Promise.reject(Error('No matching current account'));
     return user.reload();
   }
   return {onAuthStateChanged:watch,signInWithGoogle:signIn,
     signOut:signOut,currentUser:current,
     getIdToken:getIdToken,reloadCurrentUser:reload,
     projectId:result.projectId};
 }
 return {create:create};
});
