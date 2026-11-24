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
 const session=new KeyboardScrollSession(),viewport=win.visualViewport;
 let baseline=viewport?.height||win.innerHeight,ensureTimer,restoreTimer,pointer=null;
 const editable=el=>el?.matches?.('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea');
 const mobile=()=>win.matchMedia('(max-width:760px)').matches;
 const position=()=>({x:win.scrollX,y:win.scrollY,route:win.location.hash});
 function capture(el){
  if(!mobile()||!editable(el))return;
  clearTimeout(restoreTimer);
  session.begin(position());
 }
 function update(){
  const height=viewport?.height||win.innerHeight,scale=viewport?.scale||1;
  if(scale!==1){session.cancel();doc.documentElement.dataset.keyboard='closed';return;}
  if(!session.origin)baseline=Math.max(baseline,height);
  const shrunken=Math.max(baseline,win.innerHeight)-height>120;
  const target=session.resize(shrunken,win.location.hash);
  doc.documentElement.dataset.keyboard=shrunken&&!!session.origin?'open':'closed';
  clearTimeout(ensureTimer);
  if(target){
   // Wait for Safari's closing animation and its own final focus scroll.
   clearTimeout(restoreTimer);
   restoreTimer=setTimeout(()=>{
    if(!session.origin&&target.route===win.location.hash&&mobile())win.scrollTo({left:target.x,top:target.y,behavior:'auto'});
   },250);
  }
  const field=doc.activeElement;
  if(!shrunken||!mobile()||!editable(field)||!session.origin)return;
  ensureTimer=setTimeout(()=>{
   if(doc.activeElement!==field)return;
   const bounds=field.getBoundingClientRect(),top=(viewport?.offsetTop||0)+16,bottom=(viewport?.offsetTop||0)+(viewport?.height||win.innerHeight)-16;
   const delta=bounds.bottom>bottom?bounds.bottom-bottom:bounds.top<top?bounds.top-top:0;
   if(Math.abs(delta)>1)win.scrollBy({top:delta,behavior:'auto'});
  },150);
 }
 // pointerdown precedes focus and Safari's automatic viewport movement.
 doc.addEventListener('pointerdown',e=>{clearTimeout(restoreTimer);pointer={x:e.clientX,y:e.clientY};capture(e.target);},{capture:true,passive:true});
 doc.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10){session.movedByUser();clearTimeout(restoreTimer);}},{passive:true});
 doc.addEventListener('pointerup',()=>pointer=null,{passive:true});
 doc.addEventListener('pointercancel',()=>pointer=null,{passive:true});
 doc.addEventListener('wheel',()=>{session.movedByUser();clearTimeout(restoreTimer);},{passive:true});
 doc.addEventListener('focusin',e=>{capture(e.target);update();});
 doc.addEventListener('focusout',()=>setTimeout(()=>{update();if(!session.opened&&!editable(doc.activeElement))session.cancel();},0));
 viewport?.addEventListener('resize',update);
 win.addEventListener('resize',update);
 win.addEventListener('hashchange',()=>{session.cancel();clearTimeout(restoreTimer);clearTimeout(ensureTimer);doc.documentElement.dataset.keyboard='closed';});
 win.addEventListener('orientationchange',()=>{session.cancel();clearTimeout(restoreTimer);baseline=0;setTimeout(update,250);});
}
