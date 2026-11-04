/* Test preview only. Admin link is shown exclusively after a server-signed Firebase admin claim.
 * ?admin_preview=1 on the isolated test host permits a LOCAL-ONLY diagnostics demonstration,
 * never privileged account metrics or reads. No tokens, personal answers, or other users' data.
 * ES5 / Safari 12 compatible.
 */
(function(w,d){
 'use strict';
 var latestUid='',granted=false,checked=false,checking=false,errors=[];
 var wording={
  ru:{button:'Админ-панель',preview:'Предпросмотр диагностики (без прав администратора)',heading:'Диагностика сайта',
    notice:'Общая статистика недоступна, пока не подключена защищённая серверная сводка. Прочерки — это не нули.',
    local:'Проверки этого устройства',network:'Интернет',connected:'доступен',offline:'нет соединения',
    firebase:'Firebase',project:'Тестовая база',sync:'Синхронизация V3',
    running:'подключена',paused:'не подключена',problems:'Последние ошибки этой вкладки',
    empty:'Ошибки не зафиксированы после открытия страницы',refresh:'Обновить показатели',
    restricted:'Тестовая диагностика показывает только состояние этого устройства. Глобальные показатели и чужие данные недоступны.',
    catalog:'Записи общего словаря'},
  fi:{button:'Ylläpito',preview:'Diagnostiikan esikatselu (ei ylläpito-oikeuksia)',heading:'Sivuston diagnostiikka',
    notice:'Palvelimen suojattuja koontitietoja ei ole yhdistetty. Viiva ei tarkoita nollaa.',
    local:'Tämän laitteen tarkistukset',network:'Internet',connected:'käytettävissä',offline:'ei yhteyttä',
    firebase:'Firebase',project:'Testitietokanta',sync:'V3-synkronointi',
    running:'käytössä',paused:'ei käytössä',problems:'Tämän välilehden viimeisimmät virheet',
    empty:'Virheitä ei havaittu sivun avaamisen jälkeen',refresh:'Päivitä tila',
    restricted:'Testinäkymä näyttää vain tämän laitteen tietoja. Muiden käyttäjien tietoja ei näytetä.',
    catalog:'Yhteisen sanaston tietueet'},
  en:{button:'Admin panel',preview:'Diagnostics preview (no administrator rights)',heading:'Site diagnostics',
    notice:'Protected server-wide metrics are not connected. A dash does not mean zero.',
    local:'This device',network:'Internet',connected:'available',offline:'offline',
    firebase:'Firebase',project:'Test database',sync:'V3 sync',
    running:'connected',paused:'not connected',problems:'Recent errors in this tab',
    empty:'No errors recorded since this page was opened',refresh:'Refresh',
    restricted:'The test preview only shows this device. Global counts and other users\' data remain unavailable.',
    catalog:'Shared vocabulary entries'}
 };
 function L(){var x=w.RS_I18N&&w.RS_I18N.getLanguage?w.RS_I18N.getLanguage():'ru';return wording[x]||wording.ru;}
 function node(tag,cls,txt){var el=d.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;}
 function add(parent,tag,cls,txt){var el=node(tag,cls,txt);parent.appendChild(el);return el;}
 function onlyTestPreview(){return w.location.hostname==='velardream-ctrl.github.io'&&/(?:^|[?&])admin_preview=1(?:&|$)/.test(w.location.search||'');}
 function filename(s){return String(s||'').split('?')[0].split('/').pop().replace(/[^A-Za-z0-9_.-]/g,'').slice(0,70)||'script';}
 function record(kind,e){
   var file=filename(e&&e.filename||''),line=Number(e&&e.lineno)||0;
   errors.push({type:kind,file:file,line:line>0&&line<1000000?line:0});
   if(errors.length>15)errors.shift();
 }
 w.addEventListener('error',function(e){record('JavaScript',e);});
 w.addEventListener('unhandledrejection',function(){record('Promise',null);});
 function current(){try{return w.firebase&&w.firebase.auth&&w.firebase.auth().currentUser||null;}catch(ignore){return null;}}
 function status(){var s=w.RS_V3_RELEASE;return !!(s&&s.isActive&&s.isActive());}
 function paint(panel,admin){
   var t=L();
   while(panel.firstChild)panel.removeChild(panel.firstChild);
   add(panel,'h2','',t.heading);
   if(admin&&w.RS_ADMIN_PREVIEW){
     var host=add(panel,'div','','');
     host.innerHTML=w.RS_ADMIN_PREVIEW.render({admin:true},null,w.RS_I18N?w.RS_I18N.getLanguage():'ru');
     add(panel,'p','hint',t.notice);
   }else add(panel,'p','hint',t.restricted);
   add(panel,'h3','',t.local);
   var p=add(panel,'p','hint','');
   var project=w.RS_FIREBASE_CONFIG&&w.RS_FIREBASE_CONFIG.projectId;
   p.textContent=t.network+': '+(w.navigator.onLine?t.connected:t.offline)+
     ' | '+t.firebase+': '+(project==='sanastoyhteiso-v3-development'?t.project:'—')+
     ' | '+t.sync+': '+(status()?t.running:t.paused);
   var count=w.RS_DATA&&w.RS_DATA.terms&&w.RS_DATA.terms.length;
   add(panel,'p','hint',t.catalog+': '+(typeof count==='number'?count:'—'));
   add(panel,'h3','',t.problems);
   if(!errors.length)add(panel,'p','hint',t.empty);
   else {
     var list=add(panel,'ul','','');
     errors.forEach(function(e){add(list,'li','',''+e.type+' — '+e.file+(e.line?':'+e.line:''));});
   }
   var refresh=add(panel,'button','btn white',t.refresh);refresh.type='button';
   refresh.addEventListener('click',function(){paint(panel,admin);});
 }
 function show(slot,admin){
   if(!slot||!slot.parentNode)return;
   slot.hidden=false;while(slot.firstChild)slot.removeChild(slot.firstChild);
   var t=L(),btn=add(slot,'button','btn white',admin?t.button:t.preview);btn.type='button';
   var panel=add(slot,'section','panel soft','');panel.hidden=true;
   btn.addEventListener('click',function(){
     panel.hidden=!panel.hidden;if(!panel.hidden)paint(panel,admin);
   });
 }
 function mount(){
   var slot=d.getElementById('rs-admin-slot');if(!slot)return;
   var user=current(),preview=onlyTestPreview();
   if(!user||user.emailVerified!==true){
     slot.hidden=true;while(slot.firstChild)slot.removeChild(slot.firstChild);
     return;
   }
   if(latestUid!==user.uid){latestUid=user.uid;granted=false;checked=false;checking=false;}
   if(checked){if(granted||preview)show(slot,granted);else slot.hidden=true;return;}
   slot.hidden=true;
   if(checking)return;checking=true;
   user.getIdTokenResult(false).then(function(result){
     if(!current()||current().uid!==user.uid)return;
     granted=!!(result&&result.claims&&result.claims.admin===true);
     checked=true;checking=false;
     var target=d.getElementById('rs-admin-slot');
     if(target){if(granted||preview)show(target,granted);else target.hidden=true;}
   },function(){
     if(current()&&current().uid===user.uid){
       checked=true;checking=false;granted=false;
       var target=d.getElementById('rs-admin-slot');
       if(target){if(preview)show(target,false);else target.hidden=true;}
     }
   });
 }
 w.RS_ADMIN_LIVE={mount:mount};
})(window,document);
