'use strict';
var assert=require('assert');
var checker=require('../rs-release-manifest.js');
var base='1'.repeat(40),hash='a'.repeat(64);
function manifest(){return {schemaVersion:1,packageId:'release-2026-11-04-a',target:checker.target,baseCommit:base,releaseType:'application',files:[{path:'app.js',sha256:hash,bytes:100}],description:'Test release'};}
function fail(change,msg){var m=manifest();change(m);assert.strictEqual(checker.validate(m,base).valid,false,msg);}
assert.strictEqual(checker.validate(manifest(),base).valid,true);
assert.strictEqual(checker.validate(manifest(),base).readyToPublish,false);
fail(function(m){m.target='evil/repo';},'wrong target');
fail(function(m){m.files[0].path='../config.js';},'path traversal');
fail(function(m){m.files[0].path='config.js';},'no config overwrite');
fail(function(m){m.files[0].path='firebase.rules';},'no rules overwrite');
fail(function(m){m.files.push(m.files[0]);},'duplicate entry');
fail(function(m){m.files[0].sha256='fake';},'fake digest');
fail(function(m){m.files[0].bytes=0;},'empty file');
fail(function(m){m.files[0].bytes=2000000;},'oversized file');
fail(function(m){m.releaseType='catalog';},'catalog cannot change code');
fail(function(m){m.files[0].admin=true;},'extra field rejected');
fail(function(m){m.baseCommit='3'.repeat(40);},'base ref mismatch');
fail(function(m){m.files[0].path='app.js\\evil';},'windows path');
console.log('PASS: release manifest rejects unsafe or inconsistent updates; publishing remains disabled.');


/* RUN-056 trusted HEAD and byte-safety fail-closed tests.
 * All synthetic only. No ZIP parsing, GitHub writes, network or publishing.
 */
assert.strictEqual(checker.validate(manifest()).valid,false,
  'RUN-056 trusted HEAD is mandatory even when baseCommit looks correct');
assert.strictEqual(checker.validate(manifest(),null).valid,false,
  'RUN-056 null expected HEAD must be rejected');
assert.strictEqual(checker.validate(manifest(),'').valid,false,
  'RUN-056 empty expected HEAD must be rejected');
assert.strictEqual(checker.validate(manifest(),'not-a-sha').valid,false,
  'RUN-056 non-SHA expected HEAD must be rejected');
assert.strictEqual(checker.validate(manifest(),{}).valid,false,
  'RUN-056 non-string expected HEAD must be rejected');
fail(function(m){m.files[0].bytes=NaN;},'RUN-056 NaN must be rejected');
fail(function(m){m.files[0].bytes=Infinity;},'RUN-056 Infinity must be rejected');
fail(function(m){m.files[0].bytes=1.5;},'RUN-056 fractional sizes must be rejected');
fail(function(m){m.files[0].bytes=-10;},'RUN-056 negative sizes must be rejected');
fail(function(m){m.files[0].bytes=null;},'RUN-056 null bytes must be rejected');
fail(function(m){m.files[0].bytes='100';},'RUN-056 string byte counts must be rejected');
fail(function(m){m.files[0].bytes={valueOf:function(){return 100;}};},
  'RUN-056 coercible object byte count must be rejected');
var valid=checker.validate(manifest(),base);
assert.strictEqual(valid.valid,true,'valid pinned manifest remains accepted for review');
assert.strictEqual(valid.readyToPublish,false,'no client validation may enable publishing');
assert.strictEqual(valid.needsBackendValidation,true,'trusted ZIP verification still required');
console.log('PASS RUN-056: manifest requires trusted current HEAD, strict byte sizes, never publishes.');
