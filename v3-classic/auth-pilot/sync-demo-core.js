/* Sanastoyhteiso V3 — isolated synthetic sync demo, ES5.
 * NO real study data, no Firebase SDK, no changes to main site storage.
 * Local queue uses a dedicated DEMO namespace, keyed by authenticated UID.
 */
(function(root,factory){
 var api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_V3_SYNC_DEMO_CORE=api;
})(this,function(){
 'use strict';
 var prefix='RS_V3_DEMO_PENDING_';
 var targets={DEMO_CARD_A:1,DEMO_CARD_B:1,DEMO_CARD_C:1};
 function uidOK(s){return typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);}
 function keysOK(o,expected){
   if(!o||typeof o!=='object'||Object.prototype.toString.call(o)!=='[object Object]')return false;
   return Object.keys(o).sort().join('|')===expected.slice().sort().join('|');
 }
 var fields=['v','uid','id','device','kind','target','time','correct','demo'];
 function valid(e,uid){
   return uidOK(uid)&&keysOK(e,fields)&&e.uid===uid&&e.v===1&&
     /^P_[a-f0-9]{32}$/.test(e.id)&&/^D_[a-f0-9]{32}$/.test(e.device)&&
     e.kind==='answer'&&Object.prototype.hasOwnProperty.call(targets,e.target)&&
     typeof e.time==='number'&&isFinite(e.time)&&Math.floor(e.time)===e.time&&e.time>0&&
     typeof e.correct==='boolean'&&e.demo===true;
 }
 function hex(bytes){
   if(!bytes||bytes.length!==16)throw Error('Secure randomness unavailable');
   var out='';
   for(var i=0;i<16;i++){
     if(typeof bytes[i]!=='number'||bytes[i]<0||bytes[i]>255||
        Math.floor(bytes[i])!==bytes[i])throw Error('Invalid randomness');
     var a=bytes[i].toString(16);out+=(a.length===1?'0':'')+a;
   }
   return out;
 }
 function newEvent(uid,device,target,correct,when,randomBytes){
   var e={v:1,uid:uid,id:'P_'+hex(randomBytes),device:device,
     kind:'answer',target:target,time:when,correct:correct,demo:true};
   if(!valid(e,uid))throw Error('Invalid synthetic answer');
   return e;
 }
 function key(uid){if(!uidOK(uid))throw Error('Wrong account');return prefix+uid;}
 function load(storage,uid){
   var raw=storage.getItem(key(uid));if(raw===null)return [];
   var items;
   try{items=JSON.parse(raw);}catch(e){throw Error('Saved DEMO queue damaged; do not overwrite');}
   if(!Array.isArray(items)||items.length>60)throw Error('Invalid saved DEMO queue');
   var ids={};
   items.forEach(function(e){
     if(!valid(e,uid)||ids[e.id])throw Error('Saved DEMO queue contains unsafe entries');
     ids[e.id]=true;
   });
   return items;
 }
 function save(storage,uid,items){
   if(!Array.isArray(items)||items.length>60)throw Error('DEMO queue full');
   var ids={};
   items.forEach(function(e){
     if(!valid(e,uid)||ids[e.id])throw Error('Invalid DEMO queue update');
     ids[e.id]=true;
   });
   storage.setItem(key(uid),JSON.stringify(items));
 }
 function append(storage,uid,e){
   if(!valid(e,uid))throw Error('Wrong account or invalid DEMO event');
   var list=load(storage,uid);
   for(var i=0;i<list.length;i++)if(list[i].id===e.id)
     throw Error('Duplicate DEMO answer id');
   list.push(e);save(storage,uid,list);
   return list;
 }
 function ack(storage,uid,eventId){
   if(typeof eventId!=='string'||!/^P_[a-f0-9]{32}$/.test(eventId))
     throw Error('Invalid acknowledgement');
   var list=load(storage,uid);
   var filtered=list.filter(function(e){return e.id!==eventId;});
   if(filtered.length!==list.length)save(storage,uid,filtered);
   return filtered;
 }
 function clear(storage,uid){save(storage,uid,[]);}
 function signature(e){return JSON.stringify(fields.map(function(k){return e[k];}));}
 function sameEvent(a,b){return signature(a)===signature(b);}
 function fold(uid,cloud,pending){
   if(!uidOK(uid)||!Array.isArray(cloud)||!Array.isArray(pending)||
      cloud.length>100||pending.length>60)throw Error('Invalid DEMO event listing');
   var all={},remote={},stats={},seen=0,correct=0,wrong=0,localOnly=0;
   function add(e,remoteEvent){
     if(!valid(e,uid))throw Error('Unsafe DEMO event from storage or server');
     if(all[e.id]&&signature(all[e.id])!==signature(e))
       throw Error('DEMO event identity collision');
     if(!all[e.id])all[e.id]=e;
     if(remoteEvent)remote[e.id]=true;
   }
   cloud.forEach(function(e){add(e,true);});
   pending.forEach(function(e){add(e,false);});
   Object.keys(all).forEach(function(id){
     var e=all[id];seen++;
     if(e.correct)correct++;else wrong++;
     var s=stats[e.target]||{seen:0,correct:0,wrong:0};
     s.seen++;if(e.correct)s.correct++;else s.wrong++;
     stats[e.target]=s;
     if(!remote[id])localOnly++;
   });
   return {seen:seen,correct:correct,wrong:wrong,byCard:stats,
     pending:localOnly,events:Object.keys(all).map(function(id){return all[id];})};
 }
 return {valid:valid,newEvent:newEvent,load:load,append:append,ack:ack,
   clear:clear,fold:fold,sameEvent:sameEvent,hex:hex,uidOK:uidOK};
});
