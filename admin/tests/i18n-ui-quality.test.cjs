'use strict';
/*
 * RUN-058: UI source-localization quality gate. Static only; no Firebase, DOM,
 * network, student data or profile access. The i18n dictionary rows are a
 * single JSON-compatible JS array intentionally used by the ES5 client.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../v3-unified-preview');
const code=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
function dictionary(){
  const marker='var rows=';
  const start=code.indexOf(marker);
  assert.ok(start>=0,'expected source dictionary');
  const end=code.indexOf(';\n',start);
  assert.ok(end>start,'dictionary must be a JSON-compatible array declaration');
  return JSON.parse(code.slice(start+marker.length,end));
}
const rows=dictionary();
function record(ru){return rows.find(r=>r[0]===ru);}
test('FI/RU/EN UI dictionary has stable complete rows',()=>{
  assert.ok(rows.length>=220,'unexpectedly truncated UI dictionary');
  const keys=new Set();
  rows.forEach((r,i)=>{
    assert.ok(Array.isArray(r)&&r.length===3,'bad UI row '+i);
    r.forEach((v,j)=>assert.ok(typeof v==='string'&&v.trim().length>0,
      'blank translation '+i+'/'+j));
    assert.ok(!keys.has(r[0]),'duplicate Russian source key '+i);
    keys.add(r[0]);
  });
});
test('Finnish and English UI labels cannot contain stray Russian placeholders',()=>{
  rows.forEach((r,i)=>[1,2].forEach(j=>{
    assert.doesNotMatch(r[j],/[А-Яа-яЁё]/u,'untranslated FI/EN UI row '+i+'/'+j);
  }));
});
test('Mediatri training lookup examples are usable in each chosen UI language',()=>{
  assert.deepEqual(record('Например: turvotus, подгузник, одежда'),[
    'Например: turvotus, подгузник, одежда',
    'Esim. turvotus, vaippa, vaatteet',
    'E.g. swelling, diaper, clothes'
  ]);
  assert.deepEqual(record('Например: Lääkitys, состояние'),[
    'Например: Lääkitys, состояние',
    'Esim. Lääkitys, vointi',
    'E.g. medication, condition'
  ]);
});
test('illustrative care note is translated without inserting personal data',()=>{
  const r=record('Утром помог одеться, сменил мокрый подгузник. Жилец был спокойным.');
  assert.ok(r);
  assert.match(r[1],/Aamutoimissa/);
  assert.match(r[1],/Asukas oli rauhallinen/);
  assert.match(r[2],/resident was calm/);
  assert.doesNotMatch(r[1]+r[2],/@|https?:\/\//);
});
test('Finnish absorbent underwear is correctly spelled',()=>{
  assert.equal(record('впитывающие трусики')[1],'imukykyiset alushousut');
});
test('localized preview version is synchronized in HTML and offline cache',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(index,/i18n\.js\?v=v3-approved-ui-2/);
  assert.match(sw,/i18n\.js\?v=v3-approved-ui-2/);
  assert.match(sw,/sanastoyhteiso-v3-unified-preview-20261105-v8/);
});
