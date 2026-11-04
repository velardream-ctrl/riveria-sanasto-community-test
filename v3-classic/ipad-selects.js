/* Sanastoyhteiso V3 TEST ONLY — accessible old-iPad select enhancement.
 * Safari iOS <=12 uses a small native expanded picker which CSS cannot style.
 * Replace visual UI ONLY on those iPads. Underlying <select> remains in
 * place, with native values and bubbling change events for existing app code.
 * ES5 (Safari 12). No storage, network, analytics, or Firebase access.
 */
(function(root,doc){
 'use strict';
 var enabled=false,openPopup=null,openButton=null,openSelect=null;
 var observer=null;
 function legacyIpad(ua){
   return /iPad/i.test(String(ua||''))&&/OS (?:[5-9]|1[0-2])_/.test(String(ua||''));
 }
 function options(select){return select.options||[];}
 function label(select){
   var i=select.selectedIndex,items=options(select);
   return i>=0&&items[i]?items[i].text:'Выбери значение';
 }
 function sync(select){
   if(!select||!select._rsIpadButton)return;
   var button=select._rsIpadButton,txt=label(select);
   if(button._rsLabel!==txt){
     button._rsLabel=txt;
     button.textContent=txt;
     var chevron=doc.createElement('span');
     chevron.className='rs-ipad-chevron';
     chevron.setAttribute('aria-hidden','true');
     chevron.textContent='⌄';
     button.appendChild(chevron);
   }
   button.disabled=!!select.disabled;
 }
 function close(returnFocus){
   var popup=openPopup,button=openButton;
   openPopup=null;openButton=null;openSelect=null;
   if(popup&&popup.parentNode)popup.parentNode.removeChild(popup);
   if(button){
     button.setAttribute('aria-expanded','false');
     button.className=button.className.replace(/\s*rs-ipad-open\b/g,'');
     if(returnFocus&&doc.documentElement.contains(button))button.focus();
   }
   doc.removeEventListener('mousedown',outside,true);
   doc.removeEventListener('touchstart',outside,true);
   doc.removeEventListener('keydown',keyboard,true);
 }
 function outside(event){
   if(!openPopup)return;
   if((openPopup.contains(event.target))||
      (openButton&&openButton.contains(event.target)))return;
   close(false);
 }
 function allButtons(){return openPopup?openPopup.querySelectorAll('button.rs-ipad-choice:not([disabled])'):[];}
 function focusIndex(index){
   var buttons=allButtons(),length=buttons.length;
   if(!length)return;
   var n=(index+length)%length;
   buttons[n].focus();
 }
 function keyboard(e){
   if(!openPopup)return;
   var key=e.key||'',kc=e.keyCode||0;
   if(key==='Escape'||kc===27){e.preventDefault();close(true);return;}
   var arr=allButtons(),idx=-1;
   for(var i=0;i<arr.length;i++)if(arr[i]===doc.activeElement){idx=i;break;}
   if(key==='ArrowDown'||kc===40){e.preventDefault();focusIndex(idx+1);return;}
   if(key==='ArrowUp'||kc===38){e.preventDefault();focusIndex(idx<0?arr.length-1:idx-1);return;}
   if(key==='Home'||kc===36){e.preventDefault();focusIndex(0);return;}
   if(key==='End'||kc===35){e.preventDefault();focusIndex(arr.length-1);return;}
 }
 function position(button,popup){
   var r=button.getBoundingClientRect();
   var ww=root.innerWidth||doc.documentElement.clientWidth||768;
   var hh=root.innerHeight||doc.documentElement.clientHeight||768;
   var margin=12,width=Math.max(r.width,Math.min(390,ww-margin*2));
   width=Math.min(width,ww-margin*2);
   var left=Math.max(margin,Math.min(r.left,ww-width-margin));
   var below=hh-r.bottom-margin-8,above=r.top-margin-8;
   var max=Math.min(480,Math.floor(hh*.66));
   var showAbove=below<210&&above>below;
   var height=Math.max(80,Math.min(max,showAbove?above:below));
   popup.style.width=Math.round(width)+'px';
   popup.style.left=Math.round(left)+'px';
   popup.style.maxHeight=Math.round(height)+'px';
   popup.style.top=Math.round(showAbove?r.top-height-8:r.bottom+7)+'px';
 }
 function open(select,button){
   if(button.disabled)return;
   if(openPopup&&openSelect===select){close(true);return;}
   close(false);
   var popup=doc.createElement('div');
   popup.className='rs-ipad-select-menu';
   popup.setAttribute('role','listbox');
   popup.setAttribute('aria-label',select.getAttribute('aria-label')||button.getAttribute('aria-label')||'Варианты');
   var items=options(select),focusCandidate=null;
   for(var i=0;i<items.length;i++){
     var item=items[i];
     if(item.tagName&&item.tagName.toLowerCase()!=='option')continue;
     var b=doc.createElement('button');
     b.type='button';
     b.className='rs-ipad-choice';
     b.setAttribute('role','option');
     b.setAttribute('aria-selected',item.selected?'true':'false');
     b.disabled=!!item.disabled;
     b.textContent=item.text;
     if(item.selected){
       b.className+=' rs-ipad-chosen';
       focusCandidate=b;
     }
     (function(index){
       b.addEventListener('click',function(e){
         e.preventDefault();e.stopPropagation();
         if(!select.parentNode){close(false);return;}
         var previous=select.selectedIndex;
         close(false);
         select.selectedIndex=index;
         sync(select);
         if(previous!==index){
           var event;
           if(typeof root.Event==='function')
             event=new root.Event('change',{bubbles:true});
           else{
             event=doc.createEvent('Event');
             event.initEvent('change',true,false);
           }
           select.dispatchEvent(event);
         }
         if(button.parentNode)button.focus();
       });
     })(i);
     popup.appendChild(b);
   }
   doc.body.appendChild(popup);
   openPopup=popup;openButton=button;openSelect=select;
   button.setAttribute('aria-expanded','true');
   button.className+=' rs-ipad-open';
   position(button,popup);
   doc.addEventListener('mousedown',outside,true);
   doc.addEventListener('touchstart',outside,true);
   doc.addEventListener('keydown',keyboard,true);
   if(focusCandidate&&!focusCandidate.disabled){
     var offset=focusCandidate.offsetTop||0;
     if(offset>100)popup.scrollTop=Math.max(0,offset-100);
     focusCandidate.focus();
   }else focusIndex(0);
 }
 function enhance(select){
   if(!select||select._rsIpadButton||!select.parentNode||!enabled)return false;
   var wrap=doc.createElement('span');
   wrap.className='rs-ipad-select-wrap';
   var parent=select.parentNode;
   parent.insertBefore(wrap,select);
   wrap.appendChild(select);
   select.className+=' rs-ipad-select-native';
   // The underlying select retains name/id/form value and native change event.
   select.setAttribute('tabindex','-1');
   select.setAttribute('aria-hidden','true');
   var button=doc.createElement('button');
   button.type='button';
   button.className='rs-ipad-select-trigger';
   button.setAttribute('aria-haspopup','listbox');
   button.setAttribute('aria-expanded','false');
   var alt=select.getAttribute('aria-label')||'Выбрать значение';
   var id=select.id;
   if(id){
     var matched=doc.querySelector('label[for="'+id.replace(/"/g,'')+'"]');
     if(matched)alt=matched.textContent.replace(/\s+/g,' ').trim()||alt;
   }
   button.setAttribute('aria-label',alt);
   wrap.appendChild(button);
   select._rsIpadButton=button;
   sync(select);
   button.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();open(select,button);});
   button.addEventListener('keydown',function(e){
     if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.keyCode===40||e.keyCode===38){
       e.preventDefault();open(select,button);
     }
   });
   select.addEventListener('change',function(){sync(select);});
   return true;
 }
 function scan(){
   if(!enabled)return;
   var selects=doc.querySelectorAll('select');
   for(var i=0;i<selects.length;i++){
     enhance(selects[i]);
     sync(selects[i]);
   }
   if(openSelect&&!doc.documentElement.contains(openSelect))close(false);
 }
 function init(){
   if(enabled)return;
   if(!legacyIpad(root.navigator&&root.navigator.userAgent))return;
   enabled=true;
   doc.documentElement.className+=' rs-legacy-ipad';
   scan();
   if(root.MutationObserver){
     observer=new root.MutationObserver(function(){scan();});
     observer.observe(doc.body||doc.documentElement,{subtree:true,childList:true,attributes:false});
   }
 }
 root.RS_IPAD_SELECTS={detect:legacyIpad,init:init,scan:scan,enhance:enhance,close:close};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);
 else init();
})(window,document);
