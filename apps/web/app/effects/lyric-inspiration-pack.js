/* KEFE lyric effects adapted from the supplied Spin, Premium Circuit, Dust Off and WrapSlide demos.
   All renderers are pure canvas draws driven by KEFE's shared lyric timeline, so preview and export stay in sync. */
(() => {
  'use strict';
  const U = window.kefeEffectUtils;
  const E = window.kefeEffects = window.kefeEffects || {};
  if (!U) { console.error('[inspiration-effects] effects/core.js is required'); return; }

  const defs = {
    spin: {
      title: 'Spin Lyrics',
      defaults: {font:'Baloo 2',weight:800,aspect:'1/1',fill:'#ff66ff',outline:'#ffff66',ink:'#000000',shadow:'#ff3333',bg:'#ff6633',spark:'#ffffff',swap:true,transparent:true,speed:1,stagger:7,lag:4,hold:0,sparkles:true,loop:true},
      fields: [
        ['select','font','Font',[['Baloo 2','Baloo 2'],['Fredoka','Fredoka'],['Titan One','Titan One'],['Lilita One','Lilita One'],['Bagel Fat One','Bagel Fat One'],['Chango','Chango'],['Paytone One','Paytone One'],['Rubik','Rubik'],['Sniglet','Sniglet'],['Dela Gothic One','Dela Gothic One']]],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Canvas shape',[['1/1','Square 1:1'],['16/9','Landscape 16:9'],['9/16','Portrait 9:16']]],
        ['color','fill','Fill'],['color','outline','Outline'],['color','ink','Ink'],['color','shadow','Shadow'],['color','bg','Background'],['color','spark','Sparkle'],
        ['toggle','swap','Swap colours on alternate lines'],['toggle','transparent','Transparent background'],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','stagger','Letter stagger',2,14,1,' frames'],['range','lag','Line lag',0,12,1,' frames'],['range','hold','Rest between loops',0,4,0.1,' s'],['toggle','sparkles','Sparkles'],['toggle','loop','Loop']
      ]
    },
    premium: {
      title: 'Premium Circuit',
      defaults: {font:'Orbitron',weight:900,bg:'#01000f',ink:'#ffffff',glow:'#6a4cff',cyan:'#4fd8ff',pink:'#ff5fa8',mint:'#6ee7d8',transparent:true,speed:1,glowAmount:48,beam:70,circuits:34,bokeh:26,loop:true},
      fields: [
        ['select','font','Font',[['Orbitron','Orbitron'],['Arial Black','Arial Black'],['Arial','Arial']]],
        ['range','weight','Weight',100,900,100,''],['color','bg','Background'],['toggle','transparent','Transparent background'],['color','ink','Text'],['color','glow','Glow'],['color','cyan','Circuit cyan'],['color','pink','Circuit pink'],['color','mint','Circuit mint'],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','glowAmount','Glow strength',0,80,1,''],['range','beam','Beam intensity',0,100,1,'%'],['range','circuits','Circuit paths',0,60,1,''],['range','bokeh','Floating lights',0,50,1,''],['toggle','loop','Loop']
      ]
    },
    dustoff: {
      title: 'Dust Off',
      defaults: {font:'Unbounded',weight:700,text:'#fafafa',bg:'#030303',transparent:true,mode:'both',enter:'flow',wind:'right',speed:1,hold:1.2,dis:41,tail:40,blank:0.44,density:1.0},
      fields: [
        ['select','font','Font',[['Unbounded','Unbounded'],['Krona One','Krona One'],['Syncopate','Syncopate'],['Lexend Zetta','Lexend Zetta'],['Michroma','Michroma'],['Archivo Black','Archivo Black'],['Syne','Syne'],['Anton','Anton'],['Dela Gothic One','Dela Gothic One']]],
        ['range','weight','Weight',100,900,100,''],['color','text','Text'],['color','bg','Background'],['toggle','transparent','Transparent background'],
        ['select','mode','Direction',[['both','Form, hold, blow away'],['in','Form only'],['out','Blow away only']]],
        ['select','enter','Entrance',[['flow','Dust streams in with the wind'],['reverse','Exit played backwards']]],
        ['select','wind','Wind direction',[['right','To the right'],['left','To the left']]],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','hold','Solid text hold',0,5,0.02,' s'],['range','dis','Front crossing time',12,90,1,' frames'],['range','tail','Dust linger',0,90,1,' frames'],['range','blank','Blank between loops',0,2,0.02,' s'],['range','density','Dust density',0.2,2,0.05,'×']
      ]
    },
    wrapslide: {
      title: 'WrapSlide',
      defaults: {font:'Space Mono',weight:700,aspect:'16/9',bg:'#000000',color:'#ffffff',transparent:true,mode:'loop',speed:1,stagger:0.14,dur:0.9,hold:0.8,tracking:0.12,burst:0.45},
      fields: [
        ['select','font','Font',[['Space Mono','Space Mono'],['Arial','Arial'],['Arial Black','Arial Black'],['monospace','Monospace']]],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Canvas shape',[['16/9','Landscape 16:9'],['1/1','Square 1:1'],['9/16','Portrait 9:16']]],
        ['color','color','Text'],['color','bg','Background'],['toggle','transparent','Transparent background'],
        ['select','mode','Animation',[['loop','Loop (original)'],['lyric','Lyric (in / glitch / out)']]],
        ['range','speed','Speed',0.5,2,0.1,'×'],['range','stagger','Letter stagger',0.04,0.3,0.01,' s'],['range','dur','Transition duration',0.2,1.8,0.05,' s'],['range','hold','Rest between loops',0,3,0.1,' s'],['range','tracking','Letter spacing',0,0.35,0.01,' em'],['range','burst','Glitch burst point',0.1,0.9,0.05,'']
      ]
    },
    inkscript: {
      title: 'Ink Script',
      defaults: {font:'Mr Dafoe',googleFont:'',weight:400,aspect:'match',sizing:'fit',ink:'#081a1a',bg:'#ff3334',transparent:true,speed:1,write:16,morph:23,hold:1.4,blank:0.28,splatter:1,exit:'cut',flourish:true,loop:true,uploadedFamily:''},
      fields: [
        ['select','font','Font',[['Mr Dafoe','Mr Dafoe'],['Kaushan Script','Kaushan Script'],['Yellowtail','Yellowtail'],['Pacifico','Pacifico'],['Lobster','Lobster'],['Damion','Damion'],['Caveat Brush','Caveat Brush'],['Sedgwick Ave Display','Sedgwick Ave Display'],['Permanent Marker','Permanent Marker'],['Satisfy','Satisfy'],['__google','Other Google font…'],['__upload','Uploaded font']]],
        ['text','googleFont','Google Fonts family','e.g. Rock Salt'],['file','fontFile','Upload font file','.ttf,.otf,.woff,.woff2'],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Composition shape',[['match','Match KEFE preview'],['4/3','Classic 4:3'],['16/9','Landscape 16:9'],['1/1','Square 1:1'],['9/16','Portrait 9:16']]],
        ['select','sizing','Word size',[['fit','Every word fills same width'],['same','Same font size for every word']]],
        ['color','ink','Ink'],['color','bg','Background'],['toggle','transparent','Transparent background'],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','write','Write-on',6,48,1,' frames'],['range','morph','Melt into next word',8,60,1,' frames'],
        ['range','hold','Hold',0,5,0.1,' s'],['range','blank','Blank before loop',0,2,0.04,' s'],['range','splatter','Splatter',0,2.5,0.1,'×'],
        ['select','exit','End of loop',[['cut','Cut to blank'],['fade','Fade out']]],
        ['toggle','flourish','Underline swoosh'],['toggle','loop','Loop']
      ]
    }
  };
  const storeKey = 'kefe.inspiration-effects.v1';
  const settings = {};
  try { Object.assign(settings, JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch (_) {}
  Object.keys(defs).forEach(k => settings[k] = Object.assign({}, defs[k].defaults, settings[k] || {}));
  if (settings.inkscript.font === '__upload') { settings.inkscript.font = 'Mr Dafoe'; settings.inkscript.uploadedFamily = ''; }
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(settings)); } catch (_) {} };
  const migrationKey = 'kefe.inspiration-effects.transparent-default.v1';
  let migrated = false;
  try { migrated = localStorage.getItem(migrationKey) === '1'; } catch (_) {}
  if (!migrated) {
    Object.keys(defs).forEach(key => { settings[key].transparent = true; });
    save();
    try { localStorage.setItem(migrationKey, '1'); } catch (_) {}
  }
  const redraw = () => { try { window.kefeLyrics?.redraw?.(); } catch (_) {} };
  const active = key => !!document.querySelector('.kefe-lyric-effect-option.active[data-effect="' + key + '"]');
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,Number(v)||0));
  const hash = n => { const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
  const linesFor = (lines,time) => {
    const out=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i], start=Number(line.time)||0;
      const end=Number(line.endTime)||Number(lines[i+1]?.time)||start+3;
      if(time>=start && time<=end)out.push({line,index:i,start,end});
    }
    if(!out.length){let i=-1;for(let j=0;j<lines.length;j++){if(time>=Number(lines[j].time||0))i=j;else break;}if(i>=0)out.push({line:lines[i],index:i,start:Number(lines[i].time)||0,end:Number(lines[i].endTime)||Number(lines[i+1]?.time)||(Number(lines[i].time)||0)+3});}
    return out.slice(-4);
  };
  function textRows(ctx,text,family,weight,size,maxW){
    const clean=String(text||'').trim().replace(/\s+/g,' ');ctx.font=weight+' '+size+'px "'+family+'", system-ui, sans-serif';
    const words=clean.split(' ').filter(Boolean),rows=[];let row='';
    for(const word of words){const test=row?row+' '+word:word;if(row&&ctx.measureText(test).width>maxW){rows.push(row);row=word;}else row=test;}
    if(row)rows.push(row);
    while(rows.length>4&&size>18){size*=.92;ctx.font=weight+' '+size+'px "'+family+'", system-ui, sans-serif';}
    return {rows,size,lineH:size*1.12};
  }
  /* Spin Lyrics: the active line is split into stacked rows (alternating pink/yellow), each letter flips in around its
     own centre with a stagger, then floats on a gentle wave with sparkles; letters flip out again before the line ends.
     Every letter has a black extrusion and a red drop shadow. Works with any font. */
  const spinFontReq={};
  const spinLayoutCache=new Map();
  function spinLayout(ctx,text,family,weight,w,h,cap){
    const key=[text,family,weight,Math.round(w),Math.round(h),Math.round(cap)].join('|');
    const hit=spinLayoutCache.get(key);if(hit)return hit;
    const words=String(text||'').trim().replace(/\s+/g,' ').split(' ').filter(Boolean);
    const B=100;ctx.font=weight+' '+B+'px "'+family+'", system-ui, sans-serif';
    const space=ctx.measureText(' ').width,ww=words.map(x=>ctx.measureText(x).width);
    const total=ww.reduce((a,b)=>a+b,0)+space*Math.max(0,words.length-1);
    const maxW=w*.86;let best=null;
    for(let n=1;n<=Math.min(3,Math.max(1,words.length));n++){
      const target=total/n,rows=[];let cur=[],cw=0;
      words.forEach((wd,i)=>{const add=cur.length?space+ww[i]:ww[i];
        if(cur.length&&cw+add>target*1.1&&rows.length<n-1){rows.push(cur);cur=[];cw=0;}
        cur.push(wd);cw+=cur.length>1?space+ww[i]:ww[i];});
      if(cur.length)rows.push(cur);
      const widest=Math.max(...rows.map(r=>ctx.measureText(r.join(' ')).width));
      let size=Math.min(cap,B*maxW/widest);
      const hMax=h*.84/(rows.length*1.12);size=Math.min(size,hMax);
      best={rows:rows.map(r=>r.join(' ')),size};
      if(size>=Math.min(cap,h*.13))break;
    }
    const out={rows:best.rows,size:Math.max(14,best.size),lineH:Math.max(14,best.size)*1.12};
    spinLayoutCache.set(key,out);if(spinLayoutCache.size>200)spinLayoutCache.delete(spinLayoutCache.keys().next().value);
    return out;
  }
  function spinStar(ctx,x,y,r,rot){
    ctx.beginPath();for(let k=0;k<8;k++){const a=rot+k*Math.PI/4,rr=k%2?r*.22:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fill();
  }
  function renderSpin(ctx,w,h,style,lines,time){
    const s=settings.spin,items=linesFor(lines,time);if(!items.length)return;
    const item=items[items.length-1],line=item.line;
    const family=style.kefeMotionFont||s.font,weight=s.weight;
    if(document.fonts&&document.fonts.load&&!spinFontReq[family+weight]){spinFontReq[family+weight]=1;document.fonts.load(weight+' 48px "'+family+'"').catch(()=>{});}
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}
    const aspect=s.aspect==='16/9'?16/9:s.aspect==='9/16'?9/16:1,boxW=Math.min(w*.9,h*.78*aspect),boxH=Math.min(h*.78,w*.9/aspect);
    const lay=spinLayout(ctx,line.text,family,weight,w,h,Math.min(boxH*.3,boxW*.17));
    const speed=Math.max(.25,Number(s.speed)||1);
    const start=item.start,end=Math.max(start+.6,item.end),span=(end-start);
    const t=(time-start)*speed,spanS=span*speed;
    const nChars=lay.rows.reduce((a,r)=>a+Array.from(r).length,0)||1;
    const flipDur=.5,stag0=(Number(s.stagger)||7)/25,lag=(Number(s.lag)||4)/25;
    const enterBudget=Math.max(.25,spanS*.42),stag=Math.min(stag0,Math.max(.01,(enterBudget-flipDur)/nChars));
    const exitStart=Math.max(spanS*.55,spanS-(flipDur+Math.min(.35,nChars*stag*.5)+.05));
    const size=lay.size,totalH=lay.rows.length*lay.lineH,top=h/2-totalH/2+lay.lineH/2;
    const ease=q=>{const c1=1.35;const u=q-1;return 1+(c1+1)*u*u*u+c1*u*u;};  // easeOutBack: slight overshoot as the letter lands
    ctx.save();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.font=weight+' '+size+'px "'+family+'", system-ui, sans-serif';
    let g=0;const sparkAnchors=[];
    lay.rows.forEach((row,ri)=>{
      const chars=Array.from(row),rowW=ctx.measureText(row).width,x0=(w-rowW)/2,cy0=top+ri*lay.lineH;
      const swapped=s.swap&&(ri%2===1);
      const fill=swapped?s.outline:s.fill,outline=swapped?s.fill:s.outline;
      chars.forEach((ch,i)=>{
        const idx=g++;
        const pre=ctx.measureText(row.slice(0,i)).width,cw=ctx.measureText(ch).width,cx=x0+pre+cw/2;
        if(ch===' ')return;
        const delay=idx*stag+ri*lag;
        const qIn=clamp((t-delay)/flipDur);
        const qOut=clamp((t-(exitStart+idx*stag*.5+ri*lag*.5))/flipDur);
        if(qIn<=0||qOut>=1)return;
        const q=ease(qIn),vis=qIn*(1-qOut);
        // 3D flip: rotation about the letter's own centre (x squashes through the edge-on position, y gets a slight tilt)
        const ang=(1-Math.min(q,1))*Math.PI+qOut*Math.PI;
        const sx=Math.max(.05,Math.abs(Math.cos(ang))),sy=.82+.18*Math.abs(Math.cos(ang/2));
        const settled=clamp((t-delay-flipDur)/.4)*(1-qOut);
        const bob=Math.sin(t*2.6+idx*.62)*size*.035*settled;
        const tilt=Math.sin(t*1.9+idx*.5)*.035*settled;
        const lift=(1-clamp(qIn))*size*.35-qOut*size*.25;
        const px=cx,py=cy0+bob+lift;
        sparkAnchors.push([px,py,idx,vis]);
        ctx.save();
        ctx.globalAlpha=clamp(vis*1.6);
        ctx.translate(px,py);ctx.rotate(tilt);ctx.scale(sx,sy);
        const ext=Math.max(2,size*.05),lw=Math.max(2,size*.06);
        // red drop shadow
        ctx.save();ctx.translate(ext*.6,ext*1.9);ctx.fillStyle=s.shadow;ctx.strokeStyle=s.shadow;ctx.lineWidth=lw+ext;ctx.shadowColor=s.shadow;ctx.shadowBlur=size*.1;ctx.strokeText(ch,0,0);ctx.fillText(ch,0,0);ctx.restore();
        // black extrusion
        ctx.fillStyle=s.ink;ctx.strokeStyle=s.ink;ctx.lineWidth=lw;
        for(let k=7;k>=1;k--){const o=k*ext*.28;ctx.strokeText(ch,o*.6,o);ctx.fillText(ch,o*.6,o);}
        // outline + fill face
        ctx.strokeStyle=outline;ctx.lineWidth=lw;ctx.strokeText(ch,0,0);
        ctx.strokeStyle=s.ink;ctx.lineWidth=Math.max(1,size*.016);ctx.strokeText(ch,0,0);
        ctx.fillStyle=fill;ctx.fillText(ch,0,0);
        ctx.restore();
      });
    });
    if(s.sparkles&&sparkAnchors.length){
      ctx.fillStyle=s.spark;
      const n=Math.min(14,Math.max(6,Math.round(sparkAnchors.length*.5)));
      for(let i=0;i<n;i++){
        const a=sparkAnchors[Math.floor(hash(i*3.7+item.index)*sparkAnchors.length)];
        const period=1.1+hash(i+40)*1.1,ph=((time*speed)/period+hash(i+60)*7)%1;
        const tw=Math.sin(ph*Math.PI);if(tw<=.02)continue;
        const sx=a[0]+(hash(i+item.index*7+11)-.5)*size*1.1,sy=a[1]+(hash(i+item.index*5+23)-.5)*size*1.0;
        ctx.globalAlpha=clamp(tw*a[3]);spinStar(ctx,sx,sy,size*(.08+.12*hash(i+80))*tw+1,ph*Math.PI*.5);
      }
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  function renderPremium(ctx,w,h,style,lines,time){
    const s=settings.premium;
    const t=time*s.speed;
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);const g=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.max(w,h)*.8);g.addColorStop(0,'#1d10a6');g.addColorStop(.55,'#08035a');g.addColorStop(1,s.bg);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<2;i++){ctx.save();ctx.translate(w/2,0);ctx.rotate(Math.sin(t*.15+i*2)*.25+(i?.35:-.35));const b=ctx.createLinearGradient(-w*.08,0,w*.08,0);b.addColorStop(0,'transparent');b.addColorStop(.5,'rgba(120,100,255,'+(Number(s.beam)/1400)+')');b.addColorStop(1,'transparent');ctx.fillStyle=b;ctx.fillRect(-w*.08,-h*.1,w*.16,h*1.2);ctx.restore();}
    const cols=[s.cyan,s.pink,s.mint,s.glow];
    for(let i=0;i<Number(s.circuits);i++){const x=hash(i+1)*w,y=hash(i+17)*h,xx=x+(hash(i+61)-.5)*w*.35,yy=y+(hash(i+71)-.5)*h*.3;ctx.strokeStyle=cols[i%cols.length];ctx.globalAlpha=.12+.18*hash(i+101);ctx.lineWidth=Math.max(1,w/1200);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,y);ctx.lineTo(xx,yy);ctx.stroke();const px=((t*(.06+hash(i+9)*.1)+hash(i+3))%1);ctx.globalAlpha=.8;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+(xx-x)*px,y,Math.max(1,w/500),0,Math.PI*2);ctx.fill();}
    for(let i=0;i<Number(s.bokeh);i++){const x=hash(i+141)*w+Math.sin(t*.3+i)*w*.01,y=(hash(i+151)*h-t*(6+hash(i+161)*14)+h*20)%h;ctx.globalAlpha=.08+.16*hash(i+171);ctx.fillStyle=cols[i%4];ctx.beginPath();ctx.arc(x,y,Math.max(1,w/350*(.2+hash(i+181))),0,Math.PI*2);ctx.fill();}
    ctx.restore();ctx.globalAlpha=1;
    const items=linesFor(lines,time);if(!items.length)return;
    const item=items[items.length-1],txt=String(item.line.text||'').toUpperCase(),size=Math.min(h*.25,w*.82/Math.max(1,txt.length*.7));
    ctx.save();ctx.font=s.weight+' '+size+'px "'+s.font+'", "Arial Black", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=s.glow;ctx.shadowBlur=Number(s.glowAmount)*w/1200;ctx.fillStyle=s.ink;
    const elapsed=Math.max(0,(time-item.start)*s.speed),cycle=Math.max(.8,item.end-item.start),p=s.loop?clamp((elapsed%cycle)/.45):clamp(elapsed/.45);ctx.globalAlpha=p;ctx.fillText(txt,w/2,h*.52);ctx.restore();
  }
  const dustPointCache=new Map();
  function dustTextPoints(w,h,text,family,size,weight){
    const key=[w,h,text,family,size,weight].join('|');if(dustPointCache.has(key))return dustPointCache.get(key);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w));canvas.height=Math.max(1,Math.ceil(h));
    const c=canvas.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,w,h);c.font=weight+' '+size+'px "'+String(family).replace(/"/g,'')+'", system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';c.fillText(text,w/2,h/2,w*.84);
    const data=c.getImageData(0,0,canvas.width,canvas.height).data,points=[];
    for(let y=0;y<canvas.height;y+=4)for(let x=0;x<canvas.width;x+=4){if(data[(y*canvas.width+x)*4+3]>80)points.push({x,y});}
    const result=points.length?points:[{x:w/2,y:h/2}];dustPointCache.set(key,result);if(dustPointCache.size>8)dustPointCache.delete(dustPointCache.keys().next().value);return result;
  }
  /* Dust Off: the line is solid text that dissolves into wind-blown dust (and/or forms from dust). A soft front sweeps
     through the letters in the wind direction; particles are released as it passes, drift downwind with turbulence and fade.
     Timeline is fitted to the line: forms at the start, rests solid, blows away so it is gone as the line ends. */
  const dustRasterCache=new Map();
  let dustMaskCanvas=null;
  const easeOut3=q=>1-Math.pow(1-clamp(q),3);
  function dustRaster(ctx,w,h,txt,family,weight,color){
    const lay=spinLayout(ctx,txt,family,weight,w,h,h*.26);
    const key=[w,h,txt,family,weight,color,Math.round(lay.size)].join('|');
    const hit=dustRasterCache.get(key);if(hit)return hit;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w));canvas.height=Math.max(1,Math.ceil(h));
    const c=canvas.getContext('2d',{willReadFrequently:true});
    c.font=weight+' '+lay.size+'px "'+String(family).replace(/"/g,'')+'", system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;
    const top=h/2-(lay.rows.length*lay.lineH)/2+lay.lineH/2;
    lay.rows.forEach((row,ri)=>c.fillText(row,w/2,top+ri*lay.lineH));
    const data=c.getImageData(0,0,canvas.width,canvas.height).data,pts=[];
    const step=Math.max(2,Math.min(6,Math.round(lay.size/26)));
    let minX=1e9,maxX=-1e9;
    for(let y=0;y<canvas.height;y+=step)for(let x=0;x<canvas.width;x+=step){if(data[(y*canvas.width+x)*4+3]>90){pts.push({x,y});if(x<minX)minX=x;if(x>maxX)maxX=x;}}
    if(!pts.length){pts.push({x:w/2,y:h/2});minX=w/2-1;maxX=w/2+1;}
    const out={canvas,pts,step,minX,maxX,W:Math.max(1,maxX-minX),size:lay.size};
    dustRasterCache.set(key,out);if(dustRasterCache.size>6)dustRasterCache.delete(dustRasterCache.keys().next().value);
    return out;
  }
  function renderDust(ctx,w,h,style,lines,time){
    const s=settings.dustoff,items=linesFor(lines,time);
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}
    if(!items.length)return;
    const item=items[items.length-1],txt=String(item.line.text||'').trim().toUpperCase();if(!txt)return;
    const family=style.kefeMotionFont||s.font;
    if(document.fonts&&document.fonts.load&&!spinFontReq['d'+family+s.weight]){spinFontReq['d'+family+s.weight]=1;document.fonts.load(s.weight+' 48px "'+family+'"').catch(()=>{});}
    const R=dustRaster(ctx,w,h,txt,family,s.weight,s.text);
    const speed=Math.max(.25,Number(s.speed)||1);
    const L=Math.max(.8,(Math.max(item.end,item.start+.8)-item.start)*speed),t=Math.max(0,(time-item.start)*speed);
    const mode=s.mode,doIn=mode!=='out',doOut=mode!=='in',dir=s.wind==='left'?-1:1,reverse=s.enter==='reverse';
    // timings (seconds on the line's clock), shrunk if the line is too short for them
    let cross=Math.max(.3,Number(s.dis)/30),life=Math.max(.3,.35+Number(s.tail)/60);
    let inTot=cross+life,outTot=cross+life;
    const need=(doIn?inTot:0)+(doOut?outTot:0),room=L*.92;
    if(need>room){const k=room/need;cross*=k;life*=k;inTot=cross+life;outTot=cross+life;}
    const outStart=doOut?Math.max(doIn?inTot+.05:0,L-outTot-.05):Infinity;
    const uOf=x=>dir>0?(x-R.minX)/R.W:(R.maxX-x)/R.W;
    const xAt=u=>dir>0?R.minX+u*R.W:R.maxX-u*R.W;
    // phase: 'in' (forming), 'hold', 'out' (dissolving)
    let phase='hold',tt=0;
    if(doOut&&t>=outStart){phase='out';tt=t-outStart;}
    else if(doIn&&t<inTot){phase='in';tt=t;}
    const inv=1/Math.max(.05,cross);
    // ---- solid layer, masked by the sweeping front
    if(!dustMaskCanvas)dustMaskCanvas=document.createElement('canvas');
    if(dustMaskCanvas.width!==R.canvas.width||dustMaskCanvas.height!==R.canvas.height){dustMaskCanvas.width=R.canvas.width;dustMaskCanvas.height=R.canvas.height;}
    const mc=dustMaskCanvas.getContext('2d');
    mc.globalCompositeOperation='source-over';mc.clearRect(0,0,dustMaskCanvas.width,dustMaskCanvas.height);
    let solid=true;
    if(phase==='out'||(phase==='in'&&reverse)){
      const tq=phase==='out'?tt:Math.max(0,inTot-t),uT=tq*inv;      // dissolved for u < uT
      const g=mc.createLinearGradient(xAt(uT-.12),0,xAt(uT),0);
      mc.drawImage(R.canvas,0,0);mc.globalCompositeOperation='destination-out';
      g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');mc.fillStyle=g;mc.fillRect(0,0,dustMaskCanvas.width,dustMaskCanvas.height);
    }else if(phase==='in'){
      const uT=(t-life)*inv;                                            // formed for u < uT
      if(uT<=-.12)solid=false;else{
        const g=mc.createLinearGradient(xAt(uT-.12),0,xAt(uT),0);
        mc.drawImage(R.canvas,0,0);mc.globalCompositeOperation='destination-out';
        g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');mc.fillStyle=g;mc.fillRect(0,0,dustMaskCanvas.width,dustMaskCanvas.height);
      }
    }else mc.drawImage(R.canvas,0,0);
    if(solid){ctx.save();ctx.shadowColor=s.text;ctx.shadowBlur=2;ctx.drawImage(dustMaskCanvas,0,0);ctx.restore();}
    // ---- dust
    const n=R.pts.length,count=Math.min(5200,Math.max(1,Math.round(n*Number(s.density)*.9)));
    const sz=R.step,size=R.size,seedBase=item.index*2137;
    ctx.save();
    for(let i=0;i<count;i++){
      const pt=R.pts[Math.floor(i*n/count)%n],seed=i*7.13+seedBase;
      const u=clamp(uOf(pt.x)),jit=hash(seed+1)*.12,travel=R.W*(.14+hash(seed+4)*.5)+size*.6;
      let a=-1,mv=0;                         // a = progress 0..1 of this particle's flight, mv = displacement amount
      if(phase==='out'||(phase==='in'&&reverse)){
        const tq=phase==='out'?tt:Math.max(0,inTot-t);
        a=(tq-(u+jit)*cross)/life;           // released when the front passes
        if(a<=0||a>=1)continue;
        mv=easeOut3(a)*dir;
      }else if(phase==='in'){
        const g=(t-(u+jit)*cross)/life;      // arrives from upwind and settles into place
        if(g<=0||g>=1)continue;
        a=1-g;mv=-easeOut3(a)*dir;
      }else continue;
      const turb=Math.sin(a*5+seed)*size*.06+(hash(seed+5)-.5)*size*.9*Math.pow(clamp(a),1.4);
      const x=pt.x+mv*travel,y=pt.y+turb-Math.pow(clamp(a),2)*size*.15;
      const alpha=(phase==='out'||reverse?Math.pow(1-a,.85):Math.pow(1-a,.85))*.95;
      const px=Math.max(1,sz*(.5+hash(seed+8)*.7)*(1-.35*a));
      ctx.globalAlpha=clamp(alpha);ctx.fillStyle=i%4===0?'#ffffff':s.text;ctx.fillRect(x,y,px,px);
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  /* WrapSlide: each letter lives in its own clipped cell. A letter slides out of its cell while a copy slides in from the
     opposite side, so the glyph wraps around seamlessly (like a slot/odometer). Lyric mode: letters wrap in, rest, a
     glitch burst wraps a few through, then they slide out as the line ends. */
  function renderWrapSlide(ctx,w,h,style,lines,time){
    const s=settings.wrapslide,items=linesFor(lines,time);if(!items.length)return;
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}
    const item=items[items.length-1],txt=String(item.line.text||'').trim().toUpperCase();if(!txt)return;
    const family=String(style.kefeMotionFont||s.font).replace(/"/g,''),aspect=s.aspect==='16/9'?16/9:s.aspect==='9/16'?9/16:1;
    if(document.fonts&&document.fonts.load&&!spinFontReq['w'+family+s.weight]){spinFontReq['w'+family+s.weight]=1;document.fonts.load(s.weight+' 48px "'+family+'"').catch(()=>{});}
    const boxW=Math.min(w*.88,h*.78*aspect),boxH=Math.min(h*.78,w*.88/aspect);
    const lay=spinLayout(ctx,txt,family,s.weight,boxW/.86,boxH/.84,Math.min(boxH*.3,boxW*.17));
    let size=lay.size,fam='"'+family+'", monospace',trackK=Number(s.tracking)||0;
    const rowsMeasure=sz=>{ctx.font=s.weight+' '+sz+'px '+fam;return lay.rows.map(r=>{const cs=Array.from(r),ws=cs.map(c=>ctx.measureText(c).width),tr=sz*trackK;return{cs,ws,tr,total:ws.reduce((a,b)=>a+b,0)+tr*Math.max(0,cs.length-1)};});};
    let rows=rowsMeasure(size);const widest=Math.max(...rows.map(r=>r.total));
    if(widest>boxW*.94){size*=boxW*.94/widest;rows=rowsMeasure(size);}
    const band=Math.min(size*1.12,boxH/lay.rows.length*.95),rowGap=band*1.1;
    const speed=Math.max(.5,Number(s.speed)||1),L=Math.max(.8,(Math.max(item.end,item.start+.8)-item.start)*speed),t=Math.max(0,(time-item.start)*speed);
    const N=rows.reduce((a,r)=>a+r.cs.length,0)||1,dur=Math.max(.15,Number(s.dur)||.9);
    const stag=Math.max(.01,Math.min(Number(s.stagger)||.14,(L*.32-dur)/N)),spread=stag*N;
    const ease=q=>q<.5?4*q*q*q:1-Math.pow(-2*q+2,3)/2;
    const cycle=Math.max(.5,(Number(s.stagger)||.14)*N+dur+(Number(s.hold)||0)),tl=s.mode==='loop'?t%cycle:t;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=s.color;ctx.font=s.weight+' '+size+'px '+fam;
    let g=0;
    rows.forEach((row,ri)=>{
      const rowY=h/2+(ri-(rows.length-1)/2)*rowGap;let xCursor=w/2-row.total/2;
      row.cs.forEach((ch,i)=>{
        const idx=g++,adv=row.ws[i]+row.tr,cx=xCursor+row.ws[i]/2;xCursor+=adv;
        if(ch===' ')return;
        const dir=hash(idx+1)>.5?1:-1,delay=hash(idx+9)*(s.mode==='loop'?(Number(s.stagger)||.14)*N:spread);
        let off=0,wrapOff=null;
        if(s.mode==='loop'){
          const q=ease(clamp((tl-delay)/dur));off=dir*band*q;wrapOff=off-dir*band;     // slides out, copy slides in
        }else{
          const inp=ease(clamp((tl-delay)/dur)),outp=ease(clamp((tl-(L-spread-dur)-delay)/dur));
          off=-dir*band*(1-inp)+dir*band*outp;
          const bq=clamp((tl-Number(s.burst)*L-delay)/dur);
          if(bq>0&&bq<1&&outp<=0&&inp>=1){const bo=dir*band*ease(bq);off=bo;wrapOff=bo-dir*band;}   // glitch: wraps through the cell
        }
        ctx.save();ctx.beginPath();ctx.rect(cx-adv/2-size*.05,rowY-band/2,adv+size*.1,band);ctx.clip();
        if(Math.abs(off)<band*.99)ctx.fillText(ch,cx,rowY+off);
        if(wrapOff!==null&&Math.abs(wrapOff)<band*.99)ctx.fillText(ch,cx,rowY+wrapOff);
        ctx.restore();
      });
    });
    ctx.restore();
  }
  const inkFontFaces = new Map();
  function inkFont(s){
    if(s.font==='__upload' && s.uploadedFamily)return s.uploadedFamily;
    if(s.font==='__google')return String(s.googleFont||'cursive').trim()||'cursive';
    return s.font||'Mr Dafoe';
  }
  function renderInkScript(ctx,w,h,style,lines,time){
    const s=settings.inkscript,source=Array.isArray(lines)?lines:[];
    if(!source.length)return;
    const first=Number(source[0]?.time)||0,last=source[source.length-1]||{};
    const lastStart=Number(last.time)||0,lastEnd=Number(last.endTime)||lastStart+3;
    let t=time;
    if(t>lastEnd+Number(s.blank)&&s.loop){
      const span=Math.max(.5,lastEnd-first+Number(s.blank));
      t=first+((t-first)%span);
    }
    if(!s.loop&&t>lastEnd){if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}return;}
    const items=linesFor(source,t);if(!items.length)return;
    const item=items[items.length-1],line=item.line,txt=String(line.text||'').trim();if(!txt)return;
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}
    const family=inkFont(s),weight=Number(s.weight)||400;
    if(s.font==='__google'&&s.googleFont){
      const key=s.googleFont.trim();
      if(key&&!inkFontFaces.has(key)){
        inkFontFaces.set(key,true);
        const link=document.createElement('link');link.rel='stylesheet';
        link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(key).replace(/%20/g,'+')+'&display=swap';
        link.onload=()=>{inkFontFaces.set(key,false);window.kefeLyrics?.redraw?.();};
        document.head.appendChild(link);
      }
    }
    if(document.fonts&&document.fonts.load){
      const fontKey='ink'+family+weight;
      if(!spinFontReq[fontKey]){spinFontReq[fontKey]=1;document.fonts.load(weight+' 48px "'+family+'"').then(()=>window.kefeLyrics?.redraw?.()).catch(()=>{});}
    }
    const maxW=w*.84,maxH=h*.46;
    const ratio=s.aspect==='match'?w/h:Number(s.aspect.split('/')[0])/Number(s.aspect.split('/')[1]);
    const boxW=ratio<w/h?Math.min(maxW,maxH*ratio):maxW;
    const boxH=ratio>w/h?Math.min(maxH,maxW/ratio):maxH;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=weight+' 100px "'+family+'", cursive';
    let size=Math.min(boxH*.78,100*boxW/Math.max(1,ctx.measureText(txt).width));
    if(s.sizing==='same'){
      for(const row of source){const rowText=String(row.text||'').trim();if(rowText){const width=ctx.measureText(rowText).width;if(width>0)size=Math.min(size,100*boxW/width);}}
    }
    size=Math.max(12,size);
    ctx.font=weight+' '+size+'px "'+family+'", cursive';
    const textW=Math.min(boxW,ctx.measureText(txt).width),x=w/2,y=h/2;
    const startTime=Number(line.time)||item.start,endTime=Math.max(startTime+.2,Number(line.endTime)||item.end);
    const dur=endTime-startTime,elapsed=Math.max(0,t-startTime);
    const speed=Math.max(.25,Number(s.speed)||1);
    const writeDur=Math.max(.12,Math.min(Number(s.write)/25/speed,dur*.72));
    const morphDur=Math.max(.12,Number(s.morph)/25/speed);
    const writeP=clamp(elapsed/writeDur);
    const exitStart=Math.max(writeDur+Number(s.hold),dur-morphDur);
    const transitionP=clamp((elapsed-exitStart)/Math.max(.08,morphDur));
    const hasNext=!!source[item.index+1]&&Number(source[item.index+1].time)<=endTime+.2;
    const fadeOut=(hasNext||s.exit==='fade')?transitionP:0;
    const alpha=1-fadeOut;
    const writing=elapsed<writeDur;
    const reveal=textW*writeP;
    const ink=s.ink||'#081a1a';
    const rgb=hex=>{const v=parseInt(String(hex).replace('#',''),16);return Number.isFinite(v)?[(v>>16)&255,(v>>8)&255,v&255]:[8,26,26];};
    const shade=(hex,k)=>{const c=rgb(hex);return 'rgb('+c.map(v=>Math.max(0,Math.min(255,Math.round(v*k)))).join(',')+')';};
    const clipReveal=()=>{
      if(!writing)return;
      ctx.beginPath();
      const left=x-textW/2-3,right=left+Math.max(0,reveal+6),top=y-size*.78,bottom=y+size*.78;
      const ripple=size*.025;
      ctx.moveTo(left,top);ctx.lineTo(right-ripple,top);
      ctx.quadraticCurveTo(right+ripple, y-size*.2, right-ripple*.3,y);
      ctx.quadraticCurveTo(right+ripple,y+size*.22,right-ripple,bottom);
      ctx.lineTo(left,bottom);ctx.closePath();ctx.clip();
    };
    ctx.save();ctx.globalAlpha=alpha;
    clipReveal();
    // Deep, restrained extrusion gives the lettering physical thickness without a cartoon outline.
    ctx.save();ctx.fillStyle=shade(ink,.28);ctx.shadowColor='rgba(0,0,0,.38)';ctx.shadowBlur=size*.12;ctx.shadowOffsetX=size*.035;ctx.shadowOffsetY=size*.075;
    for(let d=8;d>=1;d--){ctx.globalAlpha=alpha*(.42+d*.045);ctx.fillText(txt,x+d*size*.0025,y+d*size*.004);}
    ctx.restore();
    // Wet-ink face: a soft contact shadow, rich pigment, then a fine upper-left reflected edge.
    ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=shade(ink,.45);ctx.shadowBlur=size*.055;ctx.fillStyle=ink;ctx.fillText(txt,x,y);ctx.restore();
    ctx.save();ctx.globalAlpha=alpha*.22;ctx.fillStyle='#ffffff';ctx.shadowColor='#ffffff';ctx.shadowBlur=size*.035;
    ctx.fillText(txt,x-size*.006,y-size*.012);ctx.restore();
    // Narrow specular edge and subtle inner pigment variation create a beveled, inked surface.
    ctx.save();ctx.globalAlpha=alpha*.42;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=Math.max(.6,size*.006);
    ctx.lineJoin='round';ctx.strokeText(txt,x-size*.006,y-size*.012);ctx.restore();
    ctx.restore();
    if(hasNext&&transitionP>0){
      const nextText=String(source[item.index+1].text||'').trim();
      if(nextText){ctx.save();ctx.globalAlpha=transitionP;ctx.font=weight+' '+size+'px "'+family+'", cursive';ctx.fillStyle=ink;ctx.shadowColor=ink;ctx.shadowBlur=size*.06;ctx.translate(x,y+(1-transitionP)*size*.16);ctx.scale(.96+.04*transitionP,1);ctx.fillText(nextText,0,0);ctx.restore();}
    }
    // Small, deterministic ink flecks emerge near the advancing wet edge, not across the whole canvas.
    if(Number(s.splatter)>0&&(writing||transitionP>0)){
      const p=writing?writeP:transitionP,count=Math.min(96,Math.round(16*Number(s.splatter)));
      ctx.save();ctx.fillStyle=ink;
      for(let i=0;i<count;i++){
        const seed=i+item.index*211,edge=x-textW/2+reveal;
        const px=edge+(hash(seed+4)-.5)*size*.22;
        const py=y+(hash(seed+9)-.5)*size*.95;
        const radius=Math.max(.5,size*(.002+hash(seed+15)*.008))*Number(s.splatter);
        ctx.globalAlpha=alpha*(.08+.38*hash(seed+23))*p;
        ctx.beginPath();ctx.ellipse(px,py,radius*1.4,radius,hash(seed+12),0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    if(s.flourish){
      const p=clamp((elapsed-writeDur*.58)/Math.max(.12,morphDur*.65));
      if(p>0){ctx.save();ctx.globalAlpha=alpha*.82;ctx.strokeStyle=ink;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1,size*.025);
        ctx.shadowColor=ink;ctx.shadowBlur=size*.025;ctx.beginPath();
        ctx.moveTo(x-textW*.46,y+size*.48);
        ctx.bezierCurveTo(x-textW*.2,y+size*.76,x+textW*.08,y+size*.67,x+textW*.5*p,y+size*.38);
        ctx.stroke();ctx.restore();}
    }
    if(elapsed>dur&&!s.loop&&s.exit==='cut')ctx.clearRect(0,0,w,h);
    ctx.restore();
  }
  E.spin=renderSpin; E.premium=renderPremium; E.dustoff=renderDust; E.wrapslide=renderWrapSlide; E.inkscript=renderInkScript;

  function buildControls(){
    const host=document.querySelector('[data-panel-view="effects"] .kefe-form');
    if(!host||document.getElementById('kefeInspirationControls'))return;
    const root=document.createElement('div');root.id='kefeInspirationControls';root.className='kefe-inspiration-controls';
    const panels={};
    Object.entries(defs).forEach(([key,def])=>{
      const panel=document.createElement('section');panel.className='kefe-inspiration-panel';panel.dataset.effect=key;panel.hidden=true;
      const heading=document.createElement('div');heading.className='kefe-label';heading.textContent=def.title+' settings';panel.appendChild(heading);
      const grid=document.createElement('div');grid.className='kefe-inspiration-grid';
      def.fields.forEach(field=>{
        const [kind,id,label,...args]=field,row=document.createElement('label');row.className='kefe-inspiration-field';row.textContent='';
        const title=document.createElement('span');title.textContent=label;row.appendChild(title);
        let input,output;
        if(kind==='text'){
          input=document.createElement('input');input.type='text';input.placeholder=args[0]||'';input.value=settings[key][id]||'';row.appendChild(input);
          input.addEventListener('change',()=>{settings[key][id]=input.value.trim();save();if(key==='inkscript'&&id==='googleFont'&&settings[key].googleFont){settings[key].font='__google';const fontSelect=grid.querySelector('select[aria-label="Font"]');if(fontSelect)fontSelect.value='__google';}redraw();});
        }else if(kind==='file'){
          input=document.createElement('input');input.type='file';input.accept=args[0]||'.ttf,.otf,.woff,.woff2';row.appendChild(input);
          input.addEventListener('change',()=>{const file=input.files&&input.files[0];if(!file)return;file.arrayBuffer().then(buf=>{const family='KEFEInkFont'+Date.now();const face=new FontFace(family,buf);return face.load().then(()=>{document.fonts.add(face);settings[key].uploadedFamily=family;settings[key].font='__upload';save();const fontSelect=grid.querySelector('select[aria-label="Font"]');if(fontSelect)fontSelect.value='__upload';redraw();});}).catch(()=>{const note=document.createElement('span');note.textContent='Font could not be loaded.';row.appendChild(note);});});
        }else if(kind==='range'){
          const [min,max,step,suffix]=args;input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=settings[key][id];
          output=document.createElement('output');const fmt=()=>{output.textContent=String(input.value)+suffix;};fmt();row.appendChild(input);row.appendChild(output);
          input.addEventListener('input',()=>{settings[key][id]=Number(input.value);fmt();save();redraw();});
        }else if(kind==='toggle'){
          input=document.createElement('input');input.type='checkbox';input.checked=!!settings[key][id];row.classList.add('kefe-inspiration-toggle');row.appendChild(input);
          input.addEventListener('change',()=>{settings[key][id]=input.checked;save();redraw();});
        }else if(kind==='color'){
          input=document.createElement('input');input.type='color';input.value=settings[key][id];row.appendChild(input);
          input.addEventListener('input',()=>{settings[key][id]=input.value;save();redraw();});
        }else{
          input=document.createElement('select');args[0].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option);});input.value=settings[key][id];row.appendChild(input);
          input.addEventListener('change',()=>{let value=input.value;if(key==='inkscript'&&id==='font'&&value==='__upload'&&!settings[key].uploadedFamily){value='Mr Dafoe';input.value=value;}settings[key][id]=value;save();redraw();});
        }
        input.setAttribute('aria-label',label);grid.appendChild(row);
      });
      panel.appendChild(grid);
      const reset=document.createElement('button');reset.type='button';reset.className='kefe-btn';reset.textContent='Reset '+def.title+' settings';
      reset.addEventListener('click',()=>{settings[key]=Object.assign({},def.defaults);save();panel.querySelectorAll('input,select').forEach(input=>{const id=input.getAttribute('aria-label');const field=def.fields.find(f=>f[2]===id);if(!field)return;const v=settings[key][field[1]];if(input.type==='checkbox')input.checked=!!v;else if(input.type!=='file')input.value=v;const out=input.parentElement.querySelector('output');if(out&&field[0]==='range')out.textContent=String(v)+field[6];});redraw();});
      panel.appendChild(reset);root.appendChild(panel);panels[key]=panel;
    });
    const css=document.createElement('style');css.textContent='.kefe-inspiration-panel{margin-top:14px;padding:12px;border:1px solid var(--line,#34363d);border-radius:8px;background:var(--surface,transparent)}.kefe-inspiration-panel[hidden]{display:none!important}.kefe-inspiration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kefe-inspiration-field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;font-size:12px;min-width:0}.kefe-inspiration-field input[type=range],.kefe-inspiration-field input[type=text],.kefe-inspiration-field input[type=file],.kefe-inspiration-field select{grid-column:1/-1;width:100%;min-width:0}.kefe-inspiration-field input[type=color]{width:100%;grid-column:1/-1;min-height:30px}.kefe-inspiration-toggle{display:flex;align-items:center;justify-content:flex-start;gap:8px}.kefe-inspiration-toggle input{margin:0}.kefe-inspiration-panel>button{margin-top:10px}@media(max-width:600px){.kefe-inspiration-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    root.appendChild(css);host.appendChild(root);
    const sync=()=>Object.entries(panels).forEach(([key,panel])=>{panel.hidden=!active(key);});
    window.addEventListener('kefe-effect-change',sync);window.addEventListener('kefe-effects-ready',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildControls);else buildControls();
})();
