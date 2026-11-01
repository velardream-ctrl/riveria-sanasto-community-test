/* Riveria Community v2.0.5 — server-owned profile & preferences. ES5-style, Safari 12. */
(function(){
'use strict';
var cfg=window.RS_FIREBASE_CONFIG||{};
var currentUid='',loading=false,saving=false,applying=false,lastFetch=0,lastProfile='',lastPreferences='',saveTimer=null,needsCloudSave=false;
function id(){return window.RS_FAMILY&&window.RS_FAMILY.uid||'';}
function key(s){return 'rs_community_2_'+id()+'_'+s;}
function localGet(k,f){try{var x=localStorage.getItem(k);return x?JSON.parse(x):f;}catch(e){return f;}}
function localPut(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
function notify(s,issue){var el=document.getElementById('account-profile-status');if(el){el.textContent=s;el.className='operation-status '+(issue?'warning':'info');}}
function req(method,path,payload){return window.RS_FAMILY.getToken().then(function(t){return new Promise(function(resolve,reject){
 var url='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(cfg.projectId)+'/databases/(default)/documents/'+path;
 var x=new XMLHttpRequest();x.open(method,url,true);x.timeout=20000;x.setRequestHeader('Authorization','Bearer '+t);x.setRequestHeader('Accept','application/json');
 if(payload!==null){x.setRequestHeader('Content-Type','application/json');}
 x.onload=function(){var data={};try{data=JSON.parse(x.responseText||'{}');}catch(e){};
 if(x.status===404){resolve(null);return;}
 if(x.status>=200&&x.status<300){resolve(data);return;}
 reject(Error((data.error&&data.error.message)||('HTTP '+x.status)));
 };x.onerror=function(){reject(Error('Нет соединения с Firebase'));};x.ontimeout=function(){reject(Error('Firebase не ответил'));};x.send(payload===null?null:JSON.stringify(payload));
 });});}
function field(d,n,f){var v=d&&d.fields&&d.fields[n];if(!v)return f;if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return Number(v.integerValue);if(v.booleanValue!==undefined)return v.booleanValue;return f;}
function localName(){return localGet(key('name'),'');}
function localScope(){var k=window.RS_FAMILY.storageKey('rs_family_scope_v1');return k?localGet(k,{value:'mine',updatedAt:0}):{value:'mine',updatedAt:0};}
function localSubs(){return localGet(key('subs'),{});}
function preferences(){var scope=localScope();return {scope:scope.value==='all'?'all':'mine',scopeTime:Number(scope.updatedAt)||0,subs:localSubs()};}
function fingerprint(){return JSON.stringify(preferences());}
function renderProfile(name,visible){var inp=document.getElementById('community-name'),cb=document.getElementById('community-public-stats');
 if(inp&&document.activeElement!==inp)inp.value=name;
 if(cb&&document.activeElement!==cb)cb.checked=!!visible;
}
function loadProfile(){var who=id();if(!who)return Promise.resolve(false);
 return req('GET','users/'+encodeURIComponent(who),null).then(function(doc){
 if(who!==id())return false;
 if(doc){var name=String(field(doc,'alias','')),publicStats=!!field(doc,'publicStats',false);
 if(name){localPut(key('name'),name);localPut(key('stats'),publicStats);lastProfile=name;renderProfile(name,publicStats);notify('Имя и публичность загружены из Firebase.','');}}
 else notify('В облаке ещё нет профиля. Введи имя один раз и нажми «Сохранить профиль».',false);
 return true;
 }).catch(function(e){if(who===id())notify('Не удалось прочитать профиль: '+e.message+'. Проверь правила Firestore.',true);return false;});
}
function applyPreferences(doc){if(!doc||!id())return;
 var cloudTime=Number(field(doc,'updatedAt',0))||0,localTime=Number(localGet(key('prefsUpdated'),0))||0;
 if(localTime>cloudTime){needsCloudSave=true;return;} // unfinished newer local changes must not be overwritten
 var scope=field(doc,'scope','mine'),text=field(doc,'subscriptions','{}'),subs={};
 try{subs=JSON.parse(text)||{};}catch(e){return;}
 if(!subs||typeof subs!=='object'||Array.isArray(subs))return;
 var storageKey=window.RS_FAMILY.storageKey('rs_family_scope_v1');
 applying=true;
 if(storageKey)localPut(storageKey,{value:scope==='all'?'all':'mine',updatedAt:cloudTime});
 localPut(key('subs'),subs);localPut(key('prefsUpdated'),cloudTime);
 localPut(key('prefsObserved'),fingerprint());
 applying=false;
 if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(false);
 if(window.RS_COMM&&typeof window.RS_COMM.updateSubscriptions==='function')window.RS_COMM.updateSubscriptions();
}
function loadPreferences(){var who=id();if(!who)return Promise.resolve(false);
 return req('GET','settings/'+encodeURIComponent(who),null).then(function(doc){
 if(who!==id())return false;
 if(doc)applyPreferences(doc);
 else needsCloudSave=true; // bootstrap settings for a new account, including the default scope
 return true;
 }).catch(function(e){if(who===id())notify('Настройки пока не загружены из облака: '+e.message+'.',true);return false;});}
function savePreferences(){if(!id()||saving||loading||applying||!navigator.onLine)return Promise.resolve(false);
 var fp=fingerprint();if(fp===lastPreferences)return Promise.resolve(true);
 var data=preferences(),subJson=JSON.stringify(data.subs);if(subJson.length>40000){notify('Слишком много подписок для синхронизации настроек.',true);return Promise.resolve(false);}
 saving=true;var who=id(),t=Date.now();localPut(key('prefsUpdated'),t);
 var body={fields:{scope:{stringValue:data.scope},subscriptions:{stringValue:subJson},updatedAt:{integerValue:String(t)}}};
 return req('PATCH','settings/'+encodeURIComponent(who),body).then(function(){
 if(who!==id())return false;lastPreferences=fp;localPut(key('prefsObserved'),fp);notify('Настройки аккаунта синхронизированы.',false);return true;
 }).catch(function(e){if(who===id())notify('Настройки сохранены на этом устройстве, но не в облаке: '+e.message,true);return false;}).then(function(ok){saving=false;return ok;});
}
function queueSave(force){if(loading||applying)return;if(!force&&fingerprint()===lastPreferences)return;
 if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(function(){savePreferences();},800);
}
function refresh(){if(loading||!id()||!navigator.onLine)return Promise.resolve(false);
 var who=id();loading=true;lastFetch=Date.now();notify('Получаю имя и настройки аккаунта из Firebase…',false);
 return loadProfile().then(function(){return loadPreferences();}).then(function(){
  if(who===id())lastPreferences=needsCloudSave?'':fingerprint();return true;
 }).then(function(v){loading=false;
  if(needsCloudSave&&who===id()){needsCloudSave=false;return savePreferences().then(function(){return v;});}
  return v;
 },function(e){loading=false;notify('Не удалось обновить аккаунт: '+e.message,true);return false;});
}
function onAuth(){var who=id();if(!who)return;currentUid=who;lastPreferences=fingerprint();needsCloudSave=false;lastFetch=0;refresh();}
function onLogout(){currentUid='';loading=false;applying=false;needsCloudSave=false;lastPreferences='';if(saveTimer)clearTimeout(saveTimer);}
function profileSaved(name,show){if(!id())return;lastProfile=name;localPut(key('name'),name);localPut(key('stats'),!!show);renderProfile(name,show);
 var u=window.firebase&&firebase.apps.length&&firebase.auth().currentUser;
 if(u&&u.displayName!==name)u.updateProfile({displayName:name}).catch(function(){});
 notify('Имя сохранено в Firebase для всех устройств.',false);
}
function init(){
 document.addEventListener('click',function(e){var t=e.target;while(t&&t!==document&&!(t.getAttribute&&t.getAttribute('data-account')))t=t.parentNode;
 if(t&&t!==document&&t.getAttribute('data-account')==='refresh')refresh();});
 document.addEventListener('visibilitychange',function(){if(!document.hidden&&id()&&Date.now()-lastFetch>30000)refresh();});
 window.addEventListener('focus',function(){if(id()&&Date.now()-lastFetch>30000)refresh();});
 window.addEventListener('online',function(){if(id())refresh().then(function(){queueSave(false);});});
}
window.RS_ACCOUNT={onAuth:onAuth,onLogout:onLogout,onLocalChange:function(){queueSave(false);},profileSaved:profileSaved,refresh:refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
