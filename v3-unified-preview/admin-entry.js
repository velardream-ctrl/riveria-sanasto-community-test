/* TEST only. A Firebase custom claim may reveal a link, never grant server access.
 * Fail closed on changed sessions, token refreshes and an unexpected Firebase app.
 * ES5-compatible for older Safari; no Firebase writes.
 */
(function(w,d){
 'use strict';
 var generation=0,lastUser=null,forcedUser=null;
 function link(){return d.getElementById('rs-admin-entry');}
 function hide(){var e=link();if(e)e.hidden=true;}
 function show(){var e=link();if(e)e.hidden=false;}
 function validApp(){
   var c=w.RS_FIREBASE_CONFIG||{},f=w.firebase,app;
   if(!f||!f.apps||!f.apps.length||typeof f.app!=='function'||
      c.projectId!=='sanastoyhteiso-v3-development'||
      c.authDomain!=='sanastoyhteiso-v3-development.firebaseapp.com'||
      typeof c.apiKey!=='string'||!c.apiKey)return false;
   try{app=f.app();}catch(ignore){return false;}
   return !!(app&&app.options&&app.options.projectId===c.projectId&&
      app.options.authDomain===c.authDomain&&app.options.apiKey===c.apiKey);
 }
 function boot(){
   hide();
   if(!validApp()||!w.firebase||typeof w.firebase.auth!=='function')return;
   var auth;
   try{auth=w.firebase.auth();}catch(ignore){return;}
   if(!auth||typeof auth.onIdTokenChanged!=='function')return;
   try{
     auth.onIdTokenChanged(function(user){
       var n=++generation;
       hide();
       if(user!==lastUser)forcedUser=null;
       lastUser=user;
       if(!user||user.emailVerified!==true||user.isAnonymous===true)return;
       var force=forcedUser!==user;forcedUser=user;
       try{
         user.getIdTokenResult(force).then(function(result){
           if(n!==generation||auth.currentUser!==user||lastUser!==user)return;
           if(result&&result.claims&&result.claims.admin===true)show();
           else hide();
         },function(){if(n===generation&&auth.currentUser===user)hide();});
       }catch(ignore){if(n===generation)hide();}
     },function(){generation++;hide();});
   }catch(ignore){generation++;hide();}
 }
 if(d.readyState==='complete')boot();else w.addEventListener('load',boot);
})(window,document);
