'use strict';
/*
 * RUN-060. Load real ES5 i18n in an isolated Node VM with no browser,
 * Firebase, storage persistence or personal account data.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../v3-unified-preview');
const script=fs.readFileSync(path.join(root,'i18n.js'),'utf8');
const release=fs.readFileSync(path.join(root,'v3-sync-release.js'),'utf8');
function locale(lang){
  const memory={};
  const context={
    navigator:{languages:['en-US'],language:'en-US'},
    document:{
      readyState:'loading',
      addEventListener(){},
      querySelector(){return null;}
    },
    localStorage:{
      getItem(k){return Object.prototype.hasOwnProperty.call(memory,k)?memory[k]:null;},
      setItem(k,v){memory[k]=String(v);},
      removeItem(k){delete memory[k];}
    },
    setTimeout(){return 0}
  };
  context.window=context;
  vm.runInNewContext(script,context,{filename:'i18n.js',timeout:1500});
  context.RS_I18N.setLanguage(lang);
  return context.RS_I18N;
}
test('UI language switching translates V3 My Finds controls in both FI and EN',()=>{
  const fi=locale('fi'),en=locale('en');
  assert.equal(fi.translate('Мои находки · V3'),'Omat löydöt · V3');
  assert.equal(en.translate('Мои находки · V3'),'My finds · V3');
  assert.equal(fi.translate('Убрать из находок'),'Poista omista löydöistä');
  assert.equal(en.translate('Повторить подключение'),'Retry connection');
  assert.equal(fi.translate('Учёба'),'Opiskelu');
  assert.equal(en.translate('Другое'),'Other');
});
test('V3 sync heading trims source-key whitespace but retains visible trailing spacing',()=>{
  assert.equal(locale('fi').translate('Синхронизация между устройствами: '),
    'Synkronointi laitteiden välillä: ');
  assert.equal(locale('en').translate('Синхронизация между устройствами: '),
    'Sync across devices: ');
  assert.equal(locale('ru').translate('Синхронизация между устройствами: '),
    'Синхронизация между устройствами: ');
});
test('dynamic V3 queue count renders in requested UI language',()=>{
  const fi=locale('fi'),en=locale('en'),value='включена · 3 в очереди';
  assert.equal(fi.translate(value),'käytössä · 3 jonossa');
  assert.equal(en.translate(value),'enabled · 3 queued');
  assert.equal(en.translate('включена · 0 в очереди'),'enabled · 0 queued');
});
test('text of a personal vocabulary term is retained while the Add button is translated',()=>{
  const value='oma FI — частное слово RU · В мои находки';
  assert.equal(locale('fi').translate(value),'oma FI — частное слово RU · Lisää omiin löytöihin');
  assert.equal(locale('en').translate(value),'oma FI — частное слово RU · Add to my finds');
});
test('V3 error prefixes translate without discarding technical detail',()=>{
  const fi=locale('fi'),en=locale('en');
  assert.equal(fi.translate('Не удалось сохранить находку: permission-denied'),
    'Löytöä ei voitu tallentaa: permission-denied');
  assert.equal(en.translate('Сверка V3 не выполнена: offline'),
    'V3 reconciliation failed: offline');
  assert.equal(en.translate('Обнаружено несогласованное изменение score:T12345. Запись V3 остановлена.'),
    'Conflicting change score:T12345. V3 writing was stopped.');
});
test('the dangerous initial opt-in confirmation is passed through the locale translator',()=>{
  assert.match(release,/w\.confirm\(ui\(/);
  assert.ok(release.includes('Подключить V3 с новой учебной историей?'));
  assert.match(locale('en').translate(
    'Подключить V3 с новой учебной историей? Прежние локальные результаты будут сохранены отдельно, но в текущей статистике может начаться новый отсчёт. Другие пользователи не затрагиваются.'),
    /Enable V3 with a new learning history\?/);
});
test('My Finds topic UI is separated from user-written notes and vocabulary',()=>{
  assert.ok(release.includes("title.textContent=item.fi+' — '+item.ru+' · ';"));
  assert.ok(release.includes("topicLabel.textContent=topicNames[found[id].topic]||'Другое'"));
  assert.ok(release.includes("d.createTextNode(' · '+found[id].note)"));
});
test('all 256 real UI translation triples remain complete and unique',()=>{
  const ix=script.indexOf('var rows='),end=script.indexOf(';\n',ix);
  assert.ok(ix>=0&&end>ix);
  const rows=JSON.parse(script.slice(ix+'var rows='.length,end));
  assert.ok(rows.length>=256,'V3 UI rows unexpectedly disappeared');
  const keys=new Set();
  for(const [ru,fi,en] of rows){
    assert.ok(!keys.has(ru),'duplicate RU key');
    keys.add(ru);
    assert.ok(ru&&fi&&en,'incomplete UI row');
    assert.doesNotMatch(fi+en,/[А-Яа-яЁё]/);
  }
});
test('TEST HTML and offline service worker cache both reference new localized modules',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  for(const marker of ['i18n.js?v=v3-approved-ui-4',
    'v3-sync-release.js?v=v3-myfinds-i18n-1']){
    assert.ok(html.includes(marker));
    assert.ok(sw.includes(marker));
  }
  assert.match(sw,/sanastoyhteiso-v3-unified-preview-20261105-v11/);
});
