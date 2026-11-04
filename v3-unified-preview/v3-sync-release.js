/* Unified Sanastoyhteiso V3 release CANDIDATE — old website and account,
 * additive opt-in immutable cloud events. Does not run without Firebase owner
 * validation, server permissions and each user's independent consent.
 * Uses existing verified Firebase Auth; preserves old files/Google Drive.
 * All storage per owner; ES5 Safari 12; no service account or admin access.
 */
(function(w,d){
 'use strict';
 var engineAPI=w.RS_V3_STUDY_ENGINE,shadowAPI=w.RS_SYNC_SHADOW_IDB,
   pages=w.RS_V3_STUDY_PAGES,core=w.RS_SYNC_CORE,
   diff=w.RS_V3_DIFF,finds=w.RS_V3_FINDS,sha=w.RS_SHA256;
 var PROD='sanastoyhteiso-v3-development',PREFIX='rs_unified_v3_enabled_',
   BACKUP='rs_unified_v3_prior_backup_',DEVICE='rs_unified_v3_device';
 var uid='',engine=null,row=null,unsub=null,ready=false,starting=false,applying=false,
   observed=null,lastError='',queue=Promise.resolve(),queued=0,tip='',lastTail='',epoch=0;
 var db=null,auth=null;
 function byId(id){return d.getElementById(id);}
 function active(){
   return !!(ready&&engine&&uid&&w.RS_FAMILY&&
     w.RS_FAMILY.uid===uid&&auth&&auth.currentUser&&
     auth.currentUser.uid===uid&&auth.currentUser.emailVerified===true);
 }
 function validUser(user){return !!(user&&user.emailVerified===true&&w.RS_FAMILY&&w.RS_FAMILY.uid===user.uid);}
 function json(v){return JSON.parse(JSON.stringify(v));}
 function local(){return w.RS_FAMILY&&w.RS_FAMILY.getState?w.RS_FAMILY.getState():null;}
 function secureHex(){
   if(!w.crypto||!w.crypto.getRandomValues)throw Error('WebCrypto required');
   var a=new Uint8Array(16);w.crypto.getRandomValues(a);
   var s='',x;for(var i=0;i<16;i++){x=a[i].toString(16);s+=(x.length<2?'0':'')+x;}
   return s;
 }
 function device(){
   var v=w.localStorage.getItem(DEVICE);
   if(v&&/^D_[a-f0-9]{32}$/.test(v))return v;
   v='D_'+secureHex();w.localStorage.setItem(DEVICE,v);return v;
 }
 function consent(user){try{return w.localStorage.getItem(PREFIX+user)==='enabled';}catch(e){return false;}}
 function text(message,error){lastError=error?message:'';tip=message;status();}
 function status(){
   var slot=byId('v3-release-bar');if(!slot)return;
   var inSettings=!!d.querySelector('[data-view="backup"].active');slot.hidden=!inSettings;if(!inSettings)return;while(slot.firstChild)slot.removeChild(slot.firstChild);
   var h=d.createElement('strong');h.textContent='Синхронизация между устройствами: ';
   slot.appendChild(h);
   var t=d.createElement('span');
   var user=auth&&auth.currentUser;
   t.textContent=starting?'проверка аккаунта и облака…':
     active()?'включена · '+(row?row.pending.length:0)+' в очереди':
     !user?'войдите через Google':
     !validUser(user)?'ожидает подтверждённого аккаунта':
     consent(user.uid)?'временно не подключена':'доступна по желанию';
   slot.appendChild(t);
   if(tip){
     var m=d.createElement('p');m.className=lastError?'banner warning':'hint';
     m.textContent=tip;slot.appendChild(m);
   }
   if(!starting&&validUser(user)&&!active()){
     var b=d.createElement('button');b.type='button';b.className='btn good';
     b.textContent=consent(user.uid)?'Повторить подключение':'Подключить синхронизацию';
     b.addEventListener('click',function(){begin(true);});slot.appendChild(b);
   }
   if(active()){
     var check=d.createElement('button');check.type='button';check.className='btn white';
     check.textContent='Сверить V3';check.addEventListener('click',refresh);
     slot.appendChild(check);
   }
 }
 function snapshotFromCloud(s){
   var state=s||{},words={};
   Object.keys(state.words||{}).forEach(function(id){var value=state.words[id];if(value&&value.fi&&value.ru)words[id]=value;});
   var fav={};
   Object.keys(state.favorites||{}).forEach(function(id){fav[id]={
     starred:state.favorites[id]===true,updatedAt:Date.now()};});
   var scope=(local()||{}).scope||{value:'all',updatedAt:Date.now()};
   return {scores:state.scores||{},words:words,favorites:fav,scope:scope};
 }
 function apply(r){
   if(!active()||!r||!r.state||queued!==0)return false;
   applying=true;
   var prev=observed;
   try{
     var next=snapshotFromCloud(r.state);
     if(!w.RS_FAMILY.putState(next))throw Error('No local storage space; cloud not applied');
     observed=diff.project(next);
     row=r;
     return true;
   }catch(e){
     observed=prev;text('Не удалось отобразить данные V3: '+e.message,true);return false;
   }finally{applying=false;status();}
 }
 function orderly(fn){
   var owner=uid,token=epoch;
   queued++;
   var job=queue.then(function(){
     if(token!==epoch||uid!==owner||!active())
       throw Error('V3 account changed before write');
     return fn();
   });
   queue=job.then(function(){},function(e){
     if(token===epoch)
       text('Локальные изменения сохранены; V3 требует проверки: '+String(e.message||e),true);
   }).then(function(){
     if(token===epoch){queued=Math.max(0,queued-1);status();}
   });
   return job;
 }
 function sessionRemote(owner){
   var collection=db.collection('sync_v3').doc(owner).collection('events');
   function guard(){return uid===owner&&auth.currentUser&&auth.currentUser.uid===owner&&w.RS_FAMILY.uid===owner;}
   return {
     list:function(who,limit){
       if(!guard()||who!==owner||limit!==10000)return Promise.reject(Error('Invalid V3 read context'));
       return pages.create({active:guard,pageSize:100,maxEvents:10000,
         fetchPage:function(cursor,size){
           var q=collection.orderBy(w.firebase.firestore.FieldPath.documentId(),'asc').limit(size);
           if(cursor!==null)q=q.startAfter(cursor);
           return q.get({source:'server'}).then(function(snapshot){
             if(!guard())throw Error('Auth changed during query');
             var out=[],last=null;
             snapshot.forEach(function(doc){
               var e=doc.data();if(!e||e.id!==doc.id)throw Error('Cloud history ID mismatch');
               out.push(e);last=doc;
             });
             return {items:out,cursor:last};
           });
         }}).list();
     },
     put:function(who,e){
       if(!guard()||who!==owner)return Promise.reject(Error('Auth changed before write'));
       var ref=collection.doc(e.id);
       return ref.get({source:'server'}).then(function(doc){
         if(!guard())throw Error('Auth changed during write');
         if(doc.exists){
           var old=doc.data();
           if(old.uid!==owner||!engineAPI.sameEvent(old,e))
             throw Error('Immutable event collision');
           return;
         }
         return ref.set(e);
       });
     },
     watch:function(callback){
       return collection.orderBy('time','desc').limit(5).onSnapshot(
         {includeMetadataChanges:true},function(snapshot){
           if(!guard()||snapshot.metadata.fromCache||snapshot.hasPendingWrites)return;
           var ids=[];snapshot.forEach(function(doc){ids.push(doc.id);});
           var key=ids.join('|');
           if(key===lastTail)return;
           lastTail=key;callback();
         },function(err){text('Обновления V3 временно недоступны: '+String(err.code||'сеть'),true);});
     }
   };
 }
 function stop(){
   epoch++;
   if(unsub){unsub();unsub=null;}
   ready=false;engine=null;row=null;observed=null;uid='';queued=0;
   // Cancel the former account's queue; old promise continuations are fenced
   // by the epoch token and cannot decrement the new owner's counters.
   queue=Promise.resolve();
   lastTail='';starting=false;status();
 }
 function attach(user,manual){
   if(starting||active()||!validUser(user))return Promise.resolve(false);
   if(!consent(user.uid)&&!manual)return Promise.resolve(false);
   if(!engineAPI||!shadowAPI||!pages||!core||!diff||!finds||!sha)
     {text('Не все модули V3 загрузились.',true);return Promise.resolve(false);}
   var hadConsent=consent(user.uid),owner=user.uid,session=epoch;
   starting=true;tip='';status();uid=owner;
   var remote=sessionRemote(uid),storage;
   try{
     storage=shadowAPI.create({indexedDB:w.indexedDB,core:core,
       activeUid:function(){return validUser(auth.currentUser)&&uid===auth.currentUser.uid?uid:null;},
       enableStagingWrites:true,now:Date.now});
     engine=engineAPI.create({stagingOnly:true,uid:uid,device:device(),
       online:function(){return w.navigator.onLine!==false;},
       core:core,shadow:storage,remote:remote,random:secureHex,now:Date.now,
       activeUid:function(){return validUser(auth.currentUser)&&uid===auth.currentUser.uid?uid:null;}});
   }catch(e){stop();text('V3 нельзя включить: '+e.message,true);return Promise.resolve(false);}
   return engine.start().then(function(r){
     if(session!==epoch||uid!==owner||!validUser(auth.currentUser)||
       auth.currentUser.uid!==owner)throw Error('Session changed');
     // No local reset before we have completely read and validated cloud data.
     var existing=local();
     if(!existing)throw Error('Local profile not ready');
     if(manual&&!consent(uid)){
       var key=BACKUP+uid+'_'+Date.now();
       // A failed backup must block the cutover rather than destroy an old score.
       w.localStorage.setItem(key,JSON.stringify({v:1,uid:uid,createdAt:Date.now(),state:existing}));
       w.localStorage.setItem(PREFIX+uid,'enabled');
     }
     // For previously activated users, first reconcile any local edits made
     // just before an unexpected browser shutdown (positive deltas only).
     var pending=hadConsent?diff.recover(r.state,existing):{events:[],unsafe:[]};
     if(pending.unsafe.length)throw Error('Local history conflict; old state preserved');
     ready=true;row=r;
     // A fresh V3 study should show the shared public dictionary by default.
     // Only the consenting owner is changed; later preferences are preserved.
     if(!hadConsent&&w.RS_FAMILY.setScope)w.RS_FAMILY.setScope('all');
     observed=diff.project(r.state);
     function persist(index){
       if(index>=pending.events.length)return Promise.resolve();
       var ev=pending.events[index];
       return engine.record(ev.kind,ev.target,ev.value).then(function(){return persist(index+1);});
     }
     return persist(0).then(function(){return engine.view();});
   }).then(function(next){
     if(session!==epoch||uid!==owner||!validUser(auth.currentUser)||
       auth.currentUser.uid!==owner)throw Error('Session changed before applying state');
     row=next;apply(next);
     if(!ready)throw Error('V3 activation failed');
     tip='V3 включена. Прежние результаты не удалены: создана локальная копия.';
     unsub=remote.watch(function(){if(active()&&queued===0)refresh();});
     starting=false;status();
     return upload();
   }).then(function(){return session===epoch&&uid===owner&&active();}).catch(function(e){
     // An older account's async failure must never stop a newer account.
     if(session!==epoch)return false;
     // Never automatically restore or overwrite old data on a cloud error.
     stop();text('V3 пока не включена: '+String(e.message||e),true);
     return false;
   });
 }
 function begin(manual){
   if(!auth||!auth.currentUser||!validUser(auth.currentUser)){
     text('Сначала войди через подтверждённый Google-аккаунт.',true);return Promise.resolve(false);
   }
   var user=auth.currentUser;
   if(manual&&!consent(user.uid)&&!w.confirm(
     'Подключить V3 с новой учебной историей? Прежние локальные результаты будут сохранены отдельно, но в текущей статистике может начаться новый отсчёт. Другие пользователи не затрагиваются.'))
     return Promise.resolve(false);
   return attach(user,manual);
 }
 function upload(){
   if(!active())return Promise.resolve(false);
   return orderly(function(){
     return engine.upload().then(function(r){row=r;status();return true;},
       function(e){text('Без интернета изменения останутся в IndexedDB: '+e.message,true);return false;});
   });
 }
 function refresh(){
   if(!active())return Promise.resolve(false);
   return orderly(function(){
     return engine.upload().catch(function(){return null;}).then(function(){
       return engine.refresh();
     }).then(function(r){
       row=r;
       return r;
     });
   }).then(function(r){
     // Do not overwrite UI changes that have not been captured or persisted.
     if(queued===0)apply(r);
     text('Данные V3 сверены с облаком.',false);return true;
   }).catch(function(e){text('Сверка V3 не выполнена: '+e.message,true);return false;});
 }
 function capture(){
   if(!active()||applying||!observed)return;
   var after=local();if(!after)return;
   var result=diff.changes(observed,after);
   if(result.unsafe.length){
     text('Обнаружено несогласованное изменение '+result.unsafe.join(', ')+'. Запись V3 остановлена.',true);
     return;
   }
   observed=diff.project(after);
   if(!result.events.length)return;
   var owner=uid,token=epoch,which=engine;
   result.events.forEach(function(e){
     orderly(function(){return which.record(e.kind,e.target,e.value).then(function(r){
       if(epoch===token&&uid===owner)row=r;return r;
     });});
   });
   // Apply only when the SAME account's queue becomes idle.
   queue.then(function(){
     if(token!==epoch||uid!==owner||!active())return;
     which.upload().then(function(r){
       if(token===epoch&&uid===owner){row=r;status();}
     },function(){
       if(token===epoch)text('Ответы сохранены в IndexedDB; ожидается интернет.',false);
     });
   });
 }
 function direct(kind,target,value){
   if(!active())return Promise.reject(Error('V3 inactive'));
   var owner=uid,token=epoch,which=engine;
   function same(){return token===epoch&&uid===owner&&active();}
   return orderly(function(){return which.record(kind,target,value);}).then(function(r){
     if(!same())throw Error('V3 account changed during write');
     row=r;
     return which.upload().then(function(){return which.view();},function(){return r;});
   }).then(function(r){
     if(!same())throw Error('V3 account changed after write');
     row=r;if(queued===0)apply(r);return r;
   });
 }
 function wordChoices(query){
   var all=(w.RS_DATA&&w.RS_DATA.terms||[]).slice();
   var words=row&&row.state&&row.state.words||{};
   Object.keys(words).forEach(function(id){all.push(words[id]);});
   return finds.matching(all,query);
 }
 function formWord(form){
   if(!active())return Promise.reject(Error('V3 inactive'));
   var fi=form.elements.fi.value.trim(),ru=form.elements.ru.value.trim();
   if(!fi||!ru||fi.length>120||ru.length>180)
     return Promise.reject(Error('Введите FI и RU; длина не более 120/180 символов'));
   var matched=wordChoices(fi);
   if(matched.exact.length)
     return direct('collection_set',matched.exact[0].id,
       {list:'finds',added:true,topic:'other',note:''});
   var owner=uid;
   return finds.personalId(owner,fi,sha,w.crypto).then(function(id){
     if(!active()||uid!==owner)throw Error('Auth changed');
     var older=row.state.words[id];
     if(older){
       if(finds.normalize(older.fi)!==finds.normalize(fi)||
         older.ru!==ru)throw Error('Same word already exists with a different translation');
       return null;
     }
     return direct('word_upsert',id,{fi:fi,ru:ru,en:''});
   }).then(function(){
     var x=wordChoices(fi).exact[0];
     if(!x)throw Error('New personal word not yet materialized');
     return direct('collection_set',x.id,
       {list:'finds',added:true,topic:'other',note:''});
   });
 }
 function renderFinds(parent){
   if(!active()||!parent||byId('v3-finds-panel'))return;
   var panel=d.createElement('div');panel.className='panel';panel.id='v3-finds-panel';
   var h=d.createElement('h2');h.textContent='Мои находки · V3';panel.appendChild(h);
   var intro=d.createElement('p');intro.className='hint';
   intro.textContent='Введи услышанное слово в поле «Финское слово» выше. '+
     'Если оно уже есть в общем словаре, добавь существующую карточку без дубля.';
   panel.appendChild(intro);
   var topic=d.createElement('select');topic.className='control';topic.id='v3-find-topic';
   [['practice','Практика'],['study','Учёба'],['other','Другое']].forEach(function(p){
     var o=d.createElement('option');o.value=p[0];o.textContent=p[1];topic.appendChild(o);
   });
   panel.appendChild(topic);
   var note=d.createElement('input');note.type='text';note.id='v3-find-note';
   note.className='control';note.maxLength=350;note.placeholder='Личная заметка (необязательно)';
   panel.appendChild(note);
   var matches=d.createElement('div');matches.id='v3-find-matches';panel.appendChild(matches);
   var chosen=d.createElement('div');chosen.id='v3-find-saved';panel.appendChild(chosen);
   parent.appendChild(panel);
   var input=parent.querySelector('#add-form [name="fi"]');
   function update(){
     while(matches.firstChild)matches.removeChild(matches.firstChild);
     var v=input&&input.value||'';if(v.trim()){
       var results=wordChoices(v),list=results.exact.length?results.exact:results.similar;
       if(results.exact.length){
         var msg=d.createElement('p');msg.textContent='Слово уже есть — не нужно создавать вторую карточку.';
         matches.appendChild(msg);
       }else if(results.similar.length){
         var msg2=d.createElement('p');msg2.textContent='Похожие формы: выбери только при совпадении значения.';
         matches.appendChild(msg2);
       }
       list.forEach(function(word){
         var b=d.createElement('button');b.type='button';b.className='btn white';
         b.textContent=word.fi+' — '+word.ru+' · В мои находки';
         b.addEventListener('click',function(){
           direct('collection_set',word.id,{list:'finds',added:true,
             topic:topic.value,note:note.value.trim()}).then(function(){
               text('Карточка добавлена в «Мои находки» без дубля.',false);
               drawSaved();update();
             },function(e){text('Не удалось сохранить находку: '+e.message,true);});
         });matches.appendChild(b);
       });
     }
   }
   function drawSaved(){
     while(chosen.firstChild)chosen.removeChild(chosen.firstChild);
     var found=row&&row.state&&row.state.finds||{};
     Object.keys(found).filter(function(id){return found[id].added;}).forEach(function(id){
       var item=(w.RS_DATA&&w.RS_DATA.terms||[]).filter(function(x){return x.id===id;})[0]||
         (row&&row.state&&row.state.words||{})[id];
       if(!item)return;
       var line=d.createElement('div');line.className='dict-row';
       var title=d.createElement('p');
       title.textContent=item.fi+' — '+item.ru+
         ' · '+found[id].topic+(found[id].note?' · '+found[id].note:'');
       line.appendChild(title);
       var remove=d.createElement('button');remove.type='button';
       remove.className='tiny-btn';remove.textContent='Убрать из находок';
       remove.addEventListener('click',function(){
         direct('collection_set',id,{list:'finds',added:false,
           topic:found[id].topic,note:found[id].note}).then(function(){
             drawSaved();update();
           },function(e){text('Невозможно убрать: '+e.message,true);});
       });line.appendChild(remove);chosen.appendChild(line);
     });
   }
   if(input)input.addEventListener('input',update);
   drawSaved();update();
 }
 function boot(){
   if(!w.firebase||!w.firebase.auth||!w.firebase.firestore||
     !w.RS_FIREBASE_CONFIG||w.RS_FIREBASE_CONFIG.projectId!==PROD||
     w.location.hostname!=='velardream-ctrl.github.io'){
     text('V3 не активирована: необходима проверенная рабочая среда.',true);return;
   }
   auth=w.firebase.auth();db=w.firebase.firestore();
   auth.onAuthStateChanged(function(user){
     if(!validUser(user)){stop();return;}
     // Google can switch between two VERIFIED accounts without a null
     // state. Always close the previous owner's session first.
     if(uid&&uid!==user.uid)stop();
     if(active()&&user.uid===uid)return;
     if(consent(user.uid))attach(user,false);
     else status();
   });
   w.addEventListener('rs:datachange',capture);
   w.addEventListener('online',function(){if(active())refresh();});
   d.addEventListener('visibilitychange',function(){if(!d.hidden&&active())refresh();});
   status();
 }
 w.RS_V3_RELEASE={begin:begin,refresh:refresh,upload:upload,capture:capture,
   isActive:active,formWord:formWord,renderFinds:renderFinds,status:status,
   getState:function(){return row&&row.state||null;}};
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);else boot();
})(window,document);
