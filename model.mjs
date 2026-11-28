export const uid = () => globalThis.crypto.randomUUID();
export const MODES = {weight:'Weight & reps',bodyweight:'Bodyweight reps',duration:'Duration',distance:'Distance & time'};
export const THEMES=Object.freeze({
  system:'System',
  light:'Light',
  dark:'Dark',
  ocean:'Ocean',
  lavender:'Lavender',
  ember:'Ember',
  midnight:'Midnight',
  rose:'Rose',
  solar:'Solar',
  'deep-sea':'Deep Sea',
  plum:'Plum',
  graphite:'Graphite'
});
export const clone = value => structuredClone(value);
export const toKg = (v, unit) => v === '' || v == null ? null : Number(v) / (unit === 'lb' ? 2.2046226218 : 1);
export const displayWeight = (v, unit) => v == null ? '' : Number((v * (unit === 'lb' ? 2.2046226218 : 1)).toFixed(2));
export function newSet(previous = {}) { return {id:uid(),type:'working',weight:null,reps:null,seconds:null,distance:null,done:false,...previous}; }
export function newExercise(item) { return {id:uid(),exerciseId:item.id,name:item.name,mode:item.mode,rest:90,notes:'',sets:[newSet(),newSet(),newSet()]}; }
export const LIBRARY = [
['bench','Bench press','Chest','weight'],['incline','Incline dumbbell press','Chest','weight'],['fly','Cable fly','Chest','weight'],['pushup','Push-up','Chest','bodyweight'],
['row','Barbell row','Back','weight'],['cable-row','Seated cable row','Back','weight'],['lat','Lat pulldown','Back','weight'],['pullup','Pull-up','Back','bodyweight'],['db-row','Dumbbell row','Back','weight'],
['ohp','Overhead press','Shoulders','weight'],['db-press','Dumbbell shoulder press','Shoulders','weight'],['lateral','Lateral raise','Shoulders','weight'],['facepull','Face pull','Shoulders','weight'],
['squat','Barbell squat','Legs','weight'],['deadlift','Deadlift','Legs','weight'],['rdl','Romanian deadlift','Legs','weight'],['legpress','Leg press','Legs','weight'],['lunge','Dumbbell lunge','Legs','weight'],['legcurl','Leg curl','Legs','weight'],['extension','Leg extension','Legs','weight'],['calf','Calf raise','Legs','weight'],['hipthrust','Hip thrust','Legs','weight'],
['curl','Dumbbell curl','Arms','weight'],['hammer','Hammer curl','Arms','weight'],['tricep','Triceps pushdown','Arms','weight'],['dip','Dip','Arms','bodyweight'],['plank','Plank','Core','duration'],['crunch','Crunch','Core','bodyweight'],['raise','Hanging leg raise','Core','bodyweight'],['run','Running','Cardio','distance'],['bike','Cycling','Cardio','distance'],['rowing','Rowing machine','Cardio','distance']
].map(([id,name,muscle,mode])=>({id,name,muscle,mode}));
export function initialData() {
const routine=(name,ids)=>({id:uid(),name,notes:'',exercises:ids.map(id=>newExercise(LIBRARY.find(x=>x.id===id)))});
return {schema:1,settings:{unit:'kg',theme:'system',rest:90},customExercises:[],routines:[routine('Upper body A',['bench','row','db-press','lat','curl']),routine('Lower body A',['squat','rdl','legcurl','calf'])],workouts:[],active:null};
}
export function routineForWorkout(routines,workout){
  if(Object.hasOwn(workout,'routineId'))return routines.find(routine=>routine.id===workout.routineId);
  // Older sessions saved only a name. Use it when it identifies a single routine.
  const name=workout.name.trim().toLowerCase();
  const matches=routines.filter(routine=>routine.name.trim().toLowerCase()===name);
  return matches.length===1?matches[0]:undefined;
}

export function nextRoutine(routines,workouts){
  if(routines.length===0)return undefined;
  let lastIndex=-1;
  let lastCompletedAt=-Infinity;
  for(const workout of workouts){
    const completedAt=Date.parse(workout.endedAt);
    if(!Number.isFinite(completedAt)||completedAt<lastCompletedAt)continue;
    const routine=routineForWorkout(routines,workout);
    if(!routine)continue;
    lastIndex=routines.indexOf(routine);
    lastCompletedAt=completedAt;
  }
  return routines[(lastIndex+1)%routines.length];
}

export function startWorkout(template,history=[],routineId=template?.id??null) {
const w={id:uid(),routineId,name:template?.name||'Freestyle workout',notes:template?.notes||'',startedAt:new Date().toISOString(),endedAt:null,restEnd:null,exercises:clone(template?.exercises||[])};
for(const exercise of w.exercises){
  exercise.id=uid();
  const last=[...history].sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt))
    .flatMap(workout=>workout.exercises).find(item=>item.exerciseId===exercise.exerciseId);
  const prior=last?.sets.filter(set=>set.done&&set.type!=='warmup')||[];
  exercise.sets=exercise.sets.map((set,index)=>{
    const previous=prior[index];
    const recalledWeight=previous?previous.weight:set.weight;
    const weight=usesAddedWeight(exercise)?set.weight??recalledWeight:recalledWeight;
    return newSet({
      ...set,id:uid(),weight:weight??null,done:false,
      reps:previous?previous.reps:set.reps,
      seconds:previous?previous.seconds:set.seconds,
      distance:previous?previous.distance:set.distance
    });
  });
}
return w;
}
export function validSet(set,mode) {
const positive=k=>Number.isFinite(set[k])&&set[k]>0; const reps=()=>positive('reps')&&Number.isInteger(set.reps);
return mode==='weight' ? Number.isFinite(set.weight)&&set.weight>=0&&reps() : mode==='bodyweight'?reps():mode==='duration'?positive('seconds'):positive('seconds')&&positive('distance');
}
export function usesAddedWeight(exercise){
  if(exercise.mode!=='bodyweight')return false;
  if((exercise.exerciseId??exercise.id)==='pullup')return true;
  const name=exercise.name.toLowerCase().replace(/[^a-z]/g,'');
  return /^(?:(?:weighted|bodyweight)?pullups?|pullups?weighted)$/.test(name);
}
export function workoutStats(workout){
  let sets=0,volume=0;
  for(const exercise of workout.exercises){
    const tracksWeight=exercise.mode==='weight'||usesAddedWeight(exercise);
    for(const set of exercise.sets){
      if(!set.done)continue;
      sets++;
      if(tracksWeight&&set.type!=='warmup')volume+=(set.weight??0)*(set.reps??0);
    }
  }
  const elapsed=Date.parse(workout.endedAt||new Date())-Date.parse(workout.startedAt);
  return {sets,volume,minutes:Math.max(0,Math.round(elapsed/60000))};
}
function assert(ok,message){if(!ok)throw new Error(message);}
function text(v,max=200){assert(typeof v==='string'&&v.length<=max,'Invalid or overly long text.');return v;}
function numeric(v,max=1e7){assert(v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max),'Invalid numeric value.');return v;}
function date(v){assert(typeof v==='string'&&Number.isFinite(Date.parse(v)),'Invalid workout date.');return new Date(v).toISOString();}
function sets(input){assert(Array.isArray(input)&&input.length<=500,'Invalid set list.');return input.map(s=>{assert(s&&typeof s==='object','Invalid set.');const out={id:text(s.id),type:['working','warmup','drop','failure'].includes(s.type)?s.type:'working',weight:numeric(s.weight),reps:numeric(s.reps,10000),seconds:numeric(s.seconds,864000),distance:numeric(s.distance),done:s.done===true};assert(out.reps===null||Number.isInteger(out.reps),'Reps must be whole numbers.');return out;});}
function exercises(input){assert(Array.isArray(input)&&input.length<=200,'Invalid exercise list.');const out=input.map(e=>{assert(e&&MODES[e.mode],'Invalid exercise type.');const result={id:text(e.id),exerciseId:text(e.exerciseId),name:text(e.name),mode:e.mode,rest:numeric(e.rest,3600)??90,notes:text(e.notes||'',10000),sets:sets(e.sets)};assert(result.sets.every(s=>!s.done||validSet(s,result.mode)),'A completed set is missing valid values.');unique(result.sets);return result;});unique(out);return out;}
function unique(items){assert(new Set(items.map(x=>x.id)).size===items.length,'Duplicate IDs found in backup.');}
export function validateData(raw) {
assert(raw&&raw.schema===1,'Unsupported backup. Choose a Lift JSON backup (version 1).');
assert(Array.isArray(raw.workouts)&&raw.workouts.length<=20000,'Invalid workout history.');assert(Array.isArray(raw.routines)&&raw.routines.length<=1000,'Invalid routines.');assert(Array.isArray(raw.customExercises)&&raw.customExercises.length<=5000,'Invalid custom exercises.');
const cleanWorkout=(workout,active=false)=>{
  assert(workout&&typeof workout==='object','Invalid workout.');
  const startedAt=date(workout.startedAt),endedAt=active?null:date(workout.endedAt);
  assert(!endedAt||Date.parse(endedAt)>=Date.parse(startedAt),'Workout ends before it starts.');
  const result={
    id:text(workout.id),name:text(workout.name),notes:text(workout.notes||'',10000),
    startedAt,endedAt,restEnd:active?numeric(workout.restEnd,1e15):null,
    exercises:exercises(workout.exercises)
  };
  if(Object.hasOwn(workout,'routineId')){
    result.routineId=workout.routineId===null?null:text(workout.routineId);
  }
  return result;
};
const result={schema:1,settings:{unit:raw.settings?.unit==='lb'?'lb':'kg',theme:Object.hasOwn(THEMES,raw.settings?.theme)?raw.settings.theme:'system',rest:numeric(raw.settings?.rest??90,3600)??90},customExercises:raw.customExercises.map(e=>{assert(e&&MODES[e.mode],'Invalid custom exercise.');return {id:text(e.id),name:text(e.name),muscle:text(e.muscle||'Custom'),mode:e.mode};}),routines:raw.routines.map(r=>({id:text(r.id),name:text(r.name),notes:text(r.notes||'',10000),exercises:exercises(r.exercises)})),workouts:raw.workouts.map(w=>cleanWorkout(w)),active:raw.active?cleanWorkout(raw.active,true):null};
unique(result.workouts);unique(result.routines);unique(result.customExercises);assert(!result.active||!result.workouts.some(w=>w.id===result.active.id),'Active workout already exists in history.');return result;
}
export function mergeData(local,incoming){const add=(a,b)=>[...a,...b.filter(x=>!a.some(y=>y.id===x.id))];return validateData({...local,workouts:add(local.workouts,incoming.workouts),routines:add(local.routines,incoming.routines),customExercises:add(local.customExercises,incoming.customExercises),active:local.active||(!local.workouts.some(w=>w.id===incoming.active?.id)?incoming.active:null)});}
export function toCSV(data,unit='kg') {
const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';const safeText=v=>/^[=+\-@\t\r]/.test(String(v))?"'"+v:v;
const rows=[['workout_id','workout','started_at','ended_at','exercise','set','type','weight_'+unit,'reps','seconds','distance_km','notes']];
for(const w of data.workouts)for(const e of w.exercises)e.sets.forEach((s,i)=>{if(s.done)rows.push([w.id,safeText(w.name),w.startedAt,w.endedAt,safeText(e.name),i+1,s.type,displayWeight(s.weight,unit),s.reps,s.seconds,s.distance,safeText([w.notes,e.notes].filter(Boolean).join(' / '))]);});
return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n');
}

export function removeWorkout(data,id){return {...data,workouts:data.workouts.filter(w=>w.id!==id)};}
