/* KEFE — Premium visualiser pack
 * Ten production-safe, audio-reactive visual worlds.
 * Canvas2D implementation keeps preview/export compatibility with KEFE's
 * existing frame renderer while using layered procedural rendering.
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
  function fin(v, d) { var n = Number(v); return isFinite(n) ? n : (d == null ? 0 : d); }
  var shared = window.kefeVisualiserShared || {};
  var noise = shared.noise || {};
  var palette = shared.palette || {};
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
  function rgb(h, s, v, a) {
    if (typeof palette.rgb === 'function') return palette.rgb(h, s, v, a);
    h = ((h % 1) + 1) % 1;
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var c = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  }
  function audio(frame) {
    return typeof shared.audioFeatures === 'function' ? shared.audioFeatures(frame) : {
      bass: clamp(frame && frame.bass, 0, 1.4), mids: clamp(frame && frame.mids, 0, 1.4),
      treble: clamp(frame && frame.treble, 0, 1.4), energy: clamp(frame && frame.energy, 0, 1.4), flux: clamp(frame && frame.flux, 0, 1.4)
    };
  }
  function controls(appState, key) {
    var st = appState && appState.style ? appState.style : {};
    function pick(k, d, lo, hi) {
      var raw = st[key + k];
      var n = Number(raw);
      if (!isFinite(n)) n = d;
      return clamp(n, lo, hi);
    }
    return {
      react: pick('React', 1, 0, 2),
      motion: pick('Motion', 1, 0, 2),
      detail: pick('Detail', 1, .4, 1.8),
      glow: pick('Glow', 1, 0, 2)
    };
  }

  /* 1 — FERROFLUID SCULPTURE
     A polished liquid-metal crown. Bass controls radial pressure; mids make
     individual spikes breathe; treble adds fine specular sparks. */
  function ferrofluid(ctx, w, h, time, frame, appState) {
    var s = controls(appState, 'ferrofluid');
    var a = audio(frame), cx = fin(w) * .5, cy = fin(h) * .5, min = fin(Math.min(fin(w), fin(h)), 1);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,2,4,.22)';
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation = 'lighter';
    var n = Math.max(48, Math.round(96 * fin(s.detail, 1))), R = min * (.16 + fin(a.b) * .055 * fin(s.react, 1)), pulse = 1 + fin(a.b) * .22 * fin(s.react, 1);
    for (var i=0;i<n;i++) {
      var ang = TAU*i/n + time*.08*s.motion;
      var wave = .72 + .28*Math.sin(i*2.37 + time*1.4 + a.m*4*s.react);
      var spike = min * (.035 + .13*a.b + .045*a.m*wave);
      var len = R * pulse + spike;
      var x = cx + Math.cos(ang) * len, y = cy + Math.sin(ang) * len;
      var grad = ctx.createLinearGradient(fin(cx),fin(cy),fin(x,fin(cx)),fin(y,fin(cy)));
      grad.addColorStop(0,'rgba(245,248,255,.08)');
      grad.addColorStop(.55,'rgba(170,185,205,.22)');
      grad.addColorStop(.82,'rgba(255,255,255,' + (.18+a.t*.4*s.glow*s.glow).toFixed(3) + ')');
      grad.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=grad; ctx.lineWidth=Math.max(1,min*(.004+a.t*.006*s.glow));
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(ang)*R*.55,cy+Math.sin(ang)*R*.55); ctx.lineTo(x,y); ctx.stroke();
    }
    var g=ctx.createRadialGradient(cx-min*.08,cy-min*.1,min*.02,cx,cy,min*.34);
    g.addColorStop(0,'rgba(255,255,255,.96)');
    g.addColorStop(.16,'rgba(190,205,220,.78)');
    g.addColorStop(.48,'rgba(42,48,58,.82)');
    g.addColorStop(.78,'rgba(5,7,10,.98)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,min*.30*(1+a.b*.05),0,TAU); ctx.fill();
    ctx.restore();
  }

  /* 2 — LIQUID GLASS PRISM
     Refraction-like layered caustics. No external assets or DOM dependencies. */
  function liquidGlass(ctx,w,h,time,frame,appState){
    var s=controls(appState,'liquidglass'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    var env=shared.envelopes||{};
    var attack=typeof env.attackRelease==='function'?env.attackRelease(a.energy,.16,.28):a.energy;
    var pulse=1+attack*.055*s.react;
    ctx.save();ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(1,3,10,.22)';ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='screen';
    var layers=Math.max(5,Math.round(11*s.detail));
    for(var k=0;k<layers;k++){
      var z=k/(layers-1),ang=time*(.055+.012*z)*s.motion+k*.61;
      var rx=min*(.16+z*.22)*pulse,ry=rx*(.34+.18*Math.sin(time*.22+k*.9));
      ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);ctx.beginPath();
      for(var i=0;i<=220;i++){
        var q=i/220*TAU;
        var warp=.055*Math.sin(q*5-time*.34*s.motion+k)+.028*Math.sin(q*11+time*.19+k*1.7)*a.m*s.react;
        var rr=1+warp,x=Math.cos(q)*rx*rr,y=Math.sin(q)*ry*(1+.045*Math.sin(q*3+time*.4))*rr;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.closePath();
      ctx.strokeStyle=rgb(.53+z*.18+a.t*.045,.34,.9,.045+z*.018+a.t*.035*s.glow);
      ctx.lineWidth=min*(.0025+.0035*(1-z)+a.e*.002*s.react);ctx.stroke();ctx.restore();
    }
    var bands=Math.max(7,Math.round(16*s.detail));
    for(var b=0;b<bands;b++){
      var yy=(b+.5)/bands*h;ctx.beginPath();
      for(var p=0;p<=90;p++){
        var u=p/90,x2=u*w,y2=yy+Math.sin(u*TAU*(1.1+b*.07)+time*.55*s.motion+b)*h*.018+Math.sin(u*TAU*3-time*.23*s.motion)*h*.012*a.b*s.react;
        p?ctx.lineTo(x2,y2):ctx.moveTo(x2,y2);
      }
      ctx.strokeStyle=rgb(.58+b*.009,.48,.95,.025+a.t*.018*s.glow);ctx.lineWidth=Math.max(1,min*.0022);ctx.stroke();
    }
    var g=ctx.createRadialGradient(cx-min*.15,cy-min*.18,0,cx,cy,min*.48);
    g.addColorStop(0,'rgba(255,255,255,'+(.20+a.t*.20*s.glow)+')');g.addColorStop(.28,'rgba(185,215,255,'+(.10+a.m*.08)+')');g.addColorStop(.62,'rgba(75,120,190,.055)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,min*.48,0,TAU);ctx.fill();ctx.restore();
  }

  /* 3 — CINEMATIC FLUID */
  function cinematicFluid(ctx,w,h,time,frame,appState){
    var s=controls(appState,'cinematicfluid'),a=audio(frame);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalCompositeOperation='lighter';
    var fluidCount=Math.max(80,Math.round(260*s.detail));
    for(var i=0;i<fluidCount;i++){
      var x0=typeof noise.hash==='function'?noise.hash(i*2+11):hash(i*2+11);
      var y0=typeof noise.hash==='function'?noise.hash(i*2+23):hash(i*2+23);
      var h0=typeof noise.hash==='function'?noise.hash(i+91):hash(i+91);
      var flow=typeof noise.value2==='function' ? noise.value2(x0*4+time*.18*s.motion,y0*4-time*.14*s.motion,i+7) : 0.5;
      var ang=(flow-.5)*Math.PI*2 + Math.sin(y0*9+time*.37*s.motion)*.7 + Math.cos(x0*7-time*.29*s.motion)*.7;
      ang*=1.2+a.m*2.2*s.react;
      var travel=(time*.035*s.motion + a.e*.012*s.react);
      var px=(x0+Math.cos(ang)*travel+1)%1, py=(y0+Math.sin(ang)*travel+1)%1;
      px=(px+Math.sin(time*.21*s.motion+i*.17)*.018*a.m*s.react+1)%1;
      py=(py+Math.cos(time*.19*s.motion+i*.13)*.018*a.b*s.react+1)%1;
      var r=2+a.t*4*s.glow;
      ctx.fillStyle=rgb(.56+h0*.18,.55,.45+a.e*.5*s.react,.12+a.e*.12*s.glow);
      ctx.beginPath();ctx.arc(px*w,py*h,r,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  /* 4 — FRACTAL PLANET */
  function fractalPlanet(ctx,w,h,time,frame,appState){
    var s=controls(appState,'fractalplanet'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h),R=min*.25*(1+a.b*.08*s.react);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var g=ctx.createRadialGradient(cx-R*.35,cy-R*.45,R*.02,cx,cy,R*1.3);
    g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.25,'rgba(130,160,190,.48)');g.addColorStop(.58,'rgba(20,35,55,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R*1.18,0,TAU);ctx.fill();
    for(var j=0,rings=Math.max(6,Math.round(14*s.detail));j<rings;j++){
      ctx.beginPath();
      for(var i=0;i<=100;i++){var q=i/100*TAU;var n=Math.sin(q*(3+j%4)+time*.12*s.motion+j)+.5*Math.sin(q*9-time*.08*s.motion);var rr=R*(.82+j*.012+n*(.025+a.b*.05*s.react));var x=cx+Math.cos(q)*rr,y=cy+Math.sin(q)*rr*.78;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle='rgba(210,225,240,'+(.025+a.m*.025*s.react)+')';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.strokeStyle='rgba(180,215,255,'+(.16+a.t*.25*s.glow)+')';ctx.lineWidth=min*.004;ctx.beginPath();ctx.arc(cx,cy,R*1.15,0,TAU);ctx.stroke();ctx.restore();
  }

  /* 5 — COSMIC ATTRACTOR */
  function cosmicAttractor(ctx,w,h,time,frame,appState){
    var s=controls(appState,'cosmicattractor'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalCompositeOperation='lighter';
    var attractCount=Math.max(250,Math.round(700*s.detail));
    for(var i=0;i<attractCount;i++){
      var sx=typeof noise.hash==='function'?noise.hash(i*3+1):hash(i*3+1);
      var sy=typeof noise.hash==='function'?noise.hash(i*3+2):hash(i*3+2);
      var sz=typeof noise.hash==='function'?noise.hash(i*3+3):hash(i*3+3);
      var phase=typeof noise.hash==='function'?noise.hash(i+701):hash(i+701);
      var baseX=(sx-.5)*.9, baseY=(sy-.5)*.9, baseZ=(sz-.5)*.9;
      var orbit=time*.32*s.motion + phase*TAU;
      var fieldX=Math.sin(baseY*2.4+time*.32*s.motion)*.12*(1+a.b*s.react);
      var fieldY=Math.sin(baseX*1.7-time*.21*s.motion)*.12*(1+a.m*s.react);
      var fieldZ=Math.cos(baseX+baseY+time*.18*s.motion)*.10;
      var x0=baseX+fieldX*Math.sin(orbit*.73+i*.011), y0=baseY+fieldY*Math.cos(orbit*.61+i*.017), z0=baseZ+fieldZ*Math.sin(orbit*.49+i*.007);
      var ang=time*.12*s.motion, x=x0*Math.cos(ang)-z0*Math.sin(ang), y=y0, z=x0*Math.sin(ang)+z0*Math.cos(ang);
      var sc=1/(1+z*.7), px=cx+x*min*.9*sc,py=cy+y*min*.9*sc;
      ctx.fillStyle=rgb(.58+z*.1,.7,.55+a.t*.4,.18+a.e*.35*s.glow);ctx.beginPath();ctx.arc(px,py,1+sc*2.2,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  /* 6 — GYROID CRYSTAL */
  function gyroidCrystal(ctx,w,h,time,frame,appState){
    var s=controls(appState,'gyroidcrystal'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var layer=0;layer<Math.max(16,Math.round(34*s.detail));layer++){
      var rr=min*(.07+layer*.007)*(1+a.b*.18*s.react), rot=time*.15*s.motion+layer*.17;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);
      var pts=28;
      ctx.beginPath();
      for(var i=0;i<=pts;i++){var q=i/pts*TAU;var gy=Math.sin(q*3+time*.6)+Math.sin(q*5-time*.3);var rad=rr*(1+.16*gy+a.m*.06*s.react*Math.sin(q*11));var x=Math.cos(q)*rad,y=Math.sin(q)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle=rgb(.54+layer*.004,.3,.65+a.t*.25,(.025+a.t*.015)*(.4+.6*s.glow));ctx.lineWidth=min*(.0015+a.e*.001*s.react);ctx.stroke();ctx.restore();
    }
    ctx.restore();
  }

  /* 7 — SONIC METABALL ORGANISM */
  function metaball(ctx,w,h,time,frame,appState){
    var s=controls(appState,'metaball'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    var env=shared.envelopes||{};
    var kick=typeof env.impulse==='function'?env.impulse(a.bass,.52,1.6):a.bass;
    var N=Math.max(5,Math.round(8*s.detail)),bodies=[];
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.20)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var i=0;i<N;i++){
      var phase=TAU*i/N,ang=phase+time*(.18+.035*i)*s.motion,orbit=.18+(i%3)*.028;
      var x=cx+Math.cos(ang*1.07+i*.41)*min*orbit*(1+a.m*.18*s.react);
      var y=cy+Math.sin(ang*.83-i*.27)*min*(orbit*.72)*(1+a.b*.14*s.react);
      var r=min*(.055+.018*Math.sin(i*2.31)+a.b*.025*s.react)*(1+kick*.32*s.react);
      bodies.push({x:x,y:y,r:r});
    }
    for(var j=0;j<bodies.length;j++){
      var q=bodies[j],g=ctx.createRadialGradient(q.x-q.r*.3,q.y-q.r*.35,0,q.x,q.y,q.r*1.55);
      g.addColorStop(0,'rgba(255,255,255,'+(.72+a.t*.22*s.glow)+')');
      g.addColorStop(.28,rgb(.53+j/N*.18,.62,.88,.30+a.e*.14*s.glow));g.addColorStop(.68,rgb(.58+j/N*.12,.55,.72,.10));g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,q.r*1.6,0,TAU);ctx.fill();
    }
    for(var m=0;m<bodies.length;m++){
      var p=bodies[m],n=bodies[(m+1)%bodies.length],dx=n.x-p.x,dy=n.y-p.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<min*.30){
        var grad=ctx.createLinearGradient(p.x,p.y,n.x,n.y);grad.addColorStop(0,rgb(.52,.72,.95,.08+a.m*.08));grad.addColorStop(.5,rgb(.62,.55,1,.16+a.e*.10*s.glow));grad.addColorStop(1,rgb(.70,.50,.95,.08+a.t*.08));
        ctx.strokeStyle=grad;ctx.lineWidth=Math.max(2,min*.018+a.b*min*.025*s.react);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(n.x,n.y);ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* 8 — HOLOGRAPHIC RIBBON SCULPTURE */
  function ribbon(ctx,w,h,time,frame,appState){
    var s=controls(appState,'holographicribbon'),a=audio(frame),min=Math.min(w,h);
    var env=shared.envelopes||{};
    var transient=typeof env.impulse==='function'?env.impulse(a.flux,.48,1.25):a.flux;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(1,2,8,.18)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var bands=Math.max(4,Math.round(9*s.detail));
    for(var band=0;band<bands;band++){
      var offset=(band-(bands-1)/2)*min*.022,phase=band*.57;ctx.beginPath();
      for(var i=0;i<=240;i++){
        var u=i/240,x=u*w,wave=Math.sin(u*TAU*(1.15+band*.075)+time*(.34+band*.018)*s.motion+phase);
        wave+=.38*Math.sin(u*TAU*2.7-time*.21*s.motion+phase*2.1)*a.m*s.react+.18*Math.sin(u*TAU*6.2+time*.16*s.motion)*a.b*s.react;
        var y=h*.5+offset+wave*h*(.115+.014*band)*(1+a.e*.16*s.react);i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.strokeStyle=rgb(.50+band*.035+Math.sin(time*.08)*.025,.72,.92,.11+a.t*.045*s.glow);
      ctx.lineWidth=min*(.0035+.006*(1-band/bands)+a.b*.006*s.react);ctx.lineCap='round';ctx.stroke();
    }
    ctx.beginPath();
    for(var j=0;j<=260;j++){
      var v=j/260,x2=v*w,y2=h*.5+Math.sin(v*TAU*1.18+time*.42*s.motion)*h*.14+Math.sin(v*TAU*4.8-time*.27)*h*.022*a.m*s.react;
      j?ctx.lineTo(x2,y2):ctx.moveTo(x2,y2);
    }
    ctx.strokeStyle=rgb(.57,.42,1,.32+a.t*.16*s.glow+transient*.18);ctx.lineWidth=min*(.0025+a.e*.003);ctx.stroke();
    if(transient>0){ctx.globalCompositeOperation='screen';for(var spark=0;spark<24;spark++){
      var u2=typeof noise.hash==='function'?noise.hash(spark*7+91):hash(spark*7+91);
      var y3=h*.5+Math.sin(u2*TAU*1.18+time*.42*s.motion)*h*.14,rr=min*(.002+u2*.004)*transient;
      ctx.fillStyle=rgb(.57+u2*.2,.25,.98,.35*transient);ctx.beginPath();ctx.arc(u2*w,y3,rr,0,TAU);ctx.fill();
    }}
    ctx.restore();
  }

  /* 9 — BLACK-HOLE ACCRETION */
  function blackHole(ctx,w,h,time,frame,appState){
    var s=controls(appState,'blackhole'),a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    var env=shared.envelopes||{};
    var kick=typeof env.impulse==='function'?env.impulse(a.bass,.46,1.3):a.bass;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.30)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var star=0;star<180;star++){
      var sx=typeof noise.hash==='function'?noise.hash(star*3+4):hash(star*3+4),sy=typeof noise.hash==='function'?noise.hash(star*3+5):hash(star*3+5),sv=typeof noise.hash==='function'?noise.hash(star*3+6):hash(star*3+6);
      var tw=.35+.65*Math.sin(time*(.25+sv*.5)+star);ctx.fillStyle='rgba(190,215,255,'+(.025+sv*.08*tw)+')';ctx.fillRect(sx*w,sy*h,Math.max(.6,sv*1.7),Math.max(.6,sv*1.7));
    }
    var diskCount=Math.min(900,Math.max(320,Math.round(700*s.detail)));
    for(var i=0;i<diskCount;i++){
      var r0=.075+.42*(typeof noise.hash==='function'?noise.hash(i*5+1):hash(i*5+1)),z=typeof noise.hash==='function'?noise.hash(i*5+2):hash(i*5+2);
      var ang=(typeof noise.hash==='function'?noise.hash(i*5+3):hash(i*5+3))*TAU+time*(.18+.62*(1-r0))*s.motion*(1+a.e*.8*s.react);
      var warp=.012*Math.sin(ang*3+time*.4+i*.01)*a.m*s.react,rr=min*r0*(1+kick*.12*s.react);
      var px=cx+Math.cos(ang)*rr,py=cy+Math.sin(ang)*rr*(.28+.10*z);px+=Math.sin(ang*2)*min*warp;py+=Math.cos(ang*3)*min*warp*.5;
      var heat=.35+.65*(1-r0)+a.t*.22;ctx.fillStyle=rgb(.04+heat*.055,.82,.55+heat*.35,.10+a.e*.18*s.glow);ctx.beginPath();ctx.arc(px,py,.7+z*2.1+a.t*1.4*s.glow,0,TAU);ctx.fill();
    }
    var ringR=min*(.105+kick*.012*s.react),rg=ctx.createRadialGradient(cx,cy,ringR*.55,cx,cy,ringR*1.55);
    rg.addColorStop(0,'rgba(0,0,0,1)');rg.addColorStop(.48,'rgba(0,0,0,.98)');rg.addColorStop(.66,'rgba(255,155,50,'+(.30+a.b*.32*s.react)+')');rg.addColorStop(.76,'rgba(255,220,150,'+(.18+a.t*.28*s.glow)+')');rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(cx,cy,ringR*1.7,0,TAU);ctx.fill();
    ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(255,245,215,'+(.18+a.t*.30*s.glow)+')';ctx.lineWidth=min*(.004+.006*a.b*s.react);ctx.beginPath();ctx.ellipse(cx,cy,ringR*1.08,ringR*.38,0,0,TAU);ctx.stroke();ctx.restore();
  }

  /* 10 — LIVING NEURAL NETWORK */
  function neural(ctx,w,h,time,frame,appState){
    var s=controls(appState,'neuralnetwork'),a=audio(frame);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var count=75, pts=new Array(count);
    for(var i=0;i<count;i++){
      var x0=typeof noise.hash==='function'?noise.hash(i+1):hash(i+1);
      var y0=typeof noise.hash==='function'?noise.hash(i+301):hash(i+301);
      var v=typeof noise.hash==='function'?noise.hash(i+601):hash(i+601);
      var phase=typeof noise.hash==='function'?noise.hash(i+901)*TAU:hash(i+901)*TAU;
      var p=phase+time*.22*s.motion*(.7+a.e*2.4*s.react);
      var x=(x0+Math.sin(p)*.035*s.motion*(.4+a.m*s.react)+1)%1;
      var y=(y0+Math.cos(p*1.17)*.035*s.motion*(.4+a.b*s.react)+1)%1;
      pts[i]={x:x,y:y,v:v};
    }
    for(var i=0;i<count;i++)for(var j=i+1;j<count;j++){
      var p=pts[i],q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<.19*s.detail){var alpha=(.19-d)/.19*(.06+a.e*.16)*(.4+.6*s.glow);ctx.strokeStyle=rgb(.56,.55,.65,alpha);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x*w,p.y*h);ctx.lineTo(q.x*w,q.y*h);ctx.stroke();}
    }
    for(var k=0;k<count;k++){var p=pts[k],r=1.5+p.v*2+a.b*4*s.react;ctx.fillStyle=rgb(.57+p.v*.08,.7,.7+a.t*.3,(.28+a.e*.35)*(.4+.6*s.glow));ctx.beginPath();ctx.arc(p.x*w,p.y*h,r,0,TAU);ctx.fill();}
    ctx.restore();
  }

  window.kefePremiumVisualisers = {
    ferrofluid: ferrofluid,
    liquidglass: liquidGlass,
    cinematicfluid: cinematicFluid,
    fractalplanet: fractalPlanet,
    cosmicattractor: cosmicAttractor,
    gyroidcrystal: gyroidCrystal,
    metaball: metaball,
    holographicribbon: ribbon,
    blackhole: blackHole,
    neuralnetwork: neural
  };
})();