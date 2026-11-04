/* STAGING ONLY — real-term V3 pilot. No production site or legacy data access.
 * Explicit opt-in required, IndexedDB first, then immutable sync_v3 events.
 * Firebase v8.10.1, ES5 syntax for Safari iOS12.
 */
(function(w,d){
 'use strict';
 var cfg=w.RS_V3_AUTH_PILOT_CONFIG,guard=w.RS_V3_TEST_BACKEND_GUARD,
  core=w.RS_SYNC_CORE,shadowApi=w.RS_SYNC_SHADOW_IDB,
  studyApi=w.RS_V3_STUDY_ENGINE;
 var PATH='/riveria-sanasto-community-test/v3-classic/auth-pilot/study-v3.html';
 var controller=null,db=null,engine=null,shadow=null,sub=null;
 var activeUid='',activeRevision=0,busy=false,started=false;
 var current=0,reveal=false,last=null,bootStage='INIT',initializing=false;
 var terms=[],localDevice=null;
 function el(id){return d.getElementById(id);}
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
 function eventSignature(e){return JSON.stringify([e.id,e.device,e.kind,e.target,
   e.time,JSON.stringify(e.data)]);}
 function remoteAdapter(){
   var collection=db.collection('sync_v3').doc(activeUid).collection('events');
   return {
    list:function(uid,limit){
     if(!matching()||uid!==activeUid) return Promise.reject(Error('Account changed'));
     return collection.orderBy('time','asc').limit(limit).get({source:'server'})
       .then(function(s){
         if(!matching())throw Error('Account changed during cloud read');
         var events=[];
         s.forEach(function(doc){var v=doc.data();
           if(!v||v.id!==doc.id)throw Error('Cloud event ID mismatch');
           events.push(v);
         });return events;
       });
    },
    put:function(uid,e){
     if(!matching()||uid!==activeUid)return Promise.reject(Error('Account changed'));
     var r=collection.doc(e.id);
     return r.get({source:'server'}).then(function(doc){
       if(!matching())throw Error('Account changed during write');
       if(doc.exists){
         if(eventSignature(doc.data())!==eventSignature(e)||doc.data().uid!==uid)
           throw Error('Cloud event collision; preserve local data');
         return;
       }
       return r.set(e).then(function(){if(!matching())throw Error('Account changed after ACK');});
     });
    },
    watch:function(callback){
      return collection.orderBy('time','asc').limit(500).onSnapshot(
       {includeMetadataChanges:true},function(s){
        if(matching()&&!s.metadata.fromCache&&!s.hasPendingWrites)
          callback(s.size);
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
   var list=terms.slice(0,12),t=list[current%list.length],p=last.state.scores[t.id]||{seen:0,correct:0,wrong:0};
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
   var next=element('button','','Следующее →');next.disabled=busy;
   next.addEventListener('click',function(){current=(current+1)%list.length;reveal=false;render();});
   wrap.appendChild(next);el('study').appendChild(wrap);
 }
 function update(kind,id,value,advance){
   if(!engine||busy||!matching())return;
   busy=true;statusView();render();
   engine.record(kind,id,value).then(function(row){
     last=row;if(advance){current=(current+1)%12;reveal=false;}
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
       var lastNotified=0;
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
     if(!cfg||!guard||!core||!shadowApi||!studyApi||!w.firebase||
       !w.RS_V3_FIREBASE_AUTH_ADAPTER||!w.RS_V3_AUTH_CONTROLLER||
       !w.RS_DATA||!w.RS_DATA.terms||w.RS_DATA.terms.length<1296)
       throw Error('SDK or public dictionary missing');
     terms=w.RS_DATA.terms.filter(function(t){
       return /^T[0-9]{5,7}$/.test(t.id)&&t.fi&&t.ru;
     });
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
   w.addEventListener('online',function(){if(engine&&matching())send();});
   d.addEventListener('visibilitychange',function(){if(!d.hidden&&engine&&matching())reload();});
   render();
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})(window,document);
