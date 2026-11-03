/* STAGING CLASSIC ONLY: isolated synthetic account and fully offline stubs.
 * No Firebase, Google, auth, credentials, user lists or patient information.
 * This module only creates a separate localStorage namespace for synthetic
 * teaching data. Never reads the account keys of the published website.
 */
(function(w){
 'use strict';
 var prefix='rs_v3_classic_synthetic_only__';
 function none(){return null;}
 function notify(){var el=document.getElementById('toast');
   if(el){el.textContent='DEMO: сеть и вход отключены';el.className='toast show';}}
 w.RS_FAMILY={
   uid:'DEMO_SYNTHETIC_UID',
   email:'demo-v3-classic@example.invalid',
   storageKey:function(key){
     if(!/^[a-z0-9_]+$/.test(key))throw Error('Invalid demo storage key');
     return prefix+key;
   },
   sharedEnabled:function(){return true;},
   statusText:function(){return 'DEMO: только на устройстве';},
   schedule:none,sync:notify,logout:notify,migrate:notify,
   setScope:none
 };
 w.RS_COMM={
   subscribedTerms:function(){return [];},
   renderLibrary:function(el){el.innerHTML='<div class="panel"><h2>Библиотека</h2>'+
     '<p>Тестовая версия: публичный словарь включён. Облачная библиотека отключена.</p></div>';},
   renderUsers:function(el){el.innerHTML='<div class="panel"><h2>Пользователи</h2>'+
     '<p>Здесь нет реальных аккаунтов или пользовательских данных. Тестовая сборка работает локально.</p></div>';},
   dataPanel:function(){
     var html=w.RS_ADMIN_PREVIEW?w.RS_ADMIN_PREVIEW.render(
       {admin:true},{catalogVersion:'DEMO — offline preview'},
       w.RS_I18N?w.RS_I18N.getLanguage():'ru'):'';
     return '<div class="panel"><h2>Настройки сайта — учебный макет</h2>'+
       '<p>Панель администратора здесь только пример интерфейса. ' +
       'Авторизация, список реальных пользователей, Firebase и Google Drive отключены.</p>'+
       '<p>Настоящие права администратора впоследствии проверяются сервером.</p>'+html+'</div>';
   }
 };
})(this);
