/* Isolated TEST build: only a Firebase-issued admin claim reveals the admin link.
 * The target admin page checks the server-issued claim again and Firestore
 * Security Rules must independently authorize admin_metrics reads.
 * No admin preview controls are placed in the student Data section.
 */
(function(w,d){
 'use strict';
 function link(){return d.getElementById('rs-admin-entry');}
 function hide(){var e=link();if(e)e.hidden=true;}
 function show(){var e=link();if(e)e.hidden=false;}
 function boot(){
   if(!w.firebase||!w.firebase.auth)return;
   var auth;try{auth=w.firebase.auth();}catch(ignore){return;}
   auth.onAuthStateChanged(function(user){
     hide();
     if(!user||user.emailVerified!==true)return;
     user.getIdTokenResult(true).then(function(result){
       if(auth.currentUser&&auth.currentUser.uid===user.uid&&result&&result.claims&&result.claims.admin===true)show();
     },hide);
   },hide);
 }
 if(d.readyState==='complete')boot();else w.addEventListener('load',boot);
})(window,document);
