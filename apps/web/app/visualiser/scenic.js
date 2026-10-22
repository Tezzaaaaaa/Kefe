/* KEFE Scenic backgrounds — Tidal Prism and Night Tunnel.
   Two procedural WebGL backgrounds, each its own visualiser tab. Both are original
   renderings (no source imagery) so they can sit under any lyric effect.
   Uses KEFE's shared audio graph for an optional, gentle beat pulse (default low). */
(function () {
  'use strict';
  const ASSET = new URL('../assets/scenic/', (document.currentScript && document.currentScript.src) || location.href).href;

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const HEAD = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;', 'uniform float uT,uPulse,uA,uB,uC,uD,uPh;','uniform sampler2D uImg,uFl,uMa;','uniform vec2 uSrc,uVP;',
    'uniform vec3 uK0,uK1,uK2,uK3;',
    'float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}',
    'float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=vnoise(p)*a;p=p*2.03+vec2(7.1,3.7);a*=.5;}return v;}'
  ].join('\n');

  /* ---------- Tidal Prism: midnight-sun seascape with rainbow, dolphins and hibiscus ---------- */
  const TIDE_FS = HEAD + '\n' + [
    /* uA sun height, uB rainbow, uC dolphins, uD hibiscus; uK0 sky top, uK1 horizon glow, uK2 sun, uK3 hibiscus */
    'const float H=.56;const float SX=.12;',
    'vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(fract(h+vec3(0.,.6667,.3333))*6.-3.)-1.,0.,1.);return v*mix(vec3(1.),k,s);}',
    'vec3 sky(vec2 p){',
    ' float h=p.y-H;float g=clamp(h/.8,0.,1.);',
    ' vec3 col=mix(uK1,uK0*.8,pow(g,.55));',
    ' vec2 sp=vec2(SX,H+uA);vec2 d=p-sp;float r=length(d);',
    ' col+=uK2*(exp(-r*3.2)*.30+exp(-r*9.)*(.42+uPulse*.25));',
    ' col=mix(col,vec3(1.,.97,.9)*1.25,ss(.036,.03,r));',
    ' float cl=fbm(vec2(p.x*1.3+uT*.012,h*10.4));',
    ' float cm=ss(.5,.8,cl)*ss(.012,.1,h)*(1.-ss(.34,.62,h));',
    ' float lit=exp(-length(vec2((p.x-SX)*.75,h-uA))*2.7);',
    ' vec3 cc=mix(uK1*.55+uK0*.3,uK2*1.15,lit*.9);col=mix(col,cc,cm*.72);',
    ' vec2 rc=vec2(-SX,H-.2);float rr=length(p-rc);float b=(rr-.5)/.085;',
    ' float ra=ss(-.12,.06,b)*ss(1.12,.9,b);',
    ' float rbm=ss(.0,.05,h);',
    ' col+=hsv(clamp(b,0.,1.)*.78,.8,1.)*ra*uB*.4*rbm*(.55+.45*(1.-g));',
    ' float b2=(rr-.7)/.09;col+=hsv((1.-clamp(b2,0.,1.))*.78,.7,1.)*ss(-.1,.1,b2)*ss(1.1,.9,b2)*uB*.11*rbm;',
    ' return col;}',
    'float swell(vec2 w,float t){',
    ' float v=sin(w.x*1.1+w.y*.8+t*.7)*.55+sin(w.x*2.3-w.y*1.5+t*1.05)*.3+sin(w.x*4.7+w.y*2.9-t*1.4)*.16;',
    ' return v+vnoise(w*2.6+vec2(t*.22,-t*.17))*.5+vnoise(w*6.1-vec2(t*.3,t*.2))*.2;}',
    /* dolphin silhouette: returns rgb + alpha, jumping on a ballistic arc */
    'vec4 dolph(vec2 p,float y0,float sz,float x0,float ph,float per,float dir){',
    ' float tj=mod(uT+ph,per);float dur=2.3;float s=tj/dur;if(s>1.||uC<.01)return vec4(0.);',
    ' float span=sz*3.4,hgt=sz*1.55;',
    ' vec2 pos=vec2(x0+dir*(s-.5)*span,y0+hgt*4.*s*(1.-s));',
    ' float th=atan(hgt*4.*(1.-2.*s),abs(span));',
    ' vec2 l=p-pos;if(dir<0.){l.x=-l.x;}',
    ' float c=cos(th),sn=sin(th);vec2 lc=vec2(c*l.x+sn*l.y,-sn*l.x+c*l.y);',
    ' float tt=.5-lc.x/sz;float v0=lc.y/sz;',
    ' float spine=-.2*pow(max(tt-.3,0.),2.)+.03*ss(.0,.2,tt)*(1.-ss(.2,.5,tt));',
    ' float v=v0-spine;',
    ' float w=tt<.3?mix(.018,.104,ss(.03,.2,tt)):mix(.014,.104,pow(clamp(1.-(tt-.3)/.7,0.,1.),1.15));',
    ' w+=.014*exp(-pow((tt-.15)/.045,2.))*step(0.,v);',
    ' w*=ss(-.01,.02,tt)*ss(1.04,.99,tt);',
    ' float aa=.005;',
    ' float body=ss(aa,-aa,abs(v)-w)*step(.004,w);',
    ' float fh=.1*clamp((tt-.36)/.03,0.,1.)*clamp(1.-(tt-.36)/.2,0.,1.);fh-=.045*pow(clamp((tt-.36)/.2,0.,1.),2.);',
    ' float fin=ss(aa,-aa,v-(w+fh))*ss(-aa,aa,v-w*.7)*step(.355,tt)*step(tt,.57);',
    ' float pf=clamp((tt-.27)/.12,0.,1.)*clamp(1.-(tt-.27)/.2,0.,1.);',
    ' float pec=ss(aa,-aa,-v-(w+.075*pf))*ss(-aa,aa,-v-w*.6)*step(.27,tt)*step(tt,.46);',
    ' float fx=tt-.985;float e1=length(vec2(fx/.055,v/.11));float e2=length(vec2((fx-.04)/.06,v/.09));',
    ' float fl=ss(1.+.06,1.-.06,e1)*ss(1.-.06,1.+.06,e2);',
    ' float a=max(max(body,fin),max(pec,fl));',
    ' float rel=clamp(-v/max(w,.02),-1.,1.);',
    ' vec3 dark=vec3(.2,.27,.36),belly=vec3(.9,.86,.88);',
    ' vec3 col=mix(dark,belly,ss(-.1,.55,rel));',
    ' col=mix(col,dark*.85,max(fin,fl)*(1.-body));',
    ' col=mix(col,uK1,.2)+uK2*.3*ss(.55,1.,abs(rel))*step(0.,v);',
    ' col*=1.-.5*ss(.07,.0,length(vec2(tt-.105,(v-.012)))*1.);',
    ' a*=ss(y0-.002,y0+.004,p.y);',
    ' return vec4(col,a);}',
    'float splash(vec2 p,float y0,float sz,float x0,float ph,float per,float dir){',
    ' float tj=mod(uT+ph,per);float dur=2.3;float span=sz*3.4;float res=0.;',
    ' for(int k=0;k<2;k++){',
    '  float age=k==0?tj:tj-dur;vec2 ev=vec2(x0+dir*(k==0?-.5:.5)*span,y0);',
    '  if(age>0.&&age<3.5){',
    '   float R=age*.1*sz*5.+.004;float rr=length((p-ev)/vec2(1.,.28));',
    '   res+=exp(-pow((rr-R)/(.004+.01*age),2.))*exp(-age*1.5)*.9;',
    '   for(int i=0;i<7;i++){float fi=float(i);float h1=hash(vec2(fi,float(k)+floor((uT+ph)/per)*3.));float h2=hash(vec2(fi+9.,float(k)));',
    '    vec2 dp=ev+vec2((h1-.5)*.55*sz*min(age,1.2)*2.,sz*(h2*.7+.15)*(age*1.7-age*age*2.2));',
    '    if(age<1.){res+=ss(.0045,.0015,length(p-dp))*(1.-age);}}}}',
    ' return res*uC;}',
    'vec4 pflower(vec2 p,vec2 c,float sz,float rot){',
    ' vec2 l=(p-c)/vec2(1.,.4)/sz;float cs=cos(rot),sn=sin(rot);l=vec2(cs*l.x-sn*l.y,sn*l.x+cs*l.y);',
    ' float rr=length(l);if(rr>1.05)return vec4(0.);',
    ' vec2 n2=vec2(sin(l.y*5.+uT*.7),cos(l.x*5.+uT*.6))*.01;',
    ' vec4 c4=texture2D(uFl,vec2(.5+l.x*.5,.5-l.y*.5)+n2)*ss(1.05,.96,rr);',
    ' c4.rgb*=mix(vec3(1.),uK1*1.05+.12,.2);c4.rgb*=.86+.14*(1.-ss(-.6,.6,l.y));',
    ' return c4;}',
    '    vec4 flower(vec2 p,vec2 c,float sz,float rot){',
    ' vec2 l=(p-c)/vec2(1.,.4)/sz;float r=length(l);float a=atan(l.y,l.x)-rot;',
    ' float cs=abs(cos(2.5*a));float R=.6+.4*pow(cs,.55)+.025*sin(a*13.);',
    ' float m=ss(R+.035,R-.035,r);if(m<=0.)return vec4(0.);',
    ' float rad=r/max(R,.2);',
    ' vec3 pc=uK3;vec3 core=pc*.3+vec3(.28,0.,.08);vec3 edge=mix(pc,vec3(1.),.1);',
    ' vec3 col=mix(core,mix(pc,edge,ss(.45,1.,rad)),ss(.1,.5,rad));',
    ' col*=.9+.1*sin(a*30.)*ss(.1,.7,rad);col*=.72+.28*ss(0.,.4,cs);',
    ' col+=vec3(1.,.92,.92)*.1*ss(.2,-.7,l.y)*ss(.3,.9,rad);',
    ' vec2 sd=vec2(cos(rot+.55),sin(rot+.55));float tt=clamp(dot(l,sd),0.,1.1);float dl=length(l-sd*tt);',
    ' col=mix(col,mix(pc,vec3(1.),.3)*1.1,ss(.06,.035,dl)*step(.05,r));',
    ' col=mix(col,vec3(1.,.82,.18),ss(.15,.07,length(l-sd*1.12)));',
    ' return vec4(col,m);}',
    'void main(){',
    ' float asp=uRes.x/uRes.y;vec2 p=vec2((gl_FragCoord.x/uRes.x-.5)*asp,gl_FragCoord.y/uRes.y);vec3 col;vec2 n=vec2(0.);float d=H-p.y;',
    ' if(p.y>=H){col=sky(p);}',
    ' else{',
    '  float z=1./(d*3.+.05);vec2 w=vec2(p.x*z*1.3,z*1.8);',
    '  float e=.07;float h0=swell(w,uT);float hx=swell(w+vec2(e,0.),uT)-swell(w-vec2(e,0.),uT);float hy=swell(w+vec2(0.,e),uT)-swell(w-vec2(0.,e),uT);n=vec2(hx,hy)/(2.*e);',
    '  vec2 ruv=vec2(p.x+n.x*.03*(.3+d*2.5),H+d*.85+n.y*.05*(.2+d*2.));',
    '  vec3 refl=sky(ruv);float fres=.07+.88*exp(-d*6.5);',
    '  vec3 deep=mix(vec3(.02,.07,.1),vec3(.04,.11,.15),ss(0.,.5,d));deep=mix(deep,uK0*.22,.3);',
    '  col=deep*.9+refl*fres*(.75+.7*clamp(n.y*.5+.5,0.,1.));',
    '  float path=exp(-pow((p.x-SX)/(.012+d*.3),2.));',
    '  float spk=pow(clamp(n.y*.6+.5+(vnoise(w*5.+uT)-.5)*.6,0.,1.),9.);',
    '  col+=uK2*path*spk*1.5*exp(-d*2.)*(1.+uPulse*.6);',
    '  col+=vec3(1.,.95,.9)*pow(clamp(n.y*.5,0.,1.),6.)*.1*fres;',
    '  col=mix(col,uK1*.95,exp(-d*60.)*.55);',
    '  /* dolphin reflections */',
    '  vec2 pm=vec2(p.x+n.x*.012,0.);',
    '  pm.y=2.*.30-p.y;vec4 r1=dolph(pm,.30,.2,-.06,0.,8.5,1.);col=mix(col,r1.rgb*.45+uK1*.15,r1.a*.4*uC*step(p.y,.30));',
    '  pm.y=2.*.44-p.y;vec4 r2=dolph(pm,.44,.14,.14,3.9,8.5,-1.);col=mix(col,r2.rgb*.45+uK1*.15,r2.a*.4*uC*step(p.y,.44));',
    '  col+=vec3(1.,.9,.85)*(splash(p,.30,.2,-.06,0.,8.5,1.)+splash(p,.44,.14,.14,3.9,8.5,-1.)+splash(p,.50,.08,-.18,6.1,11.,1.))*.5;',
    ' }',
    ' vec4 dd=dolph(p,.30,.2,-.06,0.,8.5,1.);col=mix(col,dd.rgb,dd.a*clamp(uC,0.,1.));',
    ' dd=dolph(p,.44,.14,.14,3.9,8.5,-1.);col=mix(col,dd.rgb,dd.a*clamp(uC,0.,1.));',
    ' dd=dolph(p,.50,.08,-.18,6.1,11.,1.);col=mix(col,dd.rgb,dd.a*clamp(uC,0.,1.));',
    ' if(uD>.01){',
    '  vec2 f1=vec2(-.17+sin(uT*.25)*.015,.11+sin(uT*.6)*.004);vec2 f2=vec2(.2+sin(uT*.21+1.)*.012,.2+sin(uT*.55+2.)*.003);vec2 f3=vec2(.02+sin(uT*.19+3.)*.01,.36);vec2 f4=vec2(.13,.055+sin(uT*.5)*.004);',
    '  float sc=clamp(uD,.4,1.4);',
    '  col*=1.-.4*ss(1.3,.5,length((p-f1-vec2(0.,-.012))/vec2(1.,.4)/(.09*sc)))*step(p.y,H);',
    '  col*=1.-.4*ss(1.3,.5,length((p-f4-vec2(0.,-.012))/vec2(1.,.4)/(.1*sc)))*step(p.y,H);',
    '  if(uPh>.5){',
    '   vec4 fc=pflower(p,f3,.045*sc,1.1);col=col*(1.-fc.a)+fc.rgb;',
    '   fc=pflower(p,f2,.072*sc,.4);col=col*(1.-fc.a)+fc.rgb;',
    '   fc=pflower(p,f1,.105*sc,-.3);col=col*(1.-fc.a)+fc.rgb;',
    '   fc=pflower(p,f4,.118*sc,2.4);col=col*(1.-fc.a)+fc.rgb;',
    '  }else{',
    '   vec4 fc=flower(p,f3,.038*sc,1.1);col=mix(col,fc.rgb,fc.a);',
    '   fc=flower(p,f2,.062*sc,.4);col=mix(col,fc.rgb,fc.a);',
    '   fc=flower(p,f1,.09*sc,-.3);col=mix(col,fc.rgb,fc.a);',
    '   fc=flower(p,f4,.1*sc,.9);col=mix(col,fc.rgb,fc.a);',
    '  }',
    '  if(uPh>.5){vec2 sp=gl_FragCoord.xy/uRes;sp.x=1.-sp.x;',
    '   vec2 mu=vec2(.62+(sp.x-.84)*1.05+sin(uT*.35)*.006,.8+(sp.y-.42)*1.45+sin(uT*.5)*.004);',
    '   vec4 mc=texture2D(uMa,mu);float inb=step(0.,mu.x)*step(mu.x,1.)*step(0.,mu.y)*step(mu.y,1.);',
    '   float rg=ss(.4,.75,sp.x)*(1.-ss(.4,.62,sp.y));mc*=rg*inb*clamp(uD,0.,1.)*.92;',
    '   mc.rgb*=mix(vec3(1.),uK1*1.1+.1,.25);col=col*(1.-mc.a)+mc.rgb;}',
    ' }',
    ' vec2 sg=p*vec2(11.,14.);vec2 ci=floor(sg);vec2 cf=fract(sg)-.5;float rn=hash(ci);',
    ' vec2 off=(vec2(hash(ci+3.1),hash(ci+7.7))-.5)*.5;vec2 q2=cf-off;',
    ' float star=(exp(-abs(q2.x)*60.-abs(q2.y)*6.)+exp(-abs(q2.y)*60.-abs(q2.x)*6.))*.5;',
    ' float tw=pow(.5+.5*sin(uT*(1.2+rn*2.)+rn*40.),6.);',
    ' col+=vec3(1.,.95,.85)*star*tw*step(.8,rn)*ss(H,H+.12,p.y)*.8;',
    ' col=col/(1.+col*.12);col=pow(max(col,0.),vec3(1.02));',
    ' float g2=hash(gl_FragCoord.xy+fract(uT)*91.)-.5;col+=g2*.02;',
    ' vec2 vv=gl_FragCoord.xy/uRes-.5;col*=1.-dot(vv,vv)*.4;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  /* ---------- Night Tunnel: a lit concrete tunnel, wet asphalt and real lamp reflections ---------- */
  const TUNNEL_FS = HEAD + '\n' + [
    /* uA curve, uB lamp output, uC wall grime, uD road lines + wet sheen; uK0 wall tint, uK1 road tint, uK2 lamp core, uK3 light colour */
    'const float K=.16;const float HF=.62;const float S=2.2;',
    'float wrapd(float a){return mod(a+3.14159265,6.2831853)-3.14159265;}',
    'void main(){',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 vp=vec2(.12*uA+.015*sin(uT*.17),-.03+.012*cos(uT*.13));',
    ' vec2 q=p-vp;float r=length(q);float ang=atan(q.y,q.x);float spd=3.;',
    ' float mouth=ss(.012,.2,r);',
    ' float zw=K/max(r,.003);float zt=zw+uT*spd;',
    ' float u=ang/6.2831853*28.;float v=zt*.9;',
    ' float ed=min(min(fract(u),1.-fract(u))*.9,min(fract(v),1.-fract(v)));',
    ' float grout=ss(.05,.0,ed);',
    ' float alb=.5*(.7+.55*fbm(vec2(u*2.,v*2.)))*(1.-.5*grout);',
    ' alb*=1.-uC*.5*ss(.45,.8,fbm(vec2(u*.9,v*.12)));',
    ' float ring=ss(.485,.5,abs(fract(zt/4.4)-.5));alb*=1.-.3*ring;',
    ' float pf=fract(zt/S)-.5;float along=exp(-pf*pf*S*S/.9);',
    ' float la=exp(-pow(wrapd(ang-2.35),2.)/.09)+exp(-pow(wrapd(ang-.79),2.)/.09);',
    ' float pool=along*la;float amb=.13+.1*(.5+.5*sin(ang));',
    ' vec3 wallc=alb*(uK0*(amb+pool*1.7*uB)+uK3*pool*.22*uB);',
    ' wallc*=mix(1.,.3,ss(8.,30.,zw));',
    ' float zr=K*HF/max(-q.y,.0008);float Xf=q.x*zr/K;',
    ' float floorW=ss(.82,.74,abs(Xf))*step(q.y,0.);',
    ' float zt2=zr+uT*spd;float tex=fbm(vec2(Xf*9.,zt2*3.));',
    ' float fpool=exp(-pow(fract(zt2/S)-.5,2.)*S*S/1.2)*exp(-Xf*Xf*1.6);',
    ' vec3 roadc=uK1*(.5+.9*tex)*(.4+fpool*1.5*uB)+uK3*fpool*.16*uB;',
    ' float edgeL=ss(.03,.012,abs(abs(Xf)-.56));float dash=step(.45,fract(zt2/1.4));float mid=ss(.02,.008,abs(Xf))*dash;',
    ' float lines=(edgeL+mid)*uD;',
    ' roadc=mix(roadc,vec3(.85,.9,1.)*(.35+fpool*1.7),clamp(lines,0.,1.)*.85*(.6+.4*tex));',
    ' roadc*=exp(-zr*.07);',
    ' vec3 col=mix(wallc,roadc,floorW)*mouth;',
    ' vec3 lampc=vec3(0.);float rfl=0.;',
    ' for(int row=0;row<2;row++){',
    '  float a0=row==0?2.35:.79;vec2 dirv=vec2(cos(a0),sin(a0));',
    '  for(int i=0;i<16;i++){',
    '   float zi=(float(i)+.5)*S-S*fract(uT*spd/S);',
    '   float fade=ss(.55,1.2,zi)*ss(.0,.05,r);',
    '   vec2 lp=dirv*K/zi;vec2 dv=q-lp;',
    '   vec2 dir=normalize(lp+vec2(1e-5));float dr=dot(dv,dir),dpp=dot(dv,vec2(-dir.y,dir.x));',
    '   float sz=K/zi*.16;float sl=sz*2.4;',
    '   float core=exp(-(dr*dr/(sl*sl)+dpp*dpp/(sz*sz)));',
    '   float halo=exp(-length(dv)/(sz*4.5))*.35;',
    '   float flare=exp(-abs(dv.y)/(sz*.35))*exp(-abs(dv.x)/(sz*9.))*.35;',
    '   lampc+=(uK2*core*1.9+uK3*(halo+flare*.6))*fade*(1.+uPulse*.8);',
    '   vec2 lpm=vec2(dirv.x,-2.*HF-dirv.y)*K/zi;vec2 dm=q-lpm;',
    '   float nz=.6+.8*vnoise(vec2(dm.x*140.,uT*2.+float(i)));',
    '   rfl+=exp(-(dm.x*dm.x/(sz*sz*2.)+dm.y*dm.y/(sz*sz*30.)))*fade*nz;}}',
    ' col+=lampc*uB;',
    ' col+=(uK2*.5+uK3*.5)*rfl*floorW*uD*.55*uB;',
    ' col=col/(1.+col*.3);col=pow(max(col,0.),vec3(.95));',
    ' float g=hash(gl_FragCoord.xy+fract(uT)*77.)-.5;col+=g*.028;',
    ' vec2 vv=gl_FragCoord.xy/uRes-.5;col*=1.-dot(vv,vv)*.5;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  /* ---------- Night Tunnel (photo): real tunnel photography with zoom-blur drive, light shimmer and beat bloom ---------- */
  const TUNNEL_PHOTO_FS = HEAD + '\n' + [
    /* uA camera sway, uB exposure, uC speed blur, uD light bloom; uImg photo, uSrc size, uVP vanishing point */
    'vec2 fit(vec2 q){float ca=uRes.x/uRes.y,ia=uSrc.x/uSrc.y;if(ca>ia)q.y=(q.y-.5)*ia/ca+.5;else q.x=(q.x-.5)*ca/ia+.5;return q;}',
    'void main(){',
    ' vec2 s=gl_FragCoord.xy/uRes;vec2 vp=uVP;',
    ' vec2 q=fit(s);',
    ' q+=vec2(sin(uT*.21+1.),cos(uT*.17))*.006*uA;',
    ' float breathe=1.03+.03*sin(uT*.45)+.02*uPulse;',
    ' q=vp+(q-vp)/breathe;',
    ' vec2 dv=q-vp;float r=length(dv*vec2(uRes.x/uRes.y,1.));',
    ' float blur=uC*(.035+.16*r)*(1.+uPulse*.5);',
    ' vec3 acc=vec3(0.);',
    ' for(int k=0;k<8;k++){float f=float(k)/7.;vec2 uv=vp+dv*(1.-f*blur);acc+=texture2D(uImg,clamp(uv,.002,.998)).rgb;}',
    ' vec3 col=acc/8.;',
    ' float lum=dot(col,vec3(.3,.59,.11));',
    ' float hl=ss(.55,.95,lum);',
    ' float wave=.55+.45*sin(r*30.-uT*5.5);',
    ' col+=col*hl*(wave*.45+uPulse*.9)*uD;',
    ' col+=pow(max(col-.5,0.),vec3(1.4))*uD*1.6;',
    ' col*=uK0.x*(.7+.3*uB);',
    ' col=col/(1.+col*.12);',
    ' float g=hash(gl_FragCoord.xy+fract(uT)*77.)-.5;col+=g*.025;',
    ' vec2 vv=s-.5;col*=1.-dot(vv,vv)*.45;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  const SCENES = [
    {
      key: 'tidal-prism', label: 'Tidal Prism', icon: '≋', accent: '#ff8fb0', fs: TIDE_FS, textures: { flower: 'hibiscus-white.png', macro: 'hibiscus-macro.png' },
      title: 'Tidal Prism',
      presets: [
        { name: 'Midnight Sun', k: [[.3, .34, .64], [1, .62, .56], [1, .8, .5], [1, .3, .55]], v: {} },
        { name: 'Golden Hour', k: [[.18, .34, .62], [1, .74, .4], [1, .9, .55], [1, .45, .2]], v: {} },
        { name: 'Lilac Night', k: [[.14, .1, .34], [.85, .45, .75], [1, .72, .86], [1, .4, .72]], v: {} }
      ],
      sliders: [
        { key: 'speed', label: 'Tide speed', min: .2, max: 2.5, step: .05, def: 1, fmt: v => v.toFixed(2) + '×' },
        { key: 'sun', label: 'Sun height', min: -.03, max: .16, step: .005, def: .03, fmt: v => v.toFixed(3), u: 'uA' },
        { key: 'rainbow', label: 'Rainbow', min: 0, max: 1.6, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uB' },
        { key: 'dolphins', label: 'Dolphins', min: 0, max: 1, step: .05, def: 1, fmt: v => v < .05 ? 'Off' : v.toFixed(2), u: 'uC' },
        { key: 'hibiscus', label: 'Hibiscus', min: 0, max: 1.4, step: .05, def: 1, fmt: v => v < .05 ? 'Off' : v.toFixed(2) + '×', u: 'uD' },
        { key: 'pulse', label: 'Beat shimmer', min: 0, max: 1.5, step: .05, def: .3, fmt: v => v.toFixed(2) + '×' }
      ]
    },
    {
      key: 'night-tunnel', label: 'Night Tunnel', icon: '◖', accent: '#ff8a3d', fs: TUNNEL_FS, photoFs: TUNNEL_PHOTO_FS,
      title: 'Night Tunnel',
      presets: [
        { name: 'Amber Road', photo: 'tunnel-road.jpg', vp: [.5, .53] },
        { name: 'Amber Arc', photo: 'tunnel-arc.jpg', vp: [.55, .41] },
        { name: 'Concrete Night', photo: 'tunnel-concrete.jpg', vp: [.45, .40], k: [[2.4, 2.4, 2.4], [1, 1, 1], [1, 1, 1], [1, 1, 1]] },
        { name: 'Crimson', k: [[1, .18, .14], [.1, .13, .3], [1, .88, .92], [1, .22, .16]], v: {} },
        { name: 'Ultraviolet', k: [[.55, .2, 1], [.08, .08, .28], [.9, .95, 1], [.6, .25, 1]], v: { curve: -.8 } },
        { name: 'Sodium', k: [[1, .55, .15], [.12, .1, .1], [1, .95, .75], [1, .6, .15]], v: { curve: .3 } }
      ],
      sliders: [
        { key: 'speed', label: 'Drive speed', min: .2, max: 3, step: .05, def: 1, fmt: v => v.toFixed(2) + '×' },
        { key: 'lamps', label: 'Lamp output', min: 0, max: 2, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uB' },
        { key: 'sway', label: 'Camera sway', min: 0, max: 2, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uA', only: 'photo' },
        { key: 'blur', label: 'Speed blur', min: 0, max: 2, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uC', only: 'photo' },
        { key: 'bloom', label: 'Light bloom', min: 0, max: 1.5, step: .05, def: .8, fmt: v => v.toFixed(2) + '×', u: 'uD', only: 'photo' },
        { key: 'curve', label: 'Tunnel curve', min: -1, max: 1, step: .05, def: 1, fmt: v => v.toFixed(2), u: 'uA', only: 'proc' },
        { key: 'grime', label: 'Wall grime', min: 0, max: 1, step: .05, def: .55, fmt: v => v.toFixed(2), u: 'uC', only: 'proc' },
        { key: 'lanes', label: 'Road lines and sheen', min: 0, max: 1.5, step: .05, def: 1, fmt: v => v.toFixed(2) + '×', u: 'uD', only: 'proc' },
        { key: 'pulse', label: 'Beat pulse', min: 0, max: 1.5, step: .05, def: .3, fmt: v => v.toFixed(2) + '×' }
      ]
    }
  ];

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let audioBins = null, bass = 0, peak = .1;

  function audioBass(dt) {
    let target = .45 + .3 * Math.sin(performance.now() / 1000 * 1.9);
    try {
      const analyser = window.kefeAudioGraph?.analyser?.();
      if (analyser) {
        if (!audioBins || audioBins.length !== analyser.frequencyBinCount) audioBins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(audioBins);
        const hz = (analyser.context?.sampleRate || 48000) / (analyser.fftSize || 2048);
        const a = Math.max(1, Math.floor(30 / hz)), b = Math.min(audioBins.length - 1, Math.ceil(150 / hz));
        let s = 0; for (let i = a; i <= b; i++) s += audioBins[i];
        const raw = s / (Math.max(1, b - a + 1) * 255);
        peak = Math.max(raw, peak * Math.exp(-dt / 30), .06);
        target = Math.pow(clamp(raw / peak), 1.4);
      }
    } catch (_) {}
    bass += (target - bass) * (1 - Math.exp(-dt / (target > bass ? .08 : .3)));
    return bass;
  }

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }

  const instances = [];
  const stateApi = () => {
    const live = instances.find(i => i.shown());
    return { enabled: !!live, canvas: live ? live.canvas : null, scene: live ? live.scene.key : null };
  };

  function makeScene(scene, stage, tabs, form, tabsList) {
    const store = 'kefe.scenic.' + scene.key + '.v3';
    const cfg = {}; scene.sliders.forEach(s => cfg[s.key] = s.def); cfg.preset = 0;
    try { Object.assign(cfg, JSON.parse(localStorage.getItem(store) || 'null') || {}); } catch (_) {}
    const persist = () => { try { localStorage.setItem(store, JSON.stringify(cfg)); } catch (_) {} };

    const canvas = el('canvas'); canvas.id = 'kefeScenic' + scene.key.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase()) + 'Canvas';
    canvas.setAttribute('aria-label', scene.label + ' background');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'none', zIndex: '2', pointerEvents: 'none', borderRadius: '0' });
    stage.insertBefore(canvas, document.getElementById('kefeCanvas') || null);

    const opts = { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl', opts), program = null, loc = {}, raf = 0, last = 0, t = 0, enabled = false, active = false;
    const inst = { scene, canvas, shown: () => enabled && active };

    function compile(type, src) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error('[KEFE ' + scene.label + ' shader]', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
      return sh;
    }
    const progs = {}; let texCache = {};
    function link(fsSrc) {
      const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, fsSrc); if (!vs || !fs) return null;
      const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error('[KEFE ' + scene.label + ' program]', gl.getProgramInfoLog(pr)); gl.deleteProgram(pr); return null; }
      const l = {}; ['uRes', 'uT', 'uPulse', 'uA', 'uB', 'uC', 'uD', 'uK0', 'uK1', 'uK2', 'uK3', 'uImg', 'uFl', 'uMa', 'uPh', 'uSrc', 'uVP'].forEach(k => l[k] = gl.getUniformLocation(pr, k));
      return { program: pr, loc: l };
    }
    function build() {
      progs.main = link(scene.fs); progs.photo = scene.photoFs ? link(scene.photoFs) : null; texCache = {};
      if (!progs.main) return false;
      program = progs.main.program; loc = progs.main.loc;
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return true;
    }
    function loadTex(file, o) {
      if (texCache[file]) return texCache[file];
      const rec = { tex: gl.createTexture(), ready: false, w: 1, h: 1 }; texCache[file] = rec;
      const params = mip => { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); };
      gl.bindTexture(gl.TEXTURE_2D, rec.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); params(false);
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!gl || texCache[file] !== rec) return;
        const w = img.naturalWidth, h = img.naturalHeight, pot = v => (v & (v - 1)) === 0, mip = !!(o && o.mip) && pot(w) && pot(h);
        gl.bindTexture(gl.TEXTURE_2D, rec.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!(o && o.premul));
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (mip) gl.generateMipmap(gl.TEXTURE_2D); params(mip); rec.w = w; rec.h = h; rec.ready = true;
      };
      img.onerror = () => console.warn('[KEFE ' + scene.label + '] could not load', file);
      img.src = ASSET + file; return rec;
    }
    if (!gl || !build()) { canvas.remove(); console.error('[KEFE ' + scene.label + '] WebGL initialisation failed.'); return null; }

    function resize() {
      const r = stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round((r.width || 2) * d)), h = Math.max(2, Math.round((r.height || 2) * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl && gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw(dt) {
      const b = audioBass(dt), mo = reducedMotion ? .5 : 1;
      t += dt * cfg.speed * mo * (1 + cfg.pulse * .25 * (b - .4));
      const pr = scene.presets[cfg.preset] || scene.presets[0];
      const photo = !!(pr.photo && progs.photo), P = photo ? progs.photo : progs.main;
      program = P.program; loc = P.loc; gl.useProgram(program);
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uT, t);
      gl.uniform1f(loc.uPulse, cfg.pulse * clamp(b - .25, 0, 1) * 1.4);
      scene.sliders.forEach(s => { if (s.u && (!s.only || s.only === (photo ? 'photo' : 'proc'))) gl.uniform1f(loc[s.u], cfg[s.key]); });
      const kk = pr.k || [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]];
      ['uK0', 'uK1', 'uK2', 'uK3'].forEach((k, i) => gl.uniform3f(loc[k], ...kk[i]));
      let ready = 0;
      if (photo) {
        const r = loadTex(pr.photo, {}); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex);
        gl.uniform1i(loc.uImg, 0); gl.uniform2f(loc.uSrc, r.w, r.h); gl.uniform2f(loc.uVP, pr.vp[0], pr.vp[1]);
      } else if (scene.textures) {
        const a = loadTex(scene.textures.flower, { premul: true, mip: true }), m = loadTex(scene.textures.macro, { premul: true });
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(loc.uFl, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.uniform1i(loc.uMa, 2);
        gl.activeTexture(gl.TEXTURE0); ready = a.ready && m.ready ? 1 : 0;
      }
      gl.uniform1f(loc.uPh, ready);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function frame(now) {
      raf = 0; if (!inst.shown() || !gl || !program || document.hidden) return;
      const dt = clamp((now - (last || now)) / 1000, 0, .1); last = now;
      draw(dt); raf = requestAnimationFrame(frame);
    }
    function start() { if (!inst.shown() || !gl || raf || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    function sync() {
      canvas.style.display = inst.shown() ? 'block' : 'none';
      power.classList.toggle('is-on', enabled); power.setAttribute('aria-checked', String(enabled)); powerState.textContent = enabled ? 'On' : 'Off';
      if (inst.shown()) { resize(); start(); } else { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
      window.dispatchEvent(new CustomEvent('kefe-scenic-change', { detail: stateApi() }));
    }

    /* ---- controls ---- */
    const view = el('section', 'kefe-vis-view kefe-slow-light-view kefe-scenic-view'); view.id = 'kefeVis' + scene.label.replace(/\s+/g, '') + 'View'; view.hidden = true;
    const power = el('button', 'kefe-btn kefe-switch kefe-vis-option-power kefe-slow-light-power'); power.type = 'button'; power.setAttribute('role', 'switch'); power.setAttribute('aria-checked', 'false'); power.setAttribute('aria-label', scene.label + ' background');
    const powerState = el('span', 'kefe-switch-state', 'Off'), powerTrack = el('span', 'kefe-switch-track'); powerTrack.setAttribute('aria-hidden', 'true'); powerTrack.appendChild(el('span', 'kefe-switch-thumb'));
    power.append(powerState, powerTrack);
    power.addEventListener('click', e => { e.stopPropagation(); enabled = !enabled; sync(); });

    const presetRow = document.querySelector('.kefe-visualiser-preset-row');
    const presetSet = el('div', 'kefe-visualiser-preset-set'); presetSet.id = 'kefeScenic' + scene.key + 'PresetSet'; presetSet.hidden = true;
    const presetBtns = el('div', 'kefe-slow-light-scenes');
    const sliderEls = {};
    function field(s) {
      const wrap = el('label', 'kefe-visualiser-field'), head = el('span'), name = el('b', null, s.label), out = el('output'), input = el('input');
      input.type = 'range'; input.min = s.min; input.max = s.max; input.step = s.step; input.value = cfg[s.key]; out.textContent = s.fmt(Number(cfg[s.key]));
      head.append(name, out); wrap.append(head, input);
      input.addEventListener('input', () => { cfg[s.key] = Number(input.value); out.textContent = s.fmt(cfg[s.key]); persist(); });
      sliderEls[s.key] = { input, out, s, wrap };
      return wrap;
    }
    function applyPreset(i, fromUser) {
      cfg.preset = i; const pr = scene.presets[i];
      if (fromUser) Object.entries(pr.v || {}).forEach(([k, v]) => { cfg[k] = v; const se = sliderEls[k]; if (se) { se.input.value = v; se.out.textContent = se.s.fmt(v); } });
      { const isPhoto = !!pr.photo; Object.values(sliderEls).forEach(se => { if (se.s.only) se.wrap.hidden = se.s.only !== (isPhoto ? 'photo' : 'proc'); }); }
      presetBtns.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('primary', j === i); b.setAttribute('aria-pressed', String(j === i)); });
      persist();
    }
    scene.presets.forEach((p, i) => { const b = el('button', 'kefe-btn', p.name); b.type = 'button'; b.addEventListener('click', () => applyPreset(i, true)); presetBtns.appendChild(b); });
    presetSet.appendChild(presetBtns); if (presetRow) presetRow.appendChild(presetSet);

    const group = el('div', 'kefe-visualiser-control-group'); group.appendChild(el('div', 'kefe-label', 'Motion and look'));
    scene.sliders.forEach(s => group.appendChild(field(s)));
    const reset = el('button', 'kefe-btn', 'Reset'); reset.type = 'button';
    reset.addEventListener('click', () => { scene.sliders.forEach(s => { cfg[s.key] = s.def; const se = sliderEls[s.key]; se.input.value = s.def; se.out.textContent = s.fmt(s.def); }); applyPreset(0, false); });
    view.append(group, reset); form.appendChild(view);
    applyPreset(cfg.preset in scene.presets ? cfg.preset : 0, false);

    const tab = el('button', 'kefe-btn', scene.label); tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.dataset.visualiser = scene.key; tab.dataset.icon = scene.icon;
    tab.setAttribute('aria-controls', view.id); tab.setAttribute('aria-label', scene.label + ' background'); tab.title = scene.label + ' background'; tab.setAttribute('aria-selected', 'false');
    const option = el('div', 'kefe-vis-option'); option.append(tab, power); tabsList.appendChild(option);

    tabsList.addEventListener('click', e => {
      const clicked = e.target.closest('[role="tab"]');
      if (clicked && clicked !== tab) { active = false; view.hidden = true; presetSet.hidden = true; tab.classList.remove('primary'); tab.setAttribute('aria-selected', 'false'); sync(); }
    });
    tab.addEventListener('click', () => {
      form.querySelectorAll('.kefe-vis-view').forEach(v => v.hidden = v !== view);
      tabs.querySelectorAll('[role="tab"]').forEach(b => { const sel = b === tab; b.classList.toggle('primary', sel); b.setAttribute('aria-selected', String(sel)); });
      const pr = document.querySelector('.kefe-visualiser-preset-row'); if (pr) { pr.hidden = false; pr.querySelectorAll('.kefe-visualiser-preset-set').forEach(set => set.hidden = set !== presetSet); }
      const heading = document.getElementById('kefeVisualiserHeading'), description = document.getElementById('kefeVisualiserDescription');
      if (heading) heading.textContent = scene.title; if (description) description.textContent = '';
      const g = document.getElementById('kefeGradientCanvas'); if (g) g.style.display = 'none';
      active = true; sync();
    });

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; gl = null; });
    canvas.addEventListener('webglcontextrestored', () => { gl = canvas.getContext('webgl', opts); if (gl && build()) { resize(); if (inst.shown()) start(); } });
    window.addEventListener('resize', resize); window.addEventListener('kefe-stage-resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else if (inst.shown()) start(); });
    inst.setEnabled = v => { enabled = !!v; sync(); };
    inst.setActive = v => { active = !!v; sync(); };
    inst.seek = v => { t = Number(v) || 0; }; inst.cfg = cfg; inst.renderOnce = () => { resize(); draw(0); };
    resize();
    return inst;
  }

  function init() {
    const tabs = document.querySelector('.kefe-vis-tabs'), form = document.querySelector('.kefe-visualiser-form'), stage = document.querySelector('.kefe-stage');
    if (!tabs || !form || !stage) { console.error('[KEFE Scenic] Required preview or controls are missing.'); return; }
    const tabsList = tabs.querySelector('[role="tablist"]') || tabs;
    SCENES.forEach(s => { const i = makeScene(s, stage, tabs, form, tabsList); if (i) instances.push(i); });
    window.kefeScenic = {
      getState: stateApi,
      canvas: () => stateApi().canvas,
      scene: key => instances.find(i => i.scene.key === key),
      setScene: (key, on = true) => { const i = instances.find(x => x.scene.key === key); if (i) { i.setActive(on); i.setEnabled(on); } }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
