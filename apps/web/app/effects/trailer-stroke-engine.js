/* KEFE Trailer handwriting renderer.
 * Uses local Tegaki/Caveat centreline geometry. Progress is deterministic and distance-based,
 * so seeking or exporting the same timestamp reproduces the same written strokes.
 */
(function(){
'use strict';
var glyphs=window.KEFE_TRAILER_GLYPHS||{};
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function measure(points){var total=0,segments=[];for(var i=1;i<points.length;i++){var a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);segments.push({a:a,b:b,length:len,start:total,end:total+len});total+=len;}return {segments:segments,total:total};}
function plan(g){var strokes=g.s||[],sum=0,measures=strokes.map(function(s){var m=measure(s.p||[]);sum+=m.total;return m;}),clock=0;return strokes.map(function(s,i){var duration=(sum?measures[i].total/sum:1/Math.max(1,strokes.length))*(g.t||.5),item={stroke:s,measure:measures[i],start:clock,end:clock+duration};clock+=duration;return item;});}
function paintSegment(ctx,seg,progress,mode){var a=seg.a,b=seg.b,t=clamp(progress,0,1);if(t<=0)return;var x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,p=a[2]+(b[2]-a[2])*t;ctx.strokeStyle=mode==='mask'?'#fff':'rgba(224,242,247,.94)';ctx.fillStyle=mode==='mask'?'#fff':'rgba(224,242,247,.94)';ctx.lineWidth=Math.max(5,(a[2]+p)*.5);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(x,y);ctx.stroke();return [x,y,p];}
function draw(ctx,ch,x,y,size,progress,mode){var g=glyphs[ch];if(!g)g=glyphs[ch.toLowerCase()];if(!g||!g.s||progress<=0)return false;
var timeline=plan(g),now=clamp(progress,0,1)*(g.t||.5),scale=size/1000;
ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=mode==='mask'?0:12;ctx.shadowColor='rgba(194,230,240,.2)';
timeline.forEach(function(item){var m=item.measure;if(!m.total||now<=item.start)return;var local=clamp((now-item.start)/Math.max(.0001,item.end-item.start),0,1),distance=local*m.total,last=null;
m.segments.forEach(function(seg){if(distance<=seg.start)return;last=paintSegment(ctx,seg,clamp((distance-seg.start)/Math.max(.00001,seg.length),0,1),mode);});
if(mode!=='mask'&&local<1&&last){ctx.globalAlpha=.24;ctx.fillStyle='rgba(248,255,255,.96)';ctx.beginPath();ctx.arc(last[0],last[1],Math.max(7,last[2]*.65),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
});
ctx.restore();return true;
}
window.KEFETrailerStrokeEngine={draw:draw,hasGlyph:function(ch){return !!glyphs[ch];},glyphs:glyphs};
})();
