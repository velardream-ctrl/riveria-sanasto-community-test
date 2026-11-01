/* Riveria Community 2.1.2 — safe home/refresh, ES5 for older Safari.
   The home button never hard-reloads a running session. Google Drive access stays
   in memory until a real page restart; after restart reauthorization may be needed.
   A new SW may be installed in the background; applying it needs user consent.
*/
(function(){
'use strict';
var BUILD='riveria-sanasto-community-v2.1.2';
var checking=false, updateAvailable=false, checkSerial=0;
function id(x){return document.getElementById(x);}
function note(s,warning){var e=id('home-update-status');if(!e)return;e.hidden=false;e.textContent=s;e.className='status'+(warning?' offline':' muted');}
function showApply(show){var b=id('home-apply-update');if(b){b.hidden=!show;b.style.display=show?'inline-flex':'none';}updateAvailable=!!show;}
function home(){
  // Dispatch the existing app navigation: it resets only the active card deck.
  var cards=document.querySelector('#side-nav [data-view="cards"]')||document.querySelector('.mobile-nav [data-view="cards"]');
  if(cards&&typeof cards.click==='function')cards.click();
  if(window.RS_FAMILY_REFRESH)window.RS_FAMILY_REFRESH(false);
  try{window.scrollTo(0,0);}catch(e){}
}
function versionOf(reg,done){
  var worker=reg&&reg.active;
  if(!worker||!window.MessageChannel){done('');return;}
  var channel=new MessageChannel(),finished=false;
  var end=function(v){if(finished)return;finished=true;try{channel.port1.close();}catch(e){}done(v||'');};
  channel.port1.onmessage=function(evt){end(evt.data&&evt.data.cacheVersion);};
  try{worker.postMessage({type:'RS_CACHE_VERSION'},[channel.port2]);}
  catch(e){end('');return;}
  setTimeout(function(){end('');},1300);
}
function checkUpdates(){
  if(checking)return;
  checking=true;var serial=++checkSerial;
  note(navigator.onLine?'На главной. Проверяю обновления…':'На главной. Офлайн: локальные карточки доступны.',!navigator.onLine);
  if(!navigator.onLine||!('serviceWorker' in navigator)){checking=false;return;}
  navigator.serviceWorker.getRegistration('./').then(function(reg){
    if(!reg){checking=false;note('Обновления недоступны: сначала установи офлайн-кэш.',true);return;}
    var found=false;
    var onFound=function(){found=true;var w=reg.installing;if(w){w.addEventListener('statechange',function(){if(w.state==='installed'||w.state==='activated'){showApply(true);note('Доступна новая версия. Нажми «Применить обновление».');}});}else{showApply(true);note('Доступна новая версия. Нажми «Применить обновление».');}};
    reg.addEventListener('updatefound',onFound);
    reg.update().then(function(){
      // The updated service worker may have claimed this open page already.
      setTimeout(function(){if(serial!==checkSerial)return;versionOf(reg,function(version){
        checking=false;
        if(found||reg.waiting||(version&&version!==BUILD)){showApply(true);note('Новая версия готова. Для её применения потребуется перезагрузка.');}
        else if(!updateAvailable)note('На главной. Приложение проверено, обновлений нет.');
      });},500);
    },function(){checking=false;note('На главной. Проверить сервер обновлений сейчас не удалось.',true);});
  }).catch(function(){checking=false;note('На главной. Проверка обновлений недоступна.',true);});
}
function reloadAfterCheck(){
  if(!updateAvailable)return;
  if(!window.confirm('Чтобы применить новую версию, нужно один раз перезагрузить страницу. Локальные учебные данные останутся; Google Drive может потребовать повторного подключения. Продолжить?'))return;
  // Before a full reload, attempt to push unsynced local changes. If Drive
  // is disconnected, do NOT pretend data were synced; require explicit approval.
  if(!window.RS_COMM||!window.RS_COMM.sync||!navigator.onLine){
    if(window.confirm('Сейчас невозможно проверить синхронизацию с Google Drive. Изменения остаются на устройстве. Перезагрузить страницу?'))location.reload();
    return;
  }
  note('Проверяю личную синхронизацию перед обновлением…');
  window.RS_COMM.sync().then(function(ok){
    if(ok){location.reload();return;}
    note('Google Drive не подтвердил синхронизацию. Локальные данные не удалены.',true);
    if(window.confirm('Личные изменения пока не подтверждены в Google Drive. Они должны остаться на этом устройстве. Применить обновление сейчас?'))location.reload();
  },function(){note('Ошибка синхронизации. Приложение не перезапущено.',true);});
}
function reconnect(){
  if(!window.RS_FAMILY||!window.RS_FAMILY.uid){note('Сначала войди в свой Google-аккаунт.',true);return;}
  if(!navigator.onLine){note('Google Drive подключается только через интернет.',true);return;}
  if(window.RS_COMM&&typeof window.RS_COMM.connectDrive==='function'){
    note('Открываю подключение Google Drive…');
    // A real click is required by Google Identity Services; never request a
    // Drive token silently on page load or store it in localStorage.
    window.RS_COMM.connectDrive();
  }else note('Модуль Google Drive пока не загружен.',true);
}
function init(){
  var h=id('home-refresh-button'),d=id('home-drive-button'),u=id('home-apply-update');
  if(h)h.addEventListener('click',function(){home();checkUpdates();});
  if(d)d.addEventListener('click',reconnect);
  if(u)u.addEventListener('click',reloadAfterCheck);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
