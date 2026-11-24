import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardScrollSession,installKeyboardHandling} from '../keyboard.mjs';
const position={x:0,y:420,route:'#session'};
test('restores the position from before focus, including when switching fields',()=>{const s=new KeyboardScrollSession();s.begin(position);s.resize(true,'#session');s.begin({x:0,y:700,route:'#session'});assert.deepEqual(s.resize(false,'#session'),position);assert.equal(s.resize(false,'#session'),null);});
test('intentional scrolling while typing is preserved',()=>{const s=new KeyboardScrollSession();s.begin(position);s.resize(true,'#session');s.movedByUser();assert.equal(s.resize(false,'#session'),null);});
test('closing without an opened keyboard or after navigation never jumps back',()=>{const s=new KeyboardScrollSession();s.begin(position);assert.equal(s.resize(false,'#session'),null);s.resize(true,'#session');assert.equal(s.resize(false,'#history'),null);});
function surface(){
 const events=()=>({listeners:{},addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);},fire(type,event={}){for(const fn of this.listeners[type]||[])fn(event);}});
 const field={matches:()=>true,getBoundingClientRect:()=>({top:300,bottom:344})};
 const doc={...events(),activeElement:field,documentElement:{dataset:{}}};
 const viewport={...events(),height:844,offsetTop:0,scale:1};
 const win={...events(),visualViewport:viewport,innerHeight:844,scrollX:0,scrollY:420,location:{hash:'#session'},matchMedia:()=>({matches:true}),scrollTo(p){this.scrollY=p.top;},scrollBy(p){this.scrollY+=p.top;}};
 installKeyboardHandling(win,doc);return {win,doc,viewport,field};
}
test('dismissal restores after viewport expands even if iOS leaves the input focused',async()=>{const {win,doc,viewport,field}=surface();doc.fire('pointerdown',{target:field,clientX:100,clientY:500});win.scrollY=700;doc.fire('focusin',{target:field});viewport.height=460;viewport.fire('resize');viewport.height=844;viewport.fire('resize');await new Promise(resolve=>setTimeout(resolve,300));assert.equal(win.scrollY,420);assert.equal(doc.documentElement.dataset.keyboard,'closed');});
test('real touch scrolling cancels restoration without treating native scroll as a gesture',async()=>{const {win,doc,viewport,field}=surface();doc.fire('pointerdown',{target:field,clientX:100,clientY:500});doc.fire('focusin',{target:field});viewport.height=460;viewport.fire('resize');win.scrollY=700;doc.fire('pointermove',{clientX:100,clientY:430});viewport.height=844;viewport.fire('resize');await new Promise(resolve=>setTimeout(resolve,300));assert.equal(win.scrollY,700);});
