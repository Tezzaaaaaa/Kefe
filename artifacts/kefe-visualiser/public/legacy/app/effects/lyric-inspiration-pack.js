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
      defaults: {font:'Baloo 2',weight:800,aspect:'1/1',fill:'#ff66ff',outline:'#ffff66',ink:'#000000',shadow:'#ff3333',bg:'#ff6633',spark:'#ffffff',swap:true,transparent:false,speed:1,stagger:7,lag:4,hold:0,sparkles:true,loop:true},
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
      defaults: {font:'Orbitron',weight:900,bg:'#01000f',ink:'#ffffff',glow:'#6a4cff',cyan:'#4fd8ff',pink:'#ff5fa8',mint:'#6ee7d8',speed:1,glowAmount:48,beam:70,circuits:34,bokeh:26,loop:true},
      fields: [
        ['select','font','Font',[['Orbitron','Orbitron'],['Arial Black','Arial Black'],['Arial','Arial']]],
        ['range','weight','Weight',100,900,100,''],['color','bg','Background'],['color','ink','Text'],['color','glow','Glow'],['color','cyan','Circuit cyan'],['color','pink','Circuit pink'],['color','mint','Circuit mint'],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','glowAmount','Glow strength',0,80,1,''],['range','beam','Beam intensity',0,100,1,'%'],['range','circuits','Circuit paths',0,60,1,''],['range','bokeh','Floating lights',0,50,1,''],['toggle','loop','Loop']
      ]
    },
    dustoff: {
      title: 'Dust Off',
      defaults: {font:'Unbounded',weight:700,text:'#fafafa',bg:'#030303',transparent:false,mode:'both',enter:'flow',wind:'right',speed:1,hold:1.2,dis:41,tail:40,blank:0.44,density:1.0},
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
      defaults: {font:'Space Mono',weight:700,aspect:'16/9',bg:'#000000',color:'#ffffff',mode:'loop',speed:1,stagger:0.14,dur:0.9,hold:0.8,tracking:0.12,burst:0.45},
      fields: [
        ['select','font','Font',[['Space Mono','Space Mono'],['Arial','Arial'],['Arial Black','Arial Black'],['monospace','Monospace']]],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Canvas shape',[['16/9','Landscape 16:9'],['1/1','Square 1:1'],['9/16','Portrait 9:16']]],
        ['color','color','Text'],['color','bg','Background'],
        ['select','mode','Animation',[['loop','Loop (original)'],['lyric','Lyric (in / glitch / out)']]],
        ['range','speed','Speed',0.5,2,0.1,'×'],['range','stagger','Letter stagger',0.04,0.3,0.01,' s'],['range','dur','Transition duration',0.2,1.8,0.05,' s'],['range','hold','Rest between loops',0,3,0.1,' s'],['range','tracking','Letter spacing',0,0.35,0.01,' em'],['range','burst','Glitch burst point',0.1,0.9,0.05,'']
      ]
    },
    inkscript: {
      title: 'Ink Script',
      defaults: {font:'Mr Dafoe',googleFont:'',weight:400,aspect:'match',sizing:'fit',ink:'#081a1a',bg:'#ff3334',transparent:false,speed:1,write:16,morph:23,hold:1.4,blank:0.28,splatter:1,exit:'cut',flourish:true,loop:true,uploadedFamily:''},
      fields: [
        ['select','font','Font',[['Mr Dafoe','Mr Dafoe'],['Kaushan Script','Kaushan Script'],['Yellowtail','Yellowtail'],['Pacifico','Pacifico'],['Lobster','Lobster'],['Damion','Damion'],['Caveat Brush','Caveat Brush'],['Sedgwick Ave Display','Sedgwick Ave Display'],['Permanent Marker','Permanent Marker'],['Satisfy','Satisfy'],['__google','Other Google font…'],['__upload','Uploaded font']]],
        ['text','googleFont','Google Fonts family','e.g. Rock Salt'],['file','fontFile','Upload font file','.ttf,.otf,.woff,.woff2'],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Canvas shape',[['match','Match KEFE preview'],['4/3','Classic 4:3'],['16/9','Landscape 16:9'],['1/1','Square 1:1'],['9/16','Portrait 9:16']]],
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
  const redraw = () => { try { window.kefeLyrics?.redraw?.(); } catch (_) {} };
  const active = key => document.getElementById('lyricEffect')?.value === key;
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
  function renderSpin(ctx,w,h,style,lines,time){
    const s=settings.spin,items=linesFor(lines,time);if(!items.length)return;
    if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}
    const family=style.kefeMotionFont||s.font,size=Math.min(h*.25,w*.17),weight=s.weight;
    items.forEach(({line,index,start,end},li)=>{
      const p=clamp((time-start)*2*s.speed),duration=Math.max(.25,end-start),y=h/2+(li-(items.length-1)/2)*size*1.18;
      const layout=textRows(ctx,line.text,family,weight,size,w*.86),shown=layout.rows;
      shown.forEach((row,ri)=>{
        ctx.font=weight+' '+layout.size+'px "'+family+'", system-ui, sans-serif';
        const width=ctx.measureText(row).width,x=(w-width)/2,baseline=y+(ri-(shown.length-1)/2)*layout.lineH;
        Array.from(row).forEach((ch,i)=>{
          const delay=(i*Number(s.stagger)+li*Number(s.lag))*0.025/Math.max(.1,s.speed),q=clamp((p-delay)/.45);
          if(q<=0)return;
          const xx=x+ctx.measureText(row.slice(0,i)).width,yy=baseline+(1-q)*layout.size*.7;
          const fill=s.swap&&index%2?s.outline:s.fill,outline=s.swap&&index%2?s.fill:s.outline;
          ctx.save();ctx.globalAlpha=q;ctx.translate(xx,yy);ctx.scale(.65+.35*q,Math.max(.01,Math.sin(q*Math.PI/2)));
          ctx.lineJoin='round';ctx.lineWidth=Math.max(2,layout.size*.055);ctx.strokeStyle=s.shadow;ctx.shadowColor=s.shadow;ctx.shadowBlur=layout.size*.12;ctx.strokeText(ch,0,0);
          ctx.shadowBlur=0;ctx.strokeStyle=outline;ctx.strokeText(ch,0,0);ctx.fillStyle=fill;ctx.fillText(ch,0,0);ctx.restore();
        });
      });
    });
    if(s.sparkles){for(let i=0;i<18;i++){const x=hash(i+3)*w,y=(hash(i+29)*h+time*18)%h;ctx.globalAlpha=.25+.5*hash(i+90);ctx.fillStyle=s.spark;ctx.fillRect(x,y,2,2);}ctx.globalAlpha=1;}
  }
  function renderPremium(ctx,w,h,style,lines,time){
    const s=settings.premium;ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);
    const t=time*s.speed;
    const g=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.max(w,h)*.8);g.addColorStop(0,'#1d10a6');g.addColorStop(.55,'#08035a');g.addColorStop(1,s.bg);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<2;i++){ctx.save();ctx.translate(w/2,0);ctx.rotate(Math.sin(t*.15+i*2)*.25+(i?.35:-.35));const b=ctx.createLinearGradient(-w*.08,0,w*.08,0);b.addColorStop(0,'transparent');b.addColorStop(.5,'rgba(120,100,255,'+(Number(s.beam)/1400)+')');b.addColorStop(1,'transparent');ctx.fillStyle=b;ctx.fillRect(-w*.08,-h*.1,w*.16,h*1.2);ctx.restore();}
    const cols=[s.cyan,s.pink,s.mint,s.glow];
    for(let i=0;i<Number(s.circuits);i++){const x=hash(i+1)*w,y=hash(i+17)*h,xx=x+(hash(i+61)-.5)*w*.35,yy=y+(hash(i+71)-.5)*h*.3;ctx.strokeStyle=cols[i%cols.length];ctx.globalAlpha=.12+.18*hash(i+101);ctx.lineWidth=Math.max(1,w/1200);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,y);ctx.lineTo(xx,yy);ctx.stroke();const px=((t*(.06+hash(i+9)*.1)+hash(i+3))%1);ctx.globalAlpha=.8;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+(xx-x)*px,y,Math.max(1,w/500),0,Math.PI*2);ctx.fill();}
    for(let i=0;i<Number(s.bokeh);i++){const x=hash(i+141)*w+Math.sin(t*.3+i)*w*.01,y=(hash(i+151)*h-t*(6+hash(i+161)*14)+h*20)%h;ctx.globalAlpha=.08+.16*hash(i+171);ctx.fillStyle=cols[i%4];ctx.beginPath();ctx.arc(x,y,Math.max(1,w/350*(.2+hash(i+181))),0,Math.PI*2);ctx.fill();}
    ctx.restore();ctx.globalAlpha=1;
    const items=linesFor(lines,time);if(!items.length)return;
    const item=items[items.length-1],txt=String(item.line.text||'').toUpperCase(),size=Math.min(h*.25,w*.82/Math.max(1,txt.length*.7));
    ctx.save();ctx.font=s.weight+' '+size+'px "'+s.font+'", "Arial Black", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=s.glow;ctx.shadowBlur=Number(s.glowAmount)*w/1200;ctx.fillStyle=s.ink;
    const p=clamp((time-item.start)*2*s.speed);ctx.globalAlpha=p;ctx.fillText(txt,w/2,h*.52);ctx.restore();
  }
  function renderDust(ctx,w,h,style,lines,time){
    const s=settings.dustoff,items=linesFor(lines,time);if(!s.transparent){ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);}if(!items.length)return;
    const item=items[items.length-1],txt=String(item.line.text||'').toUpperCase(),family=style.kefeMotionFont||s.font;
    let size=Math.min(h*.24,w*.82/Math.max(1,txt.length*.62));ctx.font=s.weight+' '+size+'px "'+family+'", system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const p=Math.max(0,(time-item.start)*s.speed),dur=Math.max(.4,item.end-item.start),inEnd=.7,hold=Number(s.hold),outStart=inEnd+hold,outDur=Math.max(.2,Number(s.dis)/30),isOut=s.mode==='out',isIn=s.mode==='in';
    const opacity=isOut?1-clamp((p-outStart)/outDur):isIn?clamp(p/inEnd):p<inEnd?clamp(p/inEnd):p<outStart?1:1-clamp((p-outStart)/outDur);
    if(opacity>.02){ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=s.text;ctx.shadowColor=s.text;ctx.shadowBlur=2;ctx.fillText(txt,w/2,h/2);ctx.restore();}
    const particles=Math.round(Math.min(1800,txt.length*size*.75*Number(s.density)));
    for(let i=0;i<particles;i++){
      const seed=i+item.index*2137,baseX=hash(seed+1)*w,baseY=hash(seed+2)*h;
      const scatter=clamp((p-outStart)/outDur),form=clamp(p/inEnd);
      let x=baseX+(s.wind==='left'?-1:1)*scatter*w*(.2+hash(seed+4)*.9),y=baseY+Math.sin(p*2+seed)*h*.025+scatter*(hash(seed+5)-.5)*h*.7;
      if(s.mode==='in'||(s.mode==='both'&&p<outStart)){x=baseX+(1-form)*(w*.5*(s.wind==='left'?-1:1));y=baseY+(1-form)*(hash(seed+6)-.5)*h;}
      if(s.mode==='in'&&p>inEnd)continue;
      if(scatter>.98&&s.mode!=='out'&&s.mode!=='both')continue;
      ctx.globalAlpha=(s.mode==='out'?1:opacity<.05?0:1)*(.25+.65*(1-scatter));ctx.fillStyle=i%4===0?'#ffffff':s.text;ctx.fillRect(x,y,Math.max(1,size*.009),Math.max(1,size*.009));
    }ctx.globalAlpha=1;
  }
  function renderWrapSlide(ctx,w,h,style,lines,time){
    const s=settings.wrapslide,items=linesFor(lines,time);if(!items.length)return;
    ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);
    const item=items[items.length-1],txt=String(item.line.text||'').toUpperCase(),family=style.kefeMotionFont||s.font;
    const size=Math.min(h*.3,w*.84/Math.max(1,txt.length*.62)),n=Array.from(txt).length,cycle=Math.max(.5,Number(s.stagger)*n+Number(s.dur)+Number(s.hold));
    const t=s.mode==='loop'?((time-item.start)*s.speed)%cycle:(time-item.start)*s.speed,L=Math.max(.5,item.end-item.start);
    ctx.save();ctx.font=s.weight+' '+size+'px "'+family+'", monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=s.color;
    const adv=ctx.measureText('M').width*(1+Number(s.tracking)),x0=w/2-adv*n/2,band=size*1.06;
    const ease=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    Array.from(txt).forEach((ch,i)=>{if(ch===' ')return;const dir=hash(i+1)>.5?1:-1,delay=hash(i+9)*Number(s.stagger)*n;let off=0;
      if(s.mode==='loop'){const p=clamp((t-delay)/Math.max(.1,Number(s.dur)));off=dir*band*ease(p);}
      else {const inp=clamp((t-delay)/Math.max(.1,Number(s.dur))),outp=clamp((t-(L-Number(s.stagger)*n-Number(s.dur))-delay)/Math.max(.1,Number(s.dur))),bp=clamp((t-(Number(s.burst)*L)-delay)/Math.max(.1,Number(s.dur)));off=-dir*band*(1-ease(inp))+dir*band*ease(outp);if(bp>0&&bp<1)off+=dir*band*ease(bp);}
      const x=x0+i*adv+adv/2;ctx.save();ctx.beginPath();ctx.rect(x-adv/2,h/2-band/2,adv,band);ctx.clip();ctx.fillText(ch,x,h/2+off);ctx.restore();
    });ctx.restore();
  }
  const inkFontFaces = new Map();
  function inkFont(s){
    if(s.font==='__upload' && s.uploadedFamily)return s.uploadedFamily;
    if(s.font==='__google')return String(s.googleFont||'cursive').trim()||'cursive';
    return s.font||'Mr Dafoe';
  }
  function renderInkScript(ctx,w,h,style,lines,time){
    const s=settings.inkscript;
    const source=Array.isArray(lines)?lines:[];
    if(!source.length)return;
    const first=Number(source[0]?.time)||0,last=source[source.length-1]||{};
    const lastStart=Number(last.time)||0,lastEnd=Number(last.endTime)||lastStart+3;
    let t=time;
    if(t>lastEnd+Number(s.blank) && s.loop){
      const span=Math.max(.5,lastEnd-first+Number(s.blank));
      t=first+((t-first)%span);
    }
    const items=linesFor(source,t);
    if(!items.length)return;
    const item=items[items.length-1],line=item.line,txt=String(line.text||'').trim();
    if(!txt)return;
    if(!s.transparent){ctx.save();ctx.fillStyle=s.bg;ctx.fillRect(0,0,w,h);ctx.restore();}
    const family=inkFont(s),weight=Number(s.weight)||400;
    if(s.font==='__google' && s.googleFont){
      const key=s.googleFont.trim();
      if(key&&!inkFontFaces.has(key)){
        inkFontFaces.set(key,true);
        const link=document.createElement('link');link.rel='stylesheet';
        link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(key).replace(/%20/g,'+')+'&display=swap';
        link.onload=()=>{inkFontFaces.set(key,false);window.kefeLyrics?.redraw?.();};
        document.head.appendChild(link);
      }
    }
    const maxW=w*.82,maxH=h*.42;
    const targetAspect=s.aspect==='match'?w/h:Number(s.aspect.split('/')[0])/Number(s.aspect.split('/')[1]);
    let safeW=maxW,safeH=maxH;
    if(targetAspect<w/h)safeW=Math.min(maxW,maxH*targetAspect);else safeH=Math.min(maxH,maxW/targetAspect);
    const measure=ctx.measureText.bind(ctx);
    let size=Math.max(18,Math.min(safeH*.72,safeW/(Math.max(1,Array.from(txt).length)*.58)));
    ctx.save();ctx.font=weight+' '+size+'px "'+family+'", cursive';
    if(s.sizing==='fit'){
      const width=measure(txt).width;
      if(width>0)size*=Math.min(1,safeW/width);
    }else{
      let sameSize=size;
      source.forEach(row=>{ctx.font=weight+' '+sameSize+'px "'+family+'", cursive';const tw=measure(String(row.text||'').trim()).width;if(tw>safeW)sameSize=Math.min(sameSize,size*safeW/tw);});
      size=sameSize;
    }
    ctx.font=weight+' '+size+'px "'+family+'", cursive';ctx.textAlign='center';ctx.textBaseline='middle';
    const start=Number(line.time)||item.start,end=Math.max(start+.2,Number(line.endTime)||item.end),dur=end-start;
    const elapsed=Math.max(0,t-start),writeDur=Math.max(.08,Number(s.write)/25/Math.max(.25,Number(s.speed)||1));
    const morphDur=Math.max(.08,Number(s.morph)/25/Math.max(.25,Number(s.speed)||1));
    const writeP=clamp(elapsed/Math.min(writeDur,Math.max(.08,dur*.62)));
    const exitStart=Math.max(writeDur+Number(s.hold),dur-morphDur);
    let alpha=1;
    if(s.exit==='fade' && elapsed>exitStart)alpha=1-clamp((elapsed-exitStart)/Math.max(.08,morphDur));
    const baseline=h*.5;
    const metrics=ctx.measureText(txt),textW=Math.min(safeW,metrics.width);
    const x=w/2,y=baseline;
    const writing=elapsed<writeDur;
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=s.ink;ctx.strokeStyle=s.ink;ctx.lineJoin='round';
    ctx.save();
    if(writing){
      const reveal=textW*writeP;
      ctx.beginPath();ctx.rect(x-textW/2-2,y-size,Math.max(0,reveal+4),size*2);ctx.clip();
    }
    ctx.shadowColor=s.ink;ctx.shadowBlur=Math.max(0,size*.012);ctx.fillText(txt,x,y);ctx.restore();
    const transitionP=clamp((elapsed-exitStart)/Math.max(.08,morphDur));
    if(s.splatter>0 && (transitionP>0 || writing)){
      const p=transitionP>0?transitionP:writeP*.18;
      const count=Math.min(180,Math.round(24*Number(s.splatter)));
      ctx.save();ctx.fillStyle=s.ink;
      for(let i=0;i<count;i++){
        const seed=i+item.index*211,angle=hash(seed+4)*Math.PI*2;
        const spread=(.15+p*1.8)*size*(.25+hash(seed+9)*1.8);
        const px=x+Math.cos(angle)*spread,py=y+Math.sin(angle)*spread*.55;
        const radius=Math.max(.7,size*(.003+hash(seed+15)*.014))*Number(s.splatter);
        ctx.globalAlpha=(.2+.7*hash(seed+23))*(transitionP>0?1-transitionP*.55:.55);
        ctx.beginPath();ctx.ellipse(px,py,radius*1.25,radius,angle,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    if(s.flourish && (elapsed>writeDur*.55 || source.length===1)){
      const p=clamp((elapsed-writeDur*.55)/Math.max(.12,morphDur*.65));
      if(p>0){
        ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=s.ink;ctx.lineCap='round';ctx.lineWidth=Math.max(1.5,size*.055);
        ctx.beginPath();ctx.moveTo(x-textW*.48,y+size*.48);
        ctx.quadraticCurveTo(x-textW*.04,y+size*.7,x+textW*.52*p,y+size*.38);ctx.stroke();ctx.restore();
      }
    }
    if(elapsed>dur && !s.loop && s.exit==='cut'){ctx.clearRect(0,0,w,h);}
    ctx.restore();
  }
  E.spin=renderSpin; E.premium=renderPremium; E.dustoff=renderDust; E.wrapslide=renderWrapSlide; E.inkscript=renderInkScript;

  function buildControls(){
    const select=document.getElementById('lyricEffect'),host=select?.closest('[data-panel-view="effects"]')?.querySelector('.kefe-form');
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
          input.addEventListener('change',()=>{settings[key][id]=input.value;save();redraw();});
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
    select.addEventListener('change',sync);window.addEventListener('kefe-effects-ready',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildControls);else buildControls();
})();
