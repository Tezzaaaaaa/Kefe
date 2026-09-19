/* KEFE — Premium visualiser pack
 * Ten production-safe, audio-reactive visual worlds.
 * Canvas2D implementation keeps preview/export compatibility with KEFE's
 * existing frame renderer while using layered procedural rendering.
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var state = {};

  function clamp(v, a, b) { return Math.max(a, Math.min(b, Number(v) || 0)); }
  function fin(v, d) { var n = Number(v); return isFinite(n) ? n : (d == null ? 0 : d); }
  function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
  function rgb(h, s, v, a) {
    h = ((h % 1) + 1) % 1;
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var c = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i % 6];
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
  }
  function audio(frame) {
    return {
      b: clamp(frame && frame.bass, 0, 1.4),
      m: clamp(frame && frame.mids, 0, 1.4),
      t: clamp(frame && frame.treble, 0, 1.4),
      e: clamp(frame && frame.energy, 0, 1.4)
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
    var s = controls(appState, 'liquidglass');
    var a=audio(frame), cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save(); ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(1,2,8,.16)';ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='screen';
    for(var k=0;k<9;k++){
      var ang=time*(.05+k*.006)*s.motion+k*.71, rx=min*(.18+k*.025+a.b*.04*s.react*s.react), ry=rx*(.42+.12*Math.sin(time*.3+k));
      ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);
      ctx.strokeStyle='rgba(225,235,255,'+(.08+a.t*.05*s.glow)+')';ctx.lineWidth=min*(.012+a.e*.006*s.react);
      ctx.beginPath();
      for(var i=0;i<=180;i++){var q=i/180*TAU;var rr=1+.13*Math.sin(q*3+time*.7+k)+.05*a.m*Math.sin(q*7-time);var x=Math.cos(q)*rx*rr,y=Math.sin(q)*ry*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.closePath();ctx.stroke();ctx.restore();
    }
    var g=ctx.createRadialGradient(cx-min*.12,cy-min*.16,0,cx,cy,min*.42);
    g.addColorStop(0,'rgba(255,255,255,'+(.22+a.t*.18*s.glow)+')');g.addColorStop(.45,'rgba(145,190,255,.09)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,min*.42,0,TAU);ctx.fill();ctx.restore();
  }

  /* 3 — CINEMATIC FLUID */
  var fluid = Array.from({length:260},function(_,i){return {x:hash(i)*1,y:hash(i+17)*1,vx:0,vy:0,h:hash(i+91)};});
  function cinematicFluid(ctx,w,h,time,frame,appState){
    var a=audio(frame);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.075)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var i=0;i<fluid.length;i++){
      var p=fluid[i], px=p.x*w,py=p.y*h;
      var ang=Math.sin(p.x*7+time*.45*s.motion)+Math.cos(p.y*9-time*.31*s.motion);
      ang*=1.7+a.m*3*s.react;
      p.vx+=(Math.cos(ang)*.0007 + (w*.5-px)/w*.00005*a.b*s.react);
      p.vy+=(Math.sin(ang)*.0007 + (h*.5-py)/h*.00005*a.b);
      p.vx*=.985;p.vy*=.985;p.x=(p.x+p.vx+1)%1;p.y=(p.y+p.vy+1)%1;
      var r=2+a.t*4*s.glow;
      ctx.fillStyle=rgb(.56+p.h*.18,.55,.45+a.e*.5*s.react,.12+a.e*.12*s.glow);
      ctx.beginPath();ctx.arc(p.x*w,p.y*h,r,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  /* 4 — FRACTAL PLANET */
  function fractalPlanet(ctx,w,h,time,frame,appState){
    var a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h),R=min*.25*(1+a.b*.08);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var g=ctx.createRadialGradient(cx-R*.35,cy-R*.45,R*.02,cx,cy,R*1.3);
    g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.25,'rgba(130,160,190,.48)');g.addColorStop(.58,'rgba(20,35,55,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R*1.18,0,TAU);ctx.fill();
    for(var j=0;j<14;j++){
      ctx.beginPath();
      for(var i=0;i<=100;i++){var q=i/100*TAU;var n=Math.sin(q*(3+j%4)+time*.12+j)+.5*Math.sin(q*9-time*.08);var rr=R*(.82+j*.012+n*(.025+a.b*.05));var x=cx+Math.cos(q)*rr,y=cy+Math.sin(q)*rr*.78;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle='rgba(210,225,240,'+(.025+a.m*.025)+')';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.strokeStyle='rgba(180,215,255,'+(.16+a.t*.25*s.glow)+')';ctx.lineWidth=min*.004;ctx.beginPath();ctx.arc(cx,cy,R*1.15,0,TAU);ctx.stroke();ctx.restore();
  }

  /* 5 — COSMIC ATTRACTOR */
  var attract=Array.from({length:700},function(_,i){return {x:Math.cos(i)*.5,y:Math.sin(i*1.7)*.5,z:hash(i)*.5};});
  function cosmicAttractor(ctx,w,h,time,frame,appState){
    var a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.09)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var attractCount = Math.min(attract.length, Math.max(250, Math.round(700*s.detail)));
    for(var i=0;i<attractCount;i++){
      var p=attract[i], dx=Math.sin(p.y*2.4+time*.32*s.motion)*.004*(1+a.b*s.react), dy=Math.sin(p.x*1.7-time*.21*s.motion)*.004*(1+a.m*s.react), dz=Math.cos(p.x+p.y+time*.18*s.motion)*.003;
      p.x+=dx;p.y+=dy;p.z+=dz;
      var ang=time*.12, x=p.x*Math.cos(ang)-p.z*Math.sin(ang), y=p.y, z=p.x*Math.sin(ang)+p.z*Math.cos(ang);
      var s=1/(1+z*.7), px=cx+x*min*.9*s,py=cy+y*min*.9*s;
      ctx.fillStyle=rgb(.58+p.z*.1,.7,.55+a.t*.4,.18+a.e*.35*s.glow);ctx.beginPath();ctx.arc(px,py,1+s*2.2,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  /* 6 — GYROID CRYSTAL */
  function gyroidCrystal(ctx,w,h,time,frame,appState){
    var a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var layer=0;layer<Math.max(16,Math.round(34*s.detail));layer++){
      var rr=min*(.07+layer*.007)*(1+a.b*.18*s.react), rot=time*.15*s.motion+layer*.17;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);
      var pts=28;
      ctx.beginPath();
      for(var i=0;i<=pts;i++){var q=i/pts*TAU;var gy=Math.sin(q*3+time*.6)+Math.sin(q*5-time*.3);var rad=rr*(1+.16*gy+a.m*.06*s.react*Math.sin(q*11));var x=Math.cos(q)*rad,y=Math.sin(q)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle=rgb(.54+layer*.004,.3,.65+a.t*.25,.025+a.t*.015);ctx.lineWidth=min*(.0015+a.e*.001*s.react);ctx.stroke();ctx.restore();
    }
    ctx.restore();
  }

  /* 7 — SONIC METABALL ORGANISM */
  function metaball(ctx,w,h,time,frame,appState){
    var a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h),N=7;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var i=0;i<N;i++){
      var q=TAU*i/N+time*.25*s.motion*(.3+a.e*s.react), rr=min*(.11+a.b*.055), x=cx+Math.cos(q*1.7)*min*(.16+a.m*.05*s.react), y=cy+Math.sin(q*1.3)*min*(.16+a.b*.04);
      var g=ctx.createRadialGradient(x-rr*.28,y-rr*.32,0,x,y,rr*1.25);
      g.addColorStop(0,'rgba(255,255,255,'+(.55+a.t*.3*s.glow*s.glow)+')');g.addColorStop(.38,'rgba(145,175,205,.28)');g.addColorStop(.78,'rgba(40,50,65,.15)');g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rr*(1+.18*Math.sin(time*1.2+i)+a.b*.12*s.react),0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  /* 8 — HOLOGRAPHIC RIBBON SCULPTURE */
  function ribbon(ctx,w,h,time,frame,appState){
    var a=audio(frame),min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var band=0;band<Math.max(3,Math.round(7*s.detail));band++){
      ctx.beginPath();
      for(var i=0;i<=160;i++){var u=i/160, x=u*w, y=h*.5+Math.sin(u*TAU*(1.2+band*.13)+time*(.3+band*.04)*s.motion)*h*(.13+band*.012)+Math.sin(u*TAU*3-time)*h*.035*a.b*s.react; y+=(band-3)*min*.035; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
      ctx.strokeStyle=rgb(.56+band*.025,.65,.65+a.t*.3,.12+a.e*.08);ctx.lineWidth=min*(.008+a.b*.018*s.react);ctx.stroke();
    }
    ctx.restore();
  }

  /* 9 — BLACK-HOLE ACCRETION */
  function blackHole(ctx,w,h,time,frame,appState){
    var a=audio(frame),cx=w*.5,cy=h*.5,min=Math.min(w,h);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    var diskCount = Math.min(420, Math.max(180, Math.round(420*s.detail)));
    for(var i=0;i<diskCount;i++){
      var r=min*(.10+hash(i)*.42)*(1+a.b*.1), ang=hash(i+3)*TAU+time*(.12+.5*(1-r/min))*s.motion*(1+a.e*s.react);
      var x=cx+Math.cos(ang)*r,y=cy+Math.sin(ang)*r*.34;
      var z=hash(i+8);ctx.fillStyle=rgb(.55+z*.12,.85,.45+a.t*.4,.12+a.e*.18);
      ctx.beginPath();ctx.arc(x,y,1+z*2.4+a.t*1.5*s.glow,0,TAU);ctx.fill();
    }
    var g=ctx.createRadialGradient(cx,cy,min*.045,cx,cy,min*.18);
    g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.5,'rgba(0,0,0,.98)');g.addColorStop(.72,'rgba(255,180,70,'+(.18+a.b*.3*s.react)+')');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,min*.2,0,TAU);ctx.fill();ctx.restore();
  }

  /* 10 — LIVING NEURAL NETWORK */
  var nodes=Array.from({length:75},function(_,i){return{x:hash(i)*1,y:hash(i+300)*1,v:hash(i+600),p:hash(i+900)*TAU};});
  function neural(ctx,w,h,time,frame,appState){
    var a=audio(frame);
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(0,0,0,.1)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
    for(var i=0;i<nodes.length;i++){var n=nodes[i];n.p+=.004*s.motion*(1+a.e*4*s.react);n.x+=Math.sin(n.p)*.00035*s.motion*(.4+a.m*s.react);n.y+=Math.cos(n.p*1.17)*.00035*s.motion*(.4+a.b*s.react);n.x=(n.x+1)%1;n.y=(n.y+1)%1;}
    for(var i=0;i<nodes.length;i++)for(var j=i+1;j<nodes.length;j++){var p=nodes[i],q=nodes[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);if(d<.19*s.detail){var alpha=(.19-d)/.19*(.06+a.e*.16);ctx.strokeStyle=rgb(.56,.55,.65,alpha);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x*w,p.y*h);ctx.lineTo(q.x*w,q.y*h);ctx.stroke();}}
    for(var k=0;k<nodes.length;k++){var p=nodes[k],r=1.5+p.v*2+a.b*4*s.react;ctx.fillStyle=rgb(.57+p.v*.08,.7,.7+a.t*.3,.28+a.e*.35);ctx.beginPath();ctx.arc(p.x*w,p.y*h,r,0,TAU);ctx.fill();}
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