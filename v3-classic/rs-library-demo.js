/* Sanastoyhteiso v3 CLASSIC ONLY — familiar-library view, synthetic sharing.
 * No network or real account. Public demo libraries can be voluntarily linked.
 * File export/import illustrates future exchange; ID lookup needs a distinct
 * future Firebase project and is intentionally NOT claimed to work online.
 * ES5-compatible for older Safari.
 */
(function(root,factory){
 var api=factory(root);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_DEMO_LIBRARIES=api;
})(this,function(root){
 'use strict';
 function escape(v){return String(v===null||v===undefined?'':v)
   .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
   .replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
 var labels={
  ru:{heading:'Библиотека',lead:'Создавай тематические подборки, изучай подключённые слова и проверяй обмен.',
   notice:'Тестовый режим: чужие библиотеки здесь — примеры. Ничего не отправляется другим пользователям. Для обмена между устройствами пока можно передать JSON-файл; подключение по ID заработает после отдельной Firebase.',
   mine:'Мои тестовые библиотеки',source:'Источник слов — только мои учебные слова, добавленные в этой тестовой версии.',
   newTitle:'Название библиотеки',category:'Тема',make:'Создать из моих тестовых слов',
   catalog:'Общедоступные примеры и импортированные библиотеки',
   other:'Подключение добровольное. Можно просмотреть состав, затем добавить библиотеку в карточки.',
   connect:'Подключить',disconnect:'Отключить',export:'Поделиться JSON',words:'слов',
   imported:'Импортировано',sample:'Учебный пример',own:'Моя библиотека',
   import:'Подключить библиотеку из JSON-файла',importNote:'Файл остаётся на устройстве. Формат строго проверяется; результаты автора не импортируются.',
   noMine:'Сначала добавь тестовые слова через раздел «Новое слово».',
   subscriptions:'Подключено библиотек',createDone:'Тестовая библиотека создана',
   importedDone:'Библиотека импортирована',already:'Эта библиотека уже есть',saveDone:'Подписка обновлена',
   error:'Не удалось выполнить действие: ',noPersonal:'Нет тестовых слов для создания библиотеки.',
   id:'ID (для будущего подключения по ссылке)',testTitle:'Название новой тестовой библиотеки',
   testCat:'Тема библиотеки',backup:'Сохранить файл JSON',empty:'Нет собственных библиотек',
   noReal:'Не вводи информацию пациентов или реальные личные данные.',view:'Просмотреть слова'},
  fi:{heading:'Kirjasto',lead:'Luo harjoitussanastoja, yhdistä muiden harjoituskokoelmia ja kokeile jakamista.',
   notice:'Testitila: muiden sanastot ovat esimerkkejä. Mitään ei lähetetä muille käyttäjille. JSON-tiedoston voi siirtää itse, mutta ID:n kautta jakaminen vaatii erillisen Firebase-projektin.',
   mine:'Omat testisanastot',source:'Lähde: vain tässä testiversiossa lisäämäsi omat sanat.',
   newTitle:'Sanaston nimi',category:'Aihe',make:'Luo omista testisanoista',
   catalog:'Julkiset esimerkit ja tuodut sanastot',
   other:'Yhdistä sanasto vain halutessasi. Tarkastele sanoja ennen tilaamista.',
   connect:'Yhdistä',disconnect:'Irrota',export:'Jaa JSON',words:'sanaa',
   imported:'Tuotu',sample:'Harjoitusesimerkki',own:'Oma sanasto',
   import:'Tuo sanasto JSON-tiedostosta',importNote:'Tiedosto pysyy laitteellasi. Vain sanat tuodaan, ei edistymistä.',
   noMine:'Lisää ensin harjoitussanoja kohdassa Uusi sana.',
   subscriptions:'Yhdistettyjä sanastoja',createDone:'Testisanasto luotu',
   importedDone:'Sanasto tuotu',already:'Sanasto on jo olemassa',saveDone:'Tilaus päivitetty',
   error:'Toiminto epäonnistui: ',noPersonal:'Ei testisanoja kokoelmaa varten.',
   id:'ID (tulevaa linkkijakoa varten)',testTitle:'Uuden testisanaston nimi',
   testCat:'Sanaston aihe',backup:'Tallenna JSON-tiedosto',empty:'Ei omia sanastoja',
   noReal:'Älä kirjoita potilaiden henkilötietoja.',view:'Näytä sanat'},
  en:{heading:'Library',lead:'Create topic collections, join shared examples and test library exchange.',
   notice:'Demo mode: other people’s libraries are fictional examples. Nothing is uploaded or sent to others. JSON can be passed manually; real sharing by ID requires a separate Firebase project.',
   mine:'My test libraries',source:'Only personal words added in this independent test site may be included.',
   newTitle:'Library title',category:'Category',make:'Create from my test words',
   catalog:'Public examples and imported libraries',
   other:'Subscriptions are optional. Preview a library before connecting it to cards.',
   connect:'Connect',disconnect:'Disconnect',export:'Share JSON',words:'words',
   imported:'Imported',sample:'Demo example',own:'My library',
   import:'Import a library JSON file',importNote:'The file stays on your device. Only vocabulary is imported, never the author’s results.',
   noMine:'Add test words in the New Word section first.',
   subscriptions:'Connected libraries',createDone:'Test library created',
   importedDone:'Library imported',already:'Library already available',saveDone:'Subscription updated',
   error:'Could not complete action: ',noPersonal:'No test words available.',
   id:'ID (for future link sharing)',testTitle:'New test library title',
   testCat:'Library category',backup:'Save JSON file',empty:'No personal libraries',
   noReal:'Never enter real resident or patient information.',view:'Preview words'}
 };
 function create(opts){
   if(!opts||!opts.model||!opts.document||typeof opts.readOwnWords!=='function')
     throw Error('Missing isolated test library UI dependencies');
   var m=opts.model,doc=opts.document,container=null,lastMessage='';
   function lang(){var l=root.RS_I18N&&root.RS_I18N.getLanguage();
     return l==='fi'||l==='en'?l:'ru';}
   function t(k){return labels[lang()][k]||k;}
   function ownWords(){
     var arr=opts.readOwnWords();
     return Array.isArray(arr)?arr:[];
   }
   function message(s){lastMessage=s;}
   function actions(book,subscriptions){
     var buttons='<div class="btn-row">';
     if(book.source!=='mine'){
       var isOn=subscriptions.indexOf(book.id)>=0;
       buttons+='<button class="btn '+(isOn?'white':'primary')+
         '" type="button" data-demo-library-action="'+(isOn?'unsub':'sub')+
         '" data-library-id="'+escape(book.id)+'">'+escape(t(isOn?'disconnect':'connect'))+'</button>';
     }
     buttons+='<button class="btn white" type="button" data-demo-library-action="export"'+
       ' data-library-id="'+escape(book.id)+'">'+escape(t('export'))+'</button></div>';
     return buttons;
   }
   function one(book,subs){
     var source=t(book.source==='mine'?'own':book.source==='sample'?'sample':'imported');
     var list=book.terms.map(function(word){
       return '<li><b>'+escape(word.fi)+'</b> — '+escape(word.ru)+
         (word.en?' <small>('+escape(word.en)+')</small>':'')+'</li>';
     }).join('');
     return '<div class="panel rs-library-tile"><h3>'+escape(book.title)+'</h3>'+
       '<p class="hint">'+escape(source)+' · '+escape(book.category)+' · '+
       book.terms.length+' '+escape(t('words'))+'</p>'+
       '<details><summary>'+escape(t('view'))+' ('+book.terms.length+')</summary>'+
       '<ul>'+list+'</ul></details>'+
       '<p class="hint">'+escape(t('id'))+': <code>'+escape(book.id)+'</code></p>'+
       actions(book,subs)+'</div>';
   }
   function html(){
     var libs=m.list(),subs=m.subscriptions(),own=libs.filter(function(x){return x.source==='mine';}),
       others=libs.filter(function(x){return x.source!=='mine';});
     return '<div class="banner warning"><b>DEMO / TEST / ТЕСТ</b><p>'+
       escape(t('notice'))+'</p><p>'+escape(t('noReal'))+'</p></div>'+
       '<div class="panel"><h2>'+escape(t('heading'))+'</h2><p>'+
       escape(t('lead'))+'</p><p class="hint">'+escape(t('subscriptions'))+
       ': <b>'+subs.length+'</b></p>'+
       (lastMessage?'<p role="status" class="operation-status">'+escape(lastMessage)+'</p>':'')+
       '</div><div class="panel"><h2>'+escape(t('mine'))+'</h2><p class="hint">'+
       escape(t('source'))+'</p><p class="hint">'+escape(t('noMine'))+
       '</p><form id="rs-library-new-form">'+
       '<div class="form-row"><label class="field"><span>'+escape(t('newTitle'))+'</span>'+
       '<input class="control" name="libTitle" required maxlength="90" placeholder="'+
       escape(t('testTitle'))+'"></label><label class="field"><span>'+escape(t('category'))+
       '</span><input class="control" name="libCat" required maxlength="80" placeholder="'+
       escape(t('testCat'))+'"></label></div>'+
       '<p class="hint">'+escape(t('words'))+': '+ownWords().length+'</p>'+
       '<button class="btn primary" type="submit">'+escape(t('make'))+'</button></form></div>'+
       (own.length?own.map(function(x){return one(x,subs);}).join(''):
        '<p class="hint">'+escape(t('empty'))+'</p>')+
       '<div class="panel"><h2>'+escape(t('catalog'))+'</h2>'+
       '<p>'+escape(t('other'))+'</p></div>'+
       others.map(function(x){return one(x,subs);}).join('')+
       '<div class="panel"><h2>'+escape(t('import'))+'</h2><p class="hint">'+
       escape(t('importNote'))+'</p>'+
       '<label class="field"><span>JSON</span><input id="rs-library-import"'+
       ' type="file" accept=".json,application/json"></label></div>';
   }
   function render(node){container=node;container.innerHTML=html();}
   function refresh(){if(container&&doc.contains(container))render(container);}
   function subscribedTerms(){return m.subscribedTerms();}
   function exportFile(bookId){
     var txt=m.exportJSON(bookId),blob=new root.Blob([txt],{
       type:'application/json;charset=utf-8'}),url=root.URL.createObjectURL(blob),
       a=doc.createElement('a');
     a.href=url;a.download='sanastoyhteiso-demo-library-'+bookId+'.json';
     doc.body.appendChild(a);a.click();doc.body.removeChild(a);
     root.setTimeout(function(){root.URL.revokeObjectURL(url);},3000);
     message(t('backup'));refresh();
   }
   function targetButton(e){
     var b=e.target;
     while(b&&b!==doc){
       if(b.getAttribute&&b.getAttribute('data-demo-library-action'))return b;
       b=b.parentNode;
     }return null;
   }
   doc.addEventListener('click',function(e){
     var b=targetButton(e);if(!b)return;
     var action=b.getAttribute('data-demo-library-action'),id=b.getAttribute('data-library-id');
     try{
       if(action==='sub'||action==='unsub'){
         m.subscribe(id,action==='sub');message(t('saveDone'));refresh();
       }else if(action==='export')exportFile(id);
     }catch(err){message(t('error')+err.message);refresh();}
   });
   doc.addEventListener('submit',function(e){
     if(!e.target||e.target.id!=='rs-library-new-form')return;
     e.preventDefault();
     var form=e.target,words=ownWords();
     try{
       if(!words.length)throw Error(t('noPersonal'));
       m.create(form.elements.namedItem('libTitle').value,
         form.elements.namedItem('libCat').value,words);
       message(t('createDone'));refresh();
     }catch(err){message(t('error')+err.message);refresh();}
   });
   doc.addEventListener('change',function(e){
     if(!e.target||e.target.id!=='rs-library-import')return;
     var file=e.target.files&&e.target.files[0];
     if(!file)return;
     if(file.size>100000){message(t('error')+'File too large');refresh();return;}
     try{
       var reader=new root.FileReader();
       reader.onload=function(){
         try{
           var result=m.importJSON(String(reader.result));
           message(t(result.already?'already':'importedDone'));refresh();
         }catch(err){message(t('error')+err.message);refresh();}
       };
       reader.onerror=function(){message(t('error')+'File read error');refresh();};
       reader.readAsText(file,'UTF-8');
     }catch(err){message(t('error')+err.message);refresh();}
   });
   return {render:render,subscribedTerms:subscribedTerms,model:m};
 }
 return {create:create};
});
