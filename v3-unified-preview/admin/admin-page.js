/* STAGING admin page for isolated test Firebase. No global metrics exist until a protected backend is live.
 * All queries are read-only, disabled without verified Firebase admin claim, and restricted to
 * a fixed aggregate path. No private study collections, user lists, raw errors, tokens or secrets.
 * Safari iOS12 / ES5 compatible.
 */
(function(w,d){
 'use strict';
 var config=w.RS_FIREBASE_CONFIG||{},auth=null,db=null,authorized=false,report=null,tab='overview',locale='ru',busy=false,session=0,activeUser=null,forcedUser=null;
 var tabs=['overview','errors','browsers','sync','backups','updates','audit'];
 var labels={
 ru:{title:'Администрирование',sub:'Закрытый кабинет • тестовый сайт',checking:'Проверяю права администратора…',
  notReady:'Система авторизации недоступна. Вернись на учебную страницу и проверь подключение Firebase.',
  signIn:'Войди сначала на учебной странице через Google. Затем открой административный кабинет.',
  denied:'В этом аккаунте нет подтверждённой роли администратора. Доступ закрыт.',
  authError:'Не удалось проверить права. Обнови страницу или повторно войди.',
  note:'Отсутствие сообщений не доказывает, что ошибок нет. Для статуса «ОК» нужны работающий мониторинг и свежие агрегированные данные.',
  overview:'Обзор',errors:'Ошибки',browsers:'Браузеры',sync:'Синхронизация',backups:'Резервные копии',updates:'Обновления',audit:'Аудит',
  noData:'Нет данных',failed:'Сбой подключения агрегатов',ok:'ОК',problem:'Проблема',loading:'Загрузка сводки…',
  site:'Состояние сайта',seen:'Последняя сводка',count24:'Ошибки за 24 часа',active7:'Активность за 7 дней',
  errorGroups:'Группы ошибок',version:'Версия сайта',browserTitle:'Ошибки по браузерам',syncTitle:'Ошибки синхронизации',
  backupTitle:'Последняя проверенная копия',auditTitle:'Последние действия администратора',
  updateTitle:'Загрузка одного пакета обновления',blocked:'Функция публикации заблокирована до подключения защищённого сервера, проверки подписи/хэшей, тестов и возможности отката. Текущая страница не обновляет GitHub.',
  refresh:'Обновить сводку',missing:'Серверные метрики пока не подключены. Журнал ошибок остальных учеников недоступен.',
  noPersonal:'Личные ответы и приватные словари учеников здесь не показываются.'},
 fi:{title:'Ylläpito',sub:'Yksityinen hallintanäkymä • testisivusto',checking:'Ylläpito-oikeuksia tarkistetaan…',
  notReady:'Kirjautumispalvelu ei ole käytettävissä.',signIn:'Kirjaudu ensin opiskelusivulla Google-tilillä.',
  denied:'Tällä tilillä ei ole ylläpito-oikeuksia.',authError:'Oikeuksien tarkistus epäonnistui.',
  note:'Virheilmoitusten puuttuminen ei todista toimivuutta. OK vaatii toimivan seurannan ja tuoreet tiedot.',
  overview:'Yhteenveto',errors:'Virheet',browsers:'Selaimet',sync:'Synkronointi',backups:'Varmuuskopiot',updates:'Päivitykset',audit:'Toimintaloki',
  noData:'Ei tietoja',failed:'Koontitietoja ei voitu lukea',ok:'OK',problem:'Ongelma',loading:'Ladataan tietoja…',
  site:'Sivuston tila',seen:'Viimeisin päivitys',count24:'Virheet 24 tunnissa',active7:'Aktiivisuus 7 päivässä',
  errorGroups:'Virheryhmät',version:'Sivuston versio',browserTitle:'Virheet selaimittain',syncTitle:'Synkronointivirheet',
  backupTitle:'Viimeisin tarkistettu varmuuskopio',auditTitle:'Ylläpidon viimeisimmät toimet',
  updateTitle:'Yhden päivityspaketin lataus',blocked:'Julkaisu on estetty, kunnes suojattu palvelin, tiedostotarkastukset, testit ja palautus ovat käytettävissä.',
  refresh:'Päivitä tiedot',missing:'Palvelimen koontitietoja ei ole yhdistetty.',noPersonal:'Oppilaiden yksityisiä vastauksia ei näytetä.'},
 en:{title:'Administration',sub:'Private dashboard • test site',checking:'Checking administrator privileges…',
  notReady:'Firebase Authentication is unavailable.',signIn:'First sign in to the study site with Google.',
  denied:'This account has no verified administrator role.',authError:'Could not verify permissions.',
  note:'No error reports does not prove the site is healthy. OK requires live monitoring and fresh aggregate data.',
  overview:'Overview',errors:'Errors',browsers:'Browsers',sync:'Sync',backups:'Backups',updates:'Updates',audit:'Audit',
  noData:'No data',failed:'Aggregate data unavailable',ok:'OK',problem:'Problem',loading:'Loading metrics…',
  site:'Site health',seen:'Last report',count24:'Errors in 24h',active7:'Active in 7 days',
  errorGroups:'Error groups',version:'Site version',browserTitle:'Errors by browser',syncTitle:'Sync failures',
  backupTitle:'Last verified backup',auditTitle:'Recent admin actions',
  updateTitle:'One-file update package',blocked:'Publishing is disabled until a protected backend, file verification, tests and rollback are ready.',
  refresh:'Refresh metrics',missing:'Server-wide metrics are not connected.',noPersonal:'Private study answers are never displayed.'}
 };
 function t(){return labels[locale]||labels.ru;}
 function el(id){return d.getElementById(id);}
 function wipe(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function add(parent,tag,cls,value){var e=d.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);parent.appendChild(e);return e;}
 function text(id,value){var n=el(id);if(n)n.textContent=value;}
 function show(id,yes){var n=el(id);if(n)n.hidden=!yes;}
 function validNum(n){return typeof n==='number'&&isFinite(n)&&n>=0&&Math.floor(n)===n?n:null;}
 function safeLabel(s){return typeof s==='string'&&/^[A-Za-z0-9_. -]{1,64}$/.test(s)?s:null;}
 function at(v){if(v&&typeof v.toMillis==='function')return v.toMillis();if(typeof v==='string'){var n=Date.parse(v);return isFinite(n)?n:0;}return 0;}
 function newest(){return !!(report&&at(report.updatedAt)>0&&Date.now()-at(report.updatedAt)<15*60*1000&&Date.now()>=at(report.updatedAt));}
 function usableReport(){return !!(report&&newest()&&report.monitoringActive===true);}
 function health(){if(!usableReport())return 'unknown';
   if(report.siteStatus==='problem'||(validNum(report.criticalOpen)||0)>0)return 'problem';
   if(report.siteStatus==='ok'&&report.criticalOpen===0)return 'ok';return 'unknown';}
 function k(x){return t()[x]||x;}
 function card(root,label,value){var p=add(root,'div','panel metric','');add(p,'small','',label);add(p,'strong','',value);return p;}
 function value(x){return x===null||x===undefined?t().noData:String(x);}
 function statusDisplay(){var h=health();return h==='ok'?t().ok:h==='problem'?t().problem:t().noData;}
 function render(){
   if(!authorized)return;
   text('page-title',t().title);text('subhead',t().sub);text('policy-note',t().note);
   var tabsRoot=el('admin-tabs');wipe(tabsRoot);tabs.forEach(function(key){
     var b=add(tabsRoot,'button',tab===key?'active':'',k(key));
     b.type='button';b.setAttribute('aria-pressed',tab===key?'true':'false');
     b.addEventListener('click',function(){tab=key;render();});
   });
   var p=el('admin-view');wipe(p);
   var current=usableReport();
   if(tab==='overview'){
      var g=add(p,'div','grid','');
      card(g,k('site'),statusDisplay());
      card(g,k('seen'),newest()?new Date(at(report.updatedAt)).toLocaleString():t().noData);
      card(g,k('count24'),value(current&&report?validNum(report.errors24h):null));
      card(g,k('active7'),value(current&&report?validNum(report.active7d):null));
      card(g,k('version'),value(current&&report?safeLabel(report.releaseVersion):null));
   } else if(tab==='updates'){
      var x=add(p,'div','panel','');
      add(x,'h2','',k('updateTitle'));add(x,'p','notice',k('blocked'));
   }else{
      var z=add(p,'div','panel','');
      var heading={errors:'errorGroups',browsers:'browserTitle',sync:'syncTitle',
        backups:'backupTitle',audit:'auditTitle'}[tab];
      add(z,'h2','',k(heading));
      if(tab==='backups'){
        add(z,'p','',report&&typeof report.verifiedBackupAt==='string'&&report.verifiedBackupAt.length<35?report.verifiedBackupAt:t().noData);
      }else if(tab==='sync'){
        var sc=current&&report?validNum(report.syncFailures24h):null;
        add(z,'p','',sc===null?t().noData:String(sc));
      }else if(tab==='errors'&&current&&report&&Array.isArray(report.errorGroups)){
        // SERVER MUST aggregate and sanitize. Only known code identifiers and counts; NEVER raw messages.
        var count=0;
        report.errorGroups.slice(0,30).forEach(function(x){
          var code=x&&safeLabel(x.code),n=x&&validNum(x.count);
          if(code!==null&&n!==null){add(z,'p','',code+' — '+n);count++;}
        });
        if(!count)add(z,'p','',t().noData);
      } else add(z,'p','',t().noData);
   }
   var action=add(p,'button','','');
   action.textContent=t().refresh;action.type='button';action.disabled=busy;
   action.addEventListener('click',read);
   add(p,'p','muted',report?t().noPersonal:t().missing);
 }
 function clearAccess(message){
   authorized=false;report=null;busy=false;
   show('admin-root',false);
   wipe(el('admin-tabs'));wipe(el('admin-view'));
   text('auth-status',message);
 }
 function sameSession(n,user){
   return authorized&&n===session&&activeUser===user&&auth&&auth.currentUser===user;
 }
 function read(){
   if(!authorized||busy||!sameSession(session,activeUser))return;
   var n=session,user=activeUser;
   busy=true;text('auth-status',t().loading);
   function failed(){
     if(!sameSession(n,user))return;
     report=null;busy=false;text('auth-status',t().failed);render();
   }
   try{
     db.collection('admin_metrics').doc('current').get({source:'server'}).then(function(snapshot){
       if(!sameSession(n,user))return;
       try{
         report=snapshot&&snapshot.exists?snapshot.data():null;
       }catch(ignore){failed();return;}
       busy=false;text('auth-status',report?'':t().missing);render();
     },failed);
   }catch(ignore){failed();}
 }
 function denied(message){
   session++;activeUser=null;forcedUser=null;clearAccess(message);
 }
 function onToken(user){
   var n=++session;
   if(user!==activeUser)forcedUser=null;
   activeUser=user;clearAccess(t().checking);
   if(!user||user.emailVerified!==true||user.isAnonymous===true){
     clearAccess(t().signIn);return;
   }
   var force=forcedUser!==user;
   forcedUser=user;
   try{
     user.getIdTokenResult(force).then(function(result){
       if(n!==session||activeUser!==user||!auth||auth.currentUser!==user)return;
       if(!result||!result.claims||result.claims.admin!==true){
         clearAccess(t().denied);return;
       }
       authorized=true;show('admin-root',true);read();
     },function(){
       if(n===session&&activeUser===user&&auth&&auth.currentUser===user)
         clearAccess(t().authError);
     });
   }catch(ignore){
     if(n===session&&activeUser===user)clearAccess(t().authError);
   }
 }
 function login(){
   locale=defaultLang();paintLanguage();
   if(!w.firebase||typeof w.firebase.auth!=='function'||
       typeof w.firebase.firestore!=='function'||!w.firebase.apps||
       config.projectId!=='sanastoyhteiso-v3-development'||
       config.authDomain!=='sanastoyhteiso-v3-development.firebaseapp.com'||
       typeof config.apiKey!=='string'||!config.apiKey){
     denied(t().notReady);return;
   }
   try{
     var app=w.firebase.apps.length?w.firebase.app():w.firebase.initializeApp(config);
     if(!app||!app.options||app.options.projectId!==config.projectId||
         app.options.authDomain!==config.authDomain||app.options.apiKey!==config.apiKey){
       denied(t().notReady);return;
     }
     auth=w.firebase.auth();db=w.firebase.firestore();
     if(!auth||typeof auth.onIdTokenChanged!=='function'||!db){
       denied(t().notReady);return;
     }
     auth.onIdTokenChanged(onToken,function(){denied(t().authError);});
   }catch(ignore){denied(t().notReady);}
 }
 function defaultLang(){
   var x=(w.navigator.language||'ru').slice(0,2);
   return labels[x]?x:'en';
 }
 function paintLanguage(){
   var a=d.querySelectorAll('[data-lang]');
   for(var i=0;i<a.length;i++)a[i].setAttribute('aria-pressed',a[i].getAttribute('data-lang')===locale?'true':'false');
   d.documentElement.lang=locale;
   if(!authorized){text('page-title',t().title);text('subhead',t().sub);}
   else render();
 }
 function init(){
   d.querySelectorAll('[data-lang]').forEach(function(b){
      b.addEventListener('click',function(){locale=this.getAttribute('data-lang');paintLanguage();});
   });login();
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
