// Stores the position from before Safari's automatic focus scrolling.
export class KeyboardScrollSession {
  origin=null; opened=false; intentional=false;
  begin(position){if(!this.origin)this.origin={...position};}
  movedByUser(){if(this.origin)this.intentional=true;}
  resize(shrunken,route){
    if(!this.origin)return null;
    if(shrunken){this.opened=true;return null;}
    if(!this.opened)return null;
    const target=!this.intentional&&this.origin.route===route?this.origin:null;
    this.cancel();return target;
  }
  cancel(){this.origin=null;this.opened=false;this.intentional=false;}
}
export function installKeyboardHandling(win,doc){
  const session=new KeyboardScrollSession();
  const viewport=win.visualViewport;
  const editable=el=>el?.matches?.('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea');
  const mobile=()=>win.matchMedia('(max-width:760px)').matches;
  const height=()=>viewport?.height||win.innerHeight;
  const position=()=>({x:win.scrollX,y:win.scrollY,route:win.location.hash});
  let baseline=height(),pendingReturn=null,settleTimer,animationFrame,pointer=null;

  function cancelReturn(){
    pendingReturn=null;
    win.clearTimeout(settleTimer);
    win.cancelAnimationFrame(animationFrame);
  }

  function restore(target){
    if(session.origin||target.route!==win.location.hash||!mobile())return;
    const from=position();
    if(Math.abs(from.x-target.x)<1&&Math.abs(from.y-target.y)<1)return;
    if(win.matchMedia('(prefers-reduced-motion: reduce)').matches){
      win.scrollTo(target.x,target.y);
      return;
    }

    // A timed sequence avoids WebKit shortening the native smooth scroll during a keyboard transition.
    let startedAt;
    function step(now){
      startedAt??=now;
      const progress=Math.min(1,(now-startedAt)/320);
      const ease=progress*progress*(3-2*progress);
      win.scrollTo(from.x+(target.x-from.x)*ease,from.y+(target.y-from.y)*ease);
      if(progress<1)animationFrame=win.requestAnimationFrame(step);
    }
    animationFrame=win.requestAnimationFrame(step);
  }

  function waitForViewport(){
    win.clearTimeout(settleTimer);
    if(!pendingReturn)return;
    if(baseline-height()>100)return;
    settleTimer=win.setTimeout(()=>{
      const target=pendingReturn;
      pendingReturn=null;
      if(target)restore(target);
    },120);
  }

  function capture(el){
    if(!mobile()||!editable(el)||session.origin)return;
    cancelReturn();
    baseline=Math.max(height(),win.innerHeight);
    session.begin(position());
  }

  function update(){
    if((viewport?.scale||1)!==1){
      session.cancel();
      cancelReturn();
      doc.documentElement.dataset.keyboard='closed';
      return;
    }
    const shrunken=baseline-height()>100;
    const target=session.resize(shrunken,win.location.hash);
    doc.documentElement.dataset.keyboard=shrunken&&!!session.origin?'open':'closed';
    if(target)pendingReturn=target;
    if(pendingReturn)waitForViewport();
    // Safari already pans to the focused field. An extra scroll here competes with that pan.
  }

  function preserveScroll(){
    session.movedByUser();
    cancelReturn();
  }

  function actionKeepsPosition(target){
    return target?.closest?.('[data-preserve-scroll]');
  }

  doc.addEventListener('pointerdown',e=>{
    cancelReturn();
    pointer={x:e.clientX,y:e.clientY};
    if(actionKeepsPosition(e.target))preserveScroll();
    capture(e.target);
  },{capture:true,passive:true});
  doc.addEventListener('pointermove',e=>{
    if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10)preserveScroll();
  },{passive:true});
  doc.addEventListener('pointerup',()=>pointer=null,{passive:true});
  doc.addEventListener('pointercancel',()=>pointer=null,{passive:true});
  doc.addEventListener('touchmove',preserveScroll,{passive:true});
  doc.addEventListener('wheel',preserveScroll,{passive:true});
  doc.addEventListener('click',e=>{
    if(actionKeepsPosition(e.target))preserveScroll();
  },{capture:true});
  doc.addEventListener('focusin',e=>{capture(e.target);update();});
  doc.addEventListener('focusout',()=>win.setTimeout(()=>{
    update();
    if(!session.opened&&!editable(doc.activeElement))session.cancel();
  },0));

  viewport?.addEventListener('resize',update);
  viewport?.addEventListener('scroll',waitForViewport,{passive:true});
  win.addEventListener('resize',update);
  win.addEventListener('scroll',waitForViewport,{passive:true});
  function reset(){
    session.cancel();
    cancelReturn();
    baseline=height();
    doc.documentElement.dataset.keyboard='closed';
  }
  win.addEventListener('hashchange',reset);
  win.addEventListener('orientationchange',reset);
}
