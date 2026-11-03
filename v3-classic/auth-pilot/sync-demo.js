/* Sanastoyhteiso V3: standalone, explicitly synthetic, cross-device demo.
 * Requires separately approved sync_demo_v3 Firestore rules (new project only).
 * Uses Firebase 8.10.1 to preserve real iOS12 Safari compatibility.
 * All persistent local keys are dedicated to DEMO. Never reads the live app.
 */
(function(w,d){
 'use strict';
 var config=w.RS_V3_AUTH_PILOT_CONFIG,guard=w.RS_V3_TEST_BACKEND_GUARD,
   core=w.RS_V3_SYNC_DEMO_CORE;
 var controller=null,db=null,session=null,initialized=false,step='INIT';
 var PATH='/riveria-sanasto-community-test/v3-classic/auth-pilot/sync-demo.html';
 var deviceKey='RS_V3_DEMO_DEVICE_ONLY';
 function el(id){return d.getElementById(id);}
 function show(id,value){el(id).textContent=value;}
 function note(value,error){show('message',value);el('message').className=error?'note error':'note ok';}
 function authState(){return controller&&controller.getState();}
 function isActive(s){
   var a=authState();
   return !!(s&&session===s&&a&&a.status==='verified'&&a.user&&
     a.user.verified&&a.user.uid===s.uid&&a.revision===s.revision);
 }
 function makeHex(){
   if(!w.crypto||!w.crypto.getRandomValues)throw Error('No secure browser randomness');
   var bytes=new Uint8Array(16);w.crypto.getRandomValues(bytes);
   return core.hex(bytes);
 }
 function device(){
   var key=w.localStorage.getItem(deviceKey);
   if(key&&/^D_[a-f0-9]{32}$/.test(key))return key;
   key='D_'+makeHex();w.localStorage.setItem(deviceKey,key);return key;
 }
 function view(){
   var active=session&&isActive(session),ok=active&&session.permission===true;
   var buttons=d.querySelectorAll('[data-demo-target]');
   for(var i=0;i<buttons.length;i++)buttons[i].disabled=!ok||!!session.clearing||!!session.atLimit;
   el('retry').disabled=!ok||session.clearing||session.atLimit;
   el('clear').disabled=!ok||session.clearing||session.uploading||w.navigator.onLine===false;
   var s=authState();
   el('login').disabled=!controller||!s||s.status==='verified'||
     s.status==='unverified'||s.status==='checking'||s.status==='signing_in';
   el('logout').disabled=!s||!s.user;
   if(!active){show('seen','0');show('correct','0');show('wrong','0');show('pending','0');
     show('card-details','Войдите через Google.');return;}
   try{
     var merged=core.fold(session.uid,session.cloud,core.load(w.localStorage,session.uid));
     show('seen',String(merged.seen));show('correct',String(merged.correct));
     show('wrong',String(merged.wrong));show('pending',String(merged.pending));
     var txt=[];
     ['DEMO_CARD_A','DEMO_CARD_B','DEMO_CARD_C'].forEach(function(k){
       var a=merged.byCard[k]||{seen:0,correct:0,wrong:0};
       txt.push(k.replace('DEMO_CARD_','')+': '+a.seen+' (верно '+a.correct+')');
     });
     show('card-details',txt.join(' · '));
   }catch(err){note('Ошибка проверки локальной демо-очереди. Не перезаписывай её.',true);
     var bs=d.querySelectorAll('[data-demo-target]');
     for(var j=0;j<bs.length;j++)bs[j].disabled=true;
   }
 }
 function disconnect(){
   if(session&&session.unsubscribe){session.unsubscribe();session.unsubscribe=null;}
   session=null;show('cloud-status','Не подключено');view();
 }
 function connection(s){
   if(!isActive(s)||s.unsubscribe)return;
   var ref=db.collection('sync_demo_v3').doc(s.uid).collection('events');
   s.collection=ref;
   s.unsubscribe=ref.orderBy('time','asc').limit(100)
     .onSnapshot({includeMetadataChanges:true},function(snapshot){
       if(!isActive(s))return;
       try{
         var docs=[];
         snapshot.forEach(function(doc){
           // Pending local SDK writes are not yet confirmed by the server.
           // Their copy stays in the dedicated local queue until ACK.
           if(doc.metadata&&doc.metadata.hasPendingWrites)return;
           var e=doc.data();
           if(e.id!==doc.id||!core.valid(e,s.uid))
             throw Error('Unsafe server demo event');
           docs.push(e);
         });
         core.fold(s.uid,docs,core.load(w.localStorage,s.uid));
         s.cloud=docs;
         if(!snapshot.metadata.fromCache){
           s.permission=true;
           s.atLimit=docs.length>=100;
           s.offline=false;
           show('cloud-status','Подключено — обновления в реальном времени');
           note(s.atLimit?'Лимит 100 демособытий. Сначала удали демоответы.':
             'Облачная проверка пройдена. Можно отвечать на карточки.',!!s.atLimit);
           flush(s);
         }else{
           s.offline=true;
           show('cloud-status','Локальный кэш — ожидание сервера');
         }
         view();
       }catch(e){
         s.permission=false;show('cloud-status','Ошибка проверки событий');
         note('Сервер прислал некорректные демоданные. Отправка остановлена.',true);view();
       }
     },function(error){
       if(!isActive(s))return;
       s.permission=false;
       show('cloud-status','Нет разрешения к демоколлекции');
       var code=error&&error.code==='permission-denied'?'permission-denied':'connection-error';
       note('Демо пока закрыто ('+code+'). Нужны новые протестированные правила только в отдельной Firebase.',true);
       view();
     });
 }
 function confirmExisting(doc,e){
   if(!doc.exists)return false;
   var data=doc.data();
   if(data.id!==doc.id||!core.valid(data,e.uid)||!core.sameEvent(data,e))
     throw Error('Event collision on server');
   return true;
 }
 function flush(s){
   if(!isActive(s)||!s.permission||s.atLimit||s.uploading||s.clearing||
     (w.navigator&&w.navigator.onLine===false))return;
   var queue;
   try{queue=core.load(w.localStorage,s.uid);}
   catch(e){note('Повреждена локальная демо-очередь, автоматическая отправка остановлена.',true);return;}
   if(!queue.length)return;
   s.uploading=true;
   function next(index){
     if(!isActive(s)||s.clearing||index>=queue.length)return Promise.resolve();
     var event=queue[index],ref=s.collection.doc(event.id);
     // A retry is idempotent: if prior write reached the server before ACK,
     // verify identical document before deciding not to write it again.
     return ref.get({source:'server'}).then(function(doc){
       if(!isActive(s)||s.clearing)return;
       if(confirmExisting(doc,event))return;
       return ref.set(event);
     }).then(function(){
       if(!isActive(s)||s.clearing)return;
       core.ack(w.localStorage,s.uid,event.id);
       view();
       return next(index+1);
     });
   }
   next(0).then(function(){
     s.uploading=false;if(isActive(s))view();
   },function(e){
     s.uploading=false;
     if(isActive(s)){
       var c=e&&e.code==='permission-denied'?'permission-denied':'offline/retry';
       note('Ответ сохранён локально, отправка ещё не завершена ('+c+').',true);
       view();
     }
   });
 }
 function startSession(state){
   disconnect();
   if(!state||state.status!=='verified'||!state.user||!state.user.verified)return;
   var s={uid:state.user.uid,revision:state.revision,cloud:[],permission:false,
     collection:null,unsubscribe:null,uploading:false,clearing:false,atLimit:false,offline:false};
   try{core.load(w.localStorage,s.uid);device();}
   catch(e){note('На устройстве недоступно сохранение демоответов.',true);return;}
   session=s;show('cloud-status','Соединяемся с Firestore…');
   connection(s);view();
 }
 function handleAuth(state){
   var labels={checking:'Проверка',verified:'Подтверждён',unverified:'Email не подтверждён',
     signed_out:'Не выполнен',signing_in:'Открываем Google',error:'Ошибка входа'};
   show('auth-status',labels[state.status]||'Ожидание');
   startSession(state);view();
 }
 function answer(target,correct){
   var s=session;if(!isActive(s)||!s.permission||s.atLimit||s.clearing)return;
   try{
     var e=core.newEvent(s.uid,device(),target,correct,Date.now(),
       (function(){var bytes=new Uint8Array(16);w.crypto.getRandomValues(bytes);return bytes;})());
     core.append(w.localStorage,s.uid,e);
     note('Ответ сохранён локально. Синхронизация запускается автоматически.',false);
     view();flush(s);
   }catch(err){note('Не удалось безопасно сохранить демоответ. Ничего не потерто.',true);}
 }
 function clearDemo(){
   var s=session;
   if(!isActive(s)||!s.permission||s.clearing||s.uploading||
      w.navigator.onLine===false)return;
   if(!w.confirm('Удалить все ВЫМЫШЛЕННЫЕ демоответы для этого тестового аккаунта? Настоящие учебные данные не затрагиваются.'))return;
   s.clearing=true;view();note('Удаляем только демособытия…',false);
   s.collection.limit(100).get({source:'server'}).then(function(snapshot){
     if(!isActive(s))throw Error('Account changed');
     var flow=Promise.resolve();
     snapshot.forEach(function(doc){
       flow=flow.then(function(){
         if(!isActive(s))throw Error('Account changed');
         var e=doc.data();
         if(doc.id!==e.id||!core.valid(e,s.uid))throw Error('Unexpected demo event');
         return doc.ref.delete();
       });
     });
     return flow;
   }).then(function(){
     if(!isActive(s))return;
     core.clear(w.localStorage,s.uid);s.cloud=[];
     note('Вымышленные демоответы удалены.',false);
   },function(e){
     if(isActive(s))note('Часть удаления не завершена. Проверь соединение, затем повтори.',true);
   }).then(function(){
     if(isActive(s)){s.clearing=false;view();}
   });
 }
 function boot(){
   if(initialized)return;initialized=true;
   try{
     step='SDK';
     if(!config||!guard||!core||!w.firebase||!w.firebase.firestore||
       !w.RS_V3_FIREBASE_AUTH_ADAPTER||!w.RS_V3_AUTH_CONTROLLER)
       throw Error('Missing SDK dependencies');
     step='PROJECT';
     var site={origin:w.location.origin,pathname:w.location.pathname};
     if(site.pathname!==PATH)throw Error('Wrong exact pilot URL');
     var verified=guard.validate({site:site,firebase:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId});
     if(verified.projectId!=='sanastoyhteiso-v3-development')
       throw Error('Not isolated Firebase project');
     step='AUTH';
     var adapter=w.RS_V3_FIREBASE_AUTH_ADAPTER.create({
       guard:guard,site:site,config:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId,sdk:w.firebase});
     controller=w.RS_V3_AUTH_CONTROLLER.create({
       guard:guard,site:site,firebase:config.firebase,
       expectedProjectId:config.expectedProjectId,
       productionProjectId:config.productionProjectId,adapter:adapter});
     var app=null,i;
     for(i=0;i<w.firebase.apps.length;i++)
       if(w.firebase.apps[i].name==='sanastoyhteiso-v3-staging-auth')app=w.firebase.apps[i];
     if(!app||app.options.projectId!==config.expectedProjectId)throw Error('Wrong Firebase app');
     db=w.firebase.firestore(app);
     controller.subscribe(handleAuth);controller.start();
   }catch(e){
     controller=null;show('auth-status','Заблокировано');
     note('Тест не запустился (этап '+step+'). Ничего в Firebase не меняй.',true);
     return;
   }
   el('login').addEventListener('click',function(){
     if(controller)controller.signInWithGoogle().catch(function(e){
       note('Ошибка Google-входа: '+((e&&e.code)||'sign-in'),true);
     });
   });
   el('logout').addEventListener('click',function(){
     if(controller)controller.signOut().catch(function(){
       note('Не удалось завершить выход.',true);
     });
   });
   var buttons=d.querySelectorAll('[data-demo-target]');
   for(var k=0;k<buttons.length;k++)buttons[k].addEventListener('click',function(){
     answer(this.getAttribute('data-demo-target'),this.getAttribute('data-demo-answer')==='1');
   });
   el('retry').addEventListener('click',function(){if(session)flush(session);});
   el('clear').addEventListener('click',clearDemo);
   w.addEventListener('online',function(){if(session){connection(session);flush(session);}});
   w.addEventListener('visibilitychange',function(){
     if(!d.hidden&&session){connection(session);flush(session);}
   });
   w.addEventListener('storage',function(e){
     if(session&&isActive(session)&&e.key&&e.key.indexOf('RS_V3_DEMO_PENDING_')===0)view();
   });
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);
 else boot();
})(window,document);
