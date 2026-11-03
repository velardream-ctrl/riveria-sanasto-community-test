/* SANASTOYHTEISO 3.0 CLASSIC STAGING ONLY — Mediatri learning guide.
 * Based on user-provided real Mediatri heading-group photographs.
 * Educational ONLY: never clinical records, no patient data, no network.
 * Existing app styling, other Mediatri tabs, data.js remain unchanged.
 * ES5-compatible. Classification is editorial and must be verified with unit policy.
 */
(function(root,factory){
 var api=factory(root);
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.RS_MED_GUIDE=api;
})(this,function(root){
 'use strict';
 var data=root.RS_DATA||{mediatri:[]};
 var shift='morning',heading='Vointi',search='',phraseSearch='',openGroup='';
 function lang(){return root.RS_I18N?root.RS_I18N.getLanguage():'ru';}
 function t(ru,fi,en){return lang()==='fi'?fi:lang()==='en'?en:ru;}
 function safe(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
   .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
 // Names copied from the photographed heading groups. Rare measurements are
 // reference-only: no invented clinical interpretations or values.
 var core=[
 ['Hoito','Уход','Care','Выполненные действия, гигиена, помощь, результат ухода','Toteutuneet hoitotoimet, hygienia ja avustaminen','Care delivered, hygiene, assistance'],
 ['Vointi','Самочувствие','Condition','Общее самочувствие, бодрость, настроение, заметные изменения','Yleisvointi, vireys, mieliala ja voinnin muutokset','General wellbeing, alertness, mood'],
 ['Fyys.toim.kyky','Физическая функциональность','Physical function','Ходьба, вставание, передвижение, использование роллатора или трости','Liikkuminen, siirtyminen ja apuvälineiden käyttö','Mobility, transfers, walking aids'],
 ['Psyyk.toim.kyky','Психическое состояние','Psychological function','Настроение, тревожность, эмоциональные реакции','Mieliala, psyykkinen vointi ja tunteisiin liittyvät havainnot','Mood, psychological wellbeing'],
 ['Sos.toim.kyky','Социальная активность','Social function','Общение, участие, контакты с другими','Vuorovaikutus, osallistuminen ja ihmissuhteet','Communication and participation'],
 ['Kognit.toim.kyky','Когнитивные функции','Cognitive function','Память, ориентировка, понимание инструкций','Muisti, orientaatio ja ohjeiden ymmärtäminen','Memory, orientation, understanding'],
 ['Turvallisuus','Безопасность','Safety','Падение, риск падения, применённые меры безопасности','Kaatumisriski, turvallisuushavainnot ja toimenpiteet','Falls risk and safety measures'],
 ['Ravitsemus','Питание','Nutrition','Сколько ел и пил, помощь с приёмом пищи','Syöminen, juominen ja ruokailuapu','Food, fluid intake and assistance'],
 ['Erittäminen','Выделения','Elimination','Мочеиспускание, стул, туалет, средства при недержании','Virtsaaminen, ulostaminen, WC-käynnit ja inkontinenssisuojat','Urination, bowel function, toileting'],
 ['Uni ja lepo','Сон и отдых','Sleep and rest','Сон, пробуждения, отдых в течение дня','Nukkuminen, herääminen ja lepo','Sleep, waking and rest'],
 ['Kudoseheys','Состояние кожи','Skin integrity','Покраснения, повреждения, кожа и раны','Ihon kunto, haavat ja muutokset','Skin condition and wounds'],
 ['Lääkitys','Лекарства','Medication','Только фактически выполненные и разрешённые лекарственные действия','Vain toteutuneet ja luvalliset lääkehoidon toimet','Only authorized medication activities'],
 ['Yöhoito','Ночной уход','Night care','Помощь и наблюдение ночью','Yöllinen avustaminen ja seuranta','Night-time care and monitoring'],
 ['Ulkoilu','Прогулки','Outdoor activity','Прогулки и помощь на улице','Ulkoilu ja siinä avustaminen','Outdoor activity and assistance'],
 ['Viriketoiminta','Занятия','Activities','Участие в занятиях и досуге','Viriketoimintaan osallistuminen','Recreational activities'],
 ['Ohjaus','Консультирование','Guidance','Инструкции и обучение жильца, оказанная помощь в понимании','Asiakkaan ohjaus ja neuvonta','Instructions and guidance'],
 ['Hoidon arviointi','Оценка ухода','Care evaluation','Наблюдаемый результат ухода и необходимость продолжения наблюдения','Hoidon vaikutus ja jatkoseuranta','Observed result and follow-up'],
 ['Verenpaine','Давление','Blood pressure','Измерение давления и его значение, если измерялось','Verenpaineen mittaus ja mitattu arvo','Measured blood pressure'],
 ['Pulssi','Пульс','Pulse','Измерение пульса, если проводилось','Pulssin mittaus ja mitattu arvo','Measured pulse']
 ];
 var secondary=[
 'Painikehälytys','Ongelma','Annettu lääke','Laboratorio','Lab.tulokset','Gluk pika',
 'Gluk.ennen ateriaa','Gluk.ater.jälkeen','Paino','Lämpö','Kommentit','Läheisen osall.',
 'Muistettavaa','Jatkosuunnitelma','Sopimukset','Hengittäminen','Happisaturaatio',
 'Suun terveys','Kivunhoito','Vyötärönympärys','Pituus','BMI','Rokotus',
 'Lääkehuolto','Päihteet','Tupakointistatus','Tupak.lisätied.','Huumausaineet/käyttö',
 'Lääkkeet/väärinkäyttö','Rahapelaaminen','Digipelaaminen','Lyhytneuvonta',
 'NEWs','Lab.tulokset','Itsehoitolääkitys','Voimavarat','UCP/C oire/dg',
 'Käyntisyy/dg','Esitiedot','Kartoitus','Suunnitelma','Tavoitteet','Ratkaisu',
 'Arviointi','Asiointi','Tulosyy','Nykytila','Seuranta','Palaveri',
 'Hoidon tarve','Hoidon tavoitteet','Hoidon suunnittelu','Hoidon toteutus',
 'Hoidon tulokset','Ohjaus','Sairausloma','Tietojen luov.','Hoitotarvikejakelu',
 'Päätoimenpide 1','Lisätoimenpide 1','Lisätoimenpide 2','Skannattu dok.','Tiedoksi-PTH',
 'Tiedoksi-SOS','ALLEKIRJOITUS'
 ];
 var instruments=[
 'ABI','ADCS','ADL','ADSUME-pisteet','ADSUME','AUDIT','AUDIT_asteikko',
 'AUDIT-C','AUDIT-C_asteikko','4AT','BAI','BASDEC','BDI','BRADEN',
 'BRADEN_asteikko','CAM','CAST','CAST_asteikko','CERAD','CHADS VASC',
 'CVA-AR','EPDS','FRAT','FRAT_asteikko','FRAX','GAF','GAS','GDS','GDS-15',
 'HAS-BLED','HSI','HSI_asteikko','IADL','MNA','MNA_asteikko','MDI','MDQ',
 'MMSE','MMSE_asteikko','MoCA','Nuuskatesti','Nuuskatesti_asteikko',
 'PGSI','PGSI_asteikko','PROD','TMT','TUR','YMRS'
 ];
 var groups=[
 {id:'Hoidon toteutus',fi:'Hoidon toteutus',ru:'Выполнение ухода',en:'Care delivery'},
 {id:'Yöhoito',fi:'Yöhoito',ru:'Ночной уход',en:'Night care'},
 {id:'Vuorohoito',fi:'Vuorohoito',ru:'Уход по сменам',en:'Shift care'},
 {id:'Lisäotsikot',fi:'Lisäotsikot',ru:'Дополнительные заголовки',en:'Additional headings'},
 {id:'Mittarit',fi:'Mittarit',ru:'Шкалы и измерения',en:'Scales and measurements'}
 ];
 function categoryTargets(m){
   var c=m.cat||'',v=m.fi||'',targets=[];
   var map={
     'Aamutoimet':['Hoito'],
     'Iltatoimet ja yö':['Hoito','Yöhoito','Uni ja lepo'],
     'Pukeutuminen':['Hoito'],
     'Peseytyminen ja sauna':['Hoito','Kudoseheys'],
     'Erittäminen ja vaipat':['Erittäminen','Hoito'],
     'Ravitsemus ja juominen':['Ravitsemus'],
     'Liikkuminen ja siirtyminen':['Fyys.toim.kyky','Turvallisuus'],
     'Turvallisuus ja raportointi':['Turvallisuus'],
     'Kipu ja mittaukset':['Vointi','Verenpaine','Pulssi'],
     'Vuorovaikutus ja kieltäytyminen':['Sos.toim.kyky','Psyyk.toim.kyky'],
     'Vointi ja mieliala':['Vointi','Psyyk.toim.kyky'],
     'Iho ja haavat':['Kudoseheys'],
     'Hoito':['Hoito'],'Lääkitys':['Lääkitys'],'Vointi':['Vointi'],
     'Kudoseheys':['Kudoseheys'],'Erittäminen':['Erittäminen'],
     'Turvallisuus':['Turvallisuus'],'Hoidon arviointi':['Hoidon arviointi'],
     'Fyys.toim.kyky':['Fyys.toim.kyky'],'Ravitsemus':['Ravitsemus'],
     'Uni ja lepo':['Uni ja lepo'],'Yöhoito':['Yöhoito'],
     'Verenpaine':['Verenpaine'],'Pulssi':['Pulssi']
   };
   targets=map[c]?map[c].slice():[];
   if(/rauhalli|väsyn|virke|hyväntuul|iloinen|vointi|mielial/i.test(v)){
     if(targets.indexOf('Vointi')<0)targets.push('Vointi');
   }
   if(/rollaattor|kävelykep|kävel|liikk|siirty|nousemi/i.test(v)){
     if(targets.indexOf('Fyys.toim.kyky')<0)targets.push('Fyys.toim.kyky');
   }
   if(/ulkoi/i.test(v)&&targets.indexOf('Ulkoilu')<0)targets.push('Ulkoilu');
   if(/keskustel|seurustel|vierail/i.test(v)&&targets.indexOf('Sos.toim.kyky')<0)targets.push('Sos.toim.kyky');
   if(/ohja|neuvo/i.test(v)&&targets.indexOf('Ohjaus')<0)targets.push('Ohjaus');
   if(/virik|askartel|laul/i.test(v)&&targets.indexOf('Viriketoiminta')<0)targets.push('Viriketoiminta');
   if(/hoidon vaikut|auttoi|helpotti/i.test(v)&&targets.indexOf('Hoidon arviointi')<0)
     targets.push('Hoidon arviointi');
   return targets;
 }
 function shiftTags(m){
   var c=m.cat||'',v=m.fi||'';
   if(c==='Aamutoimet'||/aamutoim|aamupesu|aamulla|aamupala/i.test(v))
     return ['morning'];
   if(/ilta|nukkumaanmen|iltatoim/i.test(v))return ['evening'];
   if(c==='Iltatoimet ja yö'||c==='Yöhoito'||c==='Uni ja lepo'||/yöllä|yöaik|nukkui yön/i.test(v))
     return ['night','evening'];
   return ['morning','evening','night'];
 }
 function results(){
   return (data.mediatri||[]).filter(function(m){
     var matches=categoryTargets(m).indexOf(heading)>=0,
       shifts=shiftTags(m);
     return matches&&(shift==='all'||shifts.indexOf(shift)>=0)&&
       (!search||[m.fi,m.ru,m.en,m.cat].join(' ').toLocaleLowerCase().indexOf(search.toLocaleLowerCase())>=0);
   });
 }
 function itemHTML(m){
   return '<div class="dict-row"><div><b>'+safe(m.fi)+'</b><p>'+
     safe(t(m.ru,m.ru,m.en||m.ru))+'</p><small>'+safe(m.cat)+
     '</small></div><button class="tiny-btn" type="button" data-action="copy-fi" data-value="'+
     safe(m.fi)+'">'+safe(t('Копировать','Kopioi','Copy'))+'</button></div>';
 }
 function categoriesHTML(items,initialOpen){
   var grouped={},names=[];
   items.forEach(function(m){
     if(!grouped[m.cat]){grouped[m.cat]=[];names.push(m.cat);}
     grouped[m.cat].push(m);
   });
   var output='';
   names.forEach(function(cat,i){
     output+='<details class="rs-med-fold"'+(i===0&&initialOpen?' open':'')+'><summary>'+
       safe(cat)+' <small>('+grouped[cat].length+')</small></summary>'+
       grouped[cat].map(itemHTML).join('')+'</details>';
   });
   return output||'<div class="notice">'+safe(t('Подходящих фраз пока нет. Смотри также другие заголовки.',
     'Sopivia ilmauksia ei vielä ole. Tutki myös muita otsikoita.',
     'No matching sample yet. Check other headings.'))+'</div>';
 }
 function view(){
   var h=core.filter(function(x){return x[0]===heading;})[0]||core[0];
   var opts=[['morning','Aamuvuoro','Утренняя смена','Morning shift'],
     ['evening','Iltavuoro','Вечерняя смена','Evening shift'],
     ['night','Yövuoro','Ночная смена','Night shift'],
     ['all','Kaikki vuorot','Все смены','All shifts']];
   var s='<div class="panel"><h2>'+safe(t('Помощник записи — Kirjaamisopas',
     'Kirjaamisopas','Care note guide'))+'</h2><p class="hint">'+
     safe(t('Сначала выбери смену, затем заголовок Mediatri. Для каждой темы показаны подходящие учебные примеры.',
     'Valitse ensin työvuoro ja sitten Mediatri-otsikko. Näet aiheeseen sopivia harjoitusesimerkkejä.',
     'Choose your shift and Mediatri heading to see suitable examples.'))+
     '</p><div class="two-col"><label class="field"><span>'+
     safe(t('1. Смена','1. Työvuoro','1. Shift'))+
     '</span><select class="control" id="rs-med-shift">';
   opts.forEach(function(o){s+='<option value="'+safe(o[0])+'"'+(shift===o[0]?' selected':'')+'>'+
     safe(t(o[1]+' — '+o[2],o[1],o[1]+' — '+o[3]))+'</option>';});
   s+='</select></label><label class="field"><span>'+
     safe(t('2. Заголовок Mediatri','2. Mediatri-otsikko','2. Mediatri heading'))+
     '</span><select class="control" id="rs-med-heading">';
   core.forEach(function(row){s+='<option value="'+safe(row[0])+'"'+
     (heading===row[0]?' selected':'')+'>'+safe(row[0]+' — '+t(row[1],row[0],row[2]))+'</option>';});
   s+='</select></label></div><div class="notice"><b>'+safe(h[0])+'</b> — '+
     safe(t(h[1],h[4],h[2]))+'<p>'+safe(t(h[3],h[4],h[5]))+
     '</p></div><label class="field"><span>'+
     safe(t('Поиск среди примеров','Hae esimerkeistä','Search samples'))+
     '</span><input class="control" id="rs-med-search" type="search" value="'+safe(search)+
     '" maxlength="130" placeholder="'+safe(t('слово, действие, наблюдение',
       'sana, toimenpide, havainto','word, action, observation'))+
     '"></label><div id="rs-med-guide-results" class="dictionary-list"></div></div>';
   return s;
 }
 function renderResults(){
   var el=root.document.getElementById('rs-med-guide-results');if(!el)return;
   var arr=results();
   el.innerHTML='<p class="hint">'+arr.length+' '+safe(t('вариантов','esimerkkiä','examples'))+
     '</p>'+categoriesHTML(arr,true);
 }
 function phraseView(){
   var shifts=[['all','Kaikki vuorot','Все смены','All shifts'],
     ['morning','Aamuvuoro','Утренняя смена','Morning shift'],
     ['evening','Iltavuoro','Вечерняя смена','Evening shift'],
     ['night','Yövuoro','Ночная смена','Night shift']];
   var shiftOptions=shifts.map(function(x){return '<option value="'+x[0]+'"'+
     (shift===x[0]?' selected':'')+'>'+safe(t(x[1]+' — '+x[2],x[1],x[1]+' — '+x[3]))+
     '</option>';}).join('');
   return '<div class="panel"><h2>'+safe(t('Фразы по темам','Ilmaukset aiheittain',
     'Phrases by topic'))+'</h2><p class="hint">'+
     safe(t('Все существующие фразы сгруппированы. Раскрой нужную тему.',
     'Kaikki esimerkit on ryhmitelty. Avaa haluamasi aihe.',
     'All existing samples are grouped. Open a topic.'))+
     '</p><label class="field"><span>'+safe(t('Смена','Työvuoro','Shift'))+
     '</span><select id="rs-med-phrase-shift" class="control">'+shiftOptions+
     '</select></label><label class="field"><span>'+safe(t('Поиск','Haku','Search'))+
     '</span><input id="rs-med-phrase-filter" class="control" type="search" maxlength="130" value="'+
     safe(phraseSearch)+'"></label><div id="rs-med-phrase-results"></div></div>';
 }
 function renderPhrases(){
   var el=root.document.getElementById('rs-med-phrase-results');if(!el)return;
   var arr=(data.mediatri||[]).filter(function(m){
     if(shift!=='all'&&shiftTags(m).indexOf(shift)<0)return false;
     return !phraseSearch||[m.fi,m.ru,m.en,m.cat,m.catRu].join(' ').toLocaleLowerCase()
       .indexOf(phraseSearch.toLocaleLowerCase())>=0;
   });
   el.innerHTML='<p class="hint">'+arr.length+' / '+data.mediatri.length+'</p>'+
     categoriesHTML(arr,false);
 }
 function referenceExamples(name){
   var known={
     'MNA':'MNA-arvioinnin tulos kirjattiin asianmukaiseen kohtaan.',
     'MMSE':'MMSE-testin tulos kirjattiin arvioinnin jälkeen.',
     'BRADEN':'Braden-arvioinnin tulos kirjattiin.',
     'Verenpaine':'Verenpaine mitattiin levossa; arvo kirjattiin.',
     'Paino':'Paino mitattiin; tulos kirjattiin.',
     'Happisaturaatio':'Happisaturaatio mitattiin; tulos kirjattiin.',
     'Kivunhoito':'Asukkaan kipua seurattiin ja havainto kirjattiin.',
     'Hoidon tavoitteet':'Hoidon tavoitteet käytiin läpi hoitosuunnitelman mukaisesti.',
     'Seuranta':'Asukkaan vointia seurattiin.',
     'Annettu lääke':'Annettu lääke kirjattiin lääkehoidon ohjeen mukaisesti.'
   };
   return known[name]||'';
 }
 function referenceView(){
   var s='<div class="panel"><h2>'+safe(t('Все заголовки Mediatri — справочник',
     'Kaikki Mediatri-otsikot — hakemisto','All Mediatri headings — reference'))+
     '</h2><p class="hint">'+safe(t('По фотографиям интерфейса. Повторы объединены. '
     +'Шкалы и узкоспециальные пункты не относятся к обычному описанию ежедневного ухода.',
     'Kuvien mukainen luettelo, toistot poistettu. Mittarit ja erikoisotsikot '
     +'eivät kuulu automaattisesti päivittäiseen hoitokirjaukseen.',
     'From the supplied screenshots, duplicates removed. Measures and specialist headings are not routine daily notes.'))+
     '</p><div class="rs-med-reference">';
   s+='<details class="rs-med-fold" open><summary>'+safe(t('Основные темы ухода',
     'Päivittäisen hoidon keskeiset otsikot','Routine care headings'))+' ('+core.length+
     ')</summary>';
   core.forEach(function(h){
     s+='<div class="dict-row"><div><b>'+safe(h[0])+'</b><p>'+
       safe(t(h[1],h[4],h[2]))+'</p><small>'+safe(t(h[3],h[4],h[5]))+
       '</small></div></div>';
   });s+='</details>';
   s+='<details class="rs-med-fold"><summary>'+safe(t('Дополнительные разделы',
     'Lisäotsikot','Additional headings'))+' ('+secondary.length+')</summary>';
   var seen={};
   secondary.forEach(function(name){
     if(seen[name]||core.some(function(h){return h[0]===name;}))return;
     seen[name]=true;
     var ex=referenceExamples(name);
     s+='<div class="dict-row"><div><b>'+safe(name)+'</b>'+
       '<p>'+safe(t('Дополнительный заголовок: выбирай только при необходимости и по правилам учреждения.',
         'Lisäotsikko: käytä vain tarpeen ja yksikön ohjeiden mukaan.',
         'Additional heading: use only when relevant and authorized.'))+'</p>'+
       (ex?'<small>'+safe(t('Учебный пример: ','Harjoitusesimerkki: ',
         'Example: '))+safe(ex)+'</small>':'<small>'+safe(t('Для некоторых специальных пунктов надёжного общего примера нет.',
         'Kaikille erikoisotsikoille ei ole turvallista yleisesimerkkiä.',
         'No reliable generic example for some specialist headings.'))+'</small>')+
       '</div></div>';
   });s+='</details>';
   s+='<details class="rs-med-fold"><summary>'+safe(t('Измерения и оценочные шкалы (Mittarit)',
     'Mittarit ja arviointiasteikot','Measures and assessment scales'))+
     ' ('+instruments.length+')</summary><p class="hint">'+
     safe(t('Это названия специализированных шкал. Их нельзя заменять свободной записью или использовать без обучения.',
     'Arviointimittareita käytetään vain koulutuksen ja yksikön ohjeen mukaisesti.',
     'These are specialized instruments; use according to training and unit protocol.'))+
     '</p>';
   instruments.forEach(function(name){
     var ex=referenceExamples(name);
     s+='<div class="dict-row"><div><b>'+safe(name)+'</b><p>'+
       safe(t('Оценочный инструмент / шкала. Назначение уточняется по инструкции.',
         'Arviointimittari. Käyttötarkoitus tarkistetaan ohjeesta.',
         'Assessment instrument. Check its official use.'))+'</p>'+
       (ex?'<small>'+safe(ex)+'</small>':'')+'</div></div>';
   });s+='</details>';
   s+='</div></div>';return s;
 }
 function bind(){
   if(bind.did)return;bind.did=true;
   root.document.addEventListener('change',function(e){
     var id=e.target&&e.target.id;if(!id)return;
     if(id==='rs-med-shift'){shift=e.target.value;renderResults();}
     if(id==='rs-med-heading'){heading=e.target.value;renderResults();}
     if(id==='rs-med-phrase-shift'){shift=e.target.value;renderPhrases();}
   });
   root.document.addEventListener('input',function(e){
     if(!e.target)return;
     if(e.target.id==='rs-med-search'){search=e.target.value;renderResults();}
     if(e.target.id==='rs-med-phrase-filter'){phraseSearch=e.target.value;renderPhrases();}
   });
 }
 bind();
 return {guideView:view,renderGuide:renderResults,phraseView:phraseView,
   renderPhrases:renderPhrases,referenceView:referenceView,
   stats:function(){return {core:core.length,secondary:secondary.length,
     instruments:instruments.length,samples:data.mediatri.length};},
   sampleMatches:results,
   core:core,groups:groups};
});
