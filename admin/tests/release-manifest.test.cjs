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
