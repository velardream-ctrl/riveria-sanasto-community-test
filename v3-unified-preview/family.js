/* Riveria Sanasto Community 2.0.2
   Firebase Google Sign-in via browser popup (compat SDK) with Firebase REST tokens.
   Per-UID local storage. Actual compatibility with Safari iOS 12 requires live testing.
   No shared Apps Script key.
   Old Google Sheets sync is deliberately disabled in family mode. */
(function(){
 'use strict';
 var config=window.RS_FIREBASE_CONFIG||{}, KEY='rs_family_auth_v1', PREFIX='rs_family_v1_', uid='', email='', token='', refreshToken='', expires=0;
 var auth=null,authStarting=false,loginPending=false,loginTimer=null,offlineRecovered=false;
 var busy=false, timer=null, lastSync=0, lastStatus='Не подключено', localVersion=2, registerMode=false;
 var legacyKeys=['rs_scores_v1','rs_user_words_v1','rs_favorites_v1','rs_favorite_meta_v1','rs_deleted_words_v1'];
 function el(id){return document.getElementById(id);}
 function readRaw(k){try{return localStorage.getItem(k);}catch(e){return null;}}
 function writeRaw(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
 function readJson(k,f){try{var t=readRaw(k);return t?JSON.parse(t):f;}catch(e){return f;}}
 function stringify(v){return JSON.stringify(v);}
 function now(){return Date.now();}
 function accountKey(k){return uid?PREFIX+uid+'__'+k:null;}
 function getLocal(k,f){var t=accountKey(k);return t?readJson(t,f):f;}
 function putLocal(k,v){var t=accountKey(k);return t?writeRaw(t,stringify(v)):false;}
 function configured(){return /\S{15,}/.test(config.apiKey||'')&&!/^PASTE_/.test(config.apiKey||'')&&/^[a-z0-9][a-z0-9-]{3,80}$/.test(config.projectId||'')&&!/^PASTE_/.test(config.projectId||'');}
 function formMessage(s,bad){var e=el('family-message');if(e){e.textContent=s;e.className='family-message'+(bad?' error':'');}}
 function status(s,bad){lastStatus=s;var e=el('family-cloud-state');if(e)e.textContent=s; if(bad&&window.console)console.warn('Family sync: '+s);}
 function accountLabel(){var e=el('family-account-badge');if(e){e.hidden=!uid;e.textContent=email||'Мой аккаунт';}}
 function showGate(show){document.body.classList.toggle('family-locked',show);var gate=el('family-gate');if(gate)gate.hidden=!show;accountLabel();}
 function storageKey(k){return accountKey(k);}
 function makeSession(){
  // Store only account identity for offline UI. Firebase SDK owns its own secure auth persistence.
  writeRaw(KEY,stringify({uid:uid,email:email}));
 }
 function resetSession(){try{localStorage.removeItem(KEY);}catch(e){}uid='';email='';token='';refreshToken='';expires=0;offlineRecovered=false;}
 function doneLogin(){loginPending=false;if(loginTimer){clearTimeout(loginTimer);loginTimer=null;}var b=el('family-submit');if(b){b.disabled=false;b.textContent='Войти через Google';}}
 function bootstrapAccount(user){
  if(!user||!user.uid||!user.email)return;
  var changed=uid!==user.uid;
  uid=user.uid;email=user.email;offlineRecovered=false;makeSession();showGate(false);doneLogin();
  if(changed){if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);if(window.RS_COMM)window.RS_COMM.onAuth();}
  formMessage('Вход выполнен. Сеанс сохранён на этом устройстве.',false);
  status('Аккаунт подключён. Облачные данные загружаются отдельно.',false);
 }
 function authErrorMessage(e){var c=e&&e.code||'';var msg=e&&e.message||String(e);
  if(c==='auth/popup-blocked'||c==='auth/popup-closed-by-user'||c==='auth/operation-not-supported-in-this-environment')
   return 'Вход не завершён: установленное веб-приложение может блокировать окно Google. Попробуй открыть сайт в обычном браузере. В браузере и приложении первый вход выполняется отдельно.';
  if(c==='auth/unauthorized-domain')return 'Домен не разрешён в Firebase Authentication. Обратись к владельцу приложения.';
  if(c==='auth/network-request-failed')return 'Нет связи с Firebase. Проверь интернет и попробуй ещё раз.';
  return 'Google: '+msg;
 }
 function initFirebase(){
  if(!window.firebase||!firebase.auth){
   if(!navigator.onLine){var old=readJson(KEY,null);if(old&&old.uid&&old.email){uid=old.uid;email=old.email;offlineRecovered=true;showGate(false);if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);status('Офлайн: сохранённые данные этого устройства',false);return;}}
   formMessage('Firebase Authentication не загрузился. Проверь интернет, открой сайт в браузере и обнови страницу.',true);showGate(true);return;
  }
  try{
   if(!firebase.apps.length)firebase.initializeApp({apiKey:config.apiKey,authDomain:config.authDomain||config.projectId+'.firebaseapp.com',projectId:config.projectId});
   auth=firebase.auth();authStarting=true;
   // Native Firebase LOCAL persistence restores a session after closing a browser or PWA.
   auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
     formMessage('Не удалось сохранить долгий сеанс: '+String(e.message||e)+'. Вход может потребоваться снова.',true);
   });
   auth.onAuthStateChanged(function(user){
     authStarting=false;
     if(user){bootstrapAccount(user);return;}
     if(!navigator.onLine){var old=readJson(KEY,null);
       if(old&&old.uid&&old.email){uid=old.uid;email=old.email;offlineRecovered=true;showGate(false);if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);status('Офлайн: только сохранённые на этом устройстве данные',false);return;}
     }
     if(!loginPending){resetSession();showGate(true);formMessage('Войди через Google один раз в этом браузере или приложении. После этого сеанс будет сохраняться.',false);}
   },function(e){authStarting=false;doneLogin();showGate(true);formMessage(authErrorMessage(e),true);});
  }catch(e){authStarting=false;doneLogin();showGate(true);formMessage('Ошибка запуска Firebase: '+String(e.message||e),true);}
 }
 function xhr(method,url,body,headers){return new Promise(function(resolve,reject){var x=new XMLHttpRequest();x.open(method,url,true);x.timeout=25000;Object.keys(headers||{}).forEach(function(k){x.setRequestHeader(k,headers[k]);});x.onreadystatechange=function(){if(x.readyState!==4)return;var out={code:x.status,data:null};try{out.data=JSON.parse(x.responseText);}catch(e){out.data={};}resolve(out);};x.onerror=function(){reject(new Error('Не удалось подключиться к серверу'));};x.ontimeout=function(){reject(new Error('Время ожидания истекло'));};x.send(body===undefined||body===null?null:body);});}
 function request(method,url,payload,auth){var h={};if(payload!==null&&payload!==undefined)h['Content-Type']='application/json';if(auth)h['Authorization']='Bearer '+auth;return xhr(method,url,payload===null?null:stringify(payload),h);}
 function authError(x){var c=x&&x.error&&x.error.message||'';var m={INVALID_LOGIN_CREDENTIALS:'Неверная почта или пароль',EMAIL_NOT_FOUND:'Аккаунт не найден',INVALID_PASSWORD:'Неверный пароль',USER_DISABLED:'Этот аккаунт отключён',TOO_MANY_ATTEMPTS_TRY_LATER:'Слишком много попыток. Попробуй позже',OPERATION_NOT_ALLOWED:'В Firebase не включён вход по паролю'};return m[c]||('Ошибка входа: '+c);}
 function getToken(){
  if(!auth||!auth.currentUser||auth.currentUser.uid!==uid)return Promise.reject(new Error('Для облачного доступа нужен вход через Google на этом устройстве'));
  return auth.currentUser.getIdToken();
 }
 function getEmailVerificationStatus(){
  if(!auth||!auth.currentUser)return Promise.reject(new Error('Сначала войди в аккаунт'));
  return auth.currentUser.reload().then(function(){return !!auth.currentUser.emailVerified;});
 }
 function sendVerify(){
  if(!auth||!auth.currentUser)return Promise.reject(new Error('Сначала войди в аккаунт'));
  return auth.currentUser.reload().then(function(){
   if(auth.currentUser.emailVerified)return true;
   return auth.currentUser.sendEmailVerification().then(function(){return true;});
  });
 }
 function login(evt){
  if(evt)evt.preventDefault();
  if(loginPending)return;
  if(!configured()){formMessage('Сначала настрой Firebase в config.js.',true);return;}
  if(!navigator.onLine){formMessage('Для входа через Google нужен интернет.',true);return;}
  if(!auth){formMessage('Модуль входа ещё не готов. Обнови страницу или открой сайт в браузере.',true);return;}
  loginPending=true;var btn=el('family-submit');if(btn){btn.disabled=true;btn.textContent='Входим…';}
  formMessage('Открываю вход через Google. Если окно не появится, проверь блокировку всплывающих окон.',false);
  // Prevent an iOS PWA from becoming a permanently disabled screen if the OAuth popup stalls.
  loginTimer=setTimeout(function(){if(loginPending){doneLogin();formMessage('Вход через Google не завершён. Попробуй снова или открой сайт в обычном браузере. Данные не удалены.',true);}},25000);
  var provider=new firebase.auth.GoogleAuthProvider();
  try{auth.signInWithPopup(provider).then(function(result){
   if(result&&result.user)bootstrapAccount(result.user);
  }).catch(function(e){doneLogin();formMessage(authErrorMessage(e),true);});}
  catch(e){doneLogin();formMessage(authErrorMessage(e),true);}
 }
 function updateToken(){return getToken();}
 function empty(){return {schema:1,scores:{},words:{},favorites:{},scope:{value:'mine',updatedAt:0}};}
 function mergeScores(a,b){var m={},k; a=a||{};b=b||{};Object.keys(a).concat(Object.keys(b)).forEach(function(id){if(m[id])return;var x=a[id]||{},y=b[id]||{};m[id]={correct:Math.max(Number(x.correct)||0,Number(y.correct)||0),wrong:Math.max(Number(x.wrong)||0,Number(y.wrong)||0),seen:Math.max(Number(x.seen)||0,Number(y.seen)||0),last:Math.max(Number(x.last)||0,Number(y.last)||0)};});return m;}
 function mergeRecords(a,b){a=a||{};b=b||{};var m={};Object.keys(a).concat(Object.keys(b)).forEach(function(id){if(Object.prototype.hasOwnProperty.call(m,id))return;var x=a[id],y=b[id];m[id]=!x?y:!y?x:(Number(x.updatedAt)||0)>=(Number(y.updatedAt)||0)?x:y;});return m;}
 function mergeData(a,b){a=a||empty();b=b||empty();var s=a.scope||{},t=b.scope||{};return {schema:1,scores:mergeScores(a.scores,b.scores),words:mergeRecords(a.words,b.words),favorites:mergeRecords(a.favorites,b.favorites),scope:(Number(s.updatedAt)||0)>=(Number(t.updatedAt)||0)?s:t};}
 function getState(){var scores=getLocal('rs_scores_v1',{}),words=getLocal('rs_user_words_v1',[]),fav=getLocal('rs_favorites_v1',{}),meta=getLocal('rs_favorite_meta_v1',{}),deleted=getLocal('rs_deleted_words_v1',{}),scope=getLocal('rs_family_scope_v1',{value:'mine',updatedAt:0}),w={},f={};
 (Array.isArray(words)?words:[]).forEach(function(x){if(x&&x.id){var v=JSON.parse(stringify(x));v.updatedAt=Number(v.updatedAt)||1;v.deleted=false;w[x.id]=v;}});
 Object.keys(deleted||{}).forEach(function(id){var at=Number(deleted[id])||1;if(!w[id]||at>=Number(w[id].updatedAt||0))w[id]={id:id,updatedAt:at,deleted:true};});
 Object.keys(fav||{}).forEach(function(id){f[id]={starred:!!fav[id],updatedAt:Number(meta&&meta[id]&&meta[id].updatedAt)||1};});
 Object.keys(meta||{}).forEach(function(id){if(!f[id]||Number(meta[id].updatedAt)>f[id].updatedAt)f[id]={starred:!!meta[id].starred,updatedAt:Number(meta[id].updatedAt)||1};});
 return {schema:1,scores:scores&&typeof scores==='object'?scores:{},words:w,favorites:f,scope:scope}; }
 function putState(x){var words=[],deleted={},fav={},fm={};Object.keys(x.words||{}).forEach(function(id){var v=x.words[id];if(!v)return;if(v.deleted){deleted[id]=Number(v.updatedAt)||1;}else if(v.fi&&v.ru){words.push(v);}});
 Object.keys(x.favorites||{}).forEach(function(id){var v=x.favorites[id];if(v){fav[id]=!!v.starred;fm[id]={starred:!!v.starred,updatedAt:Number(v.updatedAt)||1};}});
 var ok=putLocal('rs_scores_v1',x.scores||{})&&putLocal('rs_user_words_v1',words)&&putLocal('rs_favorites_v1',fav)&&putLocal('rs_favorite_meta_v1',fm)&&putLocal('rs_deleted_words_v1',deleted)&&putLocal('rs_family_scope_v1',x.scope||{value:'mine',updatedAt:0});
 if(ok&&window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(false);return ok; }
 function sync(){if(!uid)return Promise.resolve(false);
  if(window.RS_V3_RELEASE&&window.RS_V3_RELEASE.isActive())return window.RS_V3_RELEASE.refresh();
  if(window.RS_COMM){return window.RS_COMM.sync();}status('Подключи собственный Google Drive в разделе «Данные»',false);return Promise.resolve(false);}
 function schedule(){if(!uid)return;if(window.RS_COMM)window.RS_COMM.onLocalChange();}
 function logout(){
  if(!window.confirm('Выйти из этого устройства? Локальные учебные данные останутся сохранены, но для повторного входа понадобится интернет.'))return;
  var previous=auth;
  if(previous)previous.signOut().catch(function(e){formMessage('Ошибка выхода: '+String(e.message||e),true);});
  resetSession();doneLogin();showGate(true);
  if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);
  if(window.RS_COMM)window.RS_COMM.onLogout();
  status('Выход выполнен',false);formMessage('Ты вышел из аккаунта.',false);
 }
 function sharedEnabled(){var s=getLocal('rs_family_scope_v1',{value:'mine'});return !!(uid&&s&&s.value==='all');}
 function setScope(v){if(!uid)return;putLocal('rs_family_scope_v1',{value:v==='all'?'all':'mine',updatedAt:now()});if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(false);schedule();}
 function migrate(){if(!uid)return;
  if(window.RS_V3_RELEASE&&window.RS_V3_RELEASE.isActive()){
    status('V3 уже активна; прежняя копия сохранена.',true);return;
  }var imported=false,existing=getState(),legacy=empty();
 var scores=readJson('rs_scores_v1',null),words=readJson('rs_user_words_v1',null),fav=readJson('rs_favorites_v1',null),meta=readJson('rs_favorite_meta_v1',{}),deleted=readJson('rs_deleted_words_v1',{});
 if(scores&&Object.keys(scores).length){legacy.scores=scores;imported=true;}
 if(Array.isArray(words)&&words.length){words.forEach(function(x){if(x&&x.id)legacy.words[x.id]=x;});imported=true;}
 Object.keys(deleted||{}).forEach(function(id){legacy.words[id]={id:id,updatedAt:Number(deleted[id])||1,deleted:true};});
 if(fav&&Object.keys(fav).length){Object.keys(fav).forEach(function(id){legacy.favorites[id]={starred:!!fav[id],updatedAt:Number(meta&&meta[id]&&meta[id].updatedAt)||1};});imported=true;}
 if(!imported){var d=el('family-migrate-state');if(d)d.textContent='Старые записи на этом устройстве не найдены.';return;}
 if(!window.confirm('Перенести прежние результаты только в этот аккаунт ('+email+')? Исходные данные не удалятся.'))return;
 legacy.scope={value:'all',updatedAt:now()};var m=mergeData(existing,legacy);if(!putState(m)){status('Ошибка сохранения перенесённых данных',true);return;}schedule();var d=el('family-migrate-state');if(d)d.textContent='Прежние результаты скопированы. Синхронизация выполняется при наличии интернета.';status('Старые данные перенесены; ожидается синхронизация',false);}
 function init(){
  var f=el('family-login-form');if(f)f.addEventListener('submit',login);
  if(!configured()){var w=el('family-setup-warning');if(w)w.hidden=false;formMessage('Администратор должен настроить Firebase.',true);showGate(true);return;}
  showGate(true);formMessage('Проверяю сохранённый вход…',false);
  initFirebase();
  window.addEventListener('online',function(){if(uid&&auth&&auth.currentUser)sync();});
  window.addEventListener('rs:datachange',schedule);
 }
 window.RS_FAMILY={storageKey:storageKey,getState:getState,putState:putState,get uid(){return uid;},get email(){return email;},getToken:getToken,getEmailVerificationStatus:getEmailVerificationStatus,sendVerify:sendVerify,sharedEnabled:sharedEnabled,setScope:setScope,statusText:function(){return lastStatus;},sync:sync,schedule:schedule,logout:logout,migrate:migrate};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
