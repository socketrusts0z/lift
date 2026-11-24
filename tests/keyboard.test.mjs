import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardScrollSession,installKeyboardHandling} from '../keyboard.mjs';
const position={x:0,y:420,route:'#session'};
test('restores the position from before focus, including when switching fields',()=>{const s=new KeyboardScrollSession();s.begin(position);s.resize(true,'#session');s.begin({x:0,y:700,route:'#session'});assert.deepEqual(s.resize(false,'#session'),position);assert.equal(s.resize(false,'#session'),null);});
test('intentional scrolling while typing is preserved',()=>{const s=new KeyboardScrollSession();s.begin(position);s.resize(true,'#session');s.movedByUser();assert.equal(s.resize(false,'#session'),null);});
test('closing without an opened keyboard or after navigation never jumps back',()=>{const s=new KeyboardScrollSession();s.begin(position);assert.equal(s.resize(false,'#session'),null);s.resize(true,'#session');assert.equal(s.resize(false,'#history'),null);});
function surface(reducedMotion=false){
  const events=()=>({
    listeners:{},
    addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);},
    fire(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}
  });
  let id=0,now=0;
  const timeouts=new Map(),frames=new Map(),scrolls=[];
  const field={matches:()=>true};
  const doc={...events(),activeElement:field,documentElement:{dataset:{}}};
  const viewport={...events(),height:844,scale:1};
  const win={
    ...events(),visualViewport:viewport,innerHeight:844,scrollX:0,scrollY:420,location:{hash:'#session'},
    matchMedia:query=>({matches:query.includes('max-width')||reducedMotion}),
    setTimeout(run,delay){const key=++id;timeouts.set(key,{run,when:now+delay});return key;},
    clearTimeout(key){timeouts.delete(key);},
    requestAnimationFrame(run){const key=++id;frames.set(key,run);return key;},
    cancelAnimationFrame(key){frames.delete(key);},
    scrollTo(x,y){this.scrollX=x;this.scrollY=y;scrolls.push(y);this.fire('scroll');}
  };
  function advance(ms){
    now+=ms;
    for(const [key,task] of [...timeouts]){
      if(task.when<=now&&timeouts.delete(key))task.run();
    }
    for(const [key,run] of [...frames])if(frames.delete(key))run(now);
  }
  function open(){
    doc.fire('pointerdown',{target:field,clientX:100,clientY:500});
    win.scrollY=700; // The browser's own focus scroll.
    doc.fire('focusin',{target:field});
    viewport.height=460;
    viewport.fire('resize');
    advance(200);
  }
  function close(){
    viewport.height=844;
    viewport.fire('resize');
  }
  installKeyboardHandling(win,doc);
  return {win,doc,viewport,advance,open,close,scrolls};
}

test('waits for the viewport to settle and eases to the original position across multiple frames',()=>{
  const {win,doc,viewport,advance,open,close,scrolls}=surface();
  open();
  assert.deepEqual(scrolls,[]);
  close();
  advance(90);
  viewport.fire('scroll');
  advance(100);
  assert.equal(win.scrollY,700);
  advance(30);
  advance(80);
  const first=win.scrollY;
  advance(80);
  assert(first<700&&first>win.scrollY&&win.scrollY>420);
  advance(160);
  assert.equal(win.scrollY,420);
  assert.equal(doc.documentElement.dataset.keyboard,'closed');
});

test('restores immediately after the viewport settles when Reduce Motion is enabled',()=>{
  const {advance,open,close,scrolls}=surface(true);
  open();
  close();
  advance(120);
  assert.deepEqual(scrolls,[420]);
});

test('completing a set can close the keyboard without a second app scroll',()=>{
  const {doc,advance,open,close,scrolls}=surface();
  open();
  const action={closest:selector=>selector==='[data-preserve-scroll]'?{}:null};
  doc.fire('pointerdown',{target:action,clientX:100,clientY:500});
  doc.activeElement=null;
  doc.fire('focusout');
  close();
  advance(500);
  assert.deepEqual(scrolls,[]);
  assert.equal(doc.documentElement.dataset.keyboard,'closed');
});

test('a swipe during the return cancels the remaining animation frames',()=>{
  const {win,doc,advance,open,close,scrolls}=surface();
  open();
  close();
  advance(120);
  advance(80);
  const current=win.scrollY;
  const steps=scrolls.length;
  doc.fire('touchmove');
  advance(500);
  assert.equal(win.scrollY,current);
  assert.equal(scrolls.length,steps);
});

test('deliberate scrolling while the keyboard is open preserves position on close',()=>{
  const {doc,advance,open,close,scrolls}=surface();
  open();
  doc.fire('pointermove',{clientX:100,clientY:430});
  close();
  advance(500);
  assert.deepEqual(scrolls,[]);
});
