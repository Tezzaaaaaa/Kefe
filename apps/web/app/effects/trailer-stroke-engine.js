/* Deterministic, pressure-aware centreline renderer adapted to Tegaki glyph geometry. */
(function(){'use strict';var glyphs=window.KEFE_TRAILER_GLYPHS||{};
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function length(p){var n=0;for(var i=1;i<p.length;i++)n+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return n;}
function plan(g){var s=g.s||[],sum=s.reduce(function(n,x){return n+length(x.p||[]);},0),t=0;return s.map(function(x){var d=(sum?length(x.p||[])/sum:1/s.length)*(g.t||.5),o={s:x,a:t,b:t+d};t+=d;return o;});}
function draw(ctx,ch,x,y,size,p,mode){var g=glyphs[ch]||glyphs[ch.toLowerCase()];if(!g||!g.s||p<=0)return;var q=plan(g),now=clamp(p,0,1)*(g.t||.5),sc=size/1000;ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.lineCap='round';ctx.lineJoin='round';
q.forEach(function(it){var pts=it.s.p||[];if(pts.length<2||now<=it.a)return;var f=clamp((now-it.a)/Math.max(.0001,it.b-it.a),0,1)*(pts.length-1),whole=Math.floor(f),part=f-whole;ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.shadowBlur=mode==='mask'?0:size*.018;ctx.shadowColor='rgba(194,230,240,.2)';
for(var j=0;j<whole;j++){var a=pts[j],b=pts[j+1];ctx.lineWidth=Math.max(5,(a[2]+b[2])*.5);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
var last=pts[Math.min(whole,pts.length-1)];if(whole<pts.length-1&&part>0){var a=pts[whole],b=pts[whole+1],px=a[0]+(b[0]-a[0])*part,py=a[1]+(b[1]-a[1])*part,pw=a[2]+(b[2]-a[2])*part;ctx.lineWidth=Math.max(5,(a[2]+pw)*.5);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(px,py);ctx.stroke();last=[px,py,pw];}
if(mode!=='mask'&&f<pts.length-1){ctx.globalAlpha=.3;ctx.beginPath();ctx.arc(last[0],last[1],Math.max(7,(last[2]||8)*.72),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
});ctx.restore();}
window.KEFETrailerStrokeEngine={draw:draw,hasGlyph:function(ch){return !!glyphs[ch];},glyphs:glyphs};})();
