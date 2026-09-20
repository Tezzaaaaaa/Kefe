/* KEFE Visualiser — Split-Flap lyric effect.
   Each letter rolls vertically through a strip of alternatives until it lands. */
(function(){
  'use strict';
  var u = window.kefeEffectUtils;
  window.kefeEffects = window.kefeEffects || {};
  if (!u) { console.error('[lyric-splitflap] requires core.js'); return; }
  function clamp(v,a,b){ a=a==null?0:a; b=b==null?1:b; return Math.max(a,Math.min(b,Number(v)||0)); }

  function font(ctx,size){ ctx.font='900 '+Math.max(8,size)+'px "Archivo Narrow","Arial Narrow",system-ui,sans-serif'; }
  function fit(ctx,text,requested,maxWidth){
    var size=Math.max(40,Math.min(220,Number(requested)||120));
    font(ctx,size);
    while(size>40 && ctx.measureText(text).width>maxWidth){ size-=2; font(ctx,size); }
    return size;
  }
  var ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function pseudoRand(n){ var x=Math.sin(n*12.9898)*43758.5453; return x-Math.floor(x); }

  window.kefeEffects.splitflap = function(ctx,w,h,style,lines,time){
    var active=u.activeLine(lines,time);
    if(!active) return;
    var text=String(active.line.text||'').trim().toUpperCase();
    if(!text) return;
    var lineProg=u.lineProgress(active.line,time);
    if(lineProg.opacity<=0.01) return;
    var sp=style.fxSpacing||1;
    var B=u.textBlock(ctx,text,{font:font,tag:'splitflap',size:style.fontSize,w:w*0.94,h:h*0.92,lh:1.08*sp,maxLines:3});
    font(ctx,B.size);
    var size=B.size, elapsed=time-(Number(active.line.time)||0);
    var total=0; B.rows.forEach(function(r){ total+=r.length; });
    var perChar=Math.min(0.08,0.9/Math.max(1,total)), gi=0;
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    B.rows.forEach(function(row,ri){
      var widths=[],rw=0,i;
      for(i=0;i<row.length;i++){ var cw=ctx.measureText(row[i]).width; widths.push(cw); rw+=cw; }
      var x=w/2-rw/2, y=h/2-B.blockH/2+(ri+0.5)*B.rowH;
      for(i=0;i<row.length;i++,gi++){
        var target=row[i], cx=x+widths[i]/2;
        x+=widths[i];
        if(target===' ') continue;
        var charStart=gi*perChar, ce=elapsed-charStart, landAt=0.55;
        var settled=ce>=landAt, cur=target, off=0;
        if(!settled&&ce>0){
          var frames=Math.floor(ce*24);
          cur=ALPHABET[Math.floor(pseudoRand(gi*17+frames)*26)];
          if(ce>landAt-0.16&&pseudoRand(gi+Math.floor(ce*10))>0.5) cur=target;
          off=(1-ce/landAt)*(pseudoRand(gi+frames)*2-1)*size*0.22;
        }
        var alpha=lineProg.opacity*(ce>0?1:0);
        if(alpha<=0) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(cx-widths[i]/2-1,y-size*0.5,widths[i]+2,size); ctx.clip();
        ctx.globalAlpha=alpha; ctx.fillStyle=style.textColor||'#FFFFFF';
        ctx.fillText(cur,cx,y+off);
        ctx.globalAlpha=alpha*0.16; ctx.fillStyle='#000';
        ctx.fillRect(cx-widths[i]/2-1,y-1,widths[i]+2,2);
        ctx.restore();
      }
    });
    ctx.restore();
  };
})();
