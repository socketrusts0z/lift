import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,startWorkout,newSet,validSet,validateData,mergeData,toCSV,toKg,displayWeight,workoutStats,clone,LIBRARY,newExercise,usesAddedWeight} from '../model.mjs';
function completed(){const d=initialData();const w=startWorkout(d.routines[0]);w.exercises=w.exercises.slice(0,1);w.exercises[0].sets=[newSet({weight:60,reps:8,done:true}),newSet({weight:20,reps:10,done:true,type:'warmup'})];w.endedAt=new Date(Date.parse(w.startedAt)+60*60000).toISOString();d.workouts=[w];return d;}
test('backup round trip preserves routines, history, custom exercises and unfinished workout',()=>{const d=completed();d.customExercises.push({id:'custom-1',name:'Custom press',mode:'weight',muscle:'Chest'});d.active=startWorkout(d.routines[1]);d.active.restEnd=Date.now()+90000;assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);});
test('starting from a routine does not mutate it and recalls previous working sets',()=>{const d=completed(),before=clone(d.routines[0]);const w=startWorkout(d.routines[0],d.workouts);assert.equal(w.exercises[0].sets[0].weight,60);assert.equal(w.exercises[0].sets[0].done,false);assert.deepEqual(d.routines[0],before);assert.notEqual(w.exercises[0].id,d.routines[0].exercises[0].id);});
test('completed set validation handles four exercise modes',()=>{assert.equal(validSet(newSet({weight:0,reps:5}),'weight'),true);assert.equal(validSet(newSet({weight:50,reps:2.5}),'weight'),false);assert.equal(validSet(newSet({reps:10}),'bodyweight'),true);assert.equal(validSet(newSet({seconds:60}),'duration'),true);assert.equal(validSet(newSet({distance:5,seconds:1200}),'distance'),true);assert.equal(validSet(newSet({weight:-10,reps:5}),'weight'),false);});
test('warmups do not inflate working volume',()=>{const s=workoutStats(completed().workouts[0]);assert.equal(s.volume,480);assert.equal(s.sets,2);assert.equal(s.minutes,60);});
test('reimporting a backup is idempotent and keeps local settings',()=>{const d=completed(),incoming=clone(d);incoming.settings.unit='lb';const result=mergeData(d,incoming);assert.equal(result.workouts.length,1);assert.equal(result.settings.unit,'kg');assert.deepEqual(mergeData(result,incoming),result);});
test('merge adds new workouts but never overwrites existing IDs',()=>{const d=completed(),incoming=completed();incoming.workouts.push({...clone(d.workouts[0]),name:'changed'});const result=mergeData(d,incoming);assert.equal(result.workouts.length,2);assert.equal(result.workouts.find(w=>w.id===d.workouts[0].id).name,d.workouts[0].name);});
test('invalid import is rejected without mutating local data',()=>{const d=completed(),before=clone(d),bad=clone(d);bad.workouts[0].exercises[0].sets[0].weight=-1;assert.throws(()=>validateData(bad));assert.deepEqual(d,before);assert.throws(()=>validateData({schema:99}));});
test('malformed and duplicate IDs and impossible completed sets are rejected',()=>{const d=completed();d.workouts.push(clone(d.workouts[0]));assert.throws(()=>validateData(d),/Duplicate/);const bad=completed();bad.workouts[0].exercises[0].sets[0].reps=null;assert.throws(()=>validateData(bad),/completed set/);});
test('CSV quotes commas, line breaks, and spreadsheet formula prefixes',()=>{const d=completed();d.workouts[0].name='=SUM(1,2)';d.workouts[0].notes='Line 1\n"Line 2"';const csv=toCSV(d);assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"Line 1\n""Line 2"""'));assert.equal(csv.match(/"weight_kg"/g).length,1);});
test('unit conversions round trip without changing canonical kilograms',()=>{const kg=60;const lb=displayWeight(kg,'lb');assert.ok(Math.abs(toKg(lb,'lb')-kg)<.005);assert.equal(toKg('','kg'),null);});
test('backup cannot finish before it starts or duplicate its active session',()=>{const d=completed();d.workouts[0].endedAt='2000-01-01T00:00:00Z';assert.throws(()=>validateData(d));const b=completed();b.active=clone(b.workouts[0]);b.active.endedAt=null;assert.throws(()=>validateData(b),/Active workout/);});

test('pounds preference and active weights survive saving and reopening',()=>{
 const d=initialData();d.settings.unit='lb';d.active=startWorkout(d.routines[0]);
 d.active.exercises[0].sets[0].weight=toKg(100,d.settings.unit);
 const reopened=validateData(JSON.parse(JSON.stringify(d)));
 assert.equal(reopened.settings.unit,'lb');
 assert.equal(displayWeight(reopened.active.exercises[0].sets[0].weight,reopened.settings.unit),100);
 reopened.settings.unit='kg';
 assert.equal(displayWeight(reopened.active.exercises[0].sets[0].weight,reopened.settings.unit),45.36);
});
test('previous session weights follow the current unit without changing history',()=>{
 const d=completed();d.settings.unit='lb';const before=clone(d.workouts);
 const w=startWorkout(d.routines[0],d.workouts);
 assert.equal(displayWeight(w.exercises[0].sets[0].weight,d.settings.unit),132.28);
 d.settings.unit='kg';assert.equal(displayWeight(w.exercises[0].sets[0].weight,d.settings.unit),60);
 assert.deepEqual(d.workouts,before);
});

test('deleting history removes its contribution to counts, volume and records on reload',async()=>{
 const {removeWorkout}=await import('../model.mjs');const d=completed();
 const second=clone(d.workouts[0]);second.id='second-workout';second.exercises[0].sets[0].weight=80;d.workouts.push(second);d.active=startWorkout(d.routines[1]);
 const remaining=removeWorkout(d,second.id),reopened=validateData(JSON.parse(JSON.stringify(remaining)));
 assert.equal(reopened.workouts.length,1);
 assert.equal(reopened.workouts.reduce((sum,w)=>sum+workoutStats(w).volume,0),480);
 assert.equal(Math.max(...reopened.workouts.flatMap(w=>w.exercises.flatMap(e=>e.sets.filter(s=>s.done&&s.type==='working').map(s=>s.weight)))),60);
 assert.equal(reopened.active.id,d.active.id);assert.equal(d.workouts.length,2);
 assert.equal(removeWorkout(reopened,reopened.workouts[0].id).workouts.length,0);
});

test('pull-ups keep reps-only history and track only the extra load for weighted sets',()=>{
 const data=completed();
 const pullup=newExercise(LIBRARY.find(exercise=>exercise.id==='pullup'));
 pullup.sets=[
  newSet({reps:8,done:true}),
  newSet({weight:0,reps:6,done:true}),
  newSet({weight:10,reps:5,done:true}),
  newSet({weight:5,reps:3,type:'warmup',done:true}),
  newSet({weight:15,reps:5}),
 ];
 data.workouts[0].exercises=[pullup];
 const loaded=validateData(JSON.parse(JSON.stringify(data)));
 const workout=loaded.workouts[0];
 assert(usesAddedWeight(workout.exercises[0]));
 assert.equal(workout.exercises[0].sets[0].weight,null);
 assert.equal(workoutStats(workout).sets,4);
 assert.equal(workoutStats(workout).volume,50);
 assert.match(toCSV(loaded),/"Pull-up","3","working","10","5"/);

 const next=startWorkout({name:'Pull',exercises:[pullup]},loaded.workouts);
 assert.equal(next.exercises[0].sets[0].weight,null);
 assert.equal(next.exercises[0].sets[2].weight,10);
 assert.equal(next.exercises[0].sets[2].done,false);
});

test('saved pull-up name variants expose added weight without changing the exercise ID',()=>{
 const data=completed();
 const previous=data.workouts[0].exercises[0];
 Object.assign(previous,{exerciseId:'custom-pull',name:'Pullups',mode:'bodyweight'});
 previous.sets=[newSet({weight:5,reps:6,done:true})];
 const loaded=validateData(JSON.parse(JSON.stringify(data))).workouts[0];
 for(const name of ['Pullup','Pull-ups','Pull Ups','Weighted Pull-up','Pullups (weighted)']){
  assert(usesAddedWeight({...loaded.exercises[0],name}),name);
 }
 assert(!usesAddedWeight({...loaded.exercises[0],name:'Band-assisted pull-up'}));
 assert(!usesAddedWeight({...loaded.exercises[0],name:'Dip'}));
 assert.equal(loaded.exercises[0].exerciseId,'custom-pull');
 assert.equal(workoutStats(loaded).volume,30);
});

test('an explicit pull-up routine load, including zero, takes priority over previous weight',()=>{
 const data=completed();
 const pullup=newExercise(LIBRARY.find(exercise=>exercise.id==='pullup'));
 const history=clone(pullup);
 history.sets=history.sets.map(set=>({...set,weight:10,reps:5,done:true}));
 data.workouts[0].exercises=[history];
 pullup.sets[0].weight=5;
 pullup.sets[1].weight=0;
 const exercise=startWorkout({exercises:[pullup]},data.workouts).exercises[0];
 assert.deepEqual(exercise.sets.map(set=>set.weight),[5,0,10]);
});
