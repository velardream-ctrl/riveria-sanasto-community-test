/* Production release candidate: pure, ES5 safe conversion of local UI changes
 * to immutable V3 event intents. Does not access Firebase, storage or DOM.
 * Do not infer a person's historical results unless they opted in to V3.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_DIFF=api;
})(this,function(){
 'use strict';
 function count(x){return typeof x==='number'&&isFinite(x)&&x>=0?Math.floor(x):0;}
 function wordId(x){return typeof x==='string'&&/^W_[a-f0-9]{32}$/.test(x);}
 function target(x){return typeof x==='string'&&/^(?:[TMPH][0-9]{5,7}|W_[a-f0-9]{32})$/.test(x);}
 function stamp(x){return x===true;}
 function normalize(x){return String(x||'').replace(/\s+/g,' ').trim().toLowerCase();}
 function project(input){
   var a=input||{},scores={},favorites={},words={};
   Object.keys(a.scores||{}).forEach(function(id){if(target(id)){
     var p=a.scores[id]||{};
     scores[id]={seen:count(p.seen),correct:count(p.correct),wrong:count(p.wrong),
       learned:p.learned===true,last:count(p.last),learnedUpdatedAt:count(p.learnedUpdatedAt)};
   }});
   Object.keys(a.favorites||{}).forEach(function(id){
     if(target(id))favorites[id]=typeof a.favorites[id]==='boolean'?
       a.favorites[id]:a.favorites[id].starred===true;
   });
   var ws=a.words||{};
   if(Array.isArray(ws)){
     ws.forEach(function(w){if(w&&wordId(w.id))words[w.id]=w;});
   }else Object.keys(ws).forEach(function(id){
     var w=ws[id];if(wordId(id)&&w&&w.fi&&w.ru&&!w.deleted)words[id]=w;
   });
   return {scores:scores,favorites:favorites,words:words};
 }
 function changes(previous,current){
   var a=project(previous),b=project(current),out=[],unsafe=[];
   // Missing keys mean incomplete local state, NOT an authorized deletion.
   // Fail closed: preserve the prior snapshot and require explicit recovery.
   // An intentional favorite removal is represented as a retained false key.
   Object.keys(a.scores).sort().forEach(function(id){
     if(!Object.prototype.hasOwnProperty.call(b.scores,id))
       unsafe.push('missing-score:'+id);
   });
   Object.keys(a.favorites).sort().forEach(function(id){
     if(!Object.prototype.hasOwnProperty.call(b.favorites,id))
       unsafe.push('missing-favorite:'+id);
   });
   Object.keys(a.words).sort().forEach(function(id){
     if(!Object.prototype.hasOwnProperty.call(b.words,id))
       unsafe.push('missing-word:'+id);
   });
   Object.keys(b.scores).sort().forEach(function(id){
     var old=a.scores[id]||{seen:0,correct:0,wrong:0,learned:false};
     var now=b.scores[id],ds=now.seen-old.seen,
       dc=now.correct-old.correct,dw=now.wrong-old.wrong;
     if(ds<0||dc<0||dw<0||dc+dw!==ds||ds>30){
       unsafe.push('score:'+id);return;
     }
     for(var i=0;i<dc;i++)out.push({kind:'answer',target:id,
       value:{correct:true,reviewLearned:false}});
     for(var j=0;j<dw;j++)out.push({kind:'answer',target:id,
       value:{correct:false,reviewLearned:!now.learned}});
     var predicted=dc>0?true:dw>0&&!now.learned?false:old.learned;
     if(now.learned!==predicted)out.push({kind:'learned_set',target:id,
       value:now.learned});
   });
   Object.keys(b.favorites).sort().forEach(function(id){
     if(!Object.prototype.hasOwnProperty.call(a.favorites,id)||
       a.favorites[id]!==b.favorites[id])
       out.push({kind:'favorite_set',target:id,value:b.favorites[id]});
   });
   Object.keys(b.words).sort().forEach(function(id){
     var w=b.words[id],old=a.words[id];
     if(!old){
       out.push({kind:'word_upsert',target:id,
         value:{fi:w.fi,ru:w.ru,en:w.en||'',cat:w.cat||'Omat sanat',
           catRu:w.catRu||'Мои слова'}});
     }else if(normalize(w.fi)!==normalize(old.fi)||
       normalize(w.ru)!==normalize(old.ru)||normalize(w.en)!==normalize(old.en))
       unsafe.push('conflicting-word:'+id);
   });
   return {events:out,unsafe:unsafe};
 }
 function recover(cloud,local){
   // Newer cloud counts on another device are NORMAL, not a rollback.
   // Recover ONLY independently proven positive local deltas. Never import
   // historical data automatically when a person first opts in.
   var c=project(cloud),l=project(local),subset={scores:{},words:{},favorites:{}},
     baseline={scores:{},words:{},favorites:{}};
   Object.keys(l.scores).forEach(function(id){
     var a=c.scores[id]||{seen:0,correct:0,wrong:0,learned:false};
     var b=l.scores[id];
     if(b.seen>a.seen&&b.correct>=a.correct&&b.wrong>=a.wrong&&
       b.seen-a.seen===b.correct-a.correct+b.wrong-a.wrong){
       subset.scores[id]=b;baseline.scores[id]=a;
     }
   });
   Object.keys(l.words).forEach(function(id){
     if(!c.words[id])subset.words[id]=l.words[id];
   });
   return changes(baseline,subset);
 }
 return {project:project,changes:changes,recover:recover,target:target,wordId:wordId};
});
