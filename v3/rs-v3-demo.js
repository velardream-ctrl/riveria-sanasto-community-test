/* STAGING-ONLY INTERACTIVE DEMO. Does not load the live app or use Firebase.
 * Synthetic per-user UID, synthetic vocabulary and one fixed remote event.
 * Only writes to sanastoyhteiso_staging_shadow_v3 IndexedDB, never localStorage.
 * The sample admin claim is simulated, NOT a Firebase authentication claim.
 * ES5 syntax for old Safari parsing. Real Safari still needs device tests.
 */
(function(root){
 'use strict';
 var doc=root.document,container=doc.getElementById('demo-content');
 if(!container)return;
 var Core=root.RS_SYNC_CORE,Shadow=root.RS_SYNC_SHADOW_IDB,
   Coordinator=root.RS_SYNC_SHADOW_RECONCILE,
   Audit=root.RS_SYNC_RECOVERY_AUDIT,Admin=root.RS_ADMIN_PREVIEW;
 var catalog=root.RS_V3_PUBLIC_CATALOG.create(root.RS_DATA);
 var uid='demo-v3-synthetic-only',lang='ru',tab='cards',cardIndex=0,
   quizIndex=0,quizAnswered=false,quizLastCorrect=false,medTab='phrases',medIndex=0,medReveal=false,
   busy=false,message='',record=null,auditData=null,done=Promise.resolve();
 var labels={
   ru:{cards:'Карточки',practice:'Тесты',mediatri:'Mediatri',dictionary:'Словарь',sync:'Синхронизация',recovery:'История',admin:'Администратор',
    heading:'Тестовая версия 3.0',note:'Только вымышленные данные. Не входит в твой аккаунт. Действующий сайт не меняется.',
    know:'Знаю',again:'Повторить',next:'Следующая',star:'Избранное',learned:'Выучено',pending:'Не отправлено',
    answers:'Ответов',terms:'Слов',add:'Добавить личное слово',fi:'Финский',ru:'Русский',en:'Английский',
    save:'Сохранить в тестовом словаре',search:'Поиск по трём языкам',simulate:'Имитировать другое устройство',
    audit:'Проверить историю',revision:'Версия данных',status:'Состояние',history:'Предыдущих снимков',
    demoAdmin:'Учебная административная панель: все цифры вымышленные, права администратора здесь имитируются.',
    noDeletion:'Никакого удаления или переноса данных пользователей.',loading:'Открываю тестовое хранилище…',
    ready:'Тестовое хранилище готово',saved:'Ответ сохранён атомарно',wordSaved:'Тестовое слово добавлено',
    merged:'Имитированное событие второго устройства объединено',audited:'История проверена',
    empty:'Слов пока нет',error:'Тестовая операция отклонена: ',review:'Проверить синхронизацию без сервера',
    sample:'Публичный словарь, результаты тестовые',all:'Всего',favorite:'★ Избранное',starred:'★',notStarred:'☆',
    source:'Публичная база',correct:'Верно',incorrect:'Повторить',choose:'Выбери русский перевод',
    phrases:'Фразы',headings:'Заголовки',scenarios:'Ситуации',showAnswer:'Показать ответ',
    medNotes:'Учебные примеры Mediatri. Не вводи данные пациентов.',showMore:'Показаны первые 60 результатов',
    medNext:'Далее'},
   fi:{cards:'Kortit',practice:'Harjoitukset',mediatri:'Mediatri',dictionary:'Sanasto',sync:'Synkronointi',recovery:'Historia',admin:'Ylläpito',
    heading:'Testiversio 3.0',note:'Vain esimerkkitietoja. Ei käytä oikeaa tiliäsi eikä muuta toimivaa sivustoa.',
    know:'Osaan',again:'Kertaa',next:'Seuraava',star:'Suosikki',learned:'Opittu',pending:'Lähettämättä',
    answers:'Vastauksia',terms:'Sanoja',add:'Lisää oma sana',fi:'Suomi',ru:'Venäjä',en:'Englanti',
    save:'Tallenna testisanastoon',search:'Hae kolmella kielellä',simulate:'Simuloi toista laitetta',
    audit:'Tarkista historia',revision:'Tietojen versio',status:'Tila',history:'Aiemmat tilannekuvat',
    demoAdmin:'Ylläpidon testinäkymä: luvut ja käyttöoikeus ovat kuvitteellisia.',
    noDeletion:'Ei oikeiden käyttäjätietojen poistoa tai siirtoa.',loading:'Avataan testitietokanta…',
    ready:'Testitietokanta valmis',saved:'Vastaus tallennettu atomisesti',wordSaved:'Testisana lisätty',
    merged:'Toisen laitteen testitapahtuma yhdistetty',audited:'Historia tarkistettu',
    empty:'Ei vielä sanoja',error:'Testitoiminto hylättiin: ',review:'Testaa synkronointi ilman palvelinta',
    sample:'Julkinen sanasto, testitulokset',all:'Yhteensä',favorite:'★ Suosikki',starred:'★',notStarred:'☆',
    source:'Julkinen sanasto',correct:'Oikein',incorrect:'Kertaa',choose:'Valitse venäjänkielinen vastine',
    phrases:'Lauseet',headings:'Otsikot',scenarios:'Tilanteet',showAnswer:'Näytä vastaus',
    medNotes:'Mediatrin harjoitusesimerkkejä. Älä käytä potilastietoja.',showMore:'Ensimmäiset 60 tulosta',
    medNext:'Seuraava'},
   en:{cards:'Cards',practice:'Quizzes',mediatri:'Mediatri',dictionary:'Dictionary',sync:'Sync',recovery:'History',admin:'Admin',
    heading:'Test version 3.0',note:'Synthetic data only. No real sign-in and no changes to the live website.',
    know:'I know',again:'Practice again',next:'Next',star:'Favorite',learned:'Learned',pending:'Not sent',
    answers:'Answers',terms:'Words',add:'Add a personal word',fi:'Finnish',ru:'Russian',en:'English',
    save:'Save to test vocabulary',search:'Search three languages',simulate:'Simulate another device',
    audit:'Audit history',revision:'Data revision',status:'Status',history:'Previous snapshots',
    demoAdmin:'Demonstration administration: all metrics and the admin claim are simulated.',
    noDeletion:'No deletion or migration of real user data.',loading:'Opening synthetic storage…',
    ready:'Test storage ready',saved:'Answer saved atomically',wordSaved:'Test word added',
    merged:'Synthetic second-device event merged',audited:'History verified',
    empty:'No words yet',error:'Test operation rejected: ',review:'Test sync without a server',
    sample:'Public vocabulary, synthetic progress',all:'Total',favorite:'★ Favorite',starred:'★',notStarred:'☆',
    source:'Public catalog',correct:'Correct',incorrect:'Try again',choose:'Choose the Russian translation',
    phrases:'Phrases',headings:'Headings',scenarios:'Scenarios',showAnswer:'Show answer',
    medNotes:'Mediatri learning examples. Do not enter patient data.',showMore:'Showing the first 60 results',
    medNext:'Next'}
 };
 var base={
  scores:{T00001:{seen:0,correct:0,wrong:0,learned:false},
    T00002:{seen:0,correct:0,wrong:0,learned:false},
    T00003:{seen:0,correct:0,wrong:0,learned:false}},
  words:{},favorites:{}
 };
 // Public vocabulary copied byte-for-byte from the already published main/data.js.
 // Learner events and personal words remain synthetic and isolated.
 var vocabulary=catalog.terms();
 var syntheticRemote=Core&&Core.event('E_'+'b'.repeat(32),'D_'+'c'.repeat(32),
   'answer','T00002',{correct:true},1793700000001);
 var device='D_'+randomHex(16);
 function randomHex(n){
   if(!root.crypto||!root.crypto.getRandomValues)
     throw Error('Secure random event IDs unavailable');
   var bytes=new Uint8Array(n),s='',i;
   root.crypto.getRandomValues(bytes);
   for(i=0;i<bytes.length;i++)s+=('0'+bytes[i].toString(16)).slice(-2);
   return s;
 }
 function escapeText(s){
   return String(s===undefined||s===null?'':s).replace(/&/g,'&amp;')
     .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
     .replace(/'/g,'&#39;');
 }
 function translate(id){return labels[lang][id]||id;}
 function totalAnswers(){
   var n=0;
   if(record)Object.keys(record.state.scores).forEach(function(id){
     n+=record.state.scores[id].seen||0;
   });
   return n;
 }
 function learnedCount(){
   var n=0;
   if(record)Object.keys(record.state.scores).forEach(function(id){
     if(record.state.scores[id].learned===true)n++;
   });
   return n;
 }
 function allWords(){
   if(!record)return vocabulary.slice();
   var extra=Object.keys(record.state.words).map(function(k){
     return record.state.words[k];
   });
   return vocabulary.concat(extra);
 }
 function currentWord(){
   var words=allWords();
   return words.length?words[cardIndex%words.length]:null;
 }
 function score(id){return record&&record.state.scores[id]||{};}
 function header(){
   var navigation=['cards','practice','dictionary','mediatri','sync','recovery','admin'].map(function(name){
     return '<button type="button" data-tab="'+name+'" class="demo-tab'+
       (tab===name?' selected':'')+'">'+escapeText(translate(name))+'</button>';
   }).join('');
   doc.getElementById('demo-heading').textContent=translate('heading');
   doc.getElementById('demo-note').textContent=translate('note');
   doc.getElementById('demo-tabs').innerHTML=navigation;
   doc.getElementById('demo-metrics').innerHTML=
     '<span>'+escapeText(translate('terms'))+': <b>'+allWords().length+'</b></span>'+
     '<span>'+escapeText(translate('learned'))+': <b>'+learnedCount()+'</b></span>'+
     '<span>'+escapeText(translate('answers'))+': <b>'+totalAnswers()+'</b></span>'+
     '<span>'+escapeText(translate('pending'))+': <b>'+(record?record.pending.length:0)+'</b></span>';
   var notice=doc.getElementById('demo-status');
   notice.textContent=message||translate('ready');
 }
 function cards(){
   var w=currentWord();
   if(!w)return '<p>'+escapeText(translate('empty'))+'</p>';
   var s=score(w.id),f=!!record.state.favorites[w.id];
   return '<div class="demo-card"><small>'+escapeText(translate('sample'))+
     ' · '+escapeText(w.id)+'</small><h2>'+escapeText(w.fi)+'</h2>'+
     '<p>'+escapeText(w.ru)+' / '+escapeText(w.en||'—')+'</p>'+
     '<p>'+escapeText(translate('answers'))+': '+Number(s.seen||0)+'</p>'+
     '<div class="demo-actions">'+
     '<button data-action="know" class="primary">'+escapeText(translate('know'))+'</button>'+
     '<button data-action="again">'+escapeText(translate('again'))+'</button>'+
     '<button data-action="favorite">'+escapeText(f?translate('starred'):translate('notStarred'))+
       ' '+escapeText(translate('star'))+'</button>'+
     '<button data-action="next">'+escapeText(translate('next'))+'</button></div></div>';
 }
 function quizOptions(){
   var n=vocabulary.length,t=vocabulary[quizIndex%n];
   var wrongA=vocabulary[(quizIndex+19)%n],
     wrongB=vocabulary[(quizIndex+97)%n];
   var pool=[{text:t.ru,correct:true},
     {text:wrongA.ru,correct:false},{text:wrongB.ru,correct:false}];
   var offset=quizIndex%3,rotated=[];
   for(var i=0;i<3;i++)rotated.push(pool[(i+offset)%3]);
   return rotated;
 }
 function practice(){
   var t=vocabulary[quizIndex%vocabulary.length],options=quizOptions();
   var buttons=options.map(function(x,i){
     return '<button type="button" data-action="quiz-choice" data-choice="'+i+'"'+
       (quizAnswered?' disabled':'')+'>'+escapeText(x.text)+'</button>';
   }).join('');
   return '<section><h2>'+escapeText(translate('practice'))+'</h2>'+
     '<p>'+escapeText(translate('choose'))+'</p><div class="demo-card">'+
     '<h2>'+escapeText(t.fi)+'</h2>'+
     '<div class="demo-actions">'+buttons+'</div>'+
     (quizAnswered?'<p role="status">'+escapeText(translate(quizLastCorrect?'correct':'incorrect'))+
       '</p><button type="button" class="primary" data-action="quiz-next">'+
       escapeText(translate('next'))+'</button>':'')+'</div></section>';
 }
 function mediatri(){
   var modes=['phrases','headings','scenarios'],arr=catalog[medTab](),
     page=arr.slice(medIndex,medIndex+12);
   var controls=modes.map(function(k){
     return '<button type="button" data-action="med-switch" data-mode="'+k+'"'+
       (medTab===k?' class="primary"':'')+'>'+escapeText(translate(k))+'</button>';
   }).join('');
   var items=page.map(function(m){
     if(medTab==='scenarios'){
       return '<li><strong>'+escapeText(m.task)+'</strong>'+
         (medReveal?'<p>'+escapeText(m.answer)+'</p>':'')+'</li>';
     }
     return '<li><strong>'+escapeText(m.fi)+'</strong> — '+
       escapeText(m.ru)+' <small>'+escapeText(m.en||'')+'</small></li>';
   }).join('');
   return '<section><h2>Mediatri</h2><p class="demo-muted">'+
     escapeText(translate('medNotes'))+'</p><div class="demo-actions">'+
     controls+'</div><ul id="demo-med-list">'+items+'</ul>'+
     '<p>'+Math.min(medIndex+1,arr.length)+'–'+
       Math.min(medIndex+page.length,arr.length)+' / '+arr.length+'</p>'+
     '<div class="demo-actions">'+
       (medTab==='scenarios'?'<button data-action="med-reveal">'+
         escapeText(translate('showAnswer'))+'</button>':'')+
       '<button data-action="med-next" class="primary">'+
         escapeText(translate('medNext'))+'</button></div></section>';
 }
 function dictionary(){
   // Personal test terms come first so newly added words are visible despite the
   // 1296-term public catalog being displayed in bounded 60-row slices.
   var own=Object.keys(record.state.words).map(function(k){return record.state.words[k];});
   var words=own.concat(vocabulary).slice(0,60).map(function(w){
     return '<li><b>'+escapeText(w.fi)+'</b> — '+escapeText(w.ru)+
       ' <small>'+escapeText(w.en||'—')+'</small></li>';
   }).join('');
   return '<section><label for="demo-search">'+escapeText(translate('search'))+
     '</label><input id="demo-search" type="search" maxlength="180" autocomplete="off">'+
     '<p class="demo-muted" id="demo-search-hint">'+escapeText(translate('showMore'))+'</p>'+ 
     '<ul id="demo-results">'+words+'</ul></section>'+
     '<section class="demo-add"><h2>'+escapeText(translate('add'))+'</h2>'+
     '<form id="demo-word-form"><label>'+escapeText(translate('fi'))+
     '<input name="fi" maxlength="120" required></label><label>'+
     escapeText(translate('ru'))+'<input name="ru" maxlength="200" required></label><label>'+
     escapeText(translate('en'))+'<input name="en" maxlength="200"></label>'+
     '<button class="primary" type="submit">'+escapeText(translate('save'))+'</button></form></section>';
 }
 function syncView(){
   return '<section><h2>'+escapeText(translate('sync'))+'</h2>'+
     '<p>'+escapeText(translate('review'))+'</p>'+
     '<button class="primary" data-action="sync">'+escapeText(translate('simulate'))+'</button>'+
     '<p>'+escapeText(translate('revision'))+': '+record.revision+
     ' · '+escapeText(translate('pending'))+': '+record.pending.length+'</p>'+
     '<p class="demo-muted">'+escapeText(translate('noDeletion'))+'</p></section>';
 }
 function recovery(){
   var result=auditData;
   return '<section><h2>'+escapeText(translate('recovery'))+'</h2>'+
     '<button class="primary" data-action="audit">'+escapeText(translate('audit'))+'</button>'+
     '<p>'+escapeText(translate('revision'))+': '+record.revision+'</p>'+
     (result?'<p>'+escapeText(translate('history'))+': '+result.history.length+
       ' · '+escapeText(translate('answers'))+': '+result.current.seen+
       ' · '+escapeText(translate('pending'))+': '+result.pending+'</p>':'')+
     '<p class="demo-muted">'+escapeText(translate('noDeletion'))+'</p></section>';
 }
 function admin(){
   // A synthetic boolean claim ONLY for demonstrating layout. No auth SDK is
   // loaded and this is not an authorization check for any real admin data.
   return '<section><p class="demo-warning">'+escapeText(translate('demoAdmin'))+'</p>'+
     Admin.render({admin:true},{registered:8,active7d:3,syncFailed24h:0,
       pendingKnown:2,backupAt:'DEMO 2026-11-03',
       catalogVersion:'DEMO FI/RU/EN v3'},lang)+'</section>';
 }
 function render(){
   if(!record){container.textContent=translate('loading');return;}
   header();
   container.innerHTML=(tab==='cards'?cards():tab==='practice'?practice():
     tab==='dictionary'?dictionary():tab==='mediatri'?mediatri():
     tab==='sync'?syncView():tab==='recovery'?recovery():admin());
 }
 var shadow=Shadow&&Shadow.create({
   enableStagingWrites:true,indexedDB:root.indexedDB,core:Core,
   activeUid:function(){return uid;}
 });
 var reader={load:function(requested,pending){
   if(requested!==uid)return Promise.reject(Error('Synthetic UID mismatch'));
   var f=Core.fold(base,[syntheticRemote].concat(pending));
   if(f.invalid||f.duplicates)throw Error('Synthetic cloud fold failed');
   return Promise.resolve({ok:true,readyToApply:false,state:f.state,
     includedPendingIds:pending.map(function(e){return e.id;})});
 }};
 var coordinator=Coordinator&&Coordinator.create({shadow:shadow,cloudReader:reader,
   activeUid:function(){return uid;},legacySyncDisabled:function(){return true;},
   online:function(){return true;},shadowOnly:true});
 var auditor=Audit&&Audit.create({shadow:shadow,
   normalizeSnapshot:Shadow.snapshot,core:Core,
   activeUid:function(){return uid;}});
 function refresh(){
   return shadow.read(uid).then(function(r){record=r;render();return r;});
 }
 function enqueue(operation){
   done=done.then(function(){busy=true;return operation();})
     .then(function(){busy=false;return refresh();},function(e){
       busy=false;message=translate('error')+(e&&e.message||String(e));
       render();return null;
     });
   return done;
 }
 function event(kind,id,data){
   return Core.event('E_'+randomHex(16),device,kind,id,data,Date.now());
 }
 function addAnswer(correct){
   var w=currentWord();
   if(!w)return;
   enqueue(function(){
     return shadow.appendLocal(uid,event('answer',w.id,{correct:correct}),record.revision)
       .then(function(){message=translate('saved');});
   });
 }
 function chooseQuiz(idx){
   if(quizAnswered)return;
   var options=quizOptions(),choice=options[idx];
   if(!choice)return;
   var correct=choice.correct===true;
   var term=vocabulary[quizIndex%vocabulary.length];
   enqueue(function(){
     return shadow.appendLocal(uid,event('answer',term.id,{correct:correct}),record.revision)
       .then(function(){
         quizAnswered=true;quizLastCorrect=correct;
         message=translate(correct?'correct':'incorrect');
       });
   });
 }
 function addFavorite(){
   var w=currentWord();
   if(!w)return;
   enqueue(function(){
     var desired=!record.state.favorites[w.id];
     return shadow.appendLocal(uid,event('favorite_set',w.id,{starred:desired}),
       record.revision).then(function(){message=translate('saved');});
   });
 }
 function addWord(form){
   var fi=form.elements.namedItem('fi').value.trim(),
     ru=form.elements.namedItem('ru').value.trim(),
     en=form.elements.namedItem('en').value.trim();
   if(!fi||!ru)return;
   enqueue(function(){
     var id='demo-word-'+randomHex(8);
     return shadow.appendLocal(uid,event('word_upsert',id,
       {id:id,fi:fi,ru:ru,en:en}),record.revision)
       .then(function(){message=translate('wordSaved');});
   });
 }
 function simulate(){
   enqueue(function(){
     return coordinator.run(uid,'VERIFIED_STAGING_RECONCILIATION_ONLY')
       .then(function(){message=translate('merged');});
   });
 }
 function checkRecovery(){
   enqueue(function(){return auditor.audit(uid).then(function(report){
     auditData=report;message=translate('audited');
   });});
 }
 function click(ev){
   var b=ev.target;
   while(b&&b!==doc&&!b.getAttribute('data-tab')&&!b.getAttribute('data-action'))
     b=b.parentNode;
   if(!b||b===doc||busy)return;
   var t=b.getAttribute('data-tab'),action=b.getAttribute('data-action');
   if(t){tab=t;auditData=null;render();return;}
   if(action==='know')addAnswer(true);
   else if(action==='again')addAnswer(false);
   else if(action==='favorite')addFavorite();
   else if(action==='next'){cardIndex++;render();}
   else if(action==='quiz-choice')chooseQuiz(Number(b.getAttribute('data-choice')));
   else if(action==='quiz-next'){quizIndex++;quizAnswered=false;render();}
   else if(action==='med-switch'){
     var m=b.getAttribute('data-mode');
     if(m==='phrases'||m==='headings'||m==='scenarios'){
       medTab=m;medIndex=0;medReveal=false;render();
     }
   }
   else if(action==='med-reveal'){medReveal=!medReveal;render();}
   else if(action==='med-next'){
     var arr=catalog[medTab]();
     medIndex=(medIndex+12)%arr.length;medReveal=false;render();
   }
   else if(action==='sync')simulate();
   else if(action==='audit')checkRecovery();
 }
 function onSubmit(ev){
   if(ev.target&&ev.target.id==='demo-word-form'){
     ev.preventDefault();if(!busy)addWord(ev.target);
   }
 }
 function onInput(ev){
   if(!ev.target||ev.target.id!=='demo-search')return;
   var q=ev.target.value.toLocaleLowerCase();
   var found=allWords().filter(function(w){
     return [w.fi,w.ru,w.en].join(' ').toLocaleLowerCase().indexOf(q)>=0;
   });
   var out=found.slice(0,60).map(function(w){return '<li><b>'+escapeText(w.fi)+'</b> — '+
     escapeText(w.ru)+' <small>'+escapeText(w.en||'—')+'</small></li>';}).join('');
   doc.getElementById('demo-results').innerHTML=out||'<li>'+escapeText(translate('empty'))+'</li>';
   doc.getElementById('demo-search-hint').textContent=
     found.length>60?translate('showMore')+' / '+found.length:found.length+' / '+allWords().length;
 }
 var didStart=false;
 function start(){
   if(didStart)return;
   didStart=true;
   doc.getElementById('demo-tabs').addEventListener('click',click);
   container.addEventListener('click',click);
   container.addEventListener('submit',onSubmit);
   container.addEventListener('input',onInput);
   doc.getElementById('demo-language').addEventListener('change',function(e){
     lang=e.target.value;
     doc.documentElement.lang=lang;
     render();
   });
   done=shadow.read(uid).then(function(existing){
     if(existing)return existing;
     return shadow.initialize(uid,base,'VERIFIED_STAGING_SHADOW_ONLY');
   }).then(refresh).then(function(){message=translate('ready');render();})
     .catch(function(e){
       container.textContent='Demo initialization failed: '+String(e.message||e);
     });
 }
 root.RS_V3_DEMO={idle:function(){return done;},
   read:function(){return shadow.read(uid);},
   syntheticUid:uid};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start);
 else start();
})(this);
