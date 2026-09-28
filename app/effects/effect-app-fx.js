/* KEFE Visual FX — independent Canvas effects inspired by modern browser effect editors. */
(() => {
    'use strict';
    function init() {
    if (typeof window === 'undefined' || typeof window.render !== 'function' || !window.state || !window.canvas || window.__kefeVisualFxInstalled) return;
    window.__kefeVisualFxInstalled = true;
    const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const FX_KEY = 'kefe-visual-fx-v1';
    const originalRender = window.render;
    const fxInput = document.createElement('canvas');
    const fxInputCtx = fxInput.getContext('2d', { alpha: false });
    const scratch = document.createElement('canvas');
    const scratchCtx = scratch.getContext('2d', { alpha: true });
    const defaults = { visualFx:'none', fxIntensity:.55, fxSpeed:1, fxGrain:.18, fxScanlines:.24, fxRgbShift:.008, fxBlur:.18, fxShake:.18, fxVignette:.18, fxHalftone:.22 };
    Object.assign(window.state.style, defaults, window.state.style);
    try { const saved=JSON.parse(localStorage.getItem(FX_KEY)||'{}'); if(saved&&typeof saved==='object')Object.assign(window.state.style,saved); } catch(_){}
    const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
    const seeded=(t,s=0)=>{const n=Math.sin(t*12.9898+s*78.233)*43758.5453;return n-Math.floor(n);};
    function resize(w,h){if(fxInput.width!==w||fxInput.height!==h){fxInput.width=w;fxInput.height=h;}if(scratch.width!==w||scratch.height!==h){scratch.width=w;scratch.height=h;}}
    function save(){try{const s=window.state.style;localStorage.setItem(FX_KEY,JSON.stringify({visualFx:s.visualFx,fxIntensity:s.fxIntensity,fxSpeed:s.fxSpeed,fxGrain:s.fxGrain,fxScanlines:s.fxScanlines,fxRgbShift:s.fxRgbShift,fxBlur:s.fxBlur,fxShake:s.fxShake,fxVignette:s.fxVignette,fxHalftone:s.fxHalftone}));}catch(_){}
    }
    function base(c,s,w,h){c.drawImage(s,0,0,w,h);}
    function vignette(c,w,h,a){if(a<=0)return;const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.62,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${clamp(a,0,.78)})`);c.fillStyle=g;c.fillRect(0,0,w,h);}
    function scan(c,w,h,a,step=4){if(a<=0)return;c.save();c.globalAlpha=clamp(a,0,.65);c.fillStyle='#000';for(let y=0;y<h;y+=Math.max(2,step))c.fillRect(0,y,w,1);c.restore();}
    function grain(c,w,h,a,t){if(a<=0)return;const size=Math.max(1,Math.round(Math.min(w,h)*.004)),count=Math.round(w*h*clamp(a,0,.4)*.000012);c.save();c.globalAlpha=clamp(a*.55,0,.24);for(let i=0;i<count;i++){const x=Math.floor(seeded(t*97+i,1)*w),y=Math.floor(seeded(t*89+i,2)*h),v=seeded(t*71+i,3)>.5?255:0;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(x,y,size,size);}c.restore();}
    function rgb(c,s,w,h,a){const px=Math.max(1,Math.round(Math.min(w,h)*a));c.save();c.globalCompositeOperation='screen';c.globalAlpha=.42;c.drawImage(s,px,0,w,h,0,0,w,h);c.restore();scratchCtx.clearRect(0,0,w,h);scratchCtx.globalAlpha=.42;scratchCtx.drawImage(s,-px,0,w,h,0,0,w,h);scratchCtx.globalAlpha=1;c.save();c.globalCompositeOperation='screen';c.drawImage(scratch,0,0);c.restore();}
    function bloom(c,s,w,h,a){if(a<=0)return;scratchCtx.clearRect(0,0,w,h);scratchCtx.filter=`blur(${Math.max(1,Math.min(28,Math.min(w,h)*a*.018))}px)`;scratchCtx.globalAlpha=clamp(a*.5,0,.5);scratchCtx.drawImage(s,0,0,w,h);scratchCtx.filter='none';scratchCtx.globalAlpha=1;c.save();c.globalCompositeOperation='screen';c.globalAlpha=clamp(a*.85,0,.7);c.drawImage(scratch,0,0);c.restore();}
    function shake(c,s,w,h,a,t,speed){const e=a*(.45+.55*Math.sin(t*speed*9.3)**2),x=(seeded(t*speed*7.1,4)-.5)*w*.018*e,y=(seeded(t*speed*8.7,5)-.5)*h*.018*e,r=(seeded(t*speed*6.2,6)-.5)*.012*e;c.save();c.translate(w/2+x,h/2+y);c.rotate(r);c.scale(1+e*.008,1+e*.008);c.drawImage(s,-w/2,-h/2,w,h);c.restore();}
    function motion(c,s,w,h,a,t){if(a<=0)return;c.save();c.globalCompositeOperation='screen';c.globalAlpha=a*.12;const dx=Math.sin(t*3.2)*Math.min(w,h)*.006*a,dy=Math.cos(t*2.4)*Math.min(w,h)*.004*a;for(let i=1;i<=4;i++)c.drawImage(s,dx*i,dy*i,w,h);c.restore();}
    function glitch(c,s,w,h,a,t){if(seeded(Math.floor(t*8),19)>.72){const n=2+Math.floor(seeded(t*10,20)*6);for(let i=0;i<n;i++){const y=Math.floor(seeded(t*11+i,21)*h),sh=Math.max(2,Math.floor(h*(.002+seeded(i,22)*.012)*a)),shift=(seeded(t*13+i,23)-.5)*w*.06*a;c.drawImage(s,0,y,w,sh,shift,y,w,sh);}}c.save();c.globalAlpha=a*.18;c.fillStyle='#fff';c.fillRect(0,Math.floor(seeded(t*31,24)*h),w,Math.max(1,Math.floor(h*.0015)));c.restore();}
    function halftone(c,s,w,h,a){if(a<=0)return;const sample=Math.min(128,Math.max(32,Math.round(w/Math.max(5,Math.min(w,h)*.012))));scratch.width=sample;scratch.height=Math.max(1,Math.round(h/w*sample));scratchCtx.filter='grayscale(1) contrast(1.2)';scratchCtx.drawImage(s,0,0,scratch.width,scratch.height);scratchCtx.filter='none';const d=scratchCtx.getImageData(0,0,scratch.width,scratch.height).data,sx=w/scratch.width,sy=h/scratch.height;c.save();c.globalAlpha=clamp(a*.75,0,.7);c.fillStyle='#000';for(let y=0;y<scratch.height;y++)for(let x=0;x<scratch.width;x++){const i=(y*scratch.width+x)*4,lum=(d[i]+d[i+1]+d[i+2])/765,r=(1-lum)*Math.min(sx,sy)*.48;if(r<.5)continue;c.beginPath();c.arc(x*sx+sx/2,y*sy+sy/2,r,0,Math.PI*2);c.fill();}c.restore();scratch.width=w;scratch.height=h;}
    function mixedMedia(c,s,w,h,a,t,speed){
      base(c,s,w,h);
      const pulse=.5+.5*Math.sin(t*speed*1.8), drift=Math.sin(t*speed*.7)*w*.012*a;
      c.save();c.globalAlpha=.15*a;c.globalCompositeOperation='multiply';
      c.fillStyle='#e8d8b8';c.translate(drift,-h*.08);c.rotate(-.006);c.fillRect(w*.06,h*.18,w*.88,h*.62);
      c.fillStyle='#d6dde0';c.translate(-drift*1.6,h*.025);c.rotate(.011);c.fillRect(w*.10,h*.29,w*.80,h*.48);c.restore();
      const shift=Math.max(1,Math.round(Math.min(w,h)*.0028*a));
      c.save();c.globalCompositeOperation='screen';c.globalAlpha=.14*a;c.drawImage(s,shift,0,w,h,0,0,w,h);c.restore();
      c.save();c.globalCompositeOperation='multiply';c.globalAlpha=.16*a;
      const spacing=Math.max(7,Math.round(Math.min(w,h)*.012));
      for(let y=0;y<h;y+=spacing)for(let x=0;x<w;x+=spacing){const n=seeded(x*.013+y*.017+Math.floor(t*speed*3),31);if(n>.72){c.fillStyle='#111';c.fillRect(x,y,Math.max(1,spacing*.18),Math.max(1,spacing*.18));}}
      c.restore();grain(c,w,h,s.fxGrain*.7*a,t*speed);vignette(c,w,h,.07*a+.025*pulse);
    }
    function apply(c,w,h,s,t,src){
      const fx=s.visualFx||'none',a=clamp(s.fxIntensity),speed=Math.max(.1,Number(s.fxSpeed)||1);
      if(fx==='none')return;
      c.clearRect(0,0,w,h);
      switch(fx){
        case'vhs':shake(c,src,w,h,a*.45,t,speed*.8);rgb(c,src,w,h,.004*a);motion(c,src,w,h,a*.65,t);scan(c,w,h,clamp(s.fxScanlines*.75+a*.12),5);grain(c,w,h,s.fxGrain+a*.28,t);glitch(c,src,w,h,a*.7,t);break;
        case'crt-screen':
        case'crt':base(c,src,w,h);rgb(c,src,w,h,.0025*a);bloom(c,src,w,h,a*.55);scan(c,w,h,s.fxScanlines+a*.22,4);vignette(c,w,h,s.fxVignette+a*.18);break;
        case'rgb-shift':
        case'rgb':base(c,src,w,h);rgb(c,src,w,h,s.fxRgbShift*a);break;
        case'bloom':
        case'star-glow':base(c,src,w,h);bloom(c,src,w,h,a);break;
        case'motion-blur':
        case'motion':base(c,src,w,h,s.fxBlur*a+a*.35,t);break;
        case'camera-shake':
        case'shake':shake(c,src,w,h,s.fxShake*a+a*.35,t,speed);motion(c,src,w,h,a*.35,t);break;
        case'glitch':base(c,src,w,h);glitch(c,src,w,h,a,t);rgb(c,src,w,h,.004*a);break;
        case'halftone-screen':
        case'halftone':base(c,src,w,h);halftone(c,src,w,h,s.fxHalftone*a);break;
        case'vignette':base(c,src,w,h);vignette(c,w,h,s.fxVignette*a+.12*a);break;

        case'depth-of-field':{
          base(c,src,w,h);scratchCtx.clearRect(0,0,w,h);scratchCtx.filter=`blur(${2+Math.min(22,Math.min(w,h)*.02*a)}px)`;scratchCtx.globalAlpha=.78*a;scratchCtx.drawImage(src,0,0,w,h);scratchCtx.filter='none';c.save();c.globalAlpha=.9;c.drawImage(scratch,0,0,w,h);c.globalCompositeOperation='destination-out';const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*(.16+.18*(1-a)),w/2,h/2,Math.min(w,h)*(.55+.15*a));g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.72,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();break;
        }
        case'circular-blur':
        case'radial-blur':{
          base(c,src,w,h);c.save();c.globalAlpha=.16*a;c.globalCompositeOperation='screen';for(let i=1;i<=7;i++){const q=i/7,ang=(q-.5)*.12*a;c.translate(w/2,h/2);c.rotate(ang);c.translate(-w/2,-h/2);c.drawImage(src,0,0,w,h);c.setTransform(1,0,0,1,0,0);}c.restore();break;
        }
        case'zoom-blur':{
          base(c,src,w,h);c.save();c.globalCompositeOperation='screen';c.globalAlpha=.1*a;for(let i=1;i<=7;i++){const q=1+i*.008*a;c.drawImage(src,w*(1-q)/2,h*(1-q)/2,w*q,h*q);}c.restore();break;
        }
        case'blur-sharp':{
          base(c,src,w,h);scratchCtx.clearRect(0,0,w,h);scratchCtx.filter=`blur(${3+18*a}px)`;scratchCtx.globalAlpha=.75*a;scratchCtx.drawImage(src,0,0,w,h);scratchCtx.filter='none';c.save();c.globalAlpha=.7;c.globalCompositeOperation='screen';c.drawImage(scratch,0,0);c.restore();break;
        }
        case'gaussian-blur':{
          c.save();c.filter=`blur(${1+Math.min(28,28*a)}px)`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }

        case'color-grading':
        case'curves':
        case'levels':
        case'color-balance':{
          c.save();c.filter=`contrast(${1+.65*a}) saturate(${1+.45*a}) brightness(${.95+.18*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'hue-curves':
        case'hue-saturation':{
          c.save();c.filter=`hue-rotate(${(t*speed*18+70*a)%360}deg) saturate(${1+.85*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'gradient-map':{
          c.save();c.filter='grayscale(1) contrast(1.25)';c.drawImage(src,0,0,w,h);c.filter='none';c.globalAlpha=.5*a;c.globalCompositeOperation='screen';const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#15204a');g.addColorStop(.5,'#ef3f38');g.addColorStop(1,'#ffe7a8');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();break;
        }
        case'thermal':{
          c.save();c.filter=`grayscale(1) contrast(${1.35+.5*a}) invert(1) hue-rotate(165deg) saturate(3)`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'dither':{
          base(c,src,w,h);halftone(c,src,w,h,.45+.5*a);break;
        }
        case'exposure':{
          c.save();c.filter=`brightness(${1+.85*a}) contrast(${1+.15*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'monochrome':
        case'black-white':{
          c.save();c.filter=`grayscale(1) contrast(${1+.3*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'color-matrix':{
          c.save();c.filter=`saturate(${.25+.5*a}) contrast(${1+.5*a}) hue-rotate(${120*a}deg)`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'rgb-gain':{
          base(c,src,w,h);rgb(c,src,w,h,.002+.012*a);c.save();c.globalAlpha=.25*a;c.globalCompositeOperation='screen';c.fillStyle='rgba(255,40,40,.35)';c.fillRect(0,0,w,h);c.restore();break;
        }
        case'duotone':{
          c.save();c.filter='grayscale(1)';c.drawImage(src,0,0,w,h);c.filter='none';c.globalCompositeOperation='multiply';c.globalAlpha=.82*a;const g=c.createLinearGradient(0,h,0,0);g.addColorStop(0,'#10182d');g.addColorStop(1,'#f06b55');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();break;
        }
        case'color-temperature':{
          c.save();c.filter=`sepia(${.35*a}) saturate(${1+.45*a}) hue-rotate(${-8*a}deg)`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'contrast':{
          c.save();c.filter=`contrast(${1+.9*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }

        case'reeded-glass':
        case'elastic-grid':
        case'ripple':
        case'displacement':{
          base(c,src,w,h);const bands=64,amp=Math.max(1,Math.min(w*.035,w*.09*a));c.save();for(let i=0;i<bands;i++){const y=i*h/bands,hh=h/bands+.8,off=Math.sin(i*.8+t*speed*4)*amp;c.drawImage(src,0,y,w,hh,off,y,w,hh);}c.restore();break;
        }
        case'cubify':{
          base(c,src,w,h);c.save();c.globalAlpha=.35*a;c.translate(w/2,h/2);c.scale(1+.14*a,1-.08*a);c.rotate(.025*a);c.drawImage(src,-w/2,-h/2,w,h);c.restore();break;
        }
        case'perspective':{
          base(c,src,w,h);c.save();c.globalAlpha=.55*a;c.setTransform(1,.08*a,-.05*a,1,0,h*.02*a);c.drawImage(src,0,0,w,h);c.restore();break;
        }
        case'pinch':{
          base(c,src,w,h);c.save();c.globalAlpha=.4*a;c.translate(w/2,h/2);c.scale(1-.16*a,1-.16*a);c.drawImage(src,-w/2,-h/2,w,h);c.restore();break;
        }
        case'swirl':{
          base(c,src,w,h);c.save();c.globalAlpha=.22*a;for(let i=1;i<=8;i++){const q=i/8;c.translate(w/2,h/2);c.rotate((q-.5)*.18*a*Math.sin(t*speed));c.translate(-w/2,-h/2);c.drawImage(src,0,0,w,h);c.setTransform(1,0,0,1,0,0);}c.restore();break;
        }
        case'polar-to-rectangular':
        case'rectangular-to-polar':{
          base(c,src,w,h);c.save();c.globalAlpha=.25*a;c.globalCompositeOperation='screen';for(let i=1;i<=5;i++){const q=i/5;c.beginPath();c.arc(w/2,h/2,Math.min(w,h)*(.12+.14*i),0,Math.PI*2);c.save();c.clip();c.drawImage(src,w*(1-q)/2,h*(1-q)/2,w*q,h*q);c.restore();}c.restore();break;
        }
        case'transform':{
          base(c,src,w,h);c.save();c.globalAlpha=.55*a;c.translate(w/2,h/2);c.rotate(Math.sin(t*speed)*.08*a);c.scale(1+.08*a,1-.04*a);c.drawImage(src,-w/2,-h/2,w,h);c.restore();break;
        }

        case'frame-drop':{
          base(c,src,w,h);const phase=Math.floor(t*speed*8)%3;if(phase===0){c.save();c.globalAlpha=.35*a;c.translate(w*.012*a,0);c.drawImage(src,0,0,w,h);c.restore();}break;
        }
        case'risograph':{
          c.save();c.filter='grayscale(1) contrast(1.55)';c.drawImage(src,0,0,w,h);c.filter='none';c.globalCompositeOperation='multiply';c.globalAlpha=.7*a;const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ef6b5b');g.addColorStop(.5,'#f2d7a0');g.addColorStop(1,'#244b63');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();halftone(c,src,w,h,.25*a);grain(c,w,h,.3*a,t);break;
        }
        case'motion-trails':base(c,src,w,h);motion(c,src,w,h,a*1.4,t);break;
        case'ascii':{
          c.fillStyle='#050505';c.fillRect(0,0,w,h);const cols=Math.max(24,Math.round(w/9)),rows=Math.max(12,Math.round(h/16)),cw=w/cols,ch=h/rows;for(let yy=0;yy<rows;yy++)for(let xx=0;xx<cols;xx++){const i=Math.floor((yy/rows)*src.height)*src.width+Math.floor((xx/cols)*src.width);const p=src.getContext?null:null;const chars=' .:-=+*#%@';const n=Math.floor(seeded(i+Math.floor(t*speed*3),77)*chars.length);c.fillStyle=`rgba(255,255,255,${.15+.55*a})`;c.font=`${Math.max(7,ch)}px monospace`;c.fillText(chars[n],xx*cw,yy*ch+ch);}break;
        }
        case'modulation':{
          base(c,src,w,h);c.save();c.globalAlpha=.35*a;c.globalCompositeOperation='screen';for(let y=0;y<h;y+=3){const off=Math.sin(y*.035+t*speed*7)*w*.015*a;c.drawImage(src,0,y,w,3,off,y,w,3);}c.restore();break;
        }
        case'threshold':{
          c.save();c.filter=`grayscale(1) contrast(${3+a*5}) brightness(${.8+.2*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();break;
        }
        case'ntsc':{
          base(c,src,w,h);rgb(c,src,w,h,.004*a);scan(c,w,h,.3+.35*a,3);grain(c,w,h,.2*a,t);break;
        }
        case'led-screen':{
          base(c,src,w,h);const step=Math.max(4,Math.round(Math.min(w,h)*.012));c.save();c.globalAlpha=.28*a;c.fillStyle='#000';for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){c.beginPath();c.arc(x+step/2,y+step/2,step*.18,0,Math.PI*2);c.fill();}c.restore();break;
        }
        case'stripe':{
          base(c,src,w,h);c.save();c.globalAlpha=.18*a;c.globalCompositeOperation='multiply';c.fillStyle='#000';const gap=Math.max(8,Math.round(Math.min(w,h)*.025));for(let x=-h;x<w;x+=gap*2)c.beginPath(),c.moveTo(x,0),c.lineTo(x+gap,0),c.lineTo(x+h+gap,h),c.lineTo(x+h,h),c.closePath(),c.fill();c.restore();break;
        }
        case'emboss':{
          base(c,src,w,h);c.save();c.globalAlpha=.45*a;c.globalCompositeOperation='screen';c.drawImage(src,Math.round(2*a),Math.round(2*a));c.globalCompositeOperation='multiply';c.globalAlpha=.35*a;c.drawImage(src,-Math.round(2*a),-Math.round(2*a));c.restore();break;
        }

        case'text':{
          base(c,src,w,h);c.save();c.globalAlpha=.7*a;c.fillStyle='#fff';c.font=`700 ${Math.max(18,Math.round(Math.min(w,h)*.07))}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('KEFE',w/2,h/2);c.restore();break;
        }
        case'blob-tracker':{
          base(c,src,w,h);c.save();c.globalAlpha=.4*a;for(let i=0;i<5;i++){const x=(.2+.6*seeded(i,88)+.08*Math.sin(t*speed+i))*w,y=(.2+.6*seeded(i,89)+.08*Math.cos(t*speed+i))*h,r=Math.min(w,h)*(.015+.025*seeded(i,90));c.strokeStyle='#fff';c.lineWidth=Math.max(1,r*.12);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}c.restore();break;
        }
        case'ink-bleed':{
          base(c,src,w,h);scratchCtx.clearRect(0,0,w,h);scratchCtx.filter=`blur(${3+25*a}px)`;scratchCtx.globalAlpha=.45*a;scratchCtx.drawImage(src,0,0,w,h);scratchCtx.filter='none';c.save();c.globalCompositeOperation='multiply';c.drawImage(scratch,Math.sin(t*speed)*w*.008*a,Math.cos(t*speed)*h*.008*a);c.restore();grain(c,w,h,.25*a,t);break;
        }
        case'paper-scan':{
          base(c,src,w,h);grain(c,w,h,.55*a,t);scan(c,w,h,.12*a,Math.max(3,Math.round(Math.min(w,h)*.008)));c.save();c.globalAlpha=.08*a;c.fillStyle='#d8c8aa';c.fillRect(0,0,w,h);c.restore();break;
        }
        case'noise':{
          base(c,src,w,h);grain(c,w,h,.9*a,t);break;
        }

        case'texture-blur':{
          base(c,src,w,h);scratchCtx.clearRect(0,0,w,h);scratchCtx.filter=`blur(${5+24*a}px)`;scratchCtx.globalAlpha=.65*a;scratchCtx.drawImage(src,0,0,w,h);scratchCtx.filter='none';c.save();c.globalAlpha=.6;c.globalCompositeOperation='screen';c.drawImage(scratch,0,0);c.restore();break;
        }
        case'layer-mix':{
          base(c,src,w,h);c.save();c.globalAlpha=.22*a;c.globalCompositeOperation='screen';c.drawImage(src,Math.sin(t*speed)*w*.012*a,Math.cos(t*speed)*h*.012*a,w,h);c.globalCompositeOperation='multiply';c.globalAlpha=.12*a;c.drawImage(src,-w*.006*a,0,w,h);c.restore();break;
        }
        case'classic-film':
        case'vintage-film':{
          c.save();c.filter=`sepia(${.32*a}) contrast(${1+.25*a}) saturate(${.75+.25*a})`;c.drawImage(src,0,0,w,h);c.filter='none';c.restore();grain(c,w,h,.55*a,t);vignette(c,w,h,.12*a);break;
        }
        case'halation':{
          base(c,src,w,h);bloom(c,src,w,h,.75*a);c.save();c.globalCompositeOperation='screen';c.globalAlpha=.2*a;c.fillStyle='#d64c4c';c.fillRect(0,0,w,h);c.restore();break;
        }
        case'film-grain':{
          base(c,src,w,h);grain(c,w,h,.95*a,t);break;
        }
        case'mixedmedia':mixedMedia(c,src,w,h,a,t,speed);break;
        default:base(c,src,w,h);
      }
    }
    window.render=function(ctx,w,h,appState,mediaCache){const fx=appState?.style?.visualFx||'none';if(!fx||fx==='none')return originalRender(ctx,w,h,appState,mediaCache);resize(w,h);originalRender(fxInputCtx,w,h,appState,mediaCache);ctx.save();apply(ctx,w,h,appState.style,Number(appState.playback?.currentTime)||0,fxInput);ctx.restore();};
    const labels={none:'Off — clean KEFE rendering',vhs:'VHS — tape wobble, chroma bleed, scanlines and grain',crt:'CRT — scanlines, glow, RGB separation and vignette',rgb:'RGB Shift — chromatic lens separation',bloom:'Bloom — soft highlight diffusion and light bleed',motion:'Motion Blur — directional trails',shake:'Camera Shake — subtle handheld movement',glitch:'Glitch — controlled signal breaks and chromatic distortion',halftone:'Halftone — graphic print-screen texture',vignette:'Vignette — restrained cinematic edge falloff',mixedmedia:'Mixed Media — layered collage, print texture, halftone and imperfect registration'};
    const catalog={
      'Blur':['Camera shake','Depth of field','Circular blur','Motion blur','Radial blur','Zoom blur','Blur/sharp','Gaussian blur'],
      'Color':['Color grading','Hue curves','Gradient map','Curves','Thermal','Dither','Exposure','Monochrome','Hue/saturation','Color balance','Color matrix','Levels','RGB Gain','Duotone','Color temperature','Contrast'],
      'Distort':['Reeded glass','Elastic grid','Cubify','Glitch','Ripple','Transform','Polar to rectangular','Pinch','Perspective','Swirl','Rectangular to polar'],
      'Effects':['Frame drop','Risograph','Motion trails','Star glow','VHS','ASCII','Halftone screen','Modulation','Threshold','Bloom','CRT screen','NTSC','RGB Shift','LED screen','Stripe','Vignette','Emboss'],
      'Generate':['Text','Blob Tracker','Ink bleed','Paper scan','Noise'],
      'Custom':['Displacement','Texture Blur','Layer Mix'],
      'Film':['Classic Film','Halation','Film Grain','Black & White','Vintage Film']
    };
    const effectValues={};
    Object.values(catalog).flat().forEach(name=>effectValues[name]=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));
    Object.assign(effectValues,{'Black & White':'black-white','VHS':'vhs','CRT screen':'crt-screen','RGB Shift':'rgb-shift','Bloom':'bloom','Motion blur':'motion-blur','Camera shake':'camera-shake','Glitch':'glitch','Halftone screen':'halftone-screen','Vignette':'vignette','Mixed media':'mixedmedia'});
    Object.entries(effectValues).forEach(([name,value])=>{labels[value]=name;});
    const implemented=new Set([...Object.keys(effectValues)]);
    function setFx(name){if(!labels[name]||window.isExporting)return;window.state.style.visualFx=name;qsa('.kefe-fx-button').forEach(b=>b.classList.toggle('active-effect',b.dataset.fx===name));const l=document.getElementById('visualFxLabel');if(l)l.textContent=labels[name];save();window.redrawCurrentPreviewFrame?.();}
    function range(parent,key,text,min,max,step,suffix=''){const row=document.createElement('div');row.className='control-row';const label=document.createElement('label'),value=document.createElement('span'),input=document.createElement('input');value.style.marginLeft='6px';label.textContent=text;input.type='range';input.min=min;input.max=max;input.step=step;input.value=window.state.style[key];const show=()=>value.textContent=`${Number(input.value).toFixed(step<.1?2:1)}${suffix}`;label.appendChild(value);show();input.addEventListener('input',()=>{window.state.style[key]=Number(input.value);show();save();window.redrawCurrentPreviewFrame?.();});row.append(label,input);parent.appendChild(row);}
    function ui(){
      const sec=document.getElementById('backgroundSection');
      const fxSec=document.getElementById('fxSection');
      if(!sec||!fxSec||sec.dataset.kefeFxBuilt)return;
      sec.dataset.kefeFxBuilt='true';
      fxSec.hidden=false;
      const h=document.createElement('div');h.className='sub-heading';h.textContent='Effect';fxSec.appendChild(h);
      const select=document.createElement('select');select.id='backgroundEffectSelect';select.setAttribute('aria-label','Background effect');
      const off=document.createElement('option');off.value='none';off.textContent='Off — clean KEFE rendering';select.appendChild(off);
      Object.entries(catalog).forEach(([category,names])=>{
        const group=document.createElement('optgroup');group.label=category;
        names.forEach(name=>{
          const o=document.createElement('option');
          o.value=effectValues[name]||'';
          o.textContent=name;
          o.disabled=!implemented.has(name);
          group.appendChild(o);
        });
        if(category==='Effects'){
          const mixed=document.createElement('option');mixed.value='mixedmedia';mixed.textContent='Mixed Media';group.appendChild(mixed);
        }
        select.appendChild(group);
      });
      const wrap=document.createElement('label');wrap.className='background-effect-select';wrap.textContent='Effect';wrap.appendChild(select);
      fxSec.appendChild(wrap);
      const label=document.createElement('div');label.className='effect-label';label.id='visualFxLabel';label.textContent=labels[window.state.style.visualFx]||labels.none;fxSec.appendChild(label);
      const controls=document.createElement('div');controls.className='background-effect-controls';range(controls,'fxIntensity','Intensity',0,1,.05);range(controls,'fxSpeed','Animation speed',.25,2.5,.05,'×');fxSec.appendChild(controls);
      select.value=window.state.style.visualFx||'none';
      select.addEventListener('change',()=>setFx(select.value));
    }
    ui();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
