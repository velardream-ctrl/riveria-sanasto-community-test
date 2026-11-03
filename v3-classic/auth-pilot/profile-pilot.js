/* V3 STAGING ONLY. Explicit user-triggered personal profile test.
 * Only the isolated development Firebase project. No live account migration.
 * ES5-compatible; never expose token, email, UID, or document payload in UI.
 */
(function(w,d){
 'use strict';
 var CONFIG=w.RS_V3_AUTH_PILOT_CONFIG,guard=w.RS_V3_TEST_BACKEND_GUARD;
 var controller=null,client=null,store=null,db=null,busy=false,started=false,securityConfirmed=false;
 var PATH='/riveria-sanasto-community-test/v3-classic/auth-pilot/profile.html';
 function el(id){return d.getElementById(id);}
 function put(id,value){el(id).textContent=value;}
 function state(){return controller&&controller.getState();}
 function verified(){var s=state();return !!(s&&s.status==='verified'&&s.user&&s.user.verified);}
 function controls(){
   var s=state(),v=verified();
   el('login').disabled=busy||!s||s.status==='verified'||s.status==='unverified'||s.status==='checking'||s.status==='signing_in';
   el('logout').disabled=busy||!s||!s.user;
   el('read').disabled=busy||!v;el('register').disabled=busy||!v||!securityConfirmed;
   el('deny').disabled=busy||!v;
 }
 function note(value,error){put('message',value);el('message').className=error?'state error':'state ok';}
 function profile(p){
   el('profile').hidden=!p;
   put('profile-status',p?'Существующий профиль найден':'Профиль ещё не создан');
   if(p){put('alias',p.alias);put('learned',String(p.learned));
     put('visibility',p.publicStats?'Публичная статистика выбрана':'Закрыта');}
 }
 function errorCode(e){
   if(e&&typeof e.code==='string'&&/^(auth\/[a-z-]{1,60}|permission-denied|already-exists)$/.test(e.code))return e.code;
   return 'операция не удалась — проверь вход и соединение';
 }
 function onState(s){
   var names={signed_out:'Не выполнен',checking:'Проверка…',signing_in:'Открывается Google…',
     verified:'Подтверждён',unverified:'Email не подтверждён',error:'Ошибка входа'};
   put('auth-status',names[s.status]||'Неизвестно');
   el('profile').hidden=true;
   put('profile-status',s.status==='verified'?'Нажми «Прочитать профиль»':'Требуется подтверждённый вход');
   put('deny-status','Не проверено');securityConfirmed=false;controls();
 }
 function run(action,success){
   if(!verified()||busy)return;
   busy=true;controls();note('Выполняется проверка…',false);
   Promise.resolve().then(action).then(function(value){
     if(verified()){
       var result=success?success(value):null;
       if(result!==false)note('Проверка завершена.',false);
     }
   },function(err){if(verified())note('Ошибка: '+errorCode(err),true);}).then(function(){
     busy=false;controls();
   },function(){busy=false;controls();});
 }
 function boot(){
   if(started)return;started=true;
   try{
     if(!CONFIG||!guard||!w.firebase||!w.firebase.firestore||
       !w.RS_V3_FIREBASE_AUTH_ADAPTER||!w.RS_V3_AUTH_CONTROLLER||
       !w.RS_V3_PROFILE_CONTRACT||!w.RS_V3_FIRESTORE_PROFILE_STORE)throw Error('Missing components');
     var site={origin:w.location.origin,pathname:w.location.pathname};
     if(site.pathname!==PATH)throw Error('Wrong path');
     var args={guard:guard,site:site,config:CONFIG.firebase,
       expectedProjectId:CONFIG.expectedProjectId,productionProjectId:CONFIG.productionProjectId};
     guard.validate({site:site,firebase:CONFIG.firebase,
       expectedProjectId:CONFIG.expectedProjectId,productionProjectId:CONFIG.productionProjectId});
     var adapter=w.RS_V3_FIREBASE_AUTH_ADAPTER.create({
       guard:guard,site:site,config:CONFIG.firebase,
       expectedProjectId:CONFIG.expectedProjectId,productionProjectId:CONFIG.productionProjectId,sdk:w.firebase});
     controller=w.RS_V3_AUTH_CONTROLLER.create({
       guard:guard,site:site,firebase:CONFIG.firebase,
       expectedProjectId:CONFIG.expectedProjectId,productionProjectId:CONFIG.productionProjectId,adapter:adapter});
     store=w.RS_V3_FIRESTORE_PROFILE_STORE.create({
       guard:guard,site:site,config:CONFIG.firebase,
       expectedProjectId:CONFIG.expectedProjectId,productionProjectId:CONFIG.productionProjectId,
       sdk:w.firebase,auth:controller,profiles:w.RS_V3_PROFILE_CONTRACT});
     client=w.RS_V3_PROFILE_CONTRACT.create({
       auth:controller,store:store,clock:function(){return Date.now();}});
     var app=null,i;
     for(i=0;i<w.firebase.apps.length;i++)
       if(w.firebase.apps[i].name==='sanastoyhteiso-v3-staging-auth')app=w.firebase.apps[i];
     if(!app||!app.options||app.options.projectId!==CONFIG.expectedProjectId)
       throw Error('Mismatched test Firebase app');
     db=w.firebase.firestore(app);
     controller.subscribe(onState);controller.start();
   }catch(e){
     controller=null;put('auth-status','Заблокировано');
     note('Безопасный вход в новую тестовую базу не подтверждён.',true);return;
   }
   el('login').addEventListener('click',function(){
     if(!controller)return;
     // Google popup must open synchronously in the user's click handler.
     controller.signInWithGoogle().catch(function(err){note('Ошибка Google-входа: '+errorCode(err),true);});
   });
   el('logout').addEventListener('click',function(){
     if(!controller||busy)return;
     controller.signOut().catch(function(err){note('Ошибка выхода: '+errorCode(err),true);});
   });
   el('read').addEventListener('click',function(){
     run(function(){return client.read();},profile);
   });
   el('register').addEventListener('click',function(){
     // Only this explicitly clicked action may create a real staging document.
     run(function(){return client.ensureRegistered();},profile);
   });
   el('deny').addEventListener('click',function(){
     run(function(){
       // Fixed invented UID, not another actual user's identity.
       // Fetch ONLY from server; never display any response payload.
       var before=state(),uid=before.user.uid;
       return db.collection('users').doc('V3_SYNTHETIC_NOT_A_REAL_USER_20261103').get({source:'server'})
         .then(function(){
           if(!verified()||state().user.uid!==uid||state().revision!==before.revision)
             throw Error('Account changed');
           return false;
         },function(err){
           if(!verified()||state().user.uid!==uid||state().revision!==before.revision)
             throw Error('Account changed');
           if(err&&err.code==='permission-denied')return true;
           throw err;
         });
     },function(denied){
       securityConfirmed=!!denied;
       put('deny-status',denied?'PASS: Firestore отказал в доступе':'ОПАСНО: Firestore разрешил чужое чтение');
       controls();
       if(!denied){note('Правила сервера необходимо проверить. Создание профилей запрещено.',true);return false;}
     });
   });
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);
 else boot();
})(window,document);
