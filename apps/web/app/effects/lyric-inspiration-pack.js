/* KEFE lyric effects adapted from the supplied Spin, Devotion, Dust Off and WrapSlide demos.
   Renderers use KEFE's shared lyric timeline so preview and export stay in sync. */
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
      title: 'Devotion',
      defaults: {font:'SF Pro Display',weight:200,background:'black',letterSpacing:0.02},
      fields: [
        ['select','background','Background',[['black','Solid black'],['white','Solid white']]],
        ['range','weight','Font weight',100,400,10,''],
        ['range','letterSpacing','Letter spacing',0,0.08,0.005,' em']
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
    chrome: {
      title: 'Liquid Chrome',
      defaults: {font:'Playfair Display',italic:true,weight:900,metal:'chrome',depth:26,shine:1,bg:'storm',star:true,upper:true,speed:1},
      fields: [
        ['select','font','Font',[['Playfair Display','Playfair Display'],['Cinzel','Cinzel'],['Bodoni Moda','Bodoni Moda'],['Cormorant Garamond','Cormorant Garamond'],['Orbitron','Orbitron'],['Arial Black','Arial Black'],['Georgia','Georgia'],['Impact','Impact']]],
        ['range','weight','Weight',400,900,100,''],['toggle','italic','Italic lettering'],
        ['select','metal','Metal finish',[['chrome','Liquid chrome'],['gunmetal','Gunmetal'],['gold','Gold'],['rose','Rose gold']]],
        ['range','depth','Extrusion depth',0,48,1,' px'],
        ['range','shine','Reflection movement',0,2,0.05,'×'],
        ['select','bg','Environment',[['none','Transparent'],['storm','Storm sky'],['night','Night sky']]],
        ['toggle','star','Four-point star flare'],['toggle','upper','Uppercase lettering'],
        ['range','speed','Animation speed',0.25,2,0.05,'×']
      ]
    },
    gel: {
      title: 'Gel Script',
      defaults: {font:'Pacifico',weight:400,color:'#e8325f',depth:8,gloss:1,inflate:1,spacing:0,bg:'black',transparent:false,upper:false,speed:1,sway:1},
      fields: [
        ['select','font','Handwriting',[['Pacifico','Pacifico'],['Lobster','Lobster'],['Satisfy','Satisfy'],['Yellowtail','Yellowtail'],['Damion','Damion'],['Caveat','Caveat'],['Playfair Display','Playfair Display'],['Georgia','Georgia']]],
        ['range','weight','Font weight',100,900,100,''],
        ['color','color','Gel colour'],
        ['range','depth','Gel depth',0,20,1,' px'],
        ['range','gloss','Gloss highlights',0,2,0.05,'×'],
        ['range','inflate','Inflation',0.5,1.8,0.05,'×'],
        ['range','spacing','Letter spacing',-5,12,0.5,'%'],
        ['select','bg','Background',[['black','Black'],['none','Transparent']]],
        ['toggle','transparent','Transparent background'],
        ['toggle','upper','Uppercase lettering'],
        ['range','speed','Animation speed',0.25,2,0.05,'×'],
        ['range','sway','Motion',0,2,0.05,'×']
      ]
    },
    inkscript: {
      title: 'Ink Script',
      defaults: {font:'Mr Dafoe',googleFont:'',weight:400,aspect:'match',sizing:'fit',ink:'#17201d',bg:'#f0eee7',transparent:false,paper:true,tracking:0,lineSpacing:1.12,speed:1,write:24,morph:23,hold:1.4,blank:0.28,splatter:0.45,exit:'cut',loop:true,uploadedFamily:''},
      fields: [
        ['select','font','Handwriting',[['Mr Dafoe','Mr Dafoe'],['Kaushan Script','Kaushan Script'],['Yellowtail','Yellowtail'],['Pacifico','Pacifico'],['Lobster','Lobster'],['Damion','Damion'],['Caveat Brush','Caveat Brush'],['Sedgwick Ave Display','Sedgwick Ave Display'],['Permanent Marker','Permanent Marker'],['Satisfy','Satisfy'],['__google','Other Google font…'],['__upload','Uploaded font']]],
        ['text','googleFont','Google font','e.g. Rock Salt'],['file','fontFile','Upload font','.ttf,.otf,.woff,.woff2'],
        ['range','weight','Weight',100,900,100,''],['select','aspect','Composition shape',[['match','Match KEFE preview'],['4/3','Classic 4:3'],['16/9','Landscape 16:9'],['1/1','Square 1:1'],['9/16','Portrait 9:16']]],
        ['select','sizing','Text sizing',[['fit','Fit each lyric line'],['same','Consistent size']]],
        ['color','ink','Ink colour'],['color','bg','Paper colour'],['toggle','transparent','Transparent background'],['toggle','paper','Paper texture'],
        ['range','tracking','Letter spacing',-0.04,0.16,0.01,' em'],['range','lineSpacing','Line spacing',0.9,1.6,0.05,'×'],
        ['range','speed','Speed',0.25,2,0.05,'×'],['range','write','Write-on',6,48,1,' frames'],['range','morph','Ink transition',8,48,1,' frames'],
        ['range','hold','Hold',0,5,0.1,' s'],['range','blank','Blank before loop',0,2,0.04,' s'],['range','splatter','Ink flecks',0,1.5,0.05,'×'],
        ['select','exit','End of loop',[['cut','Cut to blank'],['fade','Fade out']]],
        ['toggle','loop','Loop']
      ]
    }
  };
  const storeKey = 'kefe.inspiration-effects.v1';
  const settings = {};
  try { Object.assign(settings, JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch (_) {}
  Object.keys(defs).forEach(k => settings[k] = Object.assign({}, defs[k].defaults, settings[k] || {}));
  if (settings.inkscript.font === '__upload') { settings.inkscript.font = 'Mr Dafoe'; settings.inkscript.uploadedFamily = ''; }
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(settings)); } catch (_) {} };
  // Premium Circuit settings do not describe Devotion. Reset only this effect once
  // so existing users receive the new typography defaults without losing other presets.
  const devotionMigrationKey = 'kefe.inspiration-effects.devotion.solid-background.v2';
  let devotionMigrated = false;
  try { devotionMigrated = localStorage.getItem(devotionMigrationKey) === '1'; } catch (_) {}
  if (!devotionMigrated) {
    settings.premium = Object.assign({}, defs.premium.defaults);
    save();
    try { localStorage.setItem(devotionMigrationKey, '1'); } catch (_) {}
  }
  const migrationKey = 'kefe.inspiration-effects.transparent-default.v2';
  let migrated = false;
  try { migrated = localStorage.getItem(migrationKey) === '1'; } catch (_) {}
  if (!migrated) {
    Object.keys(defs).forEach(key => { if(key!=='inkscript'&&key!=='chrome'&&key!=='gel') settings[key].transparent = true; });
    settings.inkscript.transparent=false;settings.inkscript.paper=true;
    save();
    try { localStorage.setItem(migrationKey, '1'); } catch (_) {}
  }
  // Restore the signature environments for users who already had the first adapted defaults saved.
  const signatureKey='kefe.inspiration-effects.signature-design.v1';
  let signatureMigrated=false;
  try { signatureMigrated=localStorage.getItem(signatureKey)==='1'; } catch (_) {}
  if(!signatureMigrated){
    if(settings.chrome.bg==='none'&&settings.chrome.transparent===true){settings.chrome.bg='storm';settings.chrome.transparent=false;}
    if(settings.gel.bg==='black'&&settings.gel.transparent===true&&settings.gel.color==='#e8325f'){settings.gel.transparent=false;}
    save();
    try { localStorage.setItem(signatureKey,'1'); } catch (_) {}
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
  function devotionEase(value) {
    const t=clamp(value);
    return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  }
  function devotionRows(ctx,text,maxWidth,fontSize,letterSpacing) {
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),rows=[];
    const measure=value=>Array.from(value).reduce((sum,ch)=>sum+ctx.measureText(ch).width+letterSpacing,0)-letterSpacing;
    let row='';
    for(const word of words){
      const candidate=row?row+' '+word:word;
      if(row&&measure(candidate)>maxWidth){rows.push(row);row=word;}else row=candidate;
    }
    if(row)rows.push(row);
    return rows;
  }
  function devotionDrawSpaced(ctx,text,cx,y,letterSpacing) {
    const chars=Array.from(text);
    const total=chars.reduce((sum,ch)=>sum+ctx.measureText(ch).width+letterSpacing,0)-letterSpacing;
    let x=cx-total/2;
    chars.forEach(ch=>{ctx.fillText(ch,x,y);x+=ctx.measureText(ch).width+letterSpacing;});
  }
  function renderDevotion(ctx,w,h,style,lines,time) {
    const s=settings.premium;
    ctx.fillStyle=s.background==='white'?'#ffffff':'#000000';
    ctx.fillRect(0,0,w,h);
    const items=linesFor(lines,time);
    if(!items.length)return;
    const item=items[items.length-1],text=String(item.line.text||'').trim();
    if(!text)return;
    const elapsedIn=Math.max(0,(time-item.start)*1000),elapsedOut=Math.max(0,(item.end-time)*1000);
    const fadeIn=devotionEase(elapsedIn/420),fadeOut=devotionEase(elapsedOut/520);
    const alpha=Math.min(fadeIn,fadeOut);
    if(alpha<=0.001)return;
    const blur=Math.max((1-fadeIn)*14,(1-fadeOut)*10);
    const scale=0.96+0.04*fadeIn;
    const fontSize=Math.min(w*0.072,h*0.10,96);
    const letterSpacing=Math.max(0,Number(s.letterSpacing)||0)*fontSize;
    const textColor=s.background==='white'?'#000000':'#ffffff';
    ctx.save();
    ctx.fillStyle=textColor;
    ctx.font=Math.max(100,Math.min(400,Number(s.weight)||200))+' '+fontSize+'px "SF Pro Display", "Inter", -apple-system, "Helvetica Neue", "Segoe UI", sans-serif';
    ctx.textAlign='left';ctx.textBaseline='middle';
    const rows=devotionRows(ctx,text,w*0.82,fontSize,letterSpacing);
    const lineHeight=fontSize*1.18,totalHeight=rows.length*lineHeight,startY=h/2-totalHeight/2+lineHeight/2;
    if(blur>0.15)ctx.filter='blur('+blur.toFixed(2)+'px)';
    ctx.translate(w/2,h/2);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);
    ctx.globalAlpha=alpha;
    rows.forEach((row,index)=>devotionDrawSpaced(ctx,row,w/2,startY+index*lineHeight,letterSpacing));
    ctx.restore();
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
  /* Liquid Chrome uses KEFE's shared lyric timing; no separate playback loop. */
  const chromeLayouts=new Map(),chromeFonts=new Set();
  const chromeHash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  function renderChrome(ctx,w,h,style,lines,time){
    const s=settings.chrome,items=linesFor(lines,time);if(!items.length)return;
    const item=items[items.length-1],line=item.line,raw=String(line.text||'').trim();if(!raw)return;
    const text=s.upper?raw.toLocaleUpperCase():raw,family=style.kefeMotionFont||s.font||'Playfair Display',weight=Number(s.weight)||900,fontStyle=s.italic?'italic ':'';
    const fk=family+'|'+weight;
    if(document.fonts&&document.fonts.load&&!chromeFonts.has(fk)){chromeFonts.add(fk);document.fonts.load(fontStyle+weight+' 72px "'+family+'"').then(()=>window.kefeLyrics?.redraw?.()).catch(()=>{});}
    const metal=({
      chrome:{top:'#f8fcff',high:'#ffffff',mid:'#9daab8',low:'#202a38',edge:'#dce8f5',shadow:'#02060c'},
      gunmetal:{top:'#c5d0dc',high:'#edf3fa',mid:'#667586',low:'#111923',edge:'#a6b8ca',shadow:'#010308'},
      gold:{top:'#fff2bf',high:'#fffbe8',mid:'#c69b43',low:'#493014',edge:'#ffe3a0',shadow:'#170d03'},
      rose:{top:'#ffe2dc',high:'#fff4f0',mid:'#c78b83',low:'#46272c',edge:'#f5c2bd',shadow:'#16090c'}
    })[s.metal]||{top:'#f8fcff',high:'#fff',mid:'#9daab8',low:'#202a38',edge:'#dce8f5',shadow:'#02060c'};
    if(s.bg!=='none'){
      const sky=ctx.createLinearGradient(0,0,w,h);
      sky.addColorStop(0,s.bg==='night'?'#050914':'#26384b');sky.addColorStop(.46,s.bg==='night'?'#121d30':'#8494a2');
      sky.addColorStop(.53,s.bg==='night'?'#030711':'#d9e1e5');sky.addColorStop(1,s.bg==='night'?'#101a2a':'#172333');
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      for(let i=0;i<18;i++){const x=((chromeHash(i+31)*1.5+time*.009*Number(s.shine||0))%1)*w,y=chromeHash(i+81)*h,r=Math.max(w,h)*(.025+chromeHash(i+91)*.07),g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,s.bg==='night'?'rgba(116,146,181,.12)':'rgba(239,246,250,.24)');g.addColorStop(1,'rgba(12,22,37,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
      if(s.bg==='night'){ctx.fillStyle='rgba(0,3,12,.38)';ctx.fillRect(0,0,w,h);}
    }
    const key=[text,family,weight,Math.round(w),Math.round(h),s.star?1:0].join('|');let lay=chromeLayouts.get(key);
    if(!lay){
      const m=document.createElement('canvas').getContext('2d');let size=Math.min(h*.31,w/(Math.max(1,text.length)*.55)),rows=[];
      for(let k=0;k<28;k++){m.font=fontStyle+weight+' '+size+'px "'+family+'", Georgia, serif';rows=[];let row='';
        for(const word of text.split(/\s+/)){const test=row?row+' '+word:word;if(row&&m.measureText(test).width>w*.84){rows.push(row);row=word;}else row=test;}if(row)rows.push(row);
        const widest=Math.max(1,...rows.map(r=>m.measureText(r).width));if(widest<=w*.84&&rows.length*size*1.04<=h*.52)break;size*=.92;
      }
      m.font=weight+' '+size+'px "'+family+'", Georgia, serif';lay={rows,size,widths:rows.map(r=>m.measureText(r).width),lineH:size*1.04};
      chromeLayouts.set(key,lay);if(chromeLayouts.size>100)chromeLayouts.delete(chromeLayouts.keys().next().value);
    }
    const size=lay.size,top=h/2-(lay.rows.length-1)*lay.lineH/2,start=Number(line.time)||item.start,end=Math.max(start+.2,Number(line.endTime)||item.end);
    const duration=end-start,speed=Math.max(.25,Number(s.speed)||1),elapsed=Math.max(0,time-start)*speed;
    const revealDur=Math.max(.22,Math.min(duration*.42,1.05)/speed),p=clamp(elapsed/revealDur),depth=Math.max(0,Math.min(48,Number(s.depth)||0))*Math.min(1,w/900);
    const fade=items.length>1?1:1-.18*clamp((time-end+.15)/.45),sweep=(time*Number(s.shine||0)*.22)%1;
    ctx.save();ctx.globalAlpha=fade;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineCap='round';ctx.font=fontStyle+weight+' '+size+'px "'+family+'", Georgia, serif';
    lay.rows.forEach((row,ri)=>{
      const y=top+ri*lay.lineH,rowW=lay.widths[ri],left=w/2-rowW/2,reveal=Math.min(rowW+size*.08,(rowW+size*.08)*clamp(p*lay.rows.length-ri));
      ctx.save();ctx.beginPath();ctx.rect(left-size*.06,y-size*.68,Math.max(0,reveal),size*1.36);ctx.clip();
      ctx.save();ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=size*.12;ctx.shadowOffsetX=depth*.35;ctx.shadowOffsetY=depth*.8;
      ctx.fillStyle=metal.shadow;ctx.strokeStyle=metal.shadow;ctx.lineWidth=Math.max(1,size*.025);ctx.strokeText(row,w/2,y);ctx.fillText(row,w/2,y);ctx.restore();
      for(let d=Math.ceil(depth);d>=1;d--){const g=ctx.createLinearGradient(0,y-size*.5,0,y+size*.5);g.addColorStop(0,'#dae4ef');g.addColorStop(.28,'#4a596b');g.addColorStop(.58,'#111925');g.addColorStop(1,d<3?metal.edge:'#364352');ctx.fillStyle=g;ctx.fillText(row,w/2+d*.38,y+d*.72);}
      const face=ctx.createLinearGradient(0,y-size*.64,0,y+size*.62);
      face.addColorStop(0,metal.low);face.addColorStop(.12,metal.mid);face.addColorStop(.24,metal.high);face.addColorStop(.31,metal.mid);
      face.addColorStop(.48,metal.low);face.addColorStop(.59,metal.high);face.addColorStop(.73,metal.mid);face.addColorStop(.88,metal.low);face.addColorStop(1,metal.high);
      ctx.lineWidth=Math.max(1,size*.012);ctx.strokeStyle=metal.low;ctx.strokeText(row,w/2,y);ctx.fillStyle=face;ctx.fillText(row,w/2,y);
      ctx.save();ctx.globalCompositeOperation='screen';const gx=(sweep*1.7-.35)*w,glint=ctx.createLinearGradient(gx-size*.16,0,gx+size*.16,0);
      glint.addColorStop(0,'rgba(255,255,255,0)');glint.addColorStop(.42,'rgba(255,255,255,.04)');glint.addColorStop(.5,'rgba(255,255,255,.82)');glint.addColorStop(.58,'rgba(255,255,255,.05)');glint.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=glint;ctx.fillRect(0,y-size*.8,w,size*1.6);ctx.restore();ctx.restore();
    });
    if(s.star){const rowW=lay.widths[0]||size,sx=Math.min(w*.91,w/2+rowW*.43),sy=top-size*.47,r=size*(.13+.025*Math.sin(time*4.2));
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(sx,sy);ctx.rotate(time*.12);
      const glow=ctx.createRadialGradient(0,0,0,0,0,r*2.4);glow.addColorStop(0,'rgba(255,255,255,.95)');glow.addColorStop(.25,'rgba(224,241,255,.6)');glow.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r*2.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';
      ctx.beginPath();ctx.moveTo(0,-r*1.7);ctx.quadraticCurveTo(r*.15,-r*.15,r*1.15,0);ctx.quadraticCurveTo(r*.12,r*.13,0,r*1.7);ctx.quadraticCurveTo(-r*.12,r*.13,-r*1.15,0);ctx.quadraticCurveTo(-r*.15,-r*.15,0,-r*1.7);ctx.fill();ctx.restore();
    }
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=0;i<5;i++){const x=((chromeHash(i+10)+time*.035*Number(s.shine||0))%1)*w,y=h*(.24+chromeHash(i+20)*.52),tw=Math.max(0,Math.sin(time*2.4+i*1.7));if(tw<.8)continue;
      const r=Math.max(1,size*.012*tw);ctx.globalAlpha=.45*tw;ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=Math.max(1,size*.006);ctx.beginPath();ctx.moveTo(x-r*3,y);ctx.lineTo(x+r*3,y);ctx.moveTo(x,y-r*3);ctx.lineTo(x,y+r*3);ctx.stroke();}
    ctx.restore();ctx.restore();
  }
  /* Gel Script: glossy inflated word-by-word lettering on KEFE's shared lyric timeline. */
  const gelLayouts=new Map(),gelFonts=new Set();
  function renderGel(ctx,w,h,style,lines,time){
    const s=settings.gel,items=linesFor(lines,time);if(!items.length)return;
    const item=items[items.length-1],line=item.line,raw=String(line.text||'').trim();if(!raw)return;
    const text=s.upper?raw.toLocaleUpperCase():raw,family=style.kefeMotionFont||s.font||'Pacifico',weight=Number(s.weight)||400;
    const fk=family+'|'+weight;
    if(document.fonts&&document.fonts.load&&!gelFonts.has(fk)){gelFonts.add(fk);document.fonts.load(weight+' 72px "'+family+'"').then(()=>window.kefeLyrics?.redraw?.()).catch(()=>{});}
    const cacheKey=[text,family,weight,Math.round(w),Math.round(h),s.spacing].join('|');
    let lay=gelLayouts.get(cacheKey);
    if(!lay){
      const m=document.createElement('canvas').getContext('2d');let size=Math.min(h*.34,w*.17),rows=[],words=[];
      for(let pass=0;pass<30;pass++){
        m.font=weight+' '+size+'px "'+family+'", cursive';rows=[];let row='';
        for(const word of text.split(/\s+/)){const test=row?row+' '+word:word;if(row&&m.measureText(test).width>w*.84){rows.push(row);row=word;}else row=test;}
        if(row)rows.push(row);
        const widths=rows.map(r=>m.measureText(r).width);
        if(Math.max(1,...widths)<=w*.84&&rows.length*size*1.18<=h*.56)break;size*=.92;
      }
      m.font=weight+' '+size+'px "'+family+'", cursive';
      const lineH=size*1.18,totalH=rows.length*lineH,top=(h-totalH)/2+lineH/2;
      rows.forEach((r,ri)=>{
        const tokens=r.split(/\s+/),widths=tokens.map(t=>m.measureText(t).width),space=m.measureText(' ').width+size*(Number(s.spacing)||0)/100;
        const total=widths.reduce((a,b)=>a+b,0)+space*Math.max(0,tokens.length-1);let x=(w-total)/2;
        tokens.forEach((word)=>{const ww=m.measureText(word).width;words.push({text:word,x:x,y:top+ri*lineH,width:ww,ri});x+=ww+space;});
      });
      lay={words,size,lineH};gelLayouts.set(cacheKey,lay);if(gelLayouts.size>90)gelLayouts.delete(gelLayouts.keys().next().value);
    }
    const size=lay.size,start=item.start,end=Math.max(start+.3,item.end),duration=end-start,speed=Math.max(.25,Number(s.speed)||1);
    const enter=clamp((time-start)*speed/Math.min(.65,Math.max(.22,duration*.22))),exit=clamp((end-time)/Math.max(.2,Math.min(.55,duration*.18)));
    const rgbHex=/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:'#e8325f';
    const n=parseInt(rgbHex.slice(1),16),base=[n>>16&255,n>>8&255,n&255];
    const shade=(k)=>'rgb('+base.map(v=>Math.round(Math.max(0,Math.min(255,v*k))).toString()).join(',')+')';
    if(!s.transparent&&s.bg!=='none'){ctx.fillStyle=s.bg||'#000';ctx.fillRect(0,0,w,h);}
    ctx.save();ctx.globalAlpha=exit<1?Math.min(1,exit*1.25):1;
    const count=lay.words.length,span=Math.max(.3,duration*.62),elapsed=Math.max(0,time-start)*speed;
    lay.words.forEach((wd,i)=>{
      const delay=span*i/Math.max(1,count),u=(elapsed-delay)/Math.max(.28,span/Math.max(1,count)*1.5);
      let pop=clamp(u),scale=.18+.82*(1-Math.pow(1-pop,3));
      if(u>=0&&u<1){scale+=.18*Math.sin(Math.PI*clamp(u/.7))*Math.exp(-u*2.1);}
      const wobble=(u>=0&&u<1?Math.sin(u*18+i)*.035*(1-u):0)*(Number(s.sway)||0);
      const inflate=Math.max(.35,Number(s.inflate)||1),sx=scale*(1+(inflate-1)*.16),sy=scale*inflate;
      const alpha=enter*Math.min(1,Math.max(.12,pop*2.2));if(alpha<=.005)return;
      ctx.save();ctx.globalAlpha*=alpha;ctx.translate(wd.x+wd.width/2,wd.y);ctx.rotate(wobble);ctx.scale(sx,sy);
      ctx.translate(-(wd.x+wd.width/2),-wd.y);
      const d=Math.max(0,Math.min(20,Number(s.depth)||0));
      ctx.shadowColor='rgba(32,0,12,.65)';ctx.shadowBlur=size*.12;ctx.shadowOffsetX=d*.25;ctx.shadowOffsetY=d*.55;
      ctx.font=weight+' '+size+'px "'+family+'", cursive';ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineJoin='round';
      for(let z=Math.ceil(d);z>=1;z--){ctx.fillStyle=shade(.35+.32*(1-z/Math.max(1,d)));ctx.fillText(wd.text,wd.x+z*.3,wd.y+z*.55);}
      ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
      ctx.lineWidth=Math.max(1,size*.055);ctx.strokeStyle='rgba(91,0,25,.92)';ctx.strokeText(wd.text,wd.x,wd.y);
      ctx.save();ctx.globalAlpha*=.8;ctx.lineWidth=Math.max(1,size*.018);ctx.strokeStyle='rgba(255,112,139,.95)';ctx.strokeText(wd.text,wd.x-size*.006,wd.y-size*.008);ctx.restore();
      const g=ctx.createLinearGradient(0,wd.y-size*.52,0,wd.y+size*.55),gloss=Number(s.gloss)||0;
      g.addColorStop(0,'#fff5f7');g.addColorStop(.075,'#ffffff');g.addColorStop(.16,shade(1.9));
      g.addColorStop(.25,shade(1.35));g.addColorStop(.37,shade(1.02));g.addColorStop(.52,shade(.86));g.addColorStop(.64,shade(1.14));g.addColorStop(.76,shade(.72));g.addColorStop(.9,shade(.56));g.addColorStop(1,shade(.42));
      ctx.fillStyle=g;ctx.fillText(wd.text,wd.x,wd.y);
      // Dark underside shading preserves the inflated wet-plastic volume.
      ctx.save();ctx.globalCompositeOperation='multiply';const under=ctx.createLinearGradient(0,wd.y-size*.05,0,wd.y+size*.53);under.addColorStop(0,'rgba(75,0,18,0)');under.addColorStop(.55,'rgba(75,0,18,.08)');under.addColorStop(1,'rgba(35,0,12,.48)');ctx.fillStyle=under;ctx.fillText(wd.text,wd.x,wd.y);ctx.restore();
      if(gloss>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=Math.min(.95,gloss*.72);
        ctx.beginPath();ctx.ellipse(wd.x+wd.width*.46,wd.y-size*.22,Math.max(2,wd.width*.29),Math.max(1,size*.055),-.06,Math.PI,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();
        const band=ctx.createLinearGradient(wd.x,wd.y-size*.3,wd.x,wd.y+size*.02);band.addColorStop(0,'rgba(255,255,255,0)');band.addColorStop(.5,'rgba(255,255,255,.6)');band.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=band;ctx.fillRect(wd.x,wd.y-size*.31,wd.width,size*.34);ctx.restore();}
      ctx.restore();
    });
    // Wet-plastic bounce-light glints and a subtle moving highlight across the line.
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(.5,(Number(s.gloss)||0)*.22);
    const sweep=((time-start)*.24%1)*w,sg=ctx.createLinearGradient(sweep-size*.4,0,sweep+size*.4,0);
    sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(.5,'rgba(255,255,255,.32)');sg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sg;ctx.fillRect(0,h*.25,w,h*.5);ctx.restore();ctx.restore();
  }
  const inkFontFaces = new Map();
  function inkFont(s){
    if(s.font==='__upload' && s.uploadedFamily)return s.uploadedFamily;
    if(s.font==='__google')return String(s.googleFont||'cursive').trim()||'cursive';
    return s.font||'Mr Dafoe';
  }
  const inkPaperCache = new Map();
  function paintInkPaper(ctx,w,h,color,texture){
    const key=[Math.round(w),Math.round(h),color,texture?'grain':'plain'].join('|');
    let paper=inkPaperCache.get(key);
    if(!paper){
      paper=document.createElement('canvas');paper.width=Math.max(1,Math.round(w));paper.height=Math.max(1,Math.round(h));
      const p=paper.getContext('2d');p.fillStyle=color||'#f0eee7';p.fillRect(0,0,paper.width,paper.height);
      if(texture){
        const shade=p.createLinearGradient(0,0,paper.width,paper.height);
        shade.addColorStop(0,'rgba(255,255,255,.23)');shade.addColorStop(.5,'rgba(255,255,255,0)');shade.addColorStop(1,'rgba(77,65,48,.09)');
        p.fillStyle=shade;p.fillRect(0,0,paper.width,paper.height);
        const area=paper.width*paper.height,grainCount=Math.min(18000,Math.max(700,Math.round(area/420)));
        for(let i=0;i<grainCount;i++){
          const seed=i+paper.width*.37+paper.height*.71;
          const x=hash(seed+1)*paper.width,y=hash(seed+2)*paper.height;
          const alpha=.018+hash(seed+3)*.065;
          p.fillStyle='rgba(67,59,46,'+alpha.toFixed(3)+')';
          const r=.35+hash(seed+4)*1.25;p.fillRect(x,y,r,r*.7);
        }
        const fiberCount=Math.min(1200,Math.max(100,Math.round(area/8000)));
        for(let i=0;i<fiberCount;i++){
          const seed=i+paper.height*1.91,x=hash(seed+31)*paper.width,y=hash(seed+32)*paper.height;
          p.strokeStyle='rgba(87,77,62,'+(0.025+hash(seed+33)*.045).toFixed(3)+')';
          p.lineWidth=.4+hash(seed+34)*.7;p.beginPath();p.moveTo(x,y);p.lineTo(x+(hash(seed+35)-.5)*14,y+(hash(seed+36)-.5)*2.4);p.stroke();
        }
        const vignette=p.createRadialGradient(paper.width*.5,paper.height*.48,Math.min(paper.width,paper.height)*.12,paper.width*.5,paper.height*.5,Math.max(paper.width,paper.height)*.72);
        vignette.addColorStop(0,'rgba(255,255,255,0)');vignette.addColorStop(1,'rgba(62,52,38,.10)');p.fillStyle=vignette;p.fillRect(0,0,paper.width,paper.height);
      }
      inkPaperCache.set(key,paper);if(inkPaperCache.size>4)inkPaperCache.delete(inkPaperCache.keys().next().value);
    }
    ctx.drawImage(paper,0,0,w,h);
  }
  function inkTextRows(ctx,text,maxW,family,weight,tracking){
    const words=String(text||'').trim().replace(/\\s+/g,' ').split(' ').filter(Boolean),rows=[];let row='';
    const measure=value=>{if(!tracking)return ctx.measureText(value).width;return ctx.measureText(value).width+Math.max(0,Array.from(value).length-1)*tracking;};
    for(const word of words){
      const test=row?row+' '+word:word;
      if(row&&measure(test)>maxW){rows.push(row);row=word;}else row=test;
    }
    if(row)rows.push(row);
    while(rows.length>4)rows.splice(3,2,rows[3]+' '+rows[4]);
    return rows;
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
    if(!s.loop&&t>lastEnd){
      if(!s.transparent)paintInkPaper(ctx,w,h,s.bg,s.paper);
      return;
    }
    const items=linesFor(source,t);if(!items.length)return;
    const item=items[items.length-1],line=item.line,txt=String(line.text||'').trim();if(!txt)return;
    if(!s.transparent)paintInkPaper(ctx,w,h,s.bg,s.paper);
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
      if(!spinFontReq[fontKey]){
        spinFontReq[fontKey]=1;
        document.fonts.load(weight+' 48px "'+family+'"').then(()=>window.kefeLyrics?.redraw?.()).catch(()=>{});
      }
    }
    const maxW=w*.84,maxH=h*.62,tracking=(Number(s.tracking)||0)*Math.min(w,h),lineScale=Math.max(.9,Math.min(1.6,Number(s.lineSpacing)||1.12));
    const ratio=s.aspect==='match'?w/h:Number(s.aspect.split('/')[0])/Number(s.aspect.split('/')[1]);
    const boxW=ratio<w/h?Math.min(maxW,maxH*ratio):maxW,boxH=ratio>w/h?Math.min(maxH,maxW/ratio):maxH;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineCap='round';
    ctx.font=weight+' 100px "'+family+'", cursive';
    let size=Math.min(boxH*.55,100*boxW/Math.max(1,ctx.measureText(txt).width));
    if(s.sizing==='same'){
      for(const row of source){const rowText=String(row.text||'').trim();if(rowText){const width=ctx.measureText(rowText).width;if(width>0)size=Math.min(size,100*boxW/width);}}
    }
    size=Math.max(12,size);
    let rows;
    for(let attempt=0;attempt<5;attempt++){
      ctx.font=weight+' '+size+'px "'+family+'", cursive';
      rows=inkTextRows(ctx,txt,boxW*.96,family,weight,tracking);
      const widest=Math.max(1,...rows.map(row=>ctx.measureText(row).width+Math.max(0,Array.from(row).length-1)*tracking));
      const totalH=size*lineScale*rows.length;
      if((widest<=boxW&&totalH<=boxH)||size<=12)break;
      size*=Math.min(.96,boxW/widest,boxH/totalH);
    }
    ctx.font=weight+' '+size+'px "'+family+'", cursive';
    const widths=rows.map(row=>ctx.measureText(row).width+Math.max(0,Array.from(row).length-1)*tracking);
    const textW=Math.max(...widths),lineH=size*lineScale,totalH=lineH*rows.length;
    const x=w/2,y=h/2,startTime=Number(line.time)||item.start,endTime=Math.max(startTime+.2,Number(line.endTime)||item.end);
    const duration=endTime-startTime,elapsed=Math.max(0,t-startTime),speed=Math.max(.25,Number(s.speed)||1);
    const writeDur=Math.max(.18,Math.min(Number(s.write)/25/speed,duration*.78)),morphDur=Math.max(.12,Number(s.morph)/25/speed);
    const writeProgress=clamp(elapsed/writeDur),easedWrite=writeProgress*writeProgress*(3-2*writeProgress);
    const exitStart=Math.max(writeDur+Number(s.hold),duration-morphDur),transitionProgress=clamp((elapsed-exitStart)/Math.max(.08,morphDur));
    const hasNext=!!source[item.index+1]&&Number(source[item.index+1].time)<=endTime+.2;
    const alpha=1-((hasNext||s.exit==='fade')?transitionProgress:0),writing=elapsed<writeDur;
    const ink=s.ink||'#17201d',top=y-totalH/2+lineH/2;
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=ink;ctx.shadowColor=ink;ctx.shadowBlur=size*.012;
    rows.forEach((row,ri)=>{
      const rowW=widths[ri],rowY=top+ri*lineH,progress=clamp(easedWrite*rows.length-ri);
      const reveal=rowW*progress,left=x-rowW/2;
      if(writing){
        ctx.save();ctx.beginPath();
        const edge=left+reveal,amp=size*.012;
        ctx.moveTo(left-size*.02,rowY-size*.8);ctx.lineTo(edge-amp,rowY-size*.8);
        ctx.bezierCurveTo(edge+amp,rowY-size*.4,edge-amp,rowY-size*.15,edge+amp*.25,rowY);
        ctx.bezierCurveTo(edge-amp,rowY+size*.22,edge+amp,rowY+size*.55,edge-amp,rowY+size*.8);
        ctx.lineTo(left-size*.02,rowY+size*.8);ctx.closePath();ctx.clip();
      }
      if(Math.abs(tracking)<.001||typeof ctx.letterSpacing==='string'){
        if('letterSpacing' in ctx)ctx.letterSpacing=tracking+'px';
        ctx.fillText(row,x,rowY);
      }else{
        const chars=Array.from(row);let cx=x-(rowW/2);
        chars.forEach(ch=>{ctx.fillText(ch,cx+ctx.measureText(ch).width/2,rowY);cx+=ctx.measureText(ch).width+tracking;});
      }
      if(writing)ctx.restore();
    });
    ctx.restore();
    const splatter=clamp(Number(s.splatter)||0,0,1.5);
    if(splatter>0&&(writing||writeProgress>=1)){
      const count=Math.min(64,Math.round(24*splatter)),edge=x-textW/2+textW*easedWrite;
      ctx.save();
      for(let i=0;i<count;i++){
        const seed=i+item.index*211,birth=.08+.84*hash(seed+2),age=writeProgress-birth;
        if(age<0||age>.42)continue;
        const spread=size*(.035+hash(seed+4)*.16)*splatter,px=edge+(hash(seed+6)-.5)*spread*1.4,py=y+(hash(seed+8)-.5)*size*.6;
        const radius=Math.max(.35,size*(.001+hash(seed+12)*.003))*splatter;
        ctx.globalAlpha=alpha*(.1+.22*hash(seed+14))*clamp(1-age/.42);ctx.fillStyle=ink;ctx.beginPath();
        ctx.ellipse(px,py,radius*(1+hash(seed+16)),radius*(.7+hash(seed+18)*.8),hash(seed+20)*Math.PI,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    if(hasNext&&transitionProgress>0){
      const nextText=String(source[item.index+1].text||'').trim();
      if(nextText){ctx.save();ctx.globalAlpha=transitionProgress;ctx.font=weight+' '+size+'px "'+family+'", cursive';ctx.fillStyle=ink;ctx.shadowColor=ink;ctx.shadowBlur=size*.012;ctx.fillText(nextText,x,y);ctx.restore();}
    }
    if(elapsed>duration&&!s.loop&&s.exit==='cut')ctx.clearRect(0,0,w,h);
    ctx.restore();
  }
  E.spin=renderSpin; E.premium=renderDevotion; E.dustoff=renderDust; E.wrapslide=renderWrapSlide; E.inkscript=renderInkScript; E.chrome=renderChrome; E.gel=renderGel;

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
    host.appendChild(root);
    const sync=()=>Object.entries(panels).forEach(([key,panel])=>{panel.hidden=!active(key);});
    window.addEventListener('kefe-effect-change',sync);window.addEventListener('kefe-effects-ready',sync);sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildControls);else buildControls();
})();
