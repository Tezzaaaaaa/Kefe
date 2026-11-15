/* KEFE native typography treatments adapted from the supplied Shadcn.io showcase.
   All 97 use KEFE's shared lyric/word clock and canvas renderer contract. */
(() => {
'use strict';
const U=window.kefeEffectUtils,E=window.kefeEffects=window.kefeEffects||{};
if(!U){console.error('[typography-effects] effects/core.js is required');return;}
const clamp=U.clamp,chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?',colours=['#f8fafc','#a5f3fc','#c4b5fd','#f9a8d4','#fcd34d','#86efac'];
const specs=[{"category":"Entrance","label":"Fade In","key":"ty-fade-in","variant":0},{"category":"Entrance","label":"Slide Up","key":"ty-slide-up","variant":1},{"category":"Entrance","label":"Slide Down","key":"ty-slide-down","variant":2},{"category":"Entrance","label":"Slide Left","key":"ty-slide-left","variant":3},{"category":"Entrance","label":"Slide Right","key":"ty-slide-right","variant":4},{"category":"Entrance","label":"Scale In","key":"ty-scale-in","variant":5},{"category":"Entrance","label":"Blur In","key":"ty-blur-in","variant":6},{"category":"Entrance","label":"Flip X","key":"ty-flip-x","variant":7},{"category":"Entrance","label":"Flip Y","key":"ty-flip-y","variant":8},{"category":"Entrance","label":"Rotate In","key":"ty-rotate-in","variant":9},{"category":"Entrance","label":"Bounce In","key":"ty-bounce-in","variant":10},{"category":"Entrance","label":"Elastic In","key":"ty-elastic-in","variant":11},{"category":"Entrance","label":"Zoom In","key":"ty-zoom-in","variant":12},{"category":"Entrance","label":"Zoom Out","key":"ty-zoom-out","variant":13},{"category":"Entrance","label":"Skew In","key":"ty-skew-in","variant":14},{"category":"Entrance","label":"Wipe In","key":"ty-wipe-in","variant":15},{"category":"Entrance","label":"Mask In","key":"ty-mask-in","variant":16},{"category":"Entrance","label":"Reveal Up","key":"ty-reveal-up","variant":17},{"category":"Entrance","label":"Drop In","key":"ty-drop-in","variant":18},{"category":"Entrance","label":"Float In","key":"ty-float-in","variant":19},{"category":"Loops & Beats","label":"Pulse","key":"ty-pulse","variant":20},{"category":"Loops & Beats","label":"Shake","key":"ty-shake","variant":21},{"category":"Loops & Beats","label":"Wobble","key":"ty-wobble","variant":22},{"category":"Loops & Beats","label":"Jello","key":"ty-jello","variant":23},{"category":"Loops & Beats","label":"Heartbeat","key":"ty-heartbeat","variant":24},{"category":"Loops & Beats","label":"Bounce Loop","key":"ty-bounce-loop","variant":25},{"category":"Loops & Beats","label":"Flash","key":"ty-flash","variant":26},{"category":"Loops & Beats","label":"Rubber Band","key":"ty-rubber-band","variant":27},{"category":"Loops & Beats","label":"Swing","key":"ty-swing","variant":28},{"category":"Loops & Beats","label":"Tada","key":"ty-tada","variant":29},{"category":"Loops & Beats","label":"Flip Loop","key":"ty-flip-loop","variant":30},{"category":"Loops & Beats","label":"Spin Loop","key":"ty-spin-loop","variant":31},{"category":"Kinetic Text","label":"Morph Text","key":"ty-morph-text","variant":32},{"category":"Kinetic Text","label":"Letter Fade","key":"ty-letter-fade","variant":33},{"category":"Kinetic Text","label":"Number Slide","key":"ty-number-slide","variant":34},{"category":"Kinetic Text","label":"Slide Cycle","key":"ty-slide-cycle","variant":35},{"category":"Kinetic Text","label":"Bounce Cycle","key":"ty-bounce-cycle","variant":36},{"category":"Kinetic Text","label":"Rotate Cycle","key":"ty-rotate-cycle","variant":37},{"category":"Kinetic Text","label":"Zoom Cycle","key":"ty-zoom-cycle","variant":38},{"category":"Kinetic Text","label":"Wave","key":"ty-wave","variant":39},{"category":"Decode & Data","label":"Scramble","key":"ty-scramble","variant":40},{"category":"Decode & Data","label":"Typewriter","key":"ty-typewriter","variant":41},{"category":"Decode & Data","label":"Binary","key":"ty-binary","variant":42},{"category":"Decode & Data","label":"Decrypt","key":"ty-decrypt","variant":43},{"category":"Decode & Data","label":"Cipher","key":"ty-cipher","variant":44},{"category":"Decode & Data","label":"Matrix Rain","key":"ty-matrix-rain","variant":45},{"category":"Decode & Data","label":"Glitch Decode","key":"ty-glitch-decode","variant":46},{"category":"Decode & Data","label":"Noise","key":"ty-noise","variant":47},{"category":"Decode & Data","label":"Signal","key":"ty-signal","variant":48},{"category":"Decode & Data","label":"Resolve","key":"ty-resolve","variant":49},{"category":"Decode & Data","label":"Count Up","key":"ty-count-up","variant":50},{"category":"Decode & Data","label":"Percentage","key":"ty-percentage","variant":51},{"category":"Decode & Data","label":"Money","key":"ty-money","variant":52},{"category":"Decode & Data","label":"Year","key":"ty-year","variant":53},{"category":"Decode & Data","label":"Leading Zero","key":"ty-leading-zero","variant":54},{"category":"Decode & Data","label":"Decimal","key":"ty-decimal","variant":55},{"category":"Decode & Data","label":"Progress","key":"ty-progress","variant":56},{"category":"Decode & Data","label":"Hex","key":"ty-hex","variant":57},{"category":"Decode & Data","label":"Answer","key":"ty-answer","variant":58},{"category":"Decode & Data","label":"Phone","key":"ty-phone","variant":59},{"category":"Surface & Finish","label":"Gradient Text","key":"ty-gradient-text","variant":60},{"category":"Surface & Finish","label":"Neon","key":"ty-neon","variant":61},{"category":"Surface & Finish","label":"Glitch Text","key":"ty-glitch-text","variant":62},{"category":"Surface & Finish","label":"Chrome","key":"ty-chrome","variant":63},{"category":"Surface & Finish","label":"Emboss","key":"ty-emboss","variant":64},{"category":"Surface & Finish","label":"Pressed","key":"ty-pressed","variant":65},{"category":"Surface & Finish","label":"Paper Cut","key":"ty-paper-cut","variant":66},{"category":"Surface & Finish","label":"Drop Cap","key":"ty-drop-cap","variant":67},{"category":"Surface & Finish","label":"Rainbow","key":"ty-rainbow","variant":68},{"category":"Surface & Finish","label":"Glow","key":"ty-glow","variant":69},{"category":"Surface & Finish","label":"Neon Green","key":"ty-neon-green","variant":70},{"category":"Typography Styles","label":"Monospace","key":"ty-monospace","variant":71},{"category":"Typography Styles","label":"Wide","key":"ty-wide","variant":72},{"category":"Typography Styles","label":"Italic","key":"ty-italic","variant":73},{"category":"Typography Styles","label":"Underline","key":"ty-underline","variant":74},{"category":"Typography Styles","label":"Strikethrough","key":"ty-strikethrough","variant":75},{"category":"Typography Styles","label":"Black Weight","key":"ty-black-weight","variant":76},{"category":"Typography Styles","label":"Case Cycle","key":"ty-case-cycle","variant":77},{"category":"Typography Styles","label":"Lowercase Cycle","key":"ty-lowercase-cycle","variant":78},{"category":"Typography Styles","label":"Capitalize Cycle","key":"ty-capitalize-cycle","variant":79},{"category":"Beat-Reactive Controls","label":"Magnet","key":"ty-magnet","variant":80},{"category":"Beat-Reactive Controls","label":"Pressure","key":"ty-pressure","variant":81},{"category":"Beat-Reactive Controls","label":"Hover Glow","key":"ty-hover-glow","variant":82},{"category":"Beat-Reactive Controls","label":"Scale Hover","key":"ty-scale-hover","variant":83},{"category":"Beat-Reactive Controls","label":"Expand","key":"ty-expand","variant":84},{"category":"Beat-Reactive Controls","label":"Color Shift","key":"ty-color-shift","variant":85},{"category":"Beat-Reactive Controls","label":"Italic Hover","key":"ty-italic-hover","variant":86},{"category":"Beat-Reactive Controls","label":"Underline Hover","key":"ty-underline-hover","variant":87},{"category":"Beat-Reactive Controls","label":"Tilt","key":"ty-tilt","variant":88},{"category":"Display & Texture","label":"Fade","key":"ty-fade","variant":89},{"category":"Display & Texture","label":"Outline","key":"ty-outline","variant":90},{"category":"Display & Texture","label":"LCD","key":"ty-lcd","variant":91},{"category":"Display & Texture","label":"Split Flap","key":"ty-split-flap","variant":92},{"category":"Display & Texture","label":"Liquid Fill","key":"ty-liquid-fill","variant":93},{"category":"Display & Texture","label":"Fire","key":"ty-fire","variant":94},{"category":"Display & Texture","label":"Ice","key":"ty-ice","variant":95},{"category":"Display & Texture","label":"Shadow Dance","key":"ty-shadow-dance","variant":96}];
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const mix=(a,b,t)=>{const p=v=>{const h=v.slice(1);return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0);};const A=p(a),B=p(b);return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*clamp(t))).join(',')+')';};
function draw(ctx,w,h,style,lines,time,s){
if(!Array.isArray(lines)||!lines.length)return;
U.lineStack(lines,time,.22,.2).forEach(item=>{
const text=String(item.line?.text||'').replace(/\s+/g,' ').trim();if(!text)return;
const c=window.KEFE_TYPE?.effects?.[s.key]||{},base=Math.min(Number(style.fontSize)||Math.min(w,h)*.15,Math.min(w,h)*.22);
const lay=U.layoutText(ctx,text,{setFont:(target,size)=>U.setFont(target,style.kefeMotionFont||c.family||'Open Sans',size,c.weight||700),size:base,minSize:16,maxWidth:w*.9,maxHeight:h*.66,lineHeight:c.lineHeight||1.06,maxLines:3,tracking:c.tracking||0});
U.setFont(ctx,style.kefeMotionFont||c.family||'Open Sans',lay.size,c.weight||700);
if('letterSpacing'in ctx)ctx.letterSpacing=(c.tracking||0)*lay.size+'px';
const words=U.wordsFor(item.line,item.next),map=U.charMap(lay.lines,words),local=Math.max(0,time-(Number(item.line.time)||0)),phase=local*1.4+s.variant*.11,cycle=(phase%6.28318530718)/6.28318530718;
ctx.save();ctx.globalAlpha*=clamp(item.alpha);ctx.textAlign='center';ctx.textBaseline='middle';
const top=(h-lay.blockH)/2+lay.lineH*.5;
lay.lines.forEach((row,ri)=>{
const width=ctx.measureText(row).width,x0=w/2-width/2,y=top+ri*lay.lineH,cells=map[ri]||[],a=Array.from(row);
a.forEach((original,i)=>{
const before=ctx.measureText(a.slice(0,i).join('')).width,after=ctx.measureText(a.slice(0,i+1).join('')).width,cw=after-before,x=x0+before+cw/2,cell=cells[i],raw=cell?U.charProgress(cell.word,cell.j,cell.n,time,.82,.34):1,p=clamp(raw),wp=cell?.word?U.wordProgress(cell.word,time,.08):{pulse:0},wave=Math.sin(phase+i*.47);
let glyph=original,alpha=1,dx=0,dy=0,sx=1,sy=1,rot=0,blur=0,fill=style.textColor||'#f8fafc';
ctx.fillStyle=style.textColor||'#f8fafc';ctx.shadowColor='transparent';ctx.shadowBlur=0;if('filter'in ctx)ctx.filter='none';
const key=s.key, enter=clamp(p), beat=Math.sin(local* Math.PI*2*1.15), loop=(local%2.2)/2.2, pulse=Math.sin(loop*Math.PI*2), stagger=i/Math.max(1,a.length-1);
switch(key){
case 'ty-fade-in': alpha=.1+.9*enter; break;
case 'ty-slide-up': alpha=enter; dy=(1-enter)*lay.size*.66; break;
case 'ty-slide-down': alpha=enter; dy=-(1-enter)*lay.size*.66; break;
case 'ty-slide-left': alpha=enter; dx=(1-enter)*lay.size*.8; break;
case 'ty-slide-right': alpha=enter; dx=-(1-enter)*lay.size*.8; break;
case 'ty-scale-in': alpha=enter; sx=sy=.5+.5*enter; break;
case 'ty-blur-in': alpha=enter; blur=(1-enter)*lay.size*.12; break;
case 'ty-flip-x': alpha=enter; sy=Math.max(.03,Math.abs(Math.cos((1-enter)*Math.PI/2))); break;
case 'ty-flip-y': alpha=enter; sx=Math.max(.03,Math.abs(Math.cos((1-enter)*Math.PI/2))); break;
case 'ty-rotate-in': alpha=enter; rot=(1-enter)*-Math.PI; sx=sy=.7+.3*enter; break;
case 'ty-bounce-in': {const q=enter; sx=sy=q<.7?.3+q*1.14:q<.86?1.1-(q-.7)*.65:1.0; alpha=enter; break;}
case 'ty-elastic-in': {const q=enter; sx=sy=q<.6?1.25*q/0.6:q<.8?1.25-(q-.6)*1.75:.9+(q-.8)*.5; alpha=enter; break;}
case 'ty-zoom-in': alpha=enter; sx=sy=.15+.85*enter; break;
case 'ty-zoom-out': alpha=enter; sx=sy=1.5-.5*enter; break;
case 'ty-skew-in': alpha=enter; rot=(1-enter)*.22; dx=(1-enter)*-lay.size*.12; break;
case 'ty-wipe-in': alpha=enter; sx=Math.max(.03,enter); break;
case 'ty-mask-in': alpha=enter; sx=sy=Math.max(.03,enter); break;
case 'ty-reveal-up': alpha=enter; sy=Math.max(.03,enter); dy=(1-enter)*lay.size*.22; break;
case 'ty-drop-in': alpha=enter; dy=-(1-enter)*lay.size*.95; sx=sy=.8+.2*enter; break;
case 'ty-float-in': alpha=enter; dy=(1-enter)*lay.size*.5; rot=(1-enter)*-.09; break;
case 'ty-pulse': alpha=.3+.7*(.5+.5*pulse); sx=1+.04*Math.max(0,pulse); sy=1+.04*Math.max(0,pulse); break;
case 'ty-shake': dx=Math.sin(loop*Math.PI*8)*lay.size*.045; break;
case 'ty-wobble': dx=Math.sin(loop*Math.PI*4)*lay.size*.065; rot=Math.sin(loop*Math.PI*4)*.08; break;
case 'ty-jello': sx=1+.13*Math.sin(loop*Math.PI*4); sy=1-.13*Math.sin(loop*Math.PI*4); rot=Math.sin(loop*Math.PI*4)*.025; break;
case 'ty-heartbeat': {const beatPhase=(local%1.25)/1.25; const beatScale=beatPhase<.14?1+beatPhase/.14*.22:beatPhase<.28?1.22-(beatPhase-.14)/.14*.22:beatPhase<.42?1+(beatPhase-.28)/.14*.22:beatPhase<.56?1.22-(beatPhase-.42)/.14*.22:1; sx=sy=beatScale; break;}
case 'ty-bounce-loop': dy=-Math.max(0,Math.sin(loop*Math.PI*2))*lay.size*.18; break;
case 'ty-flash': alpha=.12+.88*(.5+.5*Math.cos(loop*Math.PI*2)); break;
case 'ty-rubber-band': sx=1+.18*Math.sin(loop*Math.PI*2); sy=1-.18*Math.sin(loop*Math.PI*2); break;
case 'ty-swing': rot=Math.sin(loop*Math.PI*2)*.18; break;
case 'ty-tada': {const k=Math.sin(loop*Math.PI*6); sx=sy=1+.08*Math.max(0,k); rot=k*.055; break;}
case 'ty-flip-loop': sx=Math.cos(loop*Math.PI*2); break;
case 'ty-spin-loop': rot=loop*Math.PI*2; break;
case 'ty-morph-text': {const q=clamp(enter); if(q<.72&&q>0)glyph=chars[Math.floor(hash(Math.floor((1-q)*15+i*11))*chars.length)]; alpha=q; blur=(1-q)*lay.size*.08; sx=1.15-.15*q; break;}
case 'ty-letter-fade': alpha=clamp((enter-stagger*.42)*1.8); break;
case 'ty-number-slide': dy=(1-enter)*-lay.size*.5; alpha=enter; break;
case 'ty-slide-cycle': dx=Math.sin(loop*Math.PI*2)*lay.size*.2; alpha=.25+.75*(.5+.5*Math.cos(loop*Math.PI*2)); break;
case 'ty-bounce-cycle': dy=-Math.max(0,Math.sin(loop*Math.PI*4))*lay.size*.18; break;
case 'ty-rotate-cycle': rot=loop*Math.PI*2; break;
case 'ty-zoom-cycle': sx=sy=.78+.22*(.5+.5*Math.sin(loop*Math.PI*2)); break;
case 'ty-wave': dy=Math.sin(local*3.8+i*.48)*lay.size*.15; break;
case 'ty-scramble': if(enter<.96)glyph=chars[Math.floor(hash(Math.floor((1-enter)*18+i*31))*chars.length)]; alpha=.2+.8*enter; break;
case 'ty-typewriter': alpha=enter<.08?0:1; break;
case 'ty-binary': if(enter<.92&&/[A-Za-z]/.test(original))glyph=(Math.floor(hash(i+Math.floor(local*8))*2)?"1":"0"); fill='#86efac'; break;
case 'ty-decrypt': if(enter<.96&&/[A-Za-z]/.test(original)){const base=original===original.toUpperCase()?65:97;glyph=String.fromCharCode((original.charCodeAt(0)-base+Math.floor((1-enter)*17+1))%26+base);} break;
case 'ty-cipher': if(enter<.9&&/[A-Za-z]/.test(original)){const base=original===original.toUpperCase()?65:97;glyph=String.fromCharCode((original.charCodeAt(0)-base+13)%26+base);} break;
case 'ty-matrix-rain': if(enter<.96&&/[A-Za-z]/.test(original))glyph=chars[Math.floor(hash(i+Math.floor(local*12))*chars.length)]; fill='#86efac'; dy=-Math.max(0,1-enter)*lay.size*.2; break;
case 'ty-glitch-decode': if(enter<.96&&i%3!==0)glyph=chars[Math.floor(hash(i+Math.floor(local*20))*chars.length)]; dx=Math.sin(local*31+i)*lay.size*.025; break;
case 'ty-noise': dx=(hash(i+Math.floor(local*22))-.5)*lay.size*.045; dy=(hash(i+31+Math.floor(local*22))-.5)*lay.size*.045; break;
case 'ty-signal': alpha=.35+.65*(Math.sin(local*13+i*.3)>.0?1:.35); dx=Math.sin(local*9)*lay.size*.018; break;
case 'ty-resolve': alpha=enter; blur=(1-enter)*lay.size*.1; sx=.92+.08*enter; break;
case 'ty-count-up': if(/[0-9]/.test(original)){alpha=enter;dy=(1-enter)*-lay.size*.28;} break;
case 'ty-percentage': if(/[0-9%]/.test(original)){alpha=.55+.45*(.5+.5*Math.sin(local*2.2));fill='#7dd3fc';} break;
case 'ty-money': if(/[0-9$.,]/.test(original)){fill='#fcd34d';ctx.shadowColor='#d97706';ctx.shadowBlur=lay.size*.08;dy=Math.sin(local*2+i*.2)*lay.size*.015;} break;
case 'ty-year': if(/[0-9]/.test(original)){alpha=enter;dy=(1-enter)*-lay.size*.42;rot=(1-enter)*-.08;} break;
case 'ty-leading-zero': if(/[0-9]/.test(original)){sx=sy=.65+.35*enter;alpha=enter;} break;
case 'ty-decimal': if(/[0-9.]/.test(original)){blur=(1-enter)*lay.size*.1;alpha=enter;} break;
case 'ty-progress': if(/[0-9%]/.test(original)){fill='#86efac';sx=.75+.25*enter;alpha=enter;} break;
case 'ty-hex': if(/[0-9A-Fa-fx]/.test(original)){fill='#86efac';ctx.font='700 '+lay.size+'px ui-monospace,monospace';} break;
case 'ty-answer': if(/[0-9]/.test(original)){fill='#a5f3fc';sx=sy=1+.08*Math.max(0,beat);} break;
case 'ty-phone': if(/[0-9+()-]/.test(original)){alpha=clamp(enter-stagger*.18);dy=(1-enter)*lay.size*.16;} break;
case 'ty-gradient-text': case 'ty-rainbow': {const g=ctx.createLinearGradient(x-lay.size,y,x+lay.size,y);g.addColorStop(0,colours[(i+Math.floor(local*2))%colours.length]);g.addColorStop(.5,'#fff');g.addColorStop(1,colours[(i+3+Math.floor(local*2))%colours.length]);fill=g;break;}
case 'ty-neon': case 'ty-glow': fill='#f8fafc';ctx.shadowColor='#c4b5fd';ctx.shadowBlur=lay.size*(.12+.14*(.5+.5*beat));break;
case 'ty-glitch-text': fill=i%2?'#67e8f9':'#fb7185';dx=Math.sin(local*25+i)*lay.size*.025;break;
case 'ty-chrome': {const g=ctx.createLinearGradient(x,y-lay.size*.5,x,y+lay.size*.5);g.addColorStop(0,'#fff');g.addColorStop(.35,'#64748b');g.addColorStop(.58,'#fff');g.addColorStop(1,'#94a3b8');fill=g;ctx.shadowColor='#cbd5e1';ctx.shadowBlur=lay.size*.06;break;}
case 'ty-emboss': fill='#e2e8f0';ctx.shadowColor='#64748b';ctx.shadowBlur=lay.size*.08;dy=1;break;
case 'ty-pressed': fill='#cbd5e1';ctx.shadowColor='#020617';ctx.shadowBlur=lay.size*.12;dy=1;break;
case 'ty-paper-cut': fill='#f8fafc';ctx.shadowColor='#0f172a';ctx.shadowBlur=lay.size*.14;dx=2;dy=2;break;
case 'ty-drop-cap': if(i===0){sx=1.35;sy=1.35;dy=-lay.size*.12;}break;
case 'ty-neon-green': fill='#d9f99d';ctx.shadowColor='#84cc16';ctx.shadowBlur=lay.size*.3;break;
case 'ty-monospace': ctx.font='700 '+lay.size+'px ui-monospace,monospace';break;
case 'ty-wide': if('letterSpacing'in ctx)ctx.letterSpacing=(lay.size*.1)+'px';break;
case 'ty-italic': ctx.font='italic 700 '+lay.size+'px '+(c.family||'sans-serif');break;
case 'ty-underline': case 'ty-underline-hover': break;
case 'ty-strikethrough': break;
case 'ty-black-weight': ctx.font='900 '+lay.size+'px '+(c.family||'sans-serif');break;
case 'ty-case-cycle': glyph=loop<.33?original.toLowerCase():loop<.66?original.toUpperCase():original;break;
case 'ty-lowercase-cycle': glyph=loop<.5?original.toUpperCase():original.toLowerCase();break;
case 'ty-capitalize-cycle': glyph=loop<.5?original.toLowerCase():(i===0||a[i-1]===' '?original.toUpperCase():original.toLowerCase());break;
case 'ty-magnet': dx=Math.sin(local*2.5+i*.7)*lay.size*.075;dy=Math.cos(local*2.5+i*.7)*lay.size*.06;break;
case 'ty-pressure': sx=1+.12*Math.max(0,beat);sy=1-.1*Math.max(0,beat);if('letterSpacing'in ctx)ctx.letterSpacing=(Math.max(0,beat)*lay.size*.06)+'px';break;
case 'ty-hover-glow': ctx.shadowColor='#f0abfc';ctx.shadowBlur=lay.size*(.06+.22*(.5+.5*Math.sin(local*2)));break;
case 'ty-scale-hover': sx=sy=1+.08*(.5+.5*Math.sin(local*2));break;
case 'ty-expand': if('letterSpacing'in ctx)ctx.letterSpacing=(lay.size*(.05+.18*(.5+.5*beat)))+'px';break;
case 'ty-color-shift': fill=colours[Math.floor(loop*colours.length)%colours.length];break;
case 'ty-italic-hover': ctx.font='700 '+lay.size+'px '+(c.family||'sans-serif');rot=Math.sin(local*1.8)*.045;break;
case 'ty-underline-hover': break;
case 'ty-tilt': rot=Math.sin(local*1.4)*.1;break;
case 'ty-fade': alpha=.25+.75*(.5+.5*Math.sin(local*1.5));break;
case 'ty-outline': ctx.strokeStyle=style.textColor||'#f8fafc';ctx.lineWidth=Math.max(1,lay.size*.035);break;
case 'ty-lcd': fill='#a3e635';ctx.shadowColor='#84cc16';ctx.shadowBlur=lay.size*.08;ctx.font='700 '+lay.size+'px ui-monospace,monospace';break;
case 'ty-split-flap': fill='#f8fafc';ctx.shadowColor='#020617';ctx.shadowBlur=lay.size*.1;rot=Math.sin(local*4+i*.2)*.025;break;
case 'ty-liquid-fill': {const g=ctx.createLinearGradient(x,y+lay.size*.5,x,y-lay.size*.5);g.addColorStop(0,'#0ea5e9');g.addColorStop(.55,'#bae6fd');g.addColorStop(1,'#fff');fill=g;break;}
case 'ty-fire': fill='#ffedd5';ctx.shadowColor='#f97316';ctx.shadowBlur=lay.size*.28;dy=Math.sin(local*7+i)*lay.size*.025;break;
case 'ty-ice': fill='#e0f2fe';ctx.shadowColor='#38bdf8';ctx.shadowBlur=lay.size*.2;break;
case 'ty-shadow-dance': fill='#f8fafc';ctx.shadowColor=colours[Math.floor(loop*colours.length)%colours.length];ctx.shadowBlur=lay.size*.18;dx=Math.sin(local*4+i)*lay.size*.035;break;
default: alpha=enter; break;
}

ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.translate(x+dx,y+dy);ctx.rotate(rot);ctx.scale(Math.max(.02,sx),Math.max(.02,sy));if(blur&&'filter'in ctx)ctx.filter='blur('+Math.max(0,blur)+'px)';
ctx.fillStyle=fill;
if(s.key==='ty-underline'){ctx.fillText(glyph,-cw/2,0);ctx.fillRect(-cw/2,lay.size*.13,Math.max(1,cw),Math.max(1,lay.size*.025));}
else if(s.key==='ty-underline-hover'){ctx.fillText(glyph,-cw/2,0);ctx.fillRect(-cw/2,lay.size*.13,Math.max(1,cw*(.5+.5*Math.sin(local*2))),Math.max(1,lay.size*.025));}
else if(s.key==='ty-strikethrough'){ctx.fillText(glyph,-cw/2,0);ctx.strokeStyle=style.textColor||'#fff';ctx.lineWidth=Math.max(1,lay.size*.035);ctx.beginPath();ctx.moveTo(-cw/2,0);ctx.lineTo(cw/2,0);ctx.stroke();}
else if(s.key==='ty-outline')ctx.strokeText(glyph,-cw/2,0);
else if(s.key==='ty-split-flap'){ctx.fillStyle='#111827';ctx.fillRect(-cw/2-lay.size*.025,-lay.size*.52,cw+lay.size*.05,lay.size*.64);ctx.fillStyle='#f8fafc';ctx.fillText(glyph,-cw/2,0);}
else ctx.fillText(glyph,-cw/2,0);
ctx.restore();
});
});
ctx.restore();
});
}
specs.forEach(s=>{E[s.key]=(ctx,w,h,style,lines,time)=>draw(ctx,w,h,style||{},lines,Number(time)||0,s);});
window.KEFE_TYPOGRAPHY_EFFECT_KEYS=specs.map(s=>s.key);
})();