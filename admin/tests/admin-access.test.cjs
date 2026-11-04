'use strict';
/* Deterministic, no network/Firebase writes. Run:
 * node --test admin/tests/admin-access.test.cjs
 * @author Илья Дмитриев
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../../v3-unified-preview');
const page=fs.readFileSync(path.join(root,'admin/admin-page.js'),'utf8');
const entry=fs.readFileSync(path.join(root,'admin-entry.js'),'utf8');
function later(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function element(){
  const o={hidden:true,children:[],textContent:'',listeners:{},attrs:{},className:''};
  o.appendChild=function(c){this.children.push(c);return c;};
  o.removeChild=function(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);return c;};
  Object.defineProperty(o,'firstChild',{get(){return this.children[0]||null;}});
  o.setAttribute=function(k,v){this.attrs[k]=v;};
  o.getAttribute=function(k){return this.attrs[k]||null;};
  o.addEventListener=function(k,fn){this.listeners[k]=fn;};
  return o;
}
function user(uid,claim,opts){
  opts=opts||{};const u={uid,emailVerified:opts.verified!==false,isAnonymous:!!opts.anonymous,calls:[],
    getIdTokenResult(force){this.calls.push(force);if(opts.throwToken)throw Error('token');
      return opts.deferred?opts.deferred.promise:Promise.resolve({claims:{admin:claim}});}};
  return u;
}
function harness(script,opts){
  opts=opts||{};
  const elems={};for(const id of ['rs-admin-entry','auth-status','admin-root','admin-tabs','admin-view','page-title','subhead','policy-note'])elems[id]=element();
  const document={readyState:'complete',documentElement:{lang:'ru'},
    getElementById(id){return elems[id]||(elems[id]=element());},
    querySelectorAll(){return [];},createElement(){return element();},addEventListener(){}};
  const cfg={apiKey:'test-key',projectId:'sanastoyhteiso-v3-development',authDomain:'sanastoyhteiso-v3-development.firebaseapp.com'};
  Object.assign(cfg,opts.config||{});
  let onToken=null,onError=null,reads=0,writes=0;
  const pending=[];
  const auth={currentUser:null,onIdTokenChanged(cb,err){onToken=cb;onError=err;}};
  if(opts.missingListener)delete auth.onIdTokenChanged;
  const db={collection(name){assert.equal(name,'admin_metrics');return {doc(id){
    assert.equal(id,'current');return {get(args){assert.equal(args.source,'server');reads++;
      const p=later();pending.push(p);if(opts.throwRead)throw Error('get');return p.promise;},
      set(){writes++;throw Error('write');}};}};}};
  const app={options:{...cfg,...(opts.appOptions||{})}};
  const firebase={apps:opts.noApps?[]:[app],app(){return app;},initializeApp(c){this.apps.push({options:c});return {options:c};},
    auth(){return auth;},firestore(){return db;}};
  const window={firebase,RS_FIREBASE_CONFIG:cfg,navigator:{language:'ru'},addEventListener(){}};
  vm.runInNewContext(script,{window,document,Promise,Date,console}, {timeout:1500});
  return {auth,document,elems,cfg,firebase,emit(u){auth.currentUser=u;if(onToken)onToken(u);},
    error(){if(onError)onError(Error('auth'));},get reads(){return reads;},get writes(){return writes;},pending};
}
async function tick(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
test('admin page starts hidden and listens to token changes',()=>{const h=harness(page);assert.equal(h.elems['admin-root'].hidden,true);h.emit(null);assert.equal(h.elems['admin-root'].hidden,true);});
test('valid verified strict admin claim unlocks only test UI',async()=>{const h=harness(page),u=user('a',true);h.emit(u);await tick();assert.equal(h.elems['admin-root'].hidden,false);assert.equal(h.reads,1);assert.equal(h.writes,0);});
test('ordinary account cannot open admin page',async()=>{const h=harness(page);h.emit(user('a',false));await tick();assert.equal(h.elems['admin-root'].hidden,true);assert.equal(h.reads,0);});
test('truthy nonboolean admin claim is rejected',async()=>{const h=harness(page);h.emit(user('a','true'));await tick();assert.equal(h.elems['admin-root'].hidden,true);});
test('unverified user is denied without claim call',async()=>{const h=harness(page),u=user('a',true,{verified:false});h.emit(u);await tick();assert.equal(u.calls.length,0);assert.equal(h.reads,0);});
test('anonymous user with admin claim is denied',async()=>{const h=harness(page),u=user('a',true,{anonymous:true});h.emit(u);await tick();assert.equal(u.calls.length,0);});
test('wrong project configuration fails closed',()=>{const h=harness(page,{config:{projectId:'prod'}});h.emit(user('a',true));assert.equal(h.reads,0);assert.equal(h.elems['admin-root'].hidden,true);});
test('mismatched initialized app fails closed',()=>{const h=harness(page,{appOptions:{projectId:'unexpected'}});h.emit(user('a',true));assert.equal(h.reads,0);});
test('mismatched api key fails closed',()=>{const h=harness(page,{appOptions:{apiKey:'other'}});h.emit(user('a',true));assert.equal(h.reads,0);});
test('mismatched auth domain fails closed',()=>{const h=harness(page,{appOptions:{authDomain:'another.firebaseapp.com'}});h.emit(user('a',true));assert.equal(h.reads,0);});
test('missing token listener fails closed',()=>{const h=harness(page,{missingListener:true});assert.equal(h.elems['admin-root'].hidden,true);});
test('switch immediately clears rendered dashboard and old report',async()=>{const h=harness(page),a=user('a',true),b=user('b',false);h.emit(a);await tick();h.pending[0].resolve({exists:true,data:()=>({releaseVersion:'test'})});await tick();assert.equal(h.elems['admin-root'].hidden,false);h.emit(b);assert.equal(h.elems['admin-root'].hidden,true);assert.equal(h.elems['admin-view'].children.length,0);await tick();assert.equal(h.reads,1);});
test('late admin claim cannot authorize another session',async()=>{const h=harness(page),d=later(),a=user('a',true,{deferred:d});h.emit(a);h.emit(user('b',false));d.resolve({claims:{admin:true}});await tick();assert.equal(h.elems['admin-root'].hidden,true);assert.equal(h.reads,0);});
test('old Firestore response cannot change next session',async()=>{const h=harness(page);h.emit(user('a',true));await tick();h.emit(user('b',false));h.pending[0].resolve({exists:true,data:()=>({releaseVersion:'stale'})});await tick();assert.equal(h.elems['admin-root'].hidden,true);assert.equal(h.elems['admin-view'].children.length,0);});
test('old Firestore rejection cannot change next session',async()=>{const h=harness(page);h.emit(user('a',true));await tick();h.emit(user('b',false));h.pending[0].reject(Error('old'));await tick();assert.equal(h.elems['admin-root'].hidden,true);});
test('token refresh revocation immediately clears access',async()=>{const h=harness(page),d=later(),u=user('a',true);h.emit(u);await tick();assert.equal(h.reads,1);u.getIdTokenResult=()=>d.promise;h.emit(u);assert.equal(h.elems['admin-root'].hidden,true);d.resolve({claims:{admin:false}});await tick();assert.equal(h.elems['admin-root'].hidden,true);});
test('only first token check per session forces refresh',async()=>{const h=harness(page),u=user('a',false);h.emit(u);await tick();h.emit(u);await tick();assert.deepEqual(u.calls,[true,false]);});
test('token getter synchronous failure denied',()=>{const h=harness(page);h.emit(user('a',true,{throwToken:true}));assert.equal(h.elems['admin-root'].hidden,true);});
test('synchronous Firestore failure does not retain authorized metrics',async()=>{const h=harness(page,{throwRead:true});h.emit(user('a',true));await tick();assert.equal(h.elems['admin-root'].hidden,false);assert.equal(h.elems['auth-status'].textContent,'Сбой подключения агрегатов');});
test('auth error revokes any earlier access',async()=>{const h=harness(page);h.emit(user('a',true));await tick();h.error();assert.equal(h.elems['admin-root'].hidden,true);});
test('entry link hidden for normal user',async()=>{const h=harness(entry);h.emit(user('a',false));await tick();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('entry link visible only for verified admin',async()=>{const h=harness(entry);h.emit(user('a',true));await tick();assert.equal(h.elems['rs-admin-entry'].hidden,false);});
test('entry link hidden for anonymous admin claim',async()=>{const h=harness(entry);h.emit(user('a',true,{anonymous:true}));await tick();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('entry link revokes on token update',async()=>{const h=harness(entry),u=user('a',true);h.emit(u);await tick();assert.equal(h.elems['rs-admin-entry'].hidden,false);u.getIdTokenResult=()=>Promise.resolve({claims:{admin:false}});h.emit(u);assert.equal(h.elems['rs-admin-entry'].hidden,true);await tick();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('entry old claim cannot reveal link for new user',async()=>{const h=harness(entry),d=later();h.emit(user('a',true,{deferred:d}));h.emit(user('b',false));d.resolve({claims:{admin:true}});await tick();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('entry initialized app mismatch always hides link',async()=>{const h=harness(entry,{appOptions:{projectId:'prod'}});h.emit(user('a',true));await tick();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('entry forces refresh once per user',async()=>{const h=harness(entry),u=user('a',false);h.emit(u);await tick();h.emit(u);await tick();assert.deepEqual(u.calls,[true,false]);});
test('entry auth error hides a previously authorized link',async()=>{const h=harness(entry);h.emit(user('a',true));await tick();h.error();assert.equal(h.elems['rs-admin-entry'].hidden,true);});
test('admin scripts stay read-only and service worker scripts match HTML',()=>{
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const a=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
 const i=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(a,/admin-page\.js\?v=admin-auth-2/);
 assert.match(i,/admin-entry\.js\?v=admin-auth-2/);
 assert.match(sw,/admin-page\.js\?v=admin-auth-2/);
 assert.match(sw,/admin-entry\.js\?v=admin-auth-2/);
 assert.doesNotMatch(page,/\.set\(|\.update\(|\.delete\(/);
});
