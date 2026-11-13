import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>fs.readFileSync(resolve(root,path),"utf8");
const manifestSource=read("app/effects/manifest.js");
const manifestSandbox={window:{}};
vm.createContext(manifestSandbox);
vm.runInContext(manifestSource,manifestSandbox);
const manifest=manifestSandbox.window.KEFE_EFFECTS;
assert.equal(manifest.length,73,"Apple plus 72 supplied effects");
assert.equal(new Set(manifest.map(item=>item.key)).size,73,"unique effect keys");
assert.equal(manifest[0].key,"apple");
const keys=manifest.slice(1).map(item=>item.key);
const html=read("editor.source.html");
assert.match(html,/meta name="kefe-lyric-effects" content="72"/);
assert.match(html,/effects\/lyric-combined-pack\.js/);
for(const old of ["lyric-premium-kit.js","lyric-signature-pack.js","lyric-signature-four.js","lyric-text-swap.js","lyric-pull.js"])assert.doesNotMatch(html,new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
const editor=read("app/editor.js");
assert.match(editor,/effectDefinitions\.filter\(\(\[id\]\)=>id!=='karaoke'&&id!=='bounce'\)/);
assert.match(editor,/addLyricEffectOption\('karaoke','Karaoke'\)/);
assert.match(editor,/addLyricEffectOption\('bounce','Bounce Karaoke'\)/);

function context(){
 const gradient={addColorStop(){}};
 return {canvas:{width:1280,height:720},font:"700 80px sans-serif",textAlign:"start",textBaseline:"alphabetic",fillStyle:"#fff",strokeStyle:"#fff",globalAlpha:1,lineWidth:1,shadowColor:"transparent",shadowBlur:0,filter:"none",letterSpacing:"0px",globalCompositeOperation:"source-over",lineCap:"butt",lineJoin:"miter",
 save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},setTransform(){},resetTransform(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},arc(){},arcTo(){},ellipse(){},bezierCurveTo(){},quadraticCurveTo(){},rect(){},roundRect(){},clip(){},fill(){},stroke(){},fillRect(){},strokeRect(){},clearRect(){},fillText(){this.paints=(this.paints||0)+1;},strokeText(){this.paints=(this.paints||0)+1;},
 measureText(t){const size=Number((/(\\d+(?:\\.\\d+)?)px/.exec(String(this.font))||[])[1]||20);return {width:Array.from(String(t)).length*size*.52};},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;},createConicGradient(){return gradient;},createPattern(){return null;},drawImage(){},setLineDash(){},getLineDash(){return [];}};
}
const runtime={console,Math,Number,String,Array,Object,Date,Map,Set,Intl,CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(){}};
runtime.window=runtime;runtime.globalThis=runtime;vm.createContext(runtime);
vm.runInContext(read("app/effects/core.js"),runtime);
vm.runInContext(read("app/effects/lyric-combined-pack.js"),runtime);
assert.equal(JSON.stringify(Object.keys(runtime.kefeEffects).sort()),JSON.stringify(Array.from(keys).sort()),"renderer registry exactly matches the supplied roster");
const timed=[{text:"BURN IT DOWN",time:1,endTime:3,words:[{text:"BURN",time:1,endTime:1.5},{text:"IT",time:1.5,endTime:2},{text:"DOWN",time:2,endTime:3}]}];
const untimed=[{text:"NO WORD TIMINGS",time:0,endTime:3},{text:"SECOND LINE",time:3,endTime:5}];
for(const key of keys){
 for(const [w,h,lines,time] of [[1280,720,timed,1.7],[360,640,timed,2.2],[1280,720,untimed,3.4]]){
  const ctx=context();runtime.kefeEffects[key](ctx,w,h,{effect:key,fontSize:84,kefeMotionFont:"Open Sans"},lines,time);
  assert.ok(ctx.paints>0,key+" must render timed and untimed lyrics on desktop and mobile");
 }
 const empty=context();runtime.kefeEffects[key](empty,1280,720,{fontSize:84},[],1);
 assert.equal(empty.paints||0,0,key+" must safely ignore empty lyrics");
}
vm.runInContext(read("app/effects/lyric-apple.js"),runtime);
assert.equal(typeof runtime.kefeEffects.apple,"function","Apple renderer retained");
vm.runInContext(read("app/effects/lyric-karaoke.js"),runtime);
for(const key of ["karaoke","bounce"])assert.equal(typeof runtime.kefeEffects[key],"function",key+" renderer retained");
console.log("PASS: Apple + 72 supplied effects + Karaoke/Bounce; unique registry, script wiring, desktop/mobile, timed/untimed and empty-lyrics paths.");
