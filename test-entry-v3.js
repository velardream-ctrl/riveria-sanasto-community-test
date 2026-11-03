/* TEST REPOSITORY ENTRY ONLY.
 * Retire service worker belonging to this test repo (which previously served
 * a Firebase-connected legacy test root), then open the isolated v3 classic UI.
 * Never unregister workers from other repositories on the same GitHub host.
 * No network requests, cookies, credentials or user data are accessed.
 * ES5 syntax, including Safari iOS12.
 */
(function(w){
 'use strict';
 function next(){w.location.replace('./v3-classic/');}
 var sw=w.navigator&&w.navigator.serviceWorker;
 if(!sw||typeof sw.getRegistration!=='function'){next();return;}
 var here=w.location.pathname||'';
 var scopeRoot=here.slice(0,here.lastIndexOf('/')+1);
 function isOurScope(scope){
   if(!scope||typeof scope!=='string')return false;
   // No partial-prefix matches; this must be the test repo's own root.
   var url=scopeRoot;
   return scope.slice(-url.length)===url;
 }
 function clearOldTestCache(){
   if(!w.caches||typeof w.caches.keys!=='function')return Promise.resolve();
   return w.caches.keys().then(function(names){
     var tasks=[];
     names.forEach(function(name){
       if(name.indexOf('riveria-sanasto-community-')===0)
         tasks.push(w.caches.delete(name));
     });
     return Promise.all(tasks);
   });
 }
 try{
   sw.getRegistration(w.location.href).then(function(reg){
     if(!reg||!isOurScope(reg.scope)){next();return;}
     reg.unregister().then(clearOldTestCache).then(next,next);
   },next);
 }catch(ignore){next();}
})(window);
