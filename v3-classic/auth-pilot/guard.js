/* STAGING BACKEND PRE-FLIGHT ONLY; not loaded by live or classic demo sites.
 * Before any test Firebase request, require a different Firebase project,
 * verified project/app IDs and the exact isolated GitHub Pages test path.
 * Pure validation: does not call SDK, fetch, authentication or Firestore.
 * This client check is only a guardrail; real isolation requires separate
 * Firebase project, server security rules and independent Google OAuth setup.
 * ES5 compatible.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_TEST_BACKEND_GUARD=api;
})(this,function(){
 'use strict';
 var LIVE=['riveria-sanasto-community-test'];
 // Project ID confirmed from the owner's separate Firebase Console screenshot.
 var VERIFIED_STAGING='sanastoyhteiso-v3-development';
 var ORIGIN='https://velardream-ctrl.github.io';
 var PATH='/riveria-sanasto-community-test/v3-classic/';
 function safeId(s){
   return typeof s==='string'&&/^[a-z][a-z0-9-]{5,38}$/.test(s)&&
     s.indexOf('--')===-1;
 }
 function check(input){
   if(!input||typeof input!=='object')throw Error('Missing isolated test configuration');
   var site=input.site||{},project=input.firebase||{};
   var id=project.projectId,expected=input.expectedProjectId;
   if(!safeId(id)||!safeId(expected)||id!==expected)
     throw Error('A verified, exact new staging Firebase project is required');
   if(LIVE.indexOf(id)!==-1)
     throw Error('The existing Firebase project is used by the live site');
   if(id!==VERIFIED_STAGING)
     throw Error('Use only the exact verified independent staging Firebase project');
   if(project.authDomain!==id+'.firebaseapp.com')
     throw Error('The test Firebase auth domain must match its staging project');
   if(typeof project.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{30,}$/.test(project.apiKey))
     throw Error('A public Firebase Web SDK API key for the test project is required');
   if(site.origin!==ORIGIN||site.pathname.indexOf(PATH)!==0)
     throw Error('Test Firebase only allowed on the dedicated v3-classic test path');
   if(input.productionProjectId&&input.productionProjectId===id)
     throw Error('Test Firebase must not equal the production project');
   return Object.freeze?Object.freeze({isolated:true,projectId:id,testSite:PATH}):
     {isolated:true,projectId:id,testSite:PATH};
 }
 return {validate:check,liveProjectIds:LIVE.slice(),verifiedStagingProjectId:VERIFIED_STAGING,testOrigin:ORIGIN,testPath:PATH};
});
