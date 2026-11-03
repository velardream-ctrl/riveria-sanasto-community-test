/* Independent Google Auth pilot for v3 — no Firestore, users collection,
 * cloud sync, progress, profile writes, or Google Analytics.
 * This page is separate from the familiar v3-classic offline demo.
 * Auth operations are only possible after verifying exact project and URL.
 * ES5 script, browsers must still be tested on actual iPhone/iPad.
 */
(function(w,d){
 'use strict';
 var config=w.RS_V3_AUTH_PILOT_CONFIG,guard=w.RS_V3_TEST_BACKEND_GUARD;
 var adapterFactory=w.RS_V3_FIREBASE_AUTH_ADAPTER;
 var controllerFactory=w.RS_V3_AUTH_CONTROLLER;
 var currentLang='ru',control=null,readyDone=false;
 var words={
  ru:{title:'Проверка Google-входа',subtitle:'Отдельный тестовый Firebase-проект. Настоящие словари и результаты не подключены.',
    notice:'При первом входе Firebase создаст новую тестовую учётную запись. Это не аккаунт рабочего Sanastoyhteisö. Здесь нет Firestore и личных учебных данных.',
    login:'Войти через Google',logout:'Выйти',refresh:'Проверить подтверждение почты',
    state:'Состояние',project:'Firebase-проект',email:'Почта тестового входа',
    blocked:'Ошибка безопасности: подключение не выполнено. Проверь адрес и настройки.',
    ready:'Ожидание входа',checking:'Проверка сеанса',signing_in:'Открываем Google',
    signed_out:'Вход не выполнен',unverified:'Email не подтверждён',verified:'Вход подтверждён',
    error:'Ошибка входа',startError:'Не удалось загрузить модуль Firebase',
    popupBlocked:'Браузер блокирует вход через всплывающее окно. Открой страницу в обычном браузере и разреши всплывающее окно.',
    internalError:'Не удалось завершить Google-вход. Если ты открыл страницу внутри ChatGPT или другого приложения, скопируй адрес и открой его в обычном Safari. Если ошибка повторяется в Safari, сообщи код auth/internal-error.',
    providerMissing:'В новом Firebase включи Authentication → Sign-in method → Google, затем добавь домен velardream-ctrl.github.io в Authorized domains.',
    disabled:'Включи Google Sign-in в новом Firebase; после этого можно проверять вход.',
    back:'Вернуться к тестовому Sanastoyhteisö',explain:'Это отдельная проверочная страница, основной сайт не изменён.'},
  fi:{title:'Google-kirjautumisen testi',subtitle:'Erillinen Firebase-testiprojekti. Omat sanastot ja opintotulokset eivät ole käytössä.',
    notice:'Ensimmäinen kirjautuminen luo testitilin uuteen Firebase-projektiin. Se ei ole käytössä olevan Sanastoyhteisön tili. Firestorea ei käytetä.',
    login:'Kirjaudu Googlella',logout:'Kirjaudu ulos',refresh:'Tarkista sähköpostin vahvistus',
    state:'Tila',project:'Firebase-projekti',email:'Testitilin sähköposti',blocked:'Turvatarkistus epäonnistui. Yhteyttä ei muodostettu.',
    ready:'Odottaa kirjautumista',checking:'Tarkistetaan istunto',signing_in:'Avataan Google',
    signed_out:'Ei kirjautunut',unverified:'Sähköpostia ei vahvistettu',verified:'Kirjautuminen vahvistettu',
    error:'Kirjautumisvirhe',startError:'Firebase-moduulia ei voitu ladata',
    popupBlocked:'Ponnahdusikkuna estettiin. Avaa sivu selaimessa.',
    internalError:'Google-kirjautuminen epäonnistui. Jos sivu on sovelluksen sisäisessä selaimessa, avaa osoite suoraan Safarissa. Jos virhe jatkuu, ilmoita koodi auth/internal-error.',
    providerMissing:'Ota Google-kirjautuminen käyttöön uuden Firebase-projektin Authentication-asetuksissa ja lisää velardream-ctrl.github.io sallittuihin verkkotunnuksiin.',
    disabled:'Ota Google-kirjautuminen käyttöön ennen testiä.',
    back:'Takaisin testisanastoon',explain:'Tämä on erillinen testi, vanhaa sivustoa ei muutettu.'},
  en:{title:'Google sign-in test',subtitle:'Separate Firebase staging project. Real personal vocabulary and results are not connected.',
    notice:'The first Google sign-in creates a NEW test Firebase identity. It is not your live Sanastoyhteisö account. No Firestore data is accessed.',
    login:'Sign in with Google',logout:'Sign out',refresh:'Check email verification',
    state:'Status',project:'Firebase project',email:'Test account email',blocked:'Security verification failed. No Firebase connection was made.',
    ready:'Awaiting sign-in',checking:'Checking session',signing_in:'Opening Google',
    signed_out:'Signed out',unverified:'Email not verified',verified:'Signed in and verified',
    error:'Sign-in error',startError:'Could not initialize Firebase module',
    popupBlocked:'Popup blocked. Open the page in a regular browser and allow popups.',
    internalError:'Google sign-in did not complete. If this page is inside another app, copy its URL and open it directly in Safari. If Safari also fails, report code auth/internal-error.',
    providerMissing:'Enable Authentication → Sign-in method → Google in NEW Firebase project. Add velardream-ctrl.github.io to Authorized domains.',
    disabled:'Enable the Google provider in the new Firebase project before testing.',
    back:'Back to demo Sanastoyhteisö',explain:'This is a separate test page. The production site is unchanged.'}
 };
 function el(id){return d.getElementById(id);}
 function setText(id,value){var node=el(id);if(node)node.textContent=value;}
 function t(key){return words[currentLang][key]||key;}
 function msg(code){
   if(code==='auth/internal-error')return t('internalError');
   if(code==='auth/popup-blocked'||code==='auth/popup-closed-by-user'||
      code==='auth/cancelled-popup-request')return t('popupBlocked');
   if(code==='auth/unauthorized-domain'||code==='auth/operation-not-allowed'||
      code==='auth/configuration-not-found')return t('providerMissing')+' ('+code+')';
   if(typeof code==='string'&&/^auth\/[a-z-]{1,60}$/.test(code))
     return t('error')+' ('+code+')';
   return t('error');
 }
 function displayError(code){
   var m=el('pilot-message');if(m){m.textContent=msg(code);m.hidden=false;}
 }
 function paintText(){
   setText('pilot-title',t('title'));setText('pilot-subtitle',t('subtitle'));
   setText('pilot-notice',t('notice'));setText('pilot-state-label',t('state'));
   setText('pilot-project-label',t('project'));setText('pilot-email-label',t('email'));
   setText('pilot-login',t('login'));setText('pilot-logout',t('logout'));
   setText('pilot-refresh',t('refresh'));setText('pilot-back',t('back'));
   setText('pilot-explain',t('explain'));
   var switches=d.querySelectorAll('[data-pilot-lang]');
   for(var i=0;i<switches.length;i++){
     switches[i].setAttribute('aria-pressed',switches[i].getAttribute('data-pilot-lang')===currentLang?'true':'false');
   }
 }
 function paint(state){
   var stage=state?state.status:'error',u=state&&state.user;
   setText('pilot-project','sanastoyhteiso-v3-development');
   setText('pilot-status',t(stage)||t('error'));
   setText('pilot-email',u?u.email:'—');
   el('pilot-login').disabled=stage==='checking'||stage==='signing_in'||stage==='verified'||stage==='unverified';
   el('pilot-logout').disabled=!u;
   el('pilot-refresh').disabled=!u;
 }
 function ready(){
   // Prevent duplicate DOMContentLoaded delivery from creating two Auth observers
   // or resetting a language explicitly selected by the user.
   if(readyDone)return;
   readyDone=true;
   currentLang=(function(){
     var code=(w.navigator.language||'').slice(0,2).toLowerCase();
     return code==='fi'||code==='ru'||code==='en'?code:'en';
   })();
   paintText();
   var options=d.querySelectorAll('[data-pilot-lang]');
   for(var i=0;i<options.length;i++)options[i].addEventListener('click',function(){
     var target=this.getAttribute('data-pilot-lang');
     if(!words[target])return;
     currentLang=target;paintText();paint(control?control.getState():null);
   });
   el('pilot-login').disabled=true;el('pilot-logout').disabled=true;
   el('pilot-refresh').disabled=true;
   try{
     if(!config||!guard||!adapterFactory||!controllerFactory)
       throw Error('Missing gated Auth files');
     var site={origin:w.location.origin,pathname:w.location.pathname};
     var allowed='/riveria-sanasto-community-test/v3-classic/auth-pilot/';
     if(site.pathname!==allowed&&site.pathname!==allowed+'index.html')
       throw Error('Auth pilot available only at its dedicated test URL');
     guard.validate({site:site,firebase:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId});
     if(!w.firebase||typeof w.firebase.auth!=='function')
       throw Error('Firebase SDK not available');
     var adapter=adapterFactory.create({
       guard:guard,site:site,config:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId,sdk:w.firebase
     });
     control=controllerFactory.create({
       guard:guard,site:site,firebase:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId,adapter:adapter
     });
     control.subscribe(paint);
     control.start();
   }catch(err){
     control=null;setText('pilot-status',t('startError'));
     var block=el('pilot-message');block.hidden=false;
     block.textContent=t('blocked');
     return;
   }
   el('pilot-login').addEventListener('click',function(){
     // Google popup MUST open immediately inside the click event.
     if(!control)return;
     el('pilot-message').hidden=true;
     control.signInWithGoogle().catch(function(e){displayError(e.message);});
   });
   el('pilot-logout').addEventListener('click',function(){
     if(!control)return;
     el('pilot-message').hidden=true;
     control.signOut().catch(function(e){displayError(e.message);});
   });
   el('pilot-refresh').addEventListener('click',function(){
     if(!control)return;
     el('pilot-message').hidden=true;
     control.refreshEmailVerification().catch(function(e){displayError(e.message);});
   });
   el('pilot-message').hidden=true;
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ready);
 else ready();
})(window,document);
