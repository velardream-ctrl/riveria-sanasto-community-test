/* Riveria Sanasto Community 2.1.3 — automatic, quota-conscious foreground checks.
   Compatible with ES5 / older Safari. Never silently requests Drive OAuth consent.
   No automatic hard reload: protects local unsynced study progress and Drive session.
*/
(function(){
'use strict';
var SITE_INTERVAL=30*60*1000;       // at most 2 web-worker checks per visible hour
var DRIVE_INTERVAL=15*60*1000;      // checks sync, no API requests if not authorized
var LIBRARY_INTERVAL=60*60*1000;    // only accounts with active subscriptions
var lastSite=0,lastDrive=0,lastLibraries=0,checking=false,noticed=false;
function el(id){return document.getElementById(id);}
function visible(){return !document.hidden;}
function online(){return navigator.onLine!==false;}
function signedIn(){return !!(window.RS_FAMILY&&window.RS_FAMILY.uid);}
function note(txt){var target=el('home-update-status');if(!target)return;target.textContent=txt;target.hidden=!txt;}
function goHome(){
 var b=document.querySelector('#side-nav [data-view="cards"]')||document.querySelector('.mobile-nav [data-view="cards"]');
 if(b&&typeof b.click==='function')b.click();
 try{window.scrollTo(0,0);}catch(ignore){}
}
function hasSubscriptions(){
 if(!signedIn())return false;
 try{var v=localStorage.getItem('rs_community_2_'+window.RS_FAMILY.uid+'_subs');if(!v)return false;
   var obj=JSON.parse(v),keys=Object.keys(obj||{});
   for(var i=0;i<keys.length;i++)if(obj[keys[i]]&&obj[keys[i]].active)return true;
 }catch(ignore){}
 return false;
}
function notifySiteUpdated(){
 if(noticed)return;noticed=true;
 note('Новая версия подготовлена. Она загрузится при следующем открытии приложения.');
}
function onInstalled(worker){
 if(!worker)return;
 function state(){if(worker.state==='installed'||worker.state==='activated')notifySiteUpdated();}
 worker.addEventListener('statechange',state);
 state();
}
function checkSite(){
 if(checking||!online()||!visible()||!('serviceWorker' in navigator))return;
 checking=true;
 navigator.serviceWorker.getRegistration('./').then(function(reg){
   if(!reg){checking=false;return;}
   var onFound=function(){onInstalled(reg.installing);};
   reg.addEventListener('updatefound',onFound);
   if(reg.waiting)notifySiteUpdated();
   return reg.update().then(function(){checking=false;reg.removeEventListener('updatefound',onFound);},function(){checking=false;reg.removeEventListener('updatefound',onFound);});
 },function(){checking=false;});
}
function syncDrive(){
 if(!signedIn()||!window.RS_COMM||typeof window.RS_COMM.sync!=='function')return;
 // RS_COMM.sync() checks that the Google Drive access token is present and valid.
 // Without it, no Drive/Sheets network operation occurs; authorization stays manual.
 try{window.RS_COMM.sync();}catch(ignore){}
}
function updateLibraries(){
 if(!signedIn()||!hasSubscriptions()||!window.RS_COMM||typeof window.RS_COMM.updateSubscriptions!=='function')return;
 try{window.RS_COMM.updateSubscriptions();}catch(ignore){}
}
function tick(force){
 if(!online()||!visible())return;
 var now=Date.now();
 if(!lastSite||now-lastSite>=SITE_INTERVAL){lastSite=now;checkSite();}
 if(signedIn()){
   if(!lastDrive||now-lastDrive>=DRIVE_INTERVAL){lastDrive=now;syncDrive();}
   if(hasSubscriptions()&&(!lastLibraries||now-lastLibraries>=LIBRARY_INTERVAL)){
     lastLibraries=now;updateLibraries();
   }
 }
}
function init(){
 var b=el('brand-home-button'),h=el('heading-home-button');
 if(b)b.addEventListener('click',goHome);
 if(h){h.addEventListener('click',goHome);h.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.keyCode===13||e.keyCode===32){e.preventDefault();goHome();}});}
 // No timer while the tab is sleeping; foreground checks only. No polling background server.
 window.addEventListener('online',function(){lastDrive=0;lastLibraries=0;tick(true);});
 document.addEventListener('visibilitychange',function(){if(visible())tick(false);});
 window.addEventListener('focus',function(){tick(false);});
 window.addEventListener('load',function(){setTimeout(function(){tick(true);},3500);});
 setInterval(function(){tick(false);},60*1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
