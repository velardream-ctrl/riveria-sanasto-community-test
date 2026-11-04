/* STAGING only: strict local-only comparison of two personal JSON backups.
 * No network, storage or writes. Only aggregated, anonymized output. ES5.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_MIGRATION_PREFLIGHT=api;
})(this,function(){
 'use strict';
 function plain(x){return x!==null&&typeof x==='object'&&Object.prototype.toString.call(x)==='[object Object]';}
 function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
 function parse(s){try{return typeof s==='string'?JSON.parse(s):s;}catch(e){return null;}}
 function timestamp(s){
   if(typeof s!=='string'||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(s))return null;
   var v=Date.parse(s);return isFinite(v)?v:null;
 }
 function stable(x){
   if(x===null||typeof x!=='object')return JSON.stringify(x);
   if(Object.prototype.toString.call(x)==='[object Array]')
     return '['+x.map(stable).join(',')+']';
   return '{'+Object.keys(x).sort().map(function(k){return JSON.stringify(k)+':'+stable(x[k]);}).join(',')+'}';
 }
 function asMap(words){
   var m=Object.create(null);
   words.forEach(function(w){m[w.id]=w;});
   return m;
 }
 function compare(oldInput,newInput,checker){
   var result={ok:false,readyForMigration:false,errors:[],warnings:[],metrics:null,
     message:'Локальная сверка; перенос и запись в Firestore запрещены'};
   var x=parse(oldInput),y=parse(newInput);
   if(!checker||typeof checker.check!=='function'){
     result.errors.push('Модуль проверки не загружен');return result;
   }
   if(!plain(x)||!plain(y)){
     result.errors.push('Не удаётся прочитать один из JSON-файлов');return result;
   }
   var a=checker.check(x),b=checker.check(y);
   if(!a.ok||!b.ok){
     result.errors.push('Копия не прошла проверку формата или счётчиков');return result;
   }
   var t1=timestamp(x.created),t2=timestamp(y.created);
   if(t1===null||t2===null||t2<=t1){
     result.errors.push('Вторая копия должна иметь более позднюю дату создания');return result;
   }
   ['favoriteMeta','deletedWords'].forEach(function(k){
     if(!plain(x[k])||!plain(y[k]))
       result.errors.push('Отсутствует или повреждена часть копии: '+k);
   });
   if(result.errors.length)return result;
   var oldWords=asMap(x.userWords),newWords=asMap(y.userWords);
   var diff={newScores:0,missingScores:0,missingScoreAnswers:0,
     missingScoreCorrect:0,missingScoreWrong:0,missingLearned:0,
     decreasedCounters:0,
     newWords:0,removedWords:0,changedWords:0,newFavorites:0,
     removedFavorites:0,changedFavoriteMeta:0,
     removedDeletionMarkers:0,newDeletionMarkers:0,
     changedDeletionMarkers:0,changedLearnedFlags:0};
   Object.keys(x.scores).forEach(function(id){
     if(!own(y.scores,id)){
       var missing=x.scores[id];
       diff.missingScores++;
       diff.missingScoreAnswers+=missing.seen;
       diff.missingScoreCorrect+=missing.correct;
       diff.missingScoreWrong+=missing.wrong;
       if(missing.learned===true || (missing.learned!==false && missing.correct>0))
         diff.missingLearned++;
       return;
     }
     var p=x.scores[id],q=y.scores[id];
     if(q.seen<p.seen||q.correct<p.correct||q.wrong<p.wrong)diff.decreasedCounters++;
     if(typeof p.learned==='boolean'&&p.learned!==q.learned)diff.changedLearnedFlags++;
   });
   Object.keys(y.scores).forEach(function(id){if(!own(x.scores,id))diff.newScores++;});
   Object.keys(oldWords).forEach(function(id){
     if(!own(newWords,id))diff.removedWords++;
     else if(stable(oldWords[id])!==stable(newWords[id]))diff.changedWords++;
   });
   Object.keys(newWords).forEach(function(id){if(!own(oldWords,id))diff.newWords++;});
   Object.keys(x.favorites).forEach(function(id){
     if(x.favorites[id]===true&&y.favorites[id]!==true)diff.removedFavorites++;
   });
   Object.keys(y.favorites).forEach(function(id){
     if(y.favorites[id]===true&&x.favorites[id]!==true)diff.newFavorites++;
   });
   Object.keys(x.favoriteMeta).forEach(function(id){
     if(!own(y.favoriteMeta,id)||stable(x.favoriteMeta[id])!==stable(y.favoriteMeta[id]))
       diff.changedFavoriteMeta++;
   });
   Object.keys(x.deletedWords).forEach(function(id){
     if(!own(y.deletedWords,id))diff.removedDeletionMarkers++;
     else if(stable(x.deletedWords[id])!==stable(y.deletedWords[id]))diff.changedDeletionMarkers++;
   });
   Object.keys(y.deletedWords).forEach(function(id){
     if(!own(x.deletedWords,id))diff.newDeletionMarkers++;
   });
   if(diff.missingScores)result.errors.push('Записи результатов из старой копии отсутствуют; проверь Google Drive перед переносом');
   if(diff.decreasedCounters)result.errors.push('Снизились счётчики отдельных терминов');
   if(diff.removedWords)result.errors.push('Отсутствуют личные слова: нужна проверка удаления');
   if(diff.removedDeletionMarkers)result.errors.push('Есть риск восстановить удалённые слова');
   if(b.metrics.seen<a.metrics.seen||b.metrics.correct<a.metrics.correct||
      b.metrics.wrong<a.metrics.wrong)result.errors.push('Уменьшились общие счётчики');
   if(diff.changedWords)result.warnings.push('Изменены личные слова; нужны актуальные редакции');
   if(diff.removedFavorites||diff.newFavorites||diff.changedFavoriteMeta)
     result.warnings.push('Изменилось избранное или его метаданные');
   if(diff.newDeletionMarkers||diff.changedDeletionMarkers)
     result.warnings.push('Изменились отметки удаления слов');
   if(diff.changedLearnedFlags)result.warnings.push('Изменились флаги выученного');
   if(a.warnings.length||b.warnings.length)result.warnings.push('Дополнительные предупреждения о флагах выученного');
   function metric(v){return {scoredTerms:v.scoredTerms,seen:v.seen,correct:v.correct,
     wrong:v.wrong,userWords:v.userWords,favoriteTerms:v.favoriteTerms,
     deletedWordIds:v.deletedWordIds};}
   result.metrics={older:metric(a.metrics),newer:metric(b.metrics),differences:diff};
   result.ok=result.errors.length===0;
   return result;
 }
 return{compare:compare};
});
