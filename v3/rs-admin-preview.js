/* STAGING ONLY — NOT INCLUDED IN PRODUCTION INDEX.HTML.
 * Read-only FI/RU/EN admin preview. Visibility uses server-issued Firebase
 * custom claims; Firestore Security Rules MUST independently enforce reads.
 * No user list, emails, tokens, personal answers or personal vocabulary.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_ADMIN_PREVIEW=api;
})(this,function(){
 'use strict';
 var labels={
   ru:{heading:'Настройки сайта',intro:'Данные только для администратора. Доступ проверяется сервером.',
     registered:'Зарегистрированные пользователи',
     active7d:'Активные за 7 дней',
     syncFailed24h:'Ошибки синхронизации за 24 часа',
     pendingKnown:'Ожидают синхронизации (известные серверу)',
     backupAt:'Последняя проверенная резервная копия',
     catalogVersion:'Версия общего словаря',
     footer:'Безопасный режим: только просмотр. Удаление аккаунтов и изменение прав недоступны.'},
   fi:{heading:'Sivuston asetukset',intro:'Tiedot vain ylläpitäjälle. Oikeudet tarkistetaan palvelimelta.',
     registered:'Rekisteröityneet käyttäjät',
     active7d:'Aktiiviset viimeisten 7 päivän aikana',
     syncFailed24h:'Synkronointivirheet viimeisten 24 tunnin aikana',
     pendingKnown:'Odottavat synkronoinnit (palvelimen tiedossa)',
     backupAt:'Viimeisin tarkistettu varmuuskopio',
     catalogVersion:'Yhteisen sanaston versio',
     footer:'Suojattu tila: vain luku. Tilien poisto ja oikeuksien muuttaminen eivät ole käytettävissä.'},
   en:{heading:'Site settings',intro:'Administrator-only data. Server-side permissions are required.',
     registered:'Registered users',
     active7d:'Active in the past 7 days',
     syncFailed24h:'Sync failures in the past 24 hours',
     pendingKnown:'Pending sync operations (known to server)',
     backupAt:'Last verified backup',
     catalogVersion:'Shared vocabulary version',
     footer:'Read-only safety mode. Account deletion and permission changes are unavailable.'}
 };
 function esc(x){return String(x===undefined||x===null?'—':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
 function allowed(claims){return !!(claims&&claims.admin===true);}
 function sanitize(metrics){
   metrics=metrics||{};
   function num(key){
     var raw=metrics[key],v=Number(raw);
     return (raw===null||raw===undefined||raw===''||!isFinite(v)||v<0)?
       '—':String(Math.floor(v));
   }
   return {registered:num('registered'),active7d:num('active7d'),
     syncFailed24h:num('syncFailed24h'),pendingKnown:num('pendingKnown'),
     backupAt:metrics.backupAt?esc(metrics.backupAt):'—',
     catalogVersion:metrics.catalogVersion?esc(metrics.catalogVersion):'—'};
 }
 function render(claims,metrics,language){
   if(!allowed(claims))return '';
   var t=labels[language]||labels.ru,m=sanitize(metrics),items=[
     ['registered',m.registered],['active7d',m.active7d],
     ['syncFailed24h',m.syncFailed24h],['pendingKnown',m.pendingKnown],
     ['backupAt',m.backupAt],['catalogVersion',m.catalogVersion]
   ];
   var html='<section class="rs-admin" aria-label="'+esc(t.heading)+'"><h2>'+
     esc(t.heading)+'</h2><p>'+esc(t.intro)+'</p><div class="rs-admin-grid">';
   items.forEach(function(item){
     html+='<div class="rs-admin-tile"><strong>'+esc(t[item[0]])+
       '</strong><p>'+item[1]+'</p></div>';
   });
   return html+'</div><p>'+esc(t.footer)+'</p></section>';
 }
 return {isAdmin:allowed,sanitize:sanitize,render:render};
});
