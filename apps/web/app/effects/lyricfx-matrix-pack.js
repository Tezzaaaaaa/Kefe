/* KEFE — LyricFX Matrix Studio canvas treatments.
   Adapted from the supplied 50-effect reference to song-time and word timing. */
(() => {
'use strict';
const U=window.kefeEffectUtils,E=window.kefeEffects=window.kefeEffects||{};
if(!U){console.error('[lyricfx-matrix] effects/core.js is required');return;}
const clamp=U.clamp,seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const specs=[{"key":"lf-karaoke-sweep","label":"Karaoke Sweep","category":"kinetic","variant":0},{"key":"lf-line-focus","label":"Line Focus","category":"minimal","variant":1},{"key":"lf-smooth-glide","label":"Smooth Glide","category":"minimal","variant":2},{"key":"lf-blur-unveil","label":"Blur Unveil","category":"glow","variant":3},{"key":"lf-neon-glow","label":"Neon Glow","category":"glow","variant":4},{"key":"lf-kinetic-pop","label":"Kinetic Pop","category":"kinetic","variant":5},{"key":"lf-typewriter","label":"Typewriter (LyricFX)","category":"cyber","variant":6},{"key":"lf-sustain-pulse","label":"Sustain Pulse","category":"glow","variant":7},{"key":"lf-3d-tilt","label":"3D Tilt","category":"cyber","variant":8},{"key":"lf-genre-theme","label":"Genre Theme","category":"minimal","variant":9},{"key":"lf-chromatic-split","label":"Chromatic Split","category":"cyber","variant":10},{"key":"lf-waveform-stretch","label":"Waveform Stretch","category":"kinetic","variant":11},{"key":"lf-liquid-ink","label":"Liquid Ink","category":"glow","variant":12},{"key":"lf-laser-sweep","label":"Laser Sweep","category":"cyber","variant":13},{"key":"lf-tunnel-zoom","label":"Tunnel Zoom","category":"cyber","variant":14},{"key":"lf-particle-dissolve","label":"Particle Dissolve","category":"glow","variant":15},{"key":"lf-strobe-shutter","label":"Strobe Shutter","category":"cyber","variant":16},{"key":"lf-zero-gravity","label":"Zero Gravity","category":"minimal","variant":17},{"key":"lf-cyber-hud","label":"Cyber HUD","category":"cyber","variant":18},{"key":"lf-harmony-split","label":"Harmony Split","category":"minimal","variant":19},{"key":"lf-holo-flare","label":"Holo Flare","category":"glow","variant":20},{"key":"lf-vinyl-groove","label":"Vinyl Groove","category":"minimal","variant":21},{"key":"lf-matrix-stream","label":"Matrix Stream","category":"cyber","variant":22},{"key":"lf-lightning-arc","label":"Lightning Arc","category":"kinetic","variant":23},{"key":"lf-neon-marquee","label":"Neon Marquee","category":"cyber","variant":24},{"key":"lf-crystal-glass","label":"Crystal Glass","category":"glow","variant":25},{"key":"lf-thermal-heat","label":"Thermal Heat","category":"cyber","variant":26},{"key":"lf-seismic-tremor","label":"Seismic Tremor","category":"kinetic","variant":27},{"key":"lf-velvet-shadow","label":"Velvet Shadow","category":"glow","variant":28},{"key":"lf-supernova-flare","label":"Supernova Flare","category":"glow","variant":29},{"key":"lf-anamorphic-streak","label":"Anamorphic Streak","category":"rare glow","variant":30},{"key":"lf-spatial-doppler","label":"Spatial Doppler","category":"rare kinetic","variant":31},{"key":"lf-quantum-shift","label":"Quantum Shift","category":"rare cyber","variant":32},{"key":"lf-biolumen-ripple","label":"Biolumen Ripple","category":"rare glow","variant":33},{"key":"lf-crt-phosphor","label":"CRT Phosphor","category":"rare cyber","variant":34},{"key":"lf-aurora-wave","label":"Aurora Wave","category":"rare glow","variant":35},{"key":"lf-prism-reflection","label":"Prism Reflection","category":"rare glow","variant":36},{"key":"lf-solar-plasma","label":"Solar Plasma","category":"rare kinetic","variant":37},{"key":"lf-gravity-well","label":"Gravity Well","category":"rare cyber","variant":38},{"key":"lf-volumetric-fog","label":"Volumetric Fog","category":"rare glow","variant":39},{"key":"lf-ferrofluid-pulse","label":"Ferrofluid Pulse","category":"rare kinetic","variant":40},{"key":"lf-vhs-tracking","label":"VHS Tracking (LyricFX)","category":"rare cyber","variant":41},{"key":"lf-vaporwave-grid","label":"Vaporwave Grid","category":"rare cyber","variant":42},{"key":"lf-cyber-weave","label":"Cyber Weave","category":"rare cyber","variant":43},{"key":"lf-frost-bloom","label":"Frost Bloom","category":"rare glow","variant":44},{"key":"lf-golden-bokeh","label":"Golden Bokeh","category":"rare glow","variant":45},{"key":"lf-kinetic-wave","label":"Kinetic Wave","category":"rare kinetic","variant":46},{"key":"lf-nebula-burn","label":"Nebula Burn","category":"rare glow","variant":47},{"key":"lf-acid-liquid","label":"Acid Liquid","category":"rare glow","variant":48},{"key":"lf-cyber-equalizer","label":"Cyber Equalizer","category":"rare kinetic","variant":49}];
const colours=['#38bdf8','#c084fc','#f43f5e','#34d399','#fbbf24','#818cf8','#fb923c'];
function render(ctx,w,h,style,lines,time,s){
 if(!Array.isArray(lines)||!lines.length)return;
 U.lineStack(lines,time,.22,.2).forEach(item=>{
  const text=String(item.line?.text||'').replace(/\s+/g,' ').trim();if(!text)return;
  const c=window.KEFE_TYPE?.effects?.[s.key]||{},size=Math.min(Number(style.fontSize)||Math.min(w,h)*.15,Math.min(w,h)*.22);
  const lay=U.layoutText(ctx,text,{setFont:(target,n)=>U.setFont(target,style.kefeMotionFont||c.family||'Open Sans',n,c.weight||700),size,minSize:16,maxWidth:w*.88,maxHeight:h*.64,lineHeight:1.06,maxLines:3});
  U.setFont(ctx,style.kefeMotionFont||c.family||'Open Sans',lay.size,c.weight||700);
  const words=U.wordsFor(item.line,item.next),map=U.charMap(lay.lines,words),local=Math.max(0,time-(Number(item.line.time)||0));
  ctx.save();ctx.globalAlpha*=clamp(item.alpha);ctx.textAlign='center';ctx.textBaseline='middle';
  const top=(h-lay.blockH)/2+lay.lineH*.5;
  if(['lf-vinyl-groove','lf-biolumen-ripple','lf-gravity-well','lf-ferrofluid-pulse'].includes(s.key)){
   ctx.save();ctx.globalAlpha*=.2;ctx.strokeStyle=s.key==='lf-vinyl-groove'?'#c084fc':'#34d399';
   for(let n=0;n<5;n++){ctx.beginPath();ctx.arc(w/2,h/2,lay.size*(.7+n*.22)+Math.sin(local+n)*2,0,Math.PI*2);ctx.stroke();}ctx.restore();
  }
  if(['lf-cyber-hud','lf-cyber-weave','lf-vaporwave-grid'].includes(s.key)){
   ctx.save();ctx.globalAlpha*=.22;ctx.strokeStyle='#38bdf8';
   for(let n=0;n<9;n++){ctx.beginPath();ctx.moveTo(w*n/9,h*.18);ctx.lineTo(w*n/9,h*.9);ctx.stroke();}
   for(let n=0;n<7;n++){ctx.beginPath();ctx.moveTo(w*.08,h*n/7);ctx.lineTo(w*.92,h*n/7);ctx.stroke();}ctx.restore();
  }
  if(s.key==='lf-crt-phosphor'||s.key==='lf-vhs-tracking'){
   ctx.save();ctx.globalAlpha*=.12;ctx.fillStyle='#a3e635';for(let y=0;y<h;y+=5)ctx.fillRect(0,y,w,1);ctx.restore();
  }
  if(s.key==='lf-cyber-equalizer'){
   ctx.save();ctx.globalAlpha*=.35;ctx.fillStyle='#38bdf8';for(let n=0;n<32;n++){const bh=8+seed(n+Math.floor(local*5))*h*.14;ctx.fillRect(w*.2+n*w*.019,h*.85-bh,w*.009,bh);}ctx.restore();
  }
  lay.lines.forEach((row,ri)=>{
   const a=Array.from(row),x0=w/2-ctx.measureText(row).width/2,y=top+ri*lay.lineH,cells=map[ri]||[];
   a.forEach((original,i)=>{
    const before=ctx.measureText(a.slice(0,i).join('')).width,after=ctx.measureText(a.slice(0,i+1).join('')).width,cw=after-before,x=x0+before+cw/2,cell=cells[i],p=cell?clamp(U.charProgress(cell.word,cell.j,cell.n,time,.82,.34)):1,wp=cell?.word?U.wordProgress(cell.word,time,.08):{sweep:0,pulse:0};
    const wave=Math.sin(local*2.2+i*.55);let glyph=original,alpha=1,dx=0,dy=0,sx=1,sy=1,rot=0,blur=0,fill=style.textColor||'#f8fafc';
    switch(s.key){
     case 'lf-karaoke-sweep':fill=wp.sweep>.42?'#38bdf8':'rgba(248,250,252,.42)';break;
     case 'lf-line-focus':alpha=item.role==='prev'?.22:1;break;
     case 'lf-smooth-glide':dy=Math.sin(local*1.5)*lay.size*.08;break;
     case 'lf-blur-unveil':blur=(1-p)*lay.size*.12;alpha=.25+.75*p;break;
     case 'lf-neon-glow':case 'lf-liquid-ink':case 'lf-velvet-shadow':case 'lf-supernova-flare':case 'lf-solar-plasma':case 'lf-frost-bloom':case 'lf-nebula-burn':fill='#e0f2fe';break;
     case 'lf-kinetic-pop':sx=sy=1+Math.max(0,wp.pulse)*.22;dy=-Math.max(0,wp.pulse)*lay.size*.08;break;
     case 'lf-typewriter':alpha=p<.03?0:1;break;
     case 'lf-sustain-pulse':sx=1+wp.pulse*.08;sy=1+wp.pulse*.04;break;
     case 'lf-3d-tilt':rot=Math.sin(local)*.12;sy=.9+.1*Math.cos(local);break;
     case 'lf-genre-theme':fill=colours[s.variant%colours.length];break;
     case 'lf-chromatic-split':case 'lf-spatial-doppler':dx=wave*lay.size*.025;break;
     case 'lf-waveform-stretch':sy=1+Math.abs(wave)*.28;break;
     case 'lf-laser-sweep':fill=Math.abs(x/w-((local*.42)%1))<.08?'#fff':'rgba(248,250,252,.48)';break;
     case 'lf-tunnel-zoom':sx=sy=.88+.12*(.5+.5*Math.sin(local*1.4));break;
     case 'lf-particle-dissolve':alpha=.35+.65*p;dx=(seed(s.variant+i*7+Math.floor(local*8))-.5)*lay.size*.12;dy=(seed(s.variant+i*9)-.5)*lay.size*.1;break;
     case 'lf-strobe-shutter':alpha=Math.floor(local*7)%2?.45:1;break;
     case 'lf-zero-gravity':dy=Math.sin(local*1.3+i*.5)*lay.size*.12;rot=Math.sin(local+i)*.04;break;
     case 'lf-harmony-split':break;
     case 'lf-holo-flare':case 'lf-crystal-glass':case 'lf-aurora-wave':case 'lf-thermal-heat':case 'lf-prism-reflection':case 'lf-acid-liquid':fill=colours[(s.variant+i)%colours.length];break;
     case 'lf-matrix-stream':if(p<.92)glyph='01アイ'[Math.floor(seed(s.variant+i+Math.floor(local*12))*4)];fill='#86efac';break;
     case 'lf-neon-marquee':dx=Math.sin(local*.5)*lay.size*.08;fill='#f0abfc';break;
     case 'lf-seismic-tremor':dx=(seed(s.variant+i+Math.floor(local*15))-.5)*lay.size*.06;dy=(seed(s.variant+i+4+Math.floor(local*15))-.5)*lay.size*.06;break;
     case 'lf-anamorphic-streak':fill='#fff';break;
     case 'lf-quantum-shift':dx=(i%2?1:-1)*Math.sin(local*10)*lay.size*.035;fill=i%2?'#67e8f9':'#f0abfc';break;
     case 'lf-solar-plasma':fill='#fed7aa';break;
     case 'lf-gravity-well':{const d=(i-(a.length-1)/2)/Math.max(1,a.length);dx=-d*Math.abs(d)*lay.size*.3;dy=Math.abs(d)*lay.size*.06;break;}
     case 'lf-volumetric-fog':blur=(1-p)*lay.size*.09;alpha=.55+.45*p;fill='#e2e8f0';break;
     case 'lf-ferrofluid-pulse':sx=1+Math.max(0,wave)*.14;sy=1-Math.max(0,wave)*.1;fill='#c4b5fd';break;
     case 'lf-vaporwave-grid':fill='#f0abfc';break;
     case 'lf-golden-bokeh':fill='#fef3c7';break;
     case 'lf-kinetic-wave':dy=Math.sin(local*2+i*.6)*lay.size*.18;rot=Math.cos(local*2+i*.6)*.08;break;
    }
    ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.translate(x+dx,y+dy);ctx.rotate(rot);ctx.scale(Math.max(.03,sx),Math.max(.03,sy));if(blur&&'filter'in ctx)ctx.filter='blur('+blur+'px)';
    ctx.fillStyle=fill;ctx.shadowColor='transparent';ctx.shadowBlur=0;
    if(['lf-neon-glow','lf-liquid-ink','lf-velvet-shadow','lf-supernova-flare','lf-solar-plasma','lf-frost-bloom','lf-nebula-burn'].includes(s.key)){ctx.shadowColor=fill;ctx.shadowBlur=lay.size*.22;}
    if(s.key==='lf-chromatic-split'||s.key==='lf-spatial-doppler'){ctx.save();ctx.globalAlpha*=.42;ctx.fillStyle='#f43f5e';ctx.fillText(glyph,-cw/2-lay.size*.025,0);ctx.fillStyle='#38bdf8';ctx.fillText(glyph,-cw/2+lay.size*.025,0);ctx.restore();}
    if(s.key==='lf-crystal-glass'){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=Math.max(1,lay.size*.018);ctx.strokeText(glyph,-cw/2,0);}
    ctx.fillText(glyph,-cw/2,0);
    if(s.key==='lf-harmony-split'){ctx.save();ctx.globalAlpha*=.25;ctx.fillStyle='#38bdf8';ctx.fillText(glyph,-cw/2,lay.size*.18);ctx.restore();}
    ctx.restore();
   });
  });
  if(s.key==='lf-cyber-hud'){ctx.save();ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.strokeRect(w*.12,h*.25,w*.76,h*.5);ctx.restore();}
  if(s.key==='lf-anamorphic-streak'||s.key==='lf-laser-sweep'){ctx.save();ctx.globalAlpha*=.25;ctx.fillStyle='#a5f3fc';ctx.fillRect(((local*.5)%1)*w-lay.size*.04,h*.48,lay.size*.08,2);ctx.restore();}
  ctx.restore();
 });
}
specs.forEach(s=>{E[s.key]=(ctx,w,h,style,lines,time)=>render(ctx,w,h,style||{},lines,Number(time)||0,s);});
window.KEFE_LYRICFX_MATRIX_KEYS=specs.map(s=>s.key);
})();