/* Sanastoyhteiso 3.0 CLASSIC — OFFLINE DEMO library model.
 * No network, real users, Firebase, Google Drive, or sharing by online ID.
 * All library changes are isolated to synthetic test namespace.
 * ES5, Safari iOS12 syntax. This is a future library exchange protocol demo.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_LIBRARY_MODEL=api;
})(this,function(){
 'use strict';
 var SCHEMA='sanastoyhteiso-v3-public-library',VERSION=1;
 function isObj(v){return v!==null&&typeof v==='object'&&
   Object.prototype.toString.call(v)==='[object Object]';}
 function own(obj,key){return Object.prototype.hasOwnProperty.call(obj,key);}
 function text(v,max,required){
   if(typeof v!=='string')throw Error('Invalid library field type');
   var s=v.replace(/^\s+|\s+$/g,'');
   if(s.length>max||(required&&(!s||s.length<2))||/[\u0000-\u001f\u007f]/.test(s))
     throw Error('Invalid or too long library text');
   return s;
 }
 function validId(id){return typeof id==='string'&&/^lib_[a-zA-Z0-9_-]{8,60}$/.test(id);}
 function term(v){
   if(!isObj(v))throw Error('Invalid word');
   // Data-only copy; discard internal IDs and unknown fields. Never accept
   // scores, user identifiers, progress or auth data in a public word.
   return {fi:text(v.fi,120,true),ru:text(v.ru,180,true),
     en:text(typeof v.en==='string'?v.en:'',180,false),
     cat:text(typeof v.cat==='string'?v.cat:'Oma sanasto',80,true)};
 }
 function words(items){
   if(!Array.isArray(items)||items.length<1||items.length>100)
     throw Error('Each shared test library needs 1–100 words');
   var seen={};
   return items.map(function(item){
     var v=term(item),key=v.fi.toLocaleLowerCase();
     if(own(seen,key))throw Error('Duplicate Finnish word in a library');
     seen[key]=true;return v;
   });
 }
 function book(v,from){
   if(!isObj(v)||!validId(v.id))throw Error('Invalid library ID');
   return {id:v.id,title:text(v.title,90,true),category:text(v.category||'Oma sanasto',80,true),
     source:from,terms:words(v.terms)};
 }
 // All fictitious demo libraries are built from PUBLIC learning examples, not accounts.
 var examples=[
  {id:'lib_demo_anatomy_2026',title:'Anatomia — harjoituskokoelma',
   category:'Anatomia',source:'sample',terms:[
    {fi:'munuaiskeränen',ru:'почечное тельце',en:'renal corpuscle',cat:'Anatomia'},
    {fi:'virtsanjohdin',ru:'мочеточник',en:'ureter',cat:'Anatomia'},
    {fi:'verenkierto',ru:'кровообращение',en:'circulation',cat:'Anatomia'}]},
  {id:'lib_demo_hoiva_2026',title:'Hoivatyö — esimerkkisanasto',
   category:'Hoitotyö',source:'sample',terms:[
    {fi:'siirtymisen avustaminen',ru:'помощь при перемещении',en:'transfer assistance',cat:'Hoitotyö'},
    {fi:'päivittäinen kirjaaminen',ru:'ежедневное внесение записей',en:'daily documentation',cat:'Hoitotyö'},
    {fi:'apuvälineen käyttö',ru:'использование вспомогательного средства',en:'use of an aid',cat:'Hoitotyö'}]}
 ];
 function clone(o){return JSON.parse(JSON.stringify(o));}
 function cleanState(s){
   if(!isObj(s)||s.version!==VERSION||!Array.isArray(s.books)||
     !Array.isArray(s.subscriptions)||s.books.length>16||s.subscriptions.length>18)
     throw Error('Corrupted test library state — no writes allowed');
   var books=[],ids={};
   examples.forEach(function(x){ids[x.id]=true;});
   s.books.forEach(function(x){
     var b=book(x,x.source==='mine'?'mine':'imported');
     if(own(ids,b.id))throw Error('Duplicate library ID in storage');
     ids[b.id]=true;books.push(b);
   });
   var seen={},subs=[];
   s.subscriptions.forEach(function(id){
     if(!validId(id)||!own(ids,id)||own(seen,id))
       throw Error('Invalid subscription state');
     seen[id]=true;subs.push(id);
   });
   return {version:VERSION,books:books,subscriptions:subs};
 }
 function create(opts){
   if(!opts||!opts.storage||typeof opts.key!=='string'||
      opts.key.indexOf('rs_v3_classic_synthetic_only__')!==0)
     throw Error('Only isolated synthetic storage is allowed');
   var storage=opts.storage,key=opts.key;
   function load(){
     var raw=storage.getItem(key);
     if(raw===null)return {version:VERSION,books:[],subscriptions:[]};
     if(raw.length>160000)throw Error('Test library state is too large');
     var o;try{o=JSON.parse(raw);}catch(e){throw Error('Corrupt library JSON; preserve for recovery');}
     return cleanState(o);
   }
   function save(state){
     var copy=cleanState(state),raw=JSON.stringify(copy);
     if(raw.length>160000)throw Error('Library storage full; no changes saved');
     storage.setItem(key,raw);return copy;
   }
   function list(){
     var s=load();return clone(examples.concat(s.books));
   }
   function get(id){
     return list().filter(function(b){return b.id===id;})[0]||null;
   }
   function idNew(){
     if(typeof opts.newId==='function')return opts.newId();
     var c=opts.crypto;if(!c||typeof c.getRandomValues!=='function')
       throw Error('Secure random library IDs are not available');
     var bytes=new Uint8Array(12),hex='',i;
     c.getRandomValues(bytes);
     for(i=0;i<bytes.length;i++)hex+=('0'+bytes[i].toString(16)).slice(-2);
     return 'lib_'+hex;
   }
   function add(title,category,ownWords){
     var state=load();
     if(state.books.length>=16)throw Error('Test library limit reached');
     var id=idNew();
     if(!validId(id)||get(id))throw Error('Invalid or duplicate new library ID');
     var next=book({id:id,title:title,category:category,
       terms:ownWords},'mine');
     state.books.push(next);save(state);return clone(next);
   }
   function payload(id){
     var b=get(id);
     if(!b)throw Error('Library not found');
     var data={schema:SCHEMA,version:VERSION,id:b.id,title:b.title,
       category:b.category,terms:clone(b.terms)};
     var str=JSON.stringify(data,null,2);
     if(str.length>80000)throw Error('Library export too large');
     return str;
   }
   function receive(input){
     var raw;
     if(typeof input==='string'){
       if(input.length>80000)throw Error('Library import exceeds 80k characters');
       try{raw=JSON.parse(input);}catch(e){throw Error('Invalid shared library JSON');}
     }else raw=input;
     if(!isObj(raw)||raw.schema!==SCHEMA||raw.version!==VERSION||
       !Array.isArray(raw.terms))throw Error('Unknown library format');
     // Fail closed if export contains forbidden private/identity fields.
     var allowed=['schema','version','id','title','category','terms'];
     Object.keys(raw).forEach(function(k){if(allowed.indexOf(k)<0)
       throw Error('Unrecognized library metadata not accepted');});
     raw.terms.forEach(function(t){
       if(!isObj(t))throw Error('Invalid word in sharing file');
       Object.keys(t).forEach(function(k){
         if(['fi','ru','en','cat'].indexOf(k)<0)
           throw Error('Private or unsupported word field rejected');
       });
     });
     var next=book(raw,'imported');
     var existing=get(next.id);
     if(existing){
       if(JSON.stringify({id:existing.id,title:existing.title,category:existing.category,
          terms:existing.terms})===
         JSON.stringify({id:next.id,title:next.title,category:next.category,
          terms:next.terms}))return {already:true,library:existing};
       throw Error('Library ID conflict: existing words are never overwritten');
     }
     var state=load();
     if(state.books.length>=16)throw Error('Test library limit reached');
     state.books.push(next);save(state);
     return {already:false,library:clone(next)};
   }
   function subscribe(id,active){
     var b=get(id),s=load();
     if(!b||b.source==='mine')throw Error('Cannot subscribe to this library');
     var pos=s.subscriptions.indexOf(id);
     if(active&&pos===-1)s.subscriptions.push(id);
     if(!active&&pos!==-1)s.subscriptions.splice(pos,1);
     save(s);
     return s.subscriptions.indexOf(id)!==-1;
   }
   function subscriptions(){return load().subscriptions.slice();}
   function subscribedTerms(){
     var ids=subscriptions(),l=list(),out=[];
     ids.forEach(function(id){
       var b=l.filter(function(x){return x.id===id;})[0];
       if(!b)return;
       b.terms.forEach(function(t,i){
         // Do NOT reuse the author's IDs or base catalog IDs. Independent
         // learning progress is now always tracked per local library+term.
         out.push({id:'shared_'+id+'_'+i,fi:t.fi,ru:t.ru,en:t.en,
           cat:t.cat,catRu:t.cat,example:'',exampleRu:'',level:'B1',priority:1});
       });
     });
     return out;
   }
   return {list:list,get:get,create:add,exportJSON:payload,importJSON:receive,
     subscribe:subscribe,subscriptions:subscriptions,
     subscribedTerms:subscribedTerms,inspect:load};
 }
 return {create:create,format:SCHEMA,version:VERSION};
});
