import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(resolve(root,file),"utf8");
const expected=[
"frost","void","script","brat","scrawl","slam","fly","crossfade","read","settle","ember","spark",
"bubblegum","stamp","slice","swash","round","brush","spin","neon","ink","dust",
"typewriter","liquid","editorial","depth","flip","lineslide","sweep","elastic","bloom","curtain",
"blinds","iris","diagonal","window","rollup","peel","sliceopen","glide","blurresolve","wave",
"scramble","tracking","kerning","centerstagger","edgestagger","falldown","riseup","jello","scatter",
"cylinder","depthecho","converge","tumble","parallax","holographic","glitch","chromatic","neonglow",
"liquidfill","goldfoil","aurora","spotlight","splitflap","marquee","splitreveal","punch","beat",
"skew","odometer","spiral"
];
assert.equal(expected.length,72);
const sandbox={window:{},console,Math,Number,String,Array,Object,Map,Set,Intl};
sandbox.window.window=sandbox.window;
vm.createContext(sandbox);
vm.runInContext(read("app/effects/manifest.js"),sandbox,{filename:"manifest.js"});
const manifest=sandbox.window.KEFE_EFFECTS;
assert.equal(manifest.length,73,"Apple plus the 72 supplied effects must be listed");
assert.equal(manifest[0].key,"apple","Apple must remain first and unchanged");
const manifestKeys=manifest.map(item=>item.key);
assert.equal(new Set(manifestKeys).size,manifestKeys.length,"effect keys must be unique");
assert.equal(new Set(manifest.map(item=>item.label)).size,manifest.length,"effect labels must be unique");
assert.deepEqual(manifestKeys.slice(1),expected,"manifest must contain the complete supplied collection in order");

const editor=read("editor.source.html");
assert.match(editor,/<meta name="kefe-lyric-effects" content="72">/);
assert.match(editor,/effects\/manifest\.js/);
assert.match(editor,/lyric-signature-pack\.js/);
assert.match(editor,/lyric-apple\.js/);
assert.match(editor,/lyric-karaoke\.js/);
assert.match(editor,/core\.js[^]*lyric-signature-pack\.js/);
const editorSource=read("app/editor.js");
assert.ok(editorSource.includes("EFFECT_PREVIEW_PHRASE='The quick brown fox jumps over the lazy dog.'"));
assert.match(editorSource,/if\(settings\.mode!=='line'\)lyricStudio\.applySettings\(\{\.\.\.settings,mode:'line'\}\)/);
assert.match(editorSource,/effectDefinitions\.filter\(\(\[id\]\)=>id!=='karaoke'&&id!=='bounce'\)\.forEach\(\(\[id,label\]\)=>addLyricEffectOption\(id,label\)\)/);

function makeContext(){
  const counter={fills:0},gradient={addColorStop(){}};
  const ctx={
    canvas:{width:1280,height:720},font:"700 80px sans-serif",textAlign:"start",textBaseline:"alphabetic",
    fillStyle:"#fff",strokeStyle:"#fff",globalAlpha:1,lineWidth:1,shadowColor:"transparent",shadowBlur:0,
    filter:"none",letterSpacing:"0px",globalCompositeOperation:"source-over",lineCap:"butt",lineJoin:"miter",
    save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},setTransform(){},resetTransform(){},
    beginPath(){},closePath(){},moveTo(){},lineTo(){},arc(){},arcTo(){},ellipse(){},bezierCurveTo(){},
    quadraticCurveTo(){},rect(){},roundRect(){},clip(){},
    fill(){counter.fills++},stroke(){counter.fills++},fillRect(){counter.fills++},strokeRect(){},clearRect(){},
    fillText(){counter.fills++},strokeText(){counter.fills++},
    measureText(text){const size=Number((/(\d+(?:\.\d+)?)px/.exec(String(this.font))||[])[1]||20);return{width:Array.from(String(text)).length*size*.52}},
    createLinearGradient(){return gradient},createRadialGradient(){return gradient},createConicGradient(){return gradient},
    createPattern(){return null},drawImage(){counter.fills++},setLineDash(){},getLineDash(){return[]},
    get fills(){return counter.fills},resetFills(){counter.fills=0}
  };
  return ctx;
}
const runtime={
  console,Math,Number,String,Array,Object,Date,Map,Set,Intl,
  CustomEvent:class CustomEvent{constructor(type){this.type=type}},
  dispatchEvent(){},addEventListener(){},
  document:{
    readyState:"complete",addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},
    createElement(tag){
      if(tag==="canvas"){const canvas={width:1,height:1,style:{}};canvas.getContext=()=>Object.assign(makeContext(),{canvas});return canvas;}
      return{style:{},setAttribute(){},appendChild(){}};
    }
  }
};
runtime.window=runtime;runtime.globalThis=runtime;
vm.createContext(runtime);
vm.runInContext(read("app/effects/core.js"),runtime,{filename:"core.js"});
vm.runInContext(read("app/effects/lyric-premium-kit.js"),runtime,{filename:"lyric-premium-kit.js"});
vm.runInContext(read("app/effects/lyric-signature-pack.js"),runtime,{filename:"lyric-signature-pack.js"});
const words=[
{text:"BURN",time:1,endTime:1.5},
{text:"IT",time:1.5,endTime:1.8},
{text:"DOWN",time:1.8,endTime:2.6}
];
const lines=[{text:"BURN IT DOWN",time:1,endTime:2.9,words}];
const plainLines=[{text:"NO WORD TIMINGS",time:0,endTime:3},{text:"SECOND LINE",time:3,endTime:5}];
for(const key of expected){
  assert.equal(typeof runtime.kefeEffects[key],"function",key+" renderer must register");
  const style={effect:key,fontSize:84,kefeMotionFont:"Open Sans"};
  for(const [w,h,sample,time] of [[1280,720,lines,1.6],[360,640,lines,2.2],[1280,720,plainLines,3.4]]){
    const ctx=makeContext();
    runtime.kefeEffects[key](ctx,w,h,style,sample,time,null);
    assert.ok(ctx.fills>0,key+" must paint on "+w+"x"+h+" at t="+time);
  }
  const empty=makeContext();
  runtime.kefeEffects[key](empty,1280,720,style,[],1.6,null);
  assert.equal(empty.fills,0,key+" must ignore empty lyric data");
}
vm.runInContext(read("app/effects/lyric-apple.js"),runtime,{filename:"lyric-apple.js"});
assert.equal(typeof runtime.kefeEffects.apple,"function","Apple renderer must remain independently registered");
const apple=makeContext();
runtime.kefeEffects.apple(apple,1280,720,{effect:"apple",fontSize:84},lines,1.6,null);
assert.ok(apple.fills>0,"Apple renderer must keep painting");
vm.runInContext(read("app/effects/lyric-karaoke.js"),runtime,{filename:"lyric-karaoke.js"});
for(const key of ["karaoke","bounce"]){
  const ctx=makeContext();
  runtime.kefeEffects[key](ctx,1280,720,{effect:key,fontSize:84},lines,1.6);
  assert.ok(ctx.fills>0,key+" renderer must keep painting");
}
console.log("Verified Apple + 72 supplied effects + Karaoke/Bounce: roster, wiring, song-time rendering, desktop/mobile frames and empty-lyrics safety.");
