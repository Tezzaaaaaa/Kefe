/* KEFE — Concrete: diegetic 3D lyrics. */
(function () {
  'use strict';
  var FONT_STACK = (window.KEFE_FONTS && window.KEFE_FONTS.serif) || '"Faustina","Iowan Old Style","Charter",Georgia,serif';
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
  var num=function(v,d){return Number.isFinite(Number(v))&&v!==''&&v!==null?Number(v):d;};
  /* ---------- Timestamp parsing ---------- */
  function parseTimestamp(value) {
    if (value == null || value === '') return NaN;
    var raw = String(value).trim();
    if (/^\d+(?:\.\d+)?ms$/i.test(raw)) return parseFloat(raw);
    if (/^\d+(?:\.\d+)?s$/i.test(raw)) return parseFloat(raw) * 1000;
    var parts = raw.split(':').map(Number);
    if (parts.some(Number.isNaN)) return NaN;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    return Number(raw) * 1000;
  }

  function attr(node, name) {
    if (!node) return '';
    var direct = node.getAttribute && node.getAttribute(name);
    if (direct) return direct;
    var list = node.attributes || [];
    for (var i = 0; i < list.length; i++) if (list[i].localName === name) return list[i].value;
    return '';
  }

  /* ---------- Timed fragment splitting ---------- */
  function splitTimedFragment(fragment) {
    var text = String(fragment.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    if (!Number.isFinite(fragment.startTime) || !Number.isFinite(fragment.endTime) || fragment.endTime <= fragment.startTime) return [];
    var tokens = text.split(/\s+/);
    if (tokens.length === 1) return [{ startTime: fragment.startTime, endTime: fragment.endTime, word: tokens[0], isBG: !!fragment.isBG }];
    var weights = tokens.map(function (t) { return Math.max(1, (t.replace(/[^\p{L}\p{N}]/gu, '') || '').length); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var cursor = fragment.startTime;
    return tokens.map(function (word, i) {
      var end = i === tokens.length - 1 ? fragment.endTime : cursor + (fragment.endTime - fragment.startTime) * (weights[i] / total);
      var out = { startTime: cursor, endTime: Math.max(cursor + 1, end), word: word, isBG: !!fragment.isBG };
      cursor = out.endTime;
      return out;
    });
  }

  /* ---------- TTML parser ---------- */
  function parseAppleTTML(source) {
    if (Array.isArray(source)) return normaliseLines(source);
    if (typeof source !== 'string' || !source.trim()) return [];
    var doc = new DOMParser().parseFromString(source, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid TTML');

    return Array.prototype.slice.call(doc.querySelectorAll('p')).map(function (p) {
      var start = parseTimestamp(attr(p, 'begin'));
      var endAttr = parseTimestamp(attr(p, 'end'));
      var dur = parseTimestamp(attr(p, 'dur'));
      var end = Number.isFinite(endAttr) ? endAttr : (Number.isFinite(start) && Number.isFinite(dur) ? start + dur : NaN);
      var primary = [], background = [], translation = '', roman = '';

      function walk(node, inStart, inEnd, role, agent, isBG) {
        if (node.nodeType === 3) {
          var text = node.nodeValue || '';
          if (!text.trim()) return;
          var roleName = String(role || '').toLowerCase();
          var fragment = { text: text, startTime: inStart, endTime: inEnd, isBG: !!isBG, agent: agent };
          if (roleName === 'x-translation') translation += text;
          else if (roleName === 'x-roman') roman += text;
          else if (isBG || roleName === 'x-bg') background.push(fragment);
          else primary.push(fragment);
          return;
        }
        if (node.nodeType !== 1) return;
        var ownStart = parseTimestamp(attr(node, 'begin'));
        var ownEnd = parseTimestamp(attr(node, 'end'));
        var ownDur = parseTimestamp(attr(node, 'dur'));
        var nextStart = Number.isFinite(ownStart) ? ownStart : inStart;
        var nextEnd = Number.isFinite(ownEnd) ? ownEnd : (Number.isFinite(ownDur) && Number.isFinite(nextStart) ? nextStart + ownDur : inEnd);
        var nextRole = attr(node, 'role') || role;
        var nextAgent = attr(node, 'agent') || agent;
        var bg = !!isBG || String(nextRole).toLowerCase() === 'x-bg';
        Array.prototype.slice.call(node.childNodes).forEach(function (child) { walk(child, nextStart, nextEnd, nextRole, nextAgent, bg); });
      }

      Array.prototype.slice.call(p.childNodes).forEach(function (child) { walk(child, start, end, '', attr(p, 'agent'), false); });

      var words = primary.reduce(function (acc, f) { return acc.concat(splitTimedFragment(f)); }, []);
      var bgWords = background.reduce(function (acc, f) { return acc.concat(splitTimedFragment(f)); }, []);
      var text = primary.map(function (f) { return f.text; }).join('').replace(/\s+/g, ' ').trim();

      return normaliseLine({
        words: words,
        backgroundWords: bgWords,
        startTime: Number.isFinite(start) ? start : (words[0] ? words[0].startTime : 0),
        endTime: Number.isFinite(end) ? end : (words.length ? words[words.length - 1].endTime : start || 0),
        isBG: words.length === 0 && bgWords.length > 0,
        isDuet: String(attr(p, 'agent') || '').toLowerCase().indexOf('duet') !== -1,
        translatedLyric: translation.replace(/\s+/g, ' ').trim(),
        romanLyric: roman.replace(/\s+/g, ' ').trim(),
        text: text
      });
    }).filter(Boolean);
  }

  /* ---------- LRC parser ---------- */
  function parseAppleLRC(source) {
    if (typeof source !== 'string') return [];
    var out = [];
    source.split(/\r?\n/).forEach(function (row) {
      var m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (!m) return;
      var start = (parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000;
      var text = m[3].trim();
      if (!text) return;
      out.push({ words: [{ startTime: start, endTime: start + 2000, word: text, isBG: false }], startTime: start, endTime: start + 2000, isBG: false, isDuet: false, translatedLyric: '', romanLyric: '', text: text });
    });
    for (var i = 0; i < out.length - 1; i++) {
      out[i].endTime = Math.max(out[i].startTime + 100, out[i + 1].startTime);
      out[i].words[0].endTime = out[i].endTime;
    }
    return out;
  }

  /* ---------- Normalisation ---------- */
  function normaliseLine(line) {
    if (!line) return null;
    var words = (Array.isArray(line.words) ? line.words : []).map(function (w) {
      var start = num(w.startTime != null ? w.startTime : (w.time != null ? w.time : w.start), 0);
      var end = num(w.endTime != null ? w.endTime : w.end, start + 100);
      return {
        startTime: start,
        endTime: Math.max(start + 1, end),
        word: String(w.word != null ? w.word : (w.text || '')),
        isBG: !!(w.isBG != null ? w.isBG : w.background)
      };
    }).filter(function (w) { return w.word; });

    var text = String(line.text != null ? line.text : words.map(function (w) { return w.word; }).join('')).replace(/\s+/g, ' ').trim();
    var start = num(line.startTime != null ? line.startTime : (line.time != null ? line.time : line.start), words[0] ? words[0].startTime : 0);
    var end = num(line.endTime != null ? line.endTime : line.end, words.length ? words[words.length - 1].endTime : start + 100);

    return {
      words: words,
      startTime: start,
      endTime: Math.max(start + 1, end),
      isBG: !!line.isBG,
      isDuet: !!line.isDuet,
      translatedLyric: String(line.translatedLyric || line.translation || ''),
      romanLyric: String(line.romanLyric || line.transliteration || ''),
      text: text
    };
  }

  function normaliseLines(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.map(normaliseLine).filter(function (l) { return l && (l.text || l.words.length); });
  }


  function activeIndex(lines,time){for(var i=0;i<lines.length;i++)if(time>=lines[i].startTime&&time<lines[i].endTime)return i;if(!lines.length)return -1;if(time>=lines[lines.length-1].endTime)return lines.length-1;return -1;}
  function focusIndex(lines,time){var ai=activeIndex(lines,time);if(ai>=0)return ai;if(!lines.length)return 0;if(time<lines[0].startTime)return 0;return lines.length-1;}
  function wordProgress(w,time){var s=num(w.startTime,0),e=Math.max(s+1,num(w.endTime,s+1));return clamp((time-s)/(e-s),0,1);}
  function color(v,d){var m=String(v||'').match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);if(m)return{r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]};var h=String(v||'').replace('#','');if(/^[0-9a-f]{6}$/i.test(h))return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1};return d;}
  function mix(a,b,t,alpha){t=clamp(t,0,1);return'rgba('+Math.round(a.r+(b.r-a.r)*t)+','+Math.round(a.g+(b.g-a.g)*t)+','+Math.round(a.b+(b.b-a.b)*t)+','+clamp((a.a+(b.a-a.a)*t)*alpha,0,1)+')';}
  function metrics(ctx,text,size,weight,spacing){ctx.font=(weight||400)+' '+size+'px '+FONT_STACK;return ctx.measureText(text).width+Math.max(0,text.length-1)*spacing;}
  function drawWord(ctx,text,x,y,size,weight,spacing,base,hi,p,glow){ctx.font=weight+' '+size+'px '+FONT_STACK;ctx.textBaseline='middle';var total=metrics(ctx,text,size,weight,spacing);ctx.globalAlpha=1;ctx.fillStyle=base;var xx=x;for(var i=0;i<text.length;i++){ctx.fillText(text[i],xx,y);xx+=ctx.measureText(text[i]).width+spacing;}if(p<=0)return total;var reveal=total*p,fade=total*.20;ctx.save();ctx.beginPath();ctx.rect(x,y-size*.72,Math.max(0,reveal+fade),size*1.45);ctx.clip();var g=ctx.createLinearGradient(x+Math.max(0,reveal-fade),0,x+reveal+fade,0);g.addColorStop(0,hi);g.addColorStop(.5,hi);g.addColorStop(1,base);ctx.fillStyle=g;ctx.shadowColor=hi;ctx.shadowBlur=glow*Math.sin(p*Math.PI);xx=x;for(var j=0;j<text.length;j++){ctx.fillText(text[j],xx,y);xx+=ctx.measureText(text[j]).width+spacing;}ctx.restore();return total;}
  function layout(ctx,w,h,style,line,index,focus,time){var size=num(style.fontSize,76),ds=num(style.depthSpacing,.28),fd=num(style.fogDensity,.35),margin=Math.max(16,Math.min(w,h)*.035),depth=index===focus?0:(focus-index)*ds,scale=Math.max(.25,1/Math.max(.001,1+depth)),vpX=w*.5,vpY=h*.5,row=size*1.28*num(style.fxSpacing,1),y=vpY+(index-focus)*row*scale;if(depth>1.5)y+=depth*2;var x=margin+(vpX-margin)*(depth/(1+Math.abs(depth)));var words=line.words&&line.words.length?line.words:[{startTime:line.startTime,endTime:line.endTime,word:line.text||''}],aw=0;for(var wi=0;wi<words.length;wi++){if(time>=words[wi].startTime&&time<words[wi].endTime){aw=wi;break;}if(time>=words[wi].endTime)aw=wi;}var wp=words.length?wordProgress(words[aw],time):0;var bass=index===focus?clamp(num(style.bass,0),0,1):0,push=index===focus?num(style.bassPush,.08)*bass*Math.sin(wp*Math.PI):0,pd=depth-push;if(index===focus){scale=Math.max(.25,1/Math.max(.001,1+pd));y=vpY+(index-focus)*row*scale;x=margin+(vpX-margin)*(pd/(1+Math.abs(pd)));}return{depth:depth,scale:scale,x:x,y:y,margin:margin,size:size,words:words,wp:wp,fogDensity:fd};}
  function renderLine(ctx,w,h,style,line,index,focus,time,fog,inactive,highlight){var L=layout(ctx,w,h,style,line,index,focus,time),active=index===focus&&time>=line.startTime&&time<line.endTime,size=L.size*L.scale*(line.isBG?.66:1),spacing=active?size*.015*clamp((time-line.startTime)/250,0,1):0,words=L.words.filter(function(x){return line.isBG||!x.isBG;}),full=words.map(function(x){return String(x.word||'');}).join(' ').trim();if(!full)return;ctx.save();ctx.translate(L.x,L.y);ctx.scale(L.scale,L.scale);var d=Math.max(0,L.depth),f=1/(1+d*L.fogDensity),fc=color(fog,{r:0,g:0,b:0,a:.55}),ic=color(inactive,{r:255,g:255,b:255,a:.32}),hc=color(highlight,{r:255,g:255,b:255,a:1}),base=mix(ic,fc,Math.min(1,d*L.fogDensity),f),hi=mix(hc,fc,Math.min(1,d*L.fogDensity)*.45,f),weight=active?500:400,x=0,gap=metrics(ctx,' ',size,weight,spacing);for(var wi=0;wi<words.length;wi++){var ww=words[wi],p=active?wordProgress(ww,time):(time>=ww.endTime?1:0);x+=drawWord(ctx,String(ww.word||''),x,0,size,weight,spacing,base,hi,p,active?7:0)+gap;}if(L.depth>1){ctx.globalAlpha=.16*f;ctx.fillStyle=base;ctx.fillText(full,1,0);ctx.fillText(full,0,1);}ctx.restore();}
  function render(ctx,w,h,style,lyrics,time){style=style||{};var lines=normaliseLines(lyrics);if(!lines.length)return;var focus=focusIndex(lines,time),visible=Math.max(1,Math.round(num(style.visibleLines,5))),first=Math.max(0,focus-visible),last=Math.min(lines.length-1,focus+visible),fog=style.fogColor||'rgba(0,0,0,.55)',inactive=style.inactiveColor||'rgba(255,255,255,.32)',highlight=style.highlightColor||'#fff',vpX=w*.5,vpY=h*.5;var light=ctx.createRadialGradient(vpX,vpY,0,vpX,vpY,Math.max(w,h)*.72);light.addColorStop(0,'rgba(255,255,255,.11)');light.addColorStop(.42,'rgba(255,255,255,.035)');light.addColorStop(1,'rgba(0,0,0,0)');ctx.save();ctx.fillStyle=light;ctx.fillRect(0,0,w,h);ctx.globalAlpha=.4;ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=Math.max(1,Math.min(w,h)*.0012);ctx.beginPath();ctx.moveTo(w*.1,vpY);ctx.lineTo(w*.9,vpY);ctx.stroke();ctx.restore();var list=[];for(var i=first;i<=last;i++)list.push({index:i,depth:i===focus?0:(focus-i)*num(style.depthSpacing,.28)});list.sort(function(a,b){return b.depth-a.depth||a.index-b.index;});for(var j=0;j<list.length;j++)renderLine(ctx,w,h,style,lines[list[j].index],list[j].index,focus,time,fog,inactive,highlight);}
  function hitTest(w,h,style,lyrics,time,x,y){var lines=normaliseLines(lyrics);if(!lines.length)return null;var focus=focusIndex(lines,time),visible=Math.max(1,Math.round(num(style&&style.visibleLines,5))),first=Math.max(0,focus-visible),last=Math.min(lines.length-1,focus+visible),c=document.createElement('canvas').getContext('2d');for(var i=first;i<=last;i++){var L=layout(c,w,h,style||{},lines[i],i,focus,time),size=L.size*L.scale*(lines[i].isBG?.66:1),words=L.words.filter(function(q){return lines[i].isBG||!q.isBG;}),txt=words.map(function(q){return String(q.word||'');}).join(' ').trim();var width=metrics(c,txt,size,i===focus?500:400,0);if(x>=L.x&&x<=L.x+width&&y>=L.y-size*.65&&y<=L.y+size*.65)return lines[i];}return null;}
  var effect=Object.freeze({id:'concrete',name:'Concrete',description:'Diegetic 3D lyrics with physical depth, fog and atmospheric perspective',render:render,parse:function(source,format){if(format==='ttml')return parseAppleTTML(source);if(format==='lrc')return parseAppleLRC(source);throw new Error('Unsupported format: '+format);},hitTest:hitTest,defaultConfig:{visibleLines:5,fogDensity:.35,depthSpacing:.28,bassPush:.08,highlightColor:'#ffffff',inactiveColor:'rgba(255,255,255,0.32)',fogColor:'rgba(0,0,0,0.55)',fontFamily:FONT_STACK}});
  window.kefeConcreteLyricsEffect=effect;
})();
