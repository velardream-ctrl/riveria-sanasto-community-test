/* Riveria Sanasto Community 2.0.2
   Firebase Google Sign-in via browser popup (compat SDK) with Firebase REST tokens.
   Per-UID local storage. Actual compatibility with Safari iOS 12 requires live testing.
   No shared Apps Script key.
   Old Google Sheets sync is deliberately disabled in family mode. */
(function(){
 'use strict';
 var config=window.RS_FIREBASE_CONFIG||{}, KEY='rs_family_auth_v1', PREFIX='rs_family_v1_', uid='', email='', token='', refreshToken='', expires=0;
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
 function makeSession(){writeRaw(KEY,stringify({uid:uid,email:email,refreshToken:refreshToken,idToken:token,expires:expires}));}
 function resetSession(){try{localStorage.removeItem(KEY);}catch(e){}uid='';email='';token='';refreshToken='';expires=0;}
 function xhr(method,url,body,headers){return new Promise(function(resolve,reject){var x=new XMLHttpRequest();x.open(method,url,true);x.timeout=25000;Object.keys(headers||{}).forEach(function(k){x.setRequestHeader(k,headers[k]);});x.onreadystatechange=function(){if(x.readyState!==4)return;var out={code:x.status,data:null};try{out.data=JSON.parse(x.responseText);}catch(e){out.data={};}resolve(out);};x.onerror=function(){reject(new Error('Не удалось подключиться к серверу'));};x.ontimeout=function(){reject(new Error('Время ожидания истекло'));};x.send(body===undefined||body===null?null:body);});}
 function request(method,url,payload,auth){var h={};if(payload!==null&&payload!==undefined)h['Content-Type']='application/json';if(auth)h['Authorization']='Bearer '+auth;return xhr(method,url,payload===null?null:stringify(payload),h);}
 function authError(x){var c=x&&x.error&&x.error.message||'';var m={INVALID_LOGIN_CREDENTIALS:'Неверная почта или пароль',EMAIL_NOT_FOUND:'Аккаунт не найден',INVALID_PASSWORD:'Неверный пароль',USER_DISABLED:'Этот аккаунт отключён',TOO_MANY_ATTEMPTS_TRY_LATER:'Слишком много попыток. Попробуй позже',OPERATION_NOT_ALLOWED:'В Firebase не включён вход по паролю'};return m[c]||('Ошибка входа: '+c);}
 function useAuth(a){if(!a||!a.localId||!a.idToken||!a.refreshToken)throw Error('Сервер не подтвердил аккаунт');uid=a.localId;email=a.email||email||'';token=a.idToken;refreshToken=a.refreshToken;expires=now()+(Number(a.expiresIn)||3600)*1000;makeSession();showGate(false);if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);status('Личный вход выполнен. Подключи Google Drive.',false);if(window.RS_COMM)window.RS_COMM.onAuth();}
 function getEmailVerificationStatus(){
  if(!uid)return Promise.reject(new Error('Сначала войди'));
  return updateToken().then(function(t){return request('POST','https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(config.apiKey),{idToken:t});}).then(function(r){
   if(r.code!==200)throw Error(authError(r.data));
   var user=r.data&&r.data.users&&r.data.users[0];
   if(!user||typeof user.emailVerified!=='boolean')throw Error('Firebase не сообщил статус подтверждения');
   if(user.localId&&user.localId!==uid)throw Error('Ответ другого аккаунта');
   return user.emailVerified===true;
  });
 }
 function sendVerify(){if(!uid)return Promise.reject(new Error('Сначала войди'));return updateToken().then(function(t){return request('POST','https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(config.apiKey),{requestType:'VERIFY_EMAIL',idToken:t});}).then(function(r){if(r.code!==200)throw Error(authError(r.data));return true;});}
 function login(evt){
  if(evt)evt.preventDefault();
  if(!configured()){formMessage('Сначала настрой Firebase Web API Key и Project ID в config.js.',true);return;}
  if(!navigator.onLine){formMessage('Для первого входа нужен интернет.',true);return;}
  if(!window.firebase||!firebase.auth){formMessage('Модуль Firebase Authentication не загрузился. Проверь сеть и обнови страницу.',true);return;}
  var btn=el('family-submit');if(btn)btn.disabled=true;
  formMessage('Открываю вход через Google…',false);
  try{
   if(!firebase.apps.length)firebase.initializeApp({apiKey:config.apiKey,authDomain:config.authDomain||config.projectId+'.firebaseapp.com',projectId:config.projectId});
   var provider=new firebase.auth.GoogleAuthProvider();
   firebase.auth().signInWithPopup(provider).then(function(result){
    var user=result.user;if(!user||!user.uid||!user.email)throw Error('Google не предоставил сведения об аккаунте.');
    return user.getIdToken().then(function(t){return {localId:user.uid,email:user.email,idToken:t,refreshToken:user.refreshToken,expiresIn:3600};});
   }).then(function(a){useAuth(a);formMessage('Вход выполнен через Google. Прогресс этого аккаунта изолирован.',false);})
   .catch(function(e){formMessage('Вход через Google: '+String(e.message||e)+' (проверь разрешённые домены и всплывающие окна)',true);})
   .then(function(){if(btn)btn.disabled=false;});
  }catch(e){formMessage('Вход Google: '+String(e.message||e),true);if(btn)btn.disabled=false;}
 }
 function updateToken(){if(!refreshToken)return Promise.reject(new Error('Нужен повторный вход'));if(token&&expires>now()+120000)return Promise.resolve(token);
 var form='grant_type=refresh_token&refresh_token='+encodeURIComponent(refreshToken);
 return xhr('POST','https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(config.apiKey),form,{'Content-Type':'application/x-www-form-urlencoded'}).then(function(r){if(r.code!==200)throw Error('Истёк сеанс. Войди в аккаунт снова.');token=r.data.id_token;refreshToken=r.data.refresh_token;expires=now()+(Number(r.data.expires_in)||3600)*1000;makeSession();return token;}); }
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
 function sync(){if(!uid)return Promise.resolve(false); if(window.RS_COMM){return window.RS_COMM.sync();}status('Подключи собственный Google Drive в разделе «Данные»',false);return Promise.resolve(false);}
 function schedule(){if(!uid)return;if(window.RS_COMM)window.RS_COMM.onLocalChange();}
 function logout(){if(!window.confirm('Выйти из личного аккаунта? Данные останутся на устройстве. Для повторного входа нужен интернет.'))return;try{if(window.firebase&&firebase.apps.length)firebase.auth().signOut();}catch(ignored){}resetSession();showGate(true);if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);if(window.RS_COMM)window.RS_COMM.onLogout();status('Выход выполнен',false);formMessage('Вы вышли из аккаунта. Для нового входа нажми «Войти через Google».',false);}
 function sharedEnabled(){var s=getLocal('rs_family_scope_v1',{value:'mine'});return !!(uid&&s&&s.value==='all');}
 function setScope(v){if(!uid)return;putLocal('rs_family_scope_v1',{value:v==='all'?'all':'mine',updatedAt:now()});if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(false);schedule();}
 function migrate(){if(!uid)return;var imported=false,existing=getState(),legacy=empty();
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
  if(!configured()){var w=el('family-setup-warning');if(w)w.hidden=false;formMessage('Сначала администратор должен настроить Firebase проект.',true);showGate(true);return;}
 var sess=readJson(KEY,null);if(sess&&sess.uid&&sess.refreshToken){uid=sess.uid;email=sess.email||'';token=sess.idToken||'';refreshToken=sess.refreshToken||'';expires=Number(sess.expires)||0;showGate(false);if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(true);if(window.RS_COMM)window.RS_COMM.onAuth();if(!navigator.onLine)status('Офлайн — личные данные на этом устройстве',false);}else showGate(true);
 window.addEventListener('online',function(){if(uid)sync();});window.addEventListener('rs:datachange',schedule);
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&uid&&navigator.onLine&&now()-lastSync>120000)sync();});
 setInterval(function(){if(uid&&navigator.onLine&&now()-lastSync>120000)sync();},120000);
 }
 window.RS_FAMILY={storageKey:storageKey,get uid(){return uid;},get email(){return email;},getToken:updateToken,getEmailVerificationStatus:getEmailVerificationStatus,sendVerify:sendVerify,sharedEnabled:sharedEnabled,setScope:setScope,statusText:function(){return lastStatus;},sync:sync,schedule:schedule,logout:logout,migrate:migrate};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
