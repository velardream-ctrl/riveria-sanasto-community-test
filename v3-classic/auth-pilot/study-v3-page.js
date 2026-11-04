/* STAGING ONLY — real-term V3 pilot. No production site or legacy data access.
 * Explicit opt-in required, IndexedDB first, then immutable sync_v3 events.
 * Firebase v8.10.1, ES5 syntax for Safari iOS12.
 */
(function(w,d){
 'use strict';
 var cfg=w.RS_V3_AUTH_PILOT_CONFIG,guard=w.RS_V3_TEST_BACKEND_GUARD,
  core=w.RS_SYNC_CORE,shadowApi=w.RS_SYNC_SHADOW_IDB,
  studyApi=w.RS_V3_STUDY_ENGINE,pagesApi=w.RS_V3_STUDY_PAGES,
  findsApi=w.RS_V3_FINDS,shaApi=w.RS_SHA256;
 var PATH='/riveria-sanasto-community-test/v3-classic/auth-pilot/study-v3.html';
 var controller=null,db=null,engine=null,shadow=null,sub=null;
 var activeUid='',activeRevision=0,busy=false,started=false;
 var current=0,reveal=false,last=null,bootStage='INIT',initializing=false;
 var terms=[],localDevice=null;
 function el(id){return d.getElementById(id);}
 function allTerms(){
   var words=last&&last.state&&last.state.words||{};
   var ids=Object.keys(words).sort();
   return terms.concat(ids.map(function(id){return words[id];}));
 }
 function visibleTerms(){
   var q=(el('search').value||'').toLowerCase().trim(),
       cat=el('category').value,mode=el('filter').value;
   var s=last&&last.state||{scores:{},favorites:{}};
   return allTerms().filter(function(t){
     if(cat&&t.cat!==cat)return false;
     if(q&&[t.id,t.fi,t.ru,t.en||'',t.cat||'',t.catRu||''].join(' ')
       .toLowerCase().indexOf(q)<0)return false;
     var score=s.scores[t.id];
     if(mode==='favorites'&&s.favorites[t.id]!==true)return false;
     if(mode==='finds'&&!(s.finds&&s.finds[t.id]&&s.finds[t.id].added))return false;
     if(mode==='learned'&&!(score&&score.learned===true))return false;
     if(mode==='review'&&score&&score.learned===true)return false;
     return true;
   });
 }
 function addCategories(){
   var found=Object.create(null),names=[],choose=el('category');
   terms.forEach(function(t){
     if(t.cat&&!found[t.cat]){
       found[t.cat]={label:t.catRu?t.catRu+' / '+t.cat:t.cat};
       names.push(t.cat);
     }
   });
   if(!found['Omat sanat']){
     found['Omat sanat']={label:'Мои слова / Omat sanat'};
     names.push('Omat sanat');
   }
   names.sort(function(a,b){return a.localeCompare(b);});
   names.forEach(function(k){
     var option=d.createElement('option');
     option.value=k;option.textContent=found[k].label;
     choose.appendChild(option);
   });
 }
 function set(id,value){el(id).textContent=value;}
 function note(message,problem){
   set('message',message);el('message').className='state '+(problem?'error':'ok');
 }
 function logged(){var s=controller&&controller.getState();
   return !!(s&&s.status==='verified'&&s.user&&s.user.verified);
 }
 function matching(){var s=controller&&controller.getState();
   return !!(s&&s.status==='verified'&&s.user&&
     s.user.uid===activeUid&&s.revision===activeRevision);
 }
 function hex(){if(!w.crypto||!w.crypto.getRandomValues)throw Error('Crypto unavailable');
   var b=new Uint8Array(16);w.crypto.getRandomValues(b);
   var s='',i,h;for(i=0;i<b.length;i++){h=b[i].toString(16);s+=(h.length===1?'0':'')+h;}
   return s;
 }
 function device(){
   var name='RS_V3_REAL_PILOT_DEVICE_ONLY',value=w.localStorage.getItem(name);
   if(value&&/^D_[a-f0-9]{32}$/.test(value))return value;
   value='D_'+hex();w.localStorage.setItem(name,value);return value;
 }
 // Firestore may reorder map fields; compare canonical event payloads.
 function remoteAdapter(){
   var collection=db.collection('sync_v3').doc(activeUid).collection('events');
   return {
    list:function(uid,limit){
     if(!matching()||uid!==activeUid)
       return Promise.reject(Error('Account changed'));
     if(limit!==10000)return Promise.reject(Error('Unapproved cloud history cap'));
     // Deterministic document-ID order prevents losing answers with identical
     // millisecond timestamps. Paginate until a short/empty page is confirmed.
     var reader=pagesApi.create({active:matching,pageSize:100,maxEvents:10000,
       fetchPage:function(cursor,number){
         var q=collection.orderBy(w.firebase.firestore.FieldPath.documentId(),'asc')
           .limit(number);
         if(cursor!==null)q=q.startAfter(cursor);
         return q.get({source:'server'}).then(function(s){
           if(!matching())throw Error('Account changed during history fetch');
           var items=[],lastDoc=null;
           s.forEach(function(doc){
             var e=doc.data();
             if(!e||e.id!==doc.id)
               throw Error('Cloud event ID mismatch');
             items.push(e);lastDoc=doc;
           });
           return {items:items,cursor:lastDoc};
         });
       }});
     return reader.list();
    },
    put:function(uid,e){
     if(!matching()||uid!==activeUid)return Promise.reject(Error('Account changed'));
     var r=collection.doc(e.id);
     return r.get({source:'server'}).then(function(doc){
       if(!matching())throw Error('Account changed during write');
       if(doc.exists){
         if(!studyApi.sameEvent(doc.data(),e)||doc.data().uid!==uid)
           throw Error('Cloud event collision; preserve local data');
         return;
       }
       return r.set(e).then(function(){if(!matching())throw Error('Account changed after ACK');});
     });
    },
    watch:function(callback){
      // A small tail listener avoids rereading the first 500 historical
      // events on each change and keeps detecting new answers after 500.
      return collection.orderBy('time','desc').limit(5).onSnapshot(
       {includeMetadataChanges:true},function(s){
        if(matching()&&!s.metadata.fromCache&&!s.hasPendingWrites){
          var ids=[];
          s.forEach(function(doc){ids.push(doc.id);});
          callback(ids.join('|'));
        }
       },function(){if(matching())note('Обновления временно недоступны; локальные ответы сохранены.',true);});
    }
   };
 }
 function statusView(){
   var s=controller&&controller.getState();
   set('auth',!s?'Загрузка…':s.status==='verified'?'Подтверждён':
     s.status==='unverified'?'Email не подтверждён':s.status==='signed_out'?'Не выполнен':
     s.status==='checking'?'Проверка…':s.status==='signing_in'?'Открываем Google…':'Ошибка входа');
   el('login').disabled=!controller||busy||!s||
     ['verified','unverified','checking','signing_in'].indexOf(s.status)>=0;
   el('logout').disabled=busy||!s||!s.user;
   el('start').disabled=busy||!logged()||!!engine;
   el('refresh').disabled=busy||!engine||!engine.status().ready;
   el('send').disabled=busy||!engine||!engine.status().ready;
   el('add-word').disabled=busy||!engine||!engine.status().ready||
     (findsApi&&findsApi.matching(allTerms(),el('word-fi').value).exact.length>0);
 }
 function counters(record){
   var ss=record&&record.state&&record.state.scores||{},seen=0,correct=0,wrong=0,learned=0;
   Object.keys(ss).forEach(function(k){var v=ss[k];
     if(v){seen+=v.seen;correct+=v.correct;wrong+=v.wrong;
       if(v.learned)learned++;}
   });
   set('seen',String(seen));set('correct',String(correct));
   set('wrong',String(wrong));set('learned',String(learned));
   set('pending',String(record?record.pending.length:0));
 }
 function cleanStudy(){
   var box=el('study');while(box.firstChild)box.removeChild(box.firstChild);
 }
 function element(tag,cls,content){
   var x=d.createElement(tag);if(cls)x.className=cls;
   if(content!==undefined)x.textContent=content;return x;
 }
 function render(){
   cleanStudy();
   if(!engine||!last){
     el('study').appendChild(element('p','','Обучение V3 ещё не запущено.'));
     counters(null);statusView();return;
   }
   counters(last);statusView();
   var saved=last.state.finds||{},total=0;
   Object.keys(saved).forEach(function(id){if(saved[id]&&saved[id].added)total++;});
   set('finds-count',String(total));renderMatches();
   var list=visibleTerms();
   set('found',String(list.length)+' / '+allTerms().length);
   if(!list.length){
     el('study').appendChild(element('p','small','В выбранной категории нет подходящих терминов.'));
     return;
   }
   var t=list[current%list.length],p=last.state.scores[t.id]||{seen:0,correct:0,wrong:0};
   var wrap=element('div','item');
   wrap.appendChild(element('p','small','Термин '+(current%list.length+1)+' / '+list.length+
     ' · '+t.id+' · '+(p.learned?'Выучено':'В изучении')));
   wrap.appendChild(element('p','fi',t.fi));
   var translation=element('p','ru',reveal?t.ru:'Перевод скрыт');
   wrap.appendChild(translation);
   if(t.en)wrap.appendChild(element('p','small',reveal?'EN: '+t.en:''));
   var show=element('button','',reveal?'Скрыть перевод':'Показать перевод');
   show.disabled=busy;
   show.addEventListener('click',function(){reveal=!reveal;render();});
   wrap.appendChild(show);
   var yes=element('button','green','✓ Знаю'),no=element('button','','↻ Нужно повторить');
   yes.disabled=busy||!reveal;no.disabled=busy||!reveal;
   yes.addEventListener('click',function(){answer(t.id,true);});
   no.addEventListener('click',function(){answer(t.id,false);});
   wrap.appendChild(yes);wrap.appendChild(no);
   var star=element('button','',last.state.favorites[t.id]?'★ Убрать избранное':'☆ В избранное');
   star.disabled=busy;star.addEventListener('click',function(){
     update('favorite_set',t.id,!last.state.favorites[t.id],false);
   });wrap.appendChild(star);
   var selection=last.state.finds&&last.state.finds[t.id],has=!!(selection&&selection.added);
   if(has){
     var source=selection.topic==='practice'?'Практика':
       selection.topic==='study'?'Учёба':'Другое';
     wrap.appendChild(element('p','small','Моя находка · '+source+
       (selection.note?' · '+selection.note:'')));
   }
   var findBtn=element('button','',has?'✓ В моих находках — убрать':'＋ В мои находки');
   findBtn.disabled=busy;
   findBtn.addEventListener('click',function(){
     chooseFind(t.id,!has,selection&&selection.topic||'other',selection&&selection.note||'');
   });
   wrap.appendChild(findBtn);
   var next=element('button','','Следующее →');next.disabled=busy;
   next.addEventListener('click',function(){current=(current+1)%list.length;reveal=false;render();});
   wrap.appendChild(next);el('study').appendChild(wrap);
 }
 function update(kind,id,value,advance){
   if(!engine||busy||!matching())return;
   busy=true;statusView();render();
   engine.record(kind,id,value).then(function(row){
     last=row;if(advance){current=(current+1)%Math.max(1,visibleTerms().length);reveal=false;}
     note('Ответ записан в IndexedDB. Отправляем в облако…',false);
     render();
     return engine.upload().then(function(){return engine.view();}).then(function(row){
       last=row;note('Облако подтвердило запись.',false);
     },function(){
       note('Ответ сохранён локально. Отправится при восстановлении связи.',false);
     });
   },function(){
     note('Запись не завершена. Ничего не перезаписывали.',true);
   }).then(function(){busy=false;render();},function(){busy=false;render();});
 }
 function answer(id,correct){update('answer',id,correct,true);}
 function reload(){
   if(!engine||busy||!matching())return;
   busy=true;statusView();
   engine.refresh().then(function(row){
     last=row;return engine.upload().then(function(){
       return engine.refresh();
     });
   }).then(function(row){
     last=row;set('cloud','Подключено');note('Облачная история сверена.',false);
   },function(){
     note('Сверка временно недоступна. Локальные ответы сохранены.',true);
   }).then(function(){busy=false;render();});
 }
 function send(){
   if(!engine||busy||!matching())return;
   busy=true;statusView();
   engine.upload().then(function(){return engine.refresh();}).then(function(row){
     last=row;note('Очередь отправлена и сверена с сервером.',false);
   },function(){note('Отправка ещё не завершена. Локальная очередь сохранена.',true);
   }).then(function(){busy=false;render();});
 }


 function renderMatches(){
   var out=el('word-matches');if(!out)return;
   while(out.firstChild)out.removeChild(out.firstChild);
   var value=el('word-fi').value;
   if(!engine||!last||!findsApi||!value.trim())return;
   var result=findsApi.matching(allTerms(),value),entries=result.exact.length?result.exact:result.similar;
   if(result.exact.length)out.appendChild(element('p','small',
     'Слово уже в словаре. Добавь существующую карточку в личную подборку:'));
   else if(result.similar.length)out.appendChild(element('p','small',
     'Возможные словоформы. Проверь значение перед выбором — они не объединяются автоматически:'));
   else out.appendChild(element('p','small','Совпадений не найдено. Можно создать личную карточку.'));
   entries.forEach(function(t){
     var btn=element('button','',t.fi+' — '+t.ru+' · В мои находки');
     btn.disabled=busy;
     btn.addEventListener('click',function(){
       chooseFind(t.id,true,el('word-topic').value,el('word-note').value);
     });
     out.appendChild(btn);
   });
 }
 function findSelection(added,topic,noteText){
   if(['practice','study','other'].indexOf(topic)<0||
     typeof noteText!=='string'||noteText.length>350)
     throw Error('Invalid personal selection');
   return {list:'finds',added:added,topic:topic,note:noteText};
 }
 function saveAndSend(row){
   last=row;note('Изменение сохранено в IndexedDB.',false);render();
   return engine.upload().then(function(){return engine.view();}).then(function(record){
     last=record;note('Мои находки синхронизированы.',false);
   },function(){
     note('Изменение в IndexedDB сохранено, но облако пока не подтвердило его. '+
       'Проверь подключение и новые правила Firestore.',true);
   });
 }
 function chooseFind(id,added,topic,rawNote){
   if(!engine||busy||!matching())return;
   if(!allTerms().some(function(t){return t.id===id;})){
     note('Слово не найдено в текущем словаре.',true);return;
   }
   var value;
   try{value=findSelection(added,topic,String(rawNote||'').trim());}
   catch(e){note('Проверь заметку и категорию.',true);return;}
   var prior=last.state.finds&&last.state.finds[id];
   if(prior&&prior.added===value.added&&prior.topic===value.topic&&prior.note===value.note){
     note('Это слово уже в выбранной подборке. Дубль не создаётся.',false);
     return;
   }
   busy=true;render();
   engine.record('collection_set',id,value).then(saveAndSend,function(){
     note('Не удалось сохранить отметку. Старые данные не изменялись.',true);
   }).then(function(){busy=false;render();},function(){busy=false;render();});
 }
 function addPersonalWord(){
   if(!engine||busy||!matching())return;
   var fi=el('word-fi').value.trim(),ru=el('word-ru').value.trim(),
       en=el('word-en').value.trim(),topic=el('word-topic').value,
       rawNote=el('word-note').value.trim();
   if(!fi||!ru||fi.length>120||ru.length>180||en.length>180){
     note('Нужны финский и русский переводы; проверь длину полей.',true);return;
   }
   var selection;
   try{selection=findSelection(true,topic,rawNote);}
   catch(e){note('Неверная категория или длинная заметка.',true);return;}
   if(findsApi.matching(allTerms(),fi).exact.length){
     note('Слово уже есть. Выбери найденную карточку выше.',true);
     renderMatches();return;
   }
   busy=true;render();
   var uid=activeUid;
   findsApi.personalId(uid,fi,shaApi,w.crypto).then(function(id){
     if(!matching())throw Error('Account changed');
     return (w.navigator.onLine===false?engine.view():engine.refresh())
       .then(function(row){
         last=row;
         var exact=findsApi.matching(allTerms(),fi).exact;
         if(exact.length)return engine.record('collection_set',exact[0].id,selection);
         if(row.state.words[id]){
           var existing=row.state.words[id];
           if(findsApi.normalize(existing.fi)!==findsApi.normalize(fi))
             throw Error('Personal word identity conflict');
           if(existing.ru.trim()!==ru||(existing.en||'').trim()!==en)
             throw Error('Personal word has another translation');
           return engine.record('collection_set',id,selection);
         }
         return engine.record('word_upsert',id,{fi:fi,ru:ru,en:en})
           .then(function(){return engine.record('collection_set',id,selection);});
       });
   }).then(function(row){
     el('word-fi').value='';el('word-ru').value='';el('word-en').value='';
     el('word-note').value='';el('search').value='';
     el('category').value='';el('filter').value='finds';current=0;reveal=false;
     return saveAndSend(row);
   }).catch(function(err){
     note(err&&err.message&&err.message.indexOf('another translation')>=0?
       'Слово уже есть с другим переводом — уточни его. Ничего не перезаписано.':
       'Сохранение не завершено. Проверь соединение, Google-вход и правила. '+
       'Старая история не изменялась.',true);
   }).then(function(){busy=false;render();},function(){busy=false;render();});
 }
 function stop(){
   if(sub){sub();sub=null;}
   engine=null;shadow=null;last=null;activeUid='';activeRevision=0;
   busy=false;set('cloud','Не подключено');render();
 }
 function start(){
   if(initializing||!logged()||engine)return;
   initializing=true;busy=true;statusView();
   try{
     var state=controller.getState();
     activeUid=state.user.uid;activeRevision=state.revision;
     localDevice=device();
     var remote=remoteAdapter();
     shadow=shadowApi.create({indexedDB:w.indexedDB,core:core,
       activeUid:function(){return matching()?activeUid:null;},
       enableStagingWrites:true,now:Date.now});
     engine=studyApi.create({stagingOnly:true,uid:activeUid,device:localDevice,
       core:core,shadow:shadow,remote:remote,random:hex,now:Date.now,
       online:function(){return w.navigator.onLine!==false;},
       activeUid:function(){return matching()?activeUid:null;}});
     set('cloud','Проверяем сервер…');
     engine.start().then(function(row){
       if(!matching())return;
       last=row;set('cloud',w.navigator.onLine===false?
         'Локальная история (офлайн)':'Соединение подтверждено');
       note('История открыта. Можно учиться.',false);
       var lastNotified='';
       sub=remote.watch(function(size){
         if(!matching()||busy||size===lastNotified)return;
         lastNotified=size;reload();
       });
     },function(){
       note('Запуск заблокирован: облачная история не проверена. Ничего не потеряно.',true);
       stop();
     }).then(function(){busy=false;initializing=false;render();});
   }catch(e){
     stop();initializing=false;note('Не удалось открыть IndexedDB или проверить приложение.',true);
   }
 }
 function authChange(s){
   if(engine&&(!s.user||s.status!=='verified'||!matching()))stop();
   statusView();
 }
 function boot(){
   if(started)return;started=true;
   try{
     bootStage='SDK';
     if(!cfg||!guard||!core||!shadowApi||!studyApi||!pagesApi||!findsApi||!shaApi||!w.firebase||
       !w.RS_V3_FIREBASE_AUTH_ADAPTER||!w.RS_V3_AUTH_CONTROLLER||
       !w.RS_DATA||!w.RS_DATA.terms||w.RS_DATA.terms.length<1296)
       throw Error('SDK or public dictionary missing');
     terms=w.RS_DATA.terms.filter(function(t){
       return /^T[0-9]{5,7}$/.test(t.id)&&t.fi&&t.ru;
     });
     if(terms.length<1296)throw Error('Incomplete public catalog');
     addCategories();
     bootStage='PROJECT';
     var site={origin:w.location.origin,pathname:w.location.pathname};
     if(site.pathname!==PATH)throw Error('Wrong pilot path');
     var vetted=guard.validate({site:site,firebase:cfg.firebase,
       expectedProjectId:cfg.expectedProjectId,productionProjectId:cfg.productionProjectId});
     if(!vetted||vetted.isolated!==true)throw Error('Not isolated');
     bootStage='AUTH';
     var adapter=w.RS_V3_FIREBASE_AUTH_ADAPTER.create({
       guard:guard,site:site,config:cfg.firebase,
       expectedProjectId:cfg.expectedProjectId,
       productionProjectId:cfg.productionProjectId,sdk:w.firebase});
     controller=w.RS_V3_AUTH_CONTROLLER.create({
       guard:guard,site:site,firebase:cfg.firebase,
       expectedProjectId:cfg.expectedProjectId,
       productionProjectId:cfg.productionProjectId,adapter:adapter});
     var app=null,i;
     for(i=0;i<w.firebase.apps.length;i++)
       if(w.firebase.apps[i].name==='sanastoyhteiso-v3-staging-auth')app=w.firebase.apps[i];
     if(!app||app.options.projectId!==cfg.expectedProjectId)throw Error('Wrong app');
     db=w.firebase.firestore(app);
     controller.subscribe(authChange);controller.start();
   }catch(e){
     set('auth','Заблокировано');
     note('Тест заблокирован на этапе '+bootStage+'. Не меняй правила Firebase.',true);
     return;
   }
   el('login').addEventListener('click',function(){
     controller.signInWithGoogle().catch(function(){
       note('Вход не выполнен. Повтори попытку через Google.',true);
     });
   });
   el('logout').addEventListener('click',function(){
     stop();controller.signOut().catch(function(){note('Не удалось выйти.',true);});
   });
   el('start').addEventListener('click',start);
   el('refresh').addEventListener('click',reload);
   el('send').addEventListener('click',send);
   el('add-word').addEventListener('click',addPersonalWord);
   el('word-fi').addEventListener('input',function(){renderMatches();statusView();});
   ['search','category','filter'].forEach(function(id){
     el(id).addEventListener(id==='search'?'input':'change',function(){
       current=0;reveal=false;render();
     });
   });
   w.addEventListener('online',function(){if(engine&&matching())send();});
   d.addEventListener('visibilitychange',function(){if(!d.hidden&&engine&&matching())reload();});
   render();
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})(window,document);
