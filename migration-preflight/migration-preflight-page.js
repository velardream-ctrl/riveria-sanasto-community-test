/* ES5 on-device JSON FileReader controller. No network, storage or private output. */
(function(w,d){
 'use strict';
 function el(id){return d.getElementById(id);}
 function text(id,s){el(id).textContent=s;}
 function add(p,s){var li=d.createElement('li');li.textContent=s;p.appendChild(li);}
 function read(f){
   return new Promise(function(resolve,reject){
     if(!f||f.size>20*1024*1024){reject(Error('file'));return;}
     var r=new FileReader();
     r.onload=function(){resolve(r.result);};
     r.onerror=function(){reject(Error('file'));};
     r.readAsText(f,'UTF-8');
   });
 }
 function render(r){
   var m=el('metrics'),issues=el('issues');m.textContent='';issues.textContent='';
   if(r.metrics){
     var x=r.metrics;
     var labels={seen:'Ответов всего',correct:'Правильных',wrong:'Неправильных',
       scoredTerms:'Терминов с ответами',userWords:'Личных слов',
       favoriteTerms:'Избранных',deletedWordIds:'Отметок удаления'};
     Object.keys(labels).forEach(function(k){
       add(m,labels[k]+': '+x.older[k]+' → '+x.newer[k]);
     });
     var labels2={newScores:'Новых результатов',missingScores:'Пропавших результатов',
       decreasedCounters:'Сниженных счётчиков',newWords:'Новых личных слов',
       removedWords:'Отсутствующих личных слов',changedWords:'Изменённых слов',
       newFavorites:'Добавлений в избранное',removedFavorites:'Убрано из избранного',
       changedFavoriteMeta:'Изменений метаданных избранного',
       removedDeletionMarkers:'Исчезнувших отметок удаления',
       newDeletionMarkers:'Новых отметок удаления',
       changedDeletionMarkers:'Изменённых отметок удаления',
       changedLearnedFlags:'Изменённых флагов выученного'};
     Object.keys(labels2).forEach(function(k){
       if(x.differences[k])add(m,labels2[k]+': '+x.differences[k]);
     });
   }
   (r.errors||[]).forEach(function(s){add(issues,'Ошибка: '+s);});
   (r.warnings||[]).forEach(function(s){add(issues,'Внимание: '+s);});
   if(!r.errors.length&&!r.warnings.length)add(issues,'Структурных расхождений не обнаружено.');
   text('status',r.ok?'Структура проверена. Перенос пока НЕ разрешён.':
     'Сверка не пройдена. Перенос запрещён.');
   el('status').className=r.ok?'ok':'error';
 }
 function run(){
   var a=el('older').files&&el('older').files[0],
       b=el('newer').files&&el('newer').files[0];
   if(!a||!b){text('status','Выбери два JSON-файла.');return;}
   el('run').disabled=true;text('status','Проверка на этом устройстве…');
   Promise.all([read(a),read(b)]).then(function(v){
     if(!w.RS_MIGRATION_PREFLIGHT||!w.RS_PERSONAL_BACKUP_AUDIT)
       throw Error('Missing local audit modules');
     render(w.RS_MIGRATION_PREFLIGHT.compare(v[0],v[1],w.RS_PERSONAL_BACKUP_AUDIT));
   },function(){text('status','Не удалось прочитать файлы. Они никуда не отправлялись.');
     el('status').className='error';}).then(function(){el('run').disabled=false;},function(){
       text('status','Проверка не завершена. Файлы не передавались.');
       el('status').className='error';el('run').disabled=false;
     });
 }
 function init(){el('run').addEventListener('click',run);}
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(window,document);
