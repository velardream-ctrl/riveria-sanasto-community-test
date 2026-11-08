'use strict';
// EXAM289: offline TEST preview acceptance. Synthetic browser only, no live credentials.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..','v3-unified-preview');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const dataCode=read('data.js'),examCode=read('rs-exam-vocab.js'),appCode=read('app.js');
const original=JSON.parse(dataCode.slice(dataCode.indexOf('{'),dataCode.lastIndexOf('}')+1));
const snap=()=>({JSON:JSON.parse(JSON.stringify(original))});
function ctx(){
 const context={console:{log(){},warn(){},error(){}},window:null};
 context.window=context;
 vm.createContext(context);
 vm.runInContext(dataCode,context,{filename:'data.js',timeout:3000});
 return context;
}
function installed(){
 const w=ctx(),before=JSON.parse(JSON.stringify(w.RS_DATA.terms));
 vm.runInContext(examCode,w,{filename:'rs-exam-vocab.js',timeout:3000});
 return {w,before,after:w.RS_DATA.terms};
}
function syntheticBrowser(){
 const {w}=installed(),writes=[],listeners={},nodes=Object.create(null);
 const node=id=>nodes[id]||(nodes[id]={id,innerHTML:'',textContent:'',className:'',value:''});
 w.document={
   getElementById:node,
   querySelectorAll(){return[];},
   addEventListener(kind,callback){listeners[kind]=callback;},
   body:{appendChild(){},removeChild(){}}
 };
 w.navigator={onLine:true,language:'ru'};
 w.location={protocol:'http:',hostname:'localhost'};
 w.localStorage={getItem(){return null;},setItem(key){writes.push(key);}};
 w.RS_FAMILY={storageKey:k=>'synthetic_'+k,sharedEnabled:()=>true};
 w.scrollTo=function(){};
 w.addEventListener=function(){};
 w.setTimeout=function(){};
 vm.runInContext(appCode,w,{filename:'app.js',timeout:3000});
 const click=(attrs)=>{
   listeners.click({target:{closest(){return{getAttribute(k){return Object.prototype.hasOwnProperty.call(attrs,k)?attrs[k]:null;}};}}});
 };
 const change=(id,value)=>listeners.change({target:{id,value}});
 const input=(id,value)=>listeners.input({target:{id,value}});
 return {w,node,click,change,input,writes};
}
test('289 released annotations are public metadata only; no remote write hooks',()=>{
 assert.ok(examCode.length>50000);
 for(const marker of ['firebase','firestore','googleapis','XMLHttpRequest','localStorage','sessionStorage','fetch(','require(','token','setCustomUserClaims']){
   assert.equal(examCode.includes(marker),false,'adapter contains forbidden '+marker);
 }
 assert.equal(/(?:^|[^a-zA-Z])(let|const)(?:\s+|[({])|=>|\?\.|\?\?/.test(examCode),false,'Safari 12 must parse ES5');
});
test('keeps all 1296 historical identities, words, translations and examples',()=>{
 const {w,before,after}=installed();
 assert.equal(w.RS_EXAM.status,'ready');
 assert.equal(before.length,1296);
 assert.equal(after.length,1339);
 for(let i=0;i<before.length;i++){
  const old=before[i],next=after[i];
  for(const field of ['id','fi','ru','en','example','exampleRu','cat','catRu','priority','level'])
   assert.deepEqual(next[field],old[field],old.id+' '+field);
 }
});
test('246 existing + 43 new, all unique IDs and distinct FI; 270 Latin terms and 10 topics',()=>{
 const {w,after}=installed(),selected=after.filter(x=>x.examTopic);
 assert.equal(selected.length,289);
 assert.equal(selected.filter(x=>Number(x.id.slice(1))<=1296).length,246);
 assert.equal(selected.filter(x=>Number(x.id.slice(1))>1296).length,43);
 assert.equal(selected.filter(x=>x.latin).length,270);
 assert.deepEqual([...new Set(selected.map(x=>x.examTopic))].sort(),['01','02','03','04','05','06','07','08','09','10']);
 assert.equal(new Set(after.map(x=>x.id)).size,1339);
 assert.equal(new Set(after.map(x=>x.fi.toLocaleLowerCase('fi-FI'))).size,1339);
 assert.equal(w.RS_EXAM.topics.length,10);
 for(const x of selected){
  assert.ok(x.explanationFi&&x.explanationRu);
  assert.equal(/<script|<iframe/i.test(x.explanationFi+x.explanationRu),false);
 }
 const old=after.find(x=>x.id==='T00574');
 assert.equal(old.fi,'sydän');assert.equal(old.latin,'cor');
 const novel=after.find(x=>x.fi==='solu');
 assert.ok(novel&&/^T0?1[23]\d\d$/.test(novel.id));assert.equal(novel.latin,'cellula');
});
test('excludes EI themes and unrelated reproductive system; no inherited learner data',()=>{
 const {after}=installed(),picked=after.filter(x=>x.examTopic);
 for(const x of picked){
  assert.equal(/veriryhmä|virtsaamisheijaste|ihon aistinelimet/i.test(x.fi),false);
  assert.equal(x.cat==='Anatomia: Lisääntymiselimistö',false);
  assert.equal(/^Sairaudet:/.test(x.cat),false);
 }
 assert.equal(picked.some(x=>x.fi==='munuaisten toiminnan säätely'),false);
 assert.equal(picked.some(x=>x.fi==='ADH:n vaikutus'),false);
 assert.equal(picked.some(x=>x.fi==='ADH (antidiureettinen hormoni)'&&x.examTopic==='09'),true);
});
test('adapter repeat has no duplicate records; wrong base fails closed without partial changes',()=>{
 const {w}=installed();
 vm.runInContext(examCode,w,{filename:'rs-exam-vocab-again.js',timeout:3000});
 assert.equal(w.RS_EXAM.status,'ready');
 assert.equal(w.RS_DATA.terms.length,1339);
 const alt=ctx();alt.RS_DATA.terms.pop();
 const originalAlt=JSON.stringify(alt.RS_DATA.terms);
 vm.runInContext(examCode,alt,{filename:'rs-exam-vocab-base-mismatch.js',timeout:3000});
 assert.equal(alt.RS_EXAM.status,'blocked');
 assert.equal(JSON.stringify(alt.RS_DATA.terms),originalAlt);
 const changed=ctx();changed.RS_DATA.terms.find(x=>x.id==='T00574').fi='wrong';
 const unchanged=JSON.stringify(changed.RS_DATA.terms);
 vm.runInContext(examCode,changed,{filename:'rs-exam-vocab-wrong-id.js',timeout:3000});
 assert.equal(changed.RS_EXAM.status,'blocked');
 assert.equal(JSON.stringify(changed.RS_DATA.terms),unchanged);
});
test('10 topic selectors in Cards/Quiz/Dictionary, notes on flipped card, no writes on opening',()=>{
 const b=syntheticBrowser(),card=b.node('main-content');
 assert.equal(b.writes.length,0,'opening and rendering cannot write');
 assert.match(card.innerHTML,/id="cards-exam"/);
 assert.match(card.innerHTML,/Экзамен · Koe/);
 assert.match(card.innerHTML,/Ihmiselimistö ja solut/);
 b.change('cards-exam','02');
 assert.match(card.innerHTML,/id="cards-exam"/);
 assert.match(card.innerHTML,/selected/);
 b.click({'data-action':'flip'});
 assert.match(card.innerHTML,/Selitys \(FI\):/);
 assert.match(card.innerHTML,/Объяснение \(RU\):/);
 b.click({'data-view':'practice'});
 assert.match(card.innerHTML,/id="quiz-exam"/);
 b.click({'data-view':'dictionary'});
 assert.match(card.innerHTML,/id="dict-exam"/);
 assert.equal(b.writes.length,0,'navigation and selection must not save scores');
});
test('Latin and explanation search works with exam topic filter without opening user data',()=>{
 const b=syntheticBrowser();b.click({'data-view':'dictionary'});
 b.input('dict-search','cor');
 assert.match(b.node('dict-results').innerHTML,/sydän/);
 b.input('dict-search','arteria coronaria');
 assert.match(b.node('dict-results').innerHTML,/sepelvaltimo/);
 assert.match(b.node('dict-results').innerHTML,/Latin ja selitys/);
 b.change('dict-exam','08');
 b.input('dict-search','urethra');
 assert.match(b.node('dict-results').innerHTML,/virtsaputki/);
 b.input('dict-search','nervus opticus');
 assert.equal(b.node('dict-count').textContent,'(0)');
 b.change('dict-exam','10');
 b.input('dict-search','nervus opticus');
 assert.match(b.node('dict-results').innerHTML,/näköhermo/);
 assert.equal(b.writes.length,0);
});
test('HTML script order and offline cache are version-consistent',()=>{
 const index=read('index.html'),sw=read('sw.js'),css=read('style.css');
 const a=index.indexOf('<script src="data.js?v=2.2.1"></script>');
 const b=index.indexOf('rs-exam-vocab.js?v=exam-289-20261108');
 const c=index.indexOf('app.js?v=exam-289-20261108');
 assert.ok(a>=0&&a<b&&b<c,'load base data then exam adapter then app');
 assert.ok(sw.includes("rs-exam-vocab.js?v=exam-289-20261108"));
 assert.ok(sw.includes('app.js?v=exam-289-20261108'));
 assert.ok(sw.includes('sanastoyhteiso-v3-unified-preview-20261108-exam289-v5'));
 assert.ok(css.includes('.rs-exam-notes')&&css.includes('overflow-wrap:anywhere'));
 assert.equal(index.includes('language="la"'),false);
});
