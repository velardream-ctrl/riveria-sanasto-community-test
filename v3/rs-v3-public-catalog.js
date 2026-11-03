/* Sanastoyhteisö 3.0 STAGING — read-only public FI/RU/EN catalog adapter.
 * Only the published community data.js snapshot may be passed. Never reads
 * accounts, Google Drive, Firebase, localStorage or user-specific scores.
 * ES5 syntax. This adapter does not replace or mutate the source dictionary.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_PUBLIC_CATALOG=api;
})(this,function(){
 'use strict';
 function validText(x){return typeof x==='string'&&x.replace(/^\s+|\s+$/g,'').length>0;}
 function create(data){
   if(!data||!validText(data.version)||!Array.isArray(data.terms)||
      !Array.isArray(data.phrases)||!Array.isArray(data.mediatri)||
      !Array.isArray(data.keyterms)||!Array.isArray(data.scenarios)||
      !Array.isArray(data.headings)||data.terms.length<1296||
      data.phrases.length<84||data.mediatri.length<183||
      data.scenarios.length<40||data.headings.length<21)
     throw Error('Published trilingual catalog is unavailable or incomplete');
   var sections=['terms','phrases','mediatri','keyterms','scenarios','headings'];
   var termIds={},seenFi={},i;
   sections.forEach(function(name){
     var ids={};
     data[name].forEach(function(item){
       if(!item||typeof item.id!=='string'||!validText(item.id)||
          Object.prototype.hasOwnProperty.call(ids,item.id))
         throw Error('Invalid or duplicate '+name+' ID');
       ids[item.id]=true;
       if(name!=='scenarios'&&(!validText(item.fi)||!validText(item.ru)))
         throw Error('Missing FI/RU text in '+name);
       if(name==='scenarios'&&(!validText(item.task)||!validText(item.answer)))
         throw Error('Missing scenario content');
     });
   });
   data.terms.forEach(function(t){
     if(!/^T[0-9]{5,}$/.test(t.id)||!validText(t.en))
       throw Error('Invalid three-language vocabulary term');
     var key=t.fi.toLocaleLowerCase();
     if(seenFi[key])throw Error('Duplicate Finnish vocabulary term');
     seenFi[key]=true;termIds[t.id]=true;
   });
   function copy(obj){return JSON.parse(JSON.stringify(obj));}
   function list(which){return copy(data[which]);}
   function find(id){
     var x;
     for(i=0;i<data.terms.length;i++){
       x=data.terms[i];if(x.id===id)return copy(x);
     }
     return null;
   }
   function search(text,limit){
     var q=String(text||'').toLocaleLowerCase().replace(/^\s+|\s+$/g,'');
     var max=(typeof limit==='number'&&limit>=1&&limit<=100)?Math.floor(limit):60;
     var out=[],count=0;
     data.terms.forEach(function(t){
       if(q&&[t.fi,t.ru,t.en].join(' ').toLocaleLowerCase().indexOf(q)<0)return;
       count++;
       if(out.length<max)out.push(copy(t));
     });
     return {items:out,count:count,truncated:count>out.length};
   }
   return {version:data.version,date:data.date||'',count:data.terms.length,
     terms:function(){return list('terms');},phrases:function(){return list('phrases');},
     mediatri:function(){return list('mediatri');},keyterms:function(){return list('keyterms');},
     scenarios:function(){return list('scenarios');},
     headings:function(){return list('headings');},find:find,search:search};
 }
 return {create:create};
});
