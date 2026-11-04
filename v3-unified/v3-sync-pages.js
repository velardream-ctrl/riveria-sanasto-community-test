/* STAGING ONLY: bounded and complete server-ordered Firestore history pagination.
 * No personal data storage or network implementation. ES5 / Safari iOS12.
 * fetchPage(cursor, limit) -> {items:[{id,...}], cursor:opaqueLastDocument}
 * The final page must contain < pageSize items. An exact multiple requires
 * one extra empty fetch; otherwise a silently truncated history could erase
 * previously learned terms when reconstructed.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_STUDY_PAGES=api;
})(this,function(){
 'use strict';
 function create(opts){
   if(!opts||typeof opts.fetchPage!=='function'||typeof opts.active!=='function')
     throw Error('Study history page fetcher missing');
   var PAGE=opts.pageSize||100,MAX=opts.maxEvents||10000;
   if(PAGE!==100||MAX!==10000)
     throw Error('Only tested bounds 100/10000 permitted in staging');
   function list(){
     var cursor=null,all=[],ids={},pageNumber=0;
     function step(){
       if(!opts.active())return Promise.reject(Error('Study account changed during paginated read'));
       if(all.length>=MAX)return Promise.reject(Error('Study cloud history above safe cap'));
       pageNumber++;
       if(pageNumber>MAX/PAGE+1)return Promise.reject(Error('Unbounded history page iteration'));
       return Promise.resolve().then(function(){
         return opts.fetchPage(cursor,PAGE);
       }).then(function(result){
         if(!opts.active())throw Error('Study account changed during paginated read');
         if(!result||!Array.isArray(result.items)||result.items.length>PAGE)
           throw Error('Malformed or oversized study history page');
         if(result.items.length&&!result.cursor)
           throw Error('Missing page cursor; refuse incomplete history');
         if(result.items.length===PAGE&&cursor!==null&&result.cursor===cursor)
           throw Error('Non-advancing cloud history cursor');
         result.items.forEach(function(item){
           if(!item||typeof item.id!=='string'||!/^E_[a-f0-9]{32}$/.test(item.id)||
             ids[item.id])throw Error('Duplicate or invalid study event across pages');
           ids[item.id]=true;all.push(item);
         });
         if(all.length>=MAX)throw Error('Study cloud history above safe cap');
         if(result.items.length===PAGE){
           if(cursor!==null&&result.cursor===cursor)
             throw Error('Non-advancing cloud history cursor');
           cursor=result.cursor;
           return step();
         }
         return all;
       });
     }
     return step();
   }
   return {list:list};
 }
 return {create:create};
});
