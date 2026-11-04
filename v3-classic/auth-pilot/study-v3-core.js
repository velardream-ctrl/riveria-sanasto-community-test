/* STAGING ONLY — not loaded by the live site.
 * Pure ES5 data helpers: unique answer events, deduplication, migration baselines,
 * bounded queues, and read-only restoration previews.
 * No network requests, Firebase SDK, tokens, or user data exported by this file.
 */
(function(root,factory){
  var api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.RS_SYNC_CORE=api;
})(this,function(){
  'use strict';
  var allowed={answer:1,learned_set:1,favorite_set:1,word_upsert:1,word_delete:1,collection_set:1};
  function copy(x){return JSON.parse(JSON.stringify(x===undefined?null:x));}
  function nonnegative(x){return Math.max(0,Math.floor(Number(x)||0));}
  function safeId(s){return typeof s==='string' && s.length>0 && s.length<=180 &&
    s!=='__proto__'&&s!=='prototype'&&s!=='constructor'&&
    !/[\x00-\x1f\x7f\/#?]/.test(s);}
  function valid(e){
    if(!e||!safeId(e.id)||!safeId(e.target)||!safeId(e.device)||
       !allowed[e.kind]||!isFinite(Number(e.time))||typeof e.data!=='object'||!e.data)return false;
    if(e.kind==='answer' && typeof e.data.correct!=='boolean')return false;
    if(e.kind==='learned_set' && typeof e.data.learned!=='boolean')return false;
    if(e.kind==='favorite_set' && typeof e.data.starred!=='boolean')return false;
    if(e.kind==='word_upsert' && (!e.data.fi||!e.data.ru||
       (e.data.id!==undefined&&e.data.id!==e.target)))return false;
    if(e.kind==='word_delete'&&e.data.deleted!==true)return false;
    if(e.kind==='collection_set'&&(
       e.data.list!=='finds'||typeof e.data.added!=='boolean'||
       ['practice','study','other'].indexOf(e.data.topic)<0||
       typeof e.data.note!=='string'||e.data.note.length>350||
       !/^(T[0-9]{5,7}|W_[a-f0-9]{32})$/.test(e.target)))
      return false;
    return true;
  }
  function event(id,device,kind,target,data,time){
    var out={id:String(id),device:String(device),kind:String(kind),target:String(target),data:copy(data),time:Number(time)};
    if(!valid(out))throw Error('Invalid progress event');
    return out;
  }
  function legacyBaseline(scores,words,favorites){
    var out={scores:{},words:{},favorites:{}},id,v;
    scores=scores||{};words=words||[];favorites=favorites||{};
    Object.keys(scores).forEach(function(k){
      var a=scores[k]||{};
      out.scores[k]={correct:nonnegative(a.correct),wrong:nonnegative(a.wrong),
        seen:nonnegative(a.seen),last:nonnegative(a.last),
        learned:typeof a.learned==='boolean'?a.learned:nonnegative(a.correct)>0,
        learnedUpdatedAt:nonnegative(a.learnedUpdatedAt)};
    });
    words.forEach(function(w){if(w&&safeId(w.id)&&w.fi&&w.ru)out.words[w.id]=copy(w);});
    Object.keys(favorites).forEach(function(k){if(safeId(k))out.favorites[k]=!!favorites[k];});
    return out;
  }
  function fold(baseline,events){
    var state=copy(baseline||legacyBaseline()),seen={},applied=0,dupes=0,invalid=0;
    state.scores=state.scores||{};state.words=state.words||{};state.favorites=state.favorites||{};state.finds=state.finds||{};
    var sorted=(events||[]).slice().sort(function(a,b){return Number(a.time)-Number(b.time)||String(a.id).localeCompare(String(b.id));});
    sorted.forEach(function(e){
      if(!valid(e)){invalid++;return;}
      if(seen[e.id]){dupes++;return;}
      seen[e.id]=true;applied++;
      var id=e.target,a=e.data,sc;
      if(e.kind==='answer'){
        sc=state.scores[id]||{correct:0,wrong:0,seen:0,last:0,learned:false,learnedUpdatedAt:0};
        sc.seen=nonnegative(sc.seen)+1;
        if(a.correct){
          sc.correct=nonnegative(sc.correct)+1;sc.learned=true;sc.learnedUpdatedAt=e.time;
        }else{
          sc.wrong=nonnegative(sc.wrong)+1;
          if(a.reviewLearned===true){sc.learned=false;sc.learnedUpdatedAt=e.time;}
        }
        sc.last=Math.max(nonnegative(sc.last),e.time);state.scores[id]=sc;
      }else if(e.kind==='learned_set'){
        sc=state.scores[id]||{correct:0,wrong:0,seen:0,last:0,learned:false,learnedUpdatedAt:0};
        sc.learned=a.learned;sc.learnedUpdatedAt=e.time;state.scores[id]=sc;
      }else if(e.kind==='favorite_set')state.favorites[id]=a.starred;
      else if(e.kind==='collection_set'){
        // Keep a tombstone rather than removing this key so an incomplete
        // server history can never silently erase a saved personal selection.
        state.finds[id]={added:a.added,topic:a.topic,note:a.note,updatedAt:e.time};
      }
      else if(e.kind==='word_upsert'){
        var w=copy(a);w.id=id;
        // Same deterministic personal word ID on two devices: identical text
        // is idempotent. Conflicting translations require an explicit review;
        // NEVER silently apply a last-writer-wins edit.
        var previous=state.words[id];
        if(previous){
          if(String(previous.fi||'').replace(/\s+/g,' ').trim().toLowerCase()!==String(w.fi||'').replace(/\s+/g,' ').trim().toLowerCase()||String(previous.ru||'').replace(/\s+/g,' ').trim().toLowerCase()!==String(w.ru||'').replace(/\s+/g,' ').trim().toLowerCase()||
             String(previous.en||'').replace(/\s+/g,' ').trim().toLowerCase()!==String(w.en||'').replace(/\s+/g,' ').trim().toLowerCase())
            throw Error('Conflicting definitions for one personal word ID');
        }else state.words[id]=w;
      }
      else if(e.kind==='word_delete')delete state.words[id];
    });
    return {state:state,applied:applied,duplicates:dupes,invalid:invalid};
  }
  function nextQueue(queue,acknowledged){
    var ack={},out=[];
    (acknowledged||[]).forEach(function(k){ack[String(k)]=1;});
    (queue||[]).forEach(function(e){if(!ack[String(e.id)])out.push(e);});
    return out;
  }
  function mergeQueues(a,b){
    var seen={},out=[];
    (a||[]).concat(b||[]).forEach(function(e){if(valid(e)&&!seen[e.id]){seen[e.id]=1;out.push(e);}});
    return out;
  }
  function restorePreview(existing,backup,expectedUid){
    if(!backup || backup.schemaVersion!==1 || !backup.uid || backup.uid!==expectedUid ||
       !backup.snapshot || !backup.snapshot.scores || !backup.snapshot.words || !backup.snapshot.favorites)
       return {ok:false,reason:'Invalid schema, UID, or incomplete backup'};
    var counts={currentTerms:Object.keys((existing||{}).scores||{}).length,
      backupTerms:Object.keys(backup.snapshot.scores).length,
      currentWords:Object.keys((existing||{}).words||{}).length,
      backupWords:Object.keys(backup.snapshot.words).length};
    return {ok:true,dryRun:true,counts:counts,snapshotId:backup.snapshotId||null,
      newerThanLocal:Number(backup.createdAt||0)>Number((existing||{}).updatedAt||0)};
  }
  function snapshotManifest(uid,snapshotId,createdAt,base,events){
    if(!safeId(uid)||!safeId(snapshotId))throw Error('Invalid snapshot identity');
    return {schemaVersion:1,uid:uid,snapshotId:snapshotId,createdAt:createdAt,
      termCount:Object.keys((base||{}).scores||{}).length,
      wordCount:Object.keys((base||{}).words||{}).length,
      eventCount:(events||[]).length,complete:false,restoreTested:false};
  }
  return {event:event,valid:valid,legacyBaseline:legacyBaseline,fold:fold,
    nextQueue:nextQueue,mergeQueues:mergeQueues,restorePreview:restorePreview,
    snapshotManifest:snapshotManifest};
});
