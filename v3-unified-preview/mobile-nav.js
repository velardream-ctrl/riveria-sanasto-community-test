/* Riveria Sanasto Community v2.0.4 — swipeable mobile navigation.
   Small ES5-only enhancement for old Safari (iOS 12). No account or learning data is touched. */
(function () {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function strip() { return el('mobile-nav-scroll'); }
  function updateArrows() {
    var s=strip(), prev=el('mobile-nav-prev'), next=el('mobile-nav-next');
    if(!s||!prev||!next)return;
    prev.disabled=s.scrollLeft<=2;
    next.disabled=s.scrollLeft+s.clientWidth>=s.scrollWidth-2;
  }
  function move(dir) {
    var s=strip();if(!s)return;
    var goal=s.scrollLeft+dir*Math.max(155,Math.floor(s.clientWidth*0.75));
    if(goal<0)goal=0;
    if(goal>s.scrollWidth-s.clientWidth)goal=s.scrollWidth-s.clientWidth;
    var start=s.scrollLeft, delta=goal-start, began=Date.now(), duration=220;
    if(!delta)return;
    if(!window.requestAnimationFrame){s.scrollLeft=goal;updateArrows();return;}
    function frame(){
      var p=Math.min(1,(Date.now()-began)/duration);
      var eased=1-Math.pow(1-p,3);
      s.scrollLeft=start+delta*eased;
      if(p<1)window.requestAnimationFrame(frame);else updateArrows();
    }
    frame();
  }
  function revealSelected() {
    var s=strip();if(!s)return;
    var active=s.querySelector('.mobile-item.active');if(!active)return;
    var box=s.getBoundingClientRect(), item=active.getBoundingClientRect();
    if(item.left<box.left+3)s.scrollLeft-=(box.left+3-item.left);
    else if(item.right>box.right-3)s.scrollLeft+=(item.right-box.right+3);
    updateArrows();
  }
  function init() {
    var s=strip(),prev=el('mobile-nav-prev'),next=el('mobile-nav-next');
    if(!s||!prev||!next)return;
    prev.addEventListener('click',function(){move(-1);});
    next.addEventListener('click',function(){move(1);});
    s.addEventListener('scroll',updateArrows);
    s.addEventListener('click',function(e){
      var t=e.target;
      while(t&&t!==s&&!t.getAttribute('data-view'))t=t.parentNode;
      if(t&&t!==s)window.setTimeout(revealSelected,0);
    });
    window.addEventListener('resize',updateArrows);
    window.addEventListener('orientationchange',function(){window.setTimeout(updateArrows,250);});
    window.setTimeout(function(){revealSelected();updateArrows();},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
