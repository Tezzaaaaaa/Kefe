/* KEFE — standalone Apple Music-style word-by-word lyrics effect.
 * Clean-room AMLL-style data contract. No external dependencies.
 * Rendering is deterministic: no requestAnimationFrame, timers or persistent animation state.
 */
(function () {
  'use strict';

  var FONT_STACK = '"SF Pro Display","SF Pro Text",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';
  var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
  var num = function(v,d){ return Number.isFinite(Number(v)) ? Number(v) : d; };

  function parseTimestamp(value) {
    if (value == null || value === '') return NaN;
    var raw = String(value).trim();
    if (/^\d+(?:\.\d+)?ms$/i.test(raw)) return parseFloat(raw);
    if (/^\d+(?:\.\d+)?s$/i.test(raw)) return parseFloat(raw) * 1000;
    var parts = raw.split(':').map(Number);
    if (parts.some(Number.isNaN)) return NaN;
    if (parts.length === 3) return (parts[0]*3600 + parts[1]*60 + parts[2]) * 1000;
    if (parts.length === 2) return (parts[0]*60 + parts[1]) * 1000;
    return Number(raw) * 1000;
  }

  function attr(node,name) {
    if (!node) return '';
    return node.getAttribute(name) || Array.from(node.attributes || []).find(function(a){return a.localName===name;})?.value || '';
  }

  function splitTimedFragment(fragment) {
    var text = String(fragment.text || '').replace(/\s+/g,' ').trim();
    if (!text || !Number.isFinite(fragment.startTime) || !Number.isFinite(fragment.endTime) || fragment.endTime <= fragment.startTime) return [];
    var tokens = text.split(/\s+/);
    if (tokens.length === 1) return [{startTime:fragment.startTime,endTime:fragment.endTime,word:tokens[0],isBG:!!fragment.isBG}];
    var weights = tokens.map(function(t){return Math.max(1,Array.from(t.replace(/[^\p{L}\p{N}]/gu,'')).length);});
    var total = weights.reduce(function(a,b){return a+b;},0), cursor=fragment.startTime;
    return tokens.map(function(word,i){
      var end = i===tokens.length-1 ? fragment.endTime : cursor+(fragment.endTime-fragment.startTime)*(weights[i]/total);
      var out={startTime:cursor,endTime:Math.max(cursor+1,end),word:word,isBG:!!fragment.isBG};
      cursor=out.endTime; return out;
    });
  }

  function parseAppleTTML(source) {
    if (Array.isArray(source)) return normaliseLines(source);
    if (typeof source !== 'string' || !source.trim()) return [];
    var doc = new DOMParser().parseFromString(source,'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid TTML');

    return Array.from(doc.querySelectorAll('p')).map(function(p){
      var start=parseTimestamp(attr(p,'begin'));
      var endAttr=parseTimestamp(attr(p,'end'));
      var dur=parseTimestamp(attr(p,'dur'));
      var end=Number.isFinite(endAttr) ? endAttr : (Number.isFinite(start)&&Number.isFinite(dur) ? start+dur : NaN);
      var primary=[], background=[], translation='', roman='';

      function walk(node,inStart,inEnd,role,agent,isBG){
        if (node.nodeType===Node.TEXT_NODE) {
          var text=node.nodeValue || '';
          if (!text.trim()) return;
          var roleName=String(role||'').toLowerCase();
          var fragment={text:text,startTime:inStart,endTime:inEnd,isBG:!!isBG,agent:agent};
          if (roleName==='x-translation') translation+=text;
          else if (roleName==='x-roman') roman+=text;
          else if (isBG || roleName==='x-bg') background.push(fragment);
          else primary.push(fragment);
          return;
        }
        if (node.nodeType!==Node.ELEMENT_NODE) return;
        var ownStart=parseTimestamp(attr(node,'begin'));
        var ownEnd=parseTimestamp(attr(node,'end'));
        var ownDur=parseTimestamp(attr(node,'dur'));
        var nextStart=Number.isFinite(ownStart)?ownStart:inStart;
        var nextEnd=Number.isFinite(ownEnd)?ownEnd:(Number.isFinite(ownDur)&&Number.isFinite(nextStart)?nextStart+ownDur:inEnd);
        var nextRole=attr(node,'role')||role;
        var nextAgent=attr(node,'agent')||agent;
        var bg=!!isBG || String(nextRole).toLowerCase()==='x-bg';
        Array.from(node.childNodes).forEach(function(child){walk(child,nextStart,nextEnd,nextRole,nextAgent,bg);});
      }

      Array.from(p.childNodes).forEach(function(child){walk(child,start,end,'',attr(p,'agent'),false);});
      var words=primary.flatMap(splitTimedFragment);
      var bgWords=background.flatMap(splitTimedFragment);
      var text=primary.map(function(f){return f.text;}).join('').replace(/\s+/g,' ').trim();
      return normaliseLine({
        words:words, backgroundWords:bgWords,
        startTime:Number.isFinite(start)?start:(words[0]?.startTime||0),
        endTime:Number.isFinite(end)?end:(words.at(-1)?.endTime||start||0),
        isBG:words.length===0 && bgWords.length>0,
        isDuet:String(attr(p,'agent')||'').toLowerCase().includes('duet'),
        translatedLyric:translation.replace(/\s+/g,' ').trim(),
        romanLyric:roman.replace(/\s+/g,' ').trim(),
        text:text
      });
    }).filter(Boolean);
  }

  function parseAppleLRC(source) {
    if (typeof source!=='string') return [];
    var out=[];
    source.split(/\r?\n/).forEach(function(row){
      var m=row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if(!m) return;
      var start=(parseInt(m[1],10)*60+parseFloat(m[2]))*1000;
      var text=m[3].trim(); if(!text) return;
      out.push({words:[{startTime:start,endTime:start+2000,word:text,isBG:false}],startTime:start,endTime:start+2000,isBG:false,isDuet:false,translatedLyric:'',romanLyric:'',text:text});
    });
    for(var i=0;i<out.length-1;i++){out[i].endTime=Math.max(out[i].startTime+100,out[i+1].startTime);out[i].words[0].endTime=out[i].endTime;}
    return out;
  }

  function normaliseLine(line) {
    if(!line) return null;
    var words=(Array.isArray(line.words)?line.words:[]).map(function(w){
      var start=num(w.startTime!=null?w.startTime:(w.time!=null?w.time:w.start),0);
      var end=num(w.endTime!=null?w.endTime:w.end,start+100);
      return {startTime:start,endTime:Math.max(start+1,end),word:String(w.word!=null?w.word:(w.text||'')),isBG:!!(w.isBG!=null?w.isBG:w.background),obscene:!!w.obscene};
    }).filter(function(w){return w.word;});
    var text=String(line.text!=null?line.text:words.map(function(w){return w.word;}).join('')).replace(/\s+/g,' ').trim();
    var start=num(line.startTime!=null?line.startTime:(line.time!=null?line.time:line.start),words[0]?.startTime||0);
    var end=num(line.endTime!=null?line.endTime:line.end,words.at(-1)?.endTime||start+100);
    return {...line,words:words,startTime:start,endTime:Math.max(start+1,end),isBG:!!line.isBG,isDuet:!!line.isDuet,translatedLyric:String(line.translatedLyric||line.translation||''),romanLyric:String(line.romanLyric||line.transliteration||''),text:text};
  }

  function normaliseLines(lines){return (Array.isArray(lines)?lines:[]).map(normaliseLine).filter(function(l){return l && (l.text||l.words.length);});}

  function activeIndex(lines,time) {
    for(var i=0;i<lines.length;i++) if(time>=lines[i].startTime && time<lines[i].endTime) return i;
    return lines.length && time>=lines.at(-1).endTime ? lines.length-1 : -1;
  }

  function wordProgress(word,time) {
    var start=num(word.startTime,0), end=Math.max(start+1,num(word.endTime,start+1));
    return clamp((time-start)/(end-start),0,1);
  }

  function measure(ctx,text,size,weight){ctx.font=(weight||700)+' '+size+'px '+FONT_STACK;return ctx.measureText(text).width;}

  function fitSize(ctx,text,size,maxWidth){
    while(size>18 && measure(ctx,text,size,700)>maxWidth) size*=0.96;
    return size;
  }

  function renderAppleLyrics(ctx,canvas,lyrics,currentTimeMs,config) {
    config=config||{};
    var lines=normaliseLines(lyrics); if(!lines.length) return;
    var w=canvas.width,h=canvas.height;
    var baseSize=num(config.fontSize,76);
    var lineHeight=num(config.lineHeight,1.25);
    var spacing=num(config.lineSpacing,22);
    var activeOpacity=num(config.activeOpacity,1);
    var inactiveOpacity=num(config.inactiveOpacity,.32);
    var pastOpacity=num(config.pastOpacity,.14);
    var blurRadius=num(config.blurRadius,1.2);
    var glowRadius=num(config.glowRadius,7);
    var highlight=config.highlightColor||'#fff';
    var inactive=config.inactiveColor||'rgba(255,255,255,.32)';
    var top=clamp(num(config.paddingTop,.245),.12,.5);
    var visible=Math.max(3,Math.min(7,Math.round(num(config.visibleLines,4))));
    var align=config.align==='right'?'right':config.align==='center'?'center':'left';
    var margin=Math.max(36,w*.075);

    // One typography scale for the whole track. Individual lyric lines never
    // resize themselves, so changing from one line to the next cannot produce
    // a random-looking jump in type size.
    var maxWidth=w-margin*2;
    var longest=0;
    lines.forEach(function(line){
      var words=Array.isArray(line.words)&&line.words.length?line.words:[{word:line.text||''}];
      var text=words.map(function(x){return String(x.word||'');}).join(' ').trim();
      if(text) longest=Math.max(longest,measure(ctx,text,baseSize,700));
    });
    var globalSize=longest>maxWidth ? fitSize(ctx,
      lines.reduce(function(best,line){
        var words=Array.isArray(line.words)&&line.words.length?line.words:[{word:line.text||''}];
        var text=words.map(function(x){return String(x.word||'');}).join(' ').trim();
        return text.length>best.length?text:best;
      },''),
      baseSize,maxWidth) : baseSize;
    // fitSize is deliberately global: the same size is used for every line.
    globalSize=clamp(globalSize,18,baseSize);

    var rowH=globalSize*lineHeight+spacing;
    var ai=activeIndex(lines,currentTimeMs);
    var focus=ai>=0?ai:Math.max(0,lines.length-1);
    var half=Math.floor(visible/2);
    var first=Math.max(0,Math.min(focus-half,Math.max(0,lines.length-visible)));
    var last=Math.min(lines.length-1,first+visible-1);

    // The active lyric has a fixed vertical anchor. The stack moves as one
    // unit; it does not recalculate its top position from each line's size.
    var centerY=h*0.50;
    var activeSlot=focus-first;
    var firstY=centerY-activeSlot*rowH;

    for(var li=first;li<=last;li++){
      var line=lines[li],cy=firstY+(li-first)*rowH,isActive=li===ai,isPast=ai>=0&&li<ai;
      var relation=Math.abs(li-focus);
      var alpha=isActive?activeOpacity:(isPast?pastOpacity:inactiveOpacity)*(1-Math.min(.35,Math.max(0,relation-1)*.08));
      var scale=isActive?num(config.activeScale,1):num(config.inactiveScale,.985);
      var blur=isActive?0:blurRadius+Math.max(0,relation-1)*.35;
      var words=Array.isArray(line.words)&&line.words.length?line.words:[{startTime:line.startTime,endTime:line.endTime,word:line.text,isBG:line.isBG}];
      var normalWords=words.filter(function(word){return !word.isBG;});
      var bgWords=words.filter(function(word){return !!word.isBG;});
      var drawWords=normalWords.length?normalWords:bgWords;
      var full=drawWords.map(function(x){return String(x.word||'');}).join(' ').trim();
      if(!full) continue;

      // Background-vocal lines are intentionally smaller, but their size is a
      // fixed ratio of the same track scale rather than a separate fit.
      var size=globalSize*(line.isBG?.66:1);
      var total=measure(ctx,full,size,700);
      var lineAlign=line.isDuet?'right':align;
      var startX=lineAlign==='center'?w/2-total/2:lineAlign==='right'?w-margin-total:margin;

      ctx.save();
      ctx.globalAlpha=alpha; ctx.filter=blur?'blur('+blur+'px)':'none';
      ctx.translate(w/2,cy);ctx.scale(scale,scale);ctx.translate(-w/2,-cy);
      ctx.font='700 '+size+'px '+FONT_STACK;ctx.textBaseline='middle';ctx.textAlign='left';
      var x=startX;
      drawWords.forEach(function(word){
        var ww=measure(ctx,word.word,size,700),p=wordProgress(word,currentTimeMs);
        ctx.globalAlpha=alpha*(word.isBG?.56:1);ctx.fillStyle=inactive;ctx.shadowBlur=0;ctx.fillText(word.word,x,cy);
        if(p>0){
          ctx.save();ctx.beginPath();
          var reveal=ww*p,fade=Math.min(ww*.32,Math.max(10,size*.16));
          ctx.rect(x,cy-size*.7,Math.max(0,reveal+fade),size*1.4);ctx.clip();
          ctx.globalAlpha=alpha*(word.isBG?.75:1);ctx.fillStyle=highlight;
          if(isActive&&p<1){ctx.shadowColor=highlight;ctx.shadowBlur=glowRadius*Math.sin(p*Math.PI);}
          ctx.fillText(word.word,x,cy);ctx.restore();
        }
        x+=ww+measure(ctx,' ',size,700);
      });
      ctx.restore();

      if(isActive&&line.translatedLyric){
        ctx.save();ctx.globalAlpha=.58;ctx.font='500 '+Math.max(14,size*.38)+'px '+FONT_STACK;ctx.textAlign=lineAlign;ctx.textBaseline='top';ctx.fillStyle='rgba(255,255,255,.82)';
        ctx.fillText(line.translatedLyric,lineAlign==='center'?w/2:lineAlign==='right'?w-margin:margin,cy+size*.72);ctx.restore();
      }
    }
  }
  function hitTest(canvas,lyrics,currentTimeMs,x,y,config) {
    config=config||{};var lines=normaliseLines(lyrics),ai=activeIndex(lines,currentTimeMs);if(ai<0)return null;
    var size=num(config.fontSize,76),visible=Math.max(3,Math.min(7,Math.round(num(config.visibleLines,4)))),top=clamp(num(config.paddingTop,.245),.12,.5),spacing=num(config.lineSpacing,22);
    var half=Math.floor(visible/2),first=Math.max(0,ai-half),last=Math.min(lines.length-1,first+visible-1),rowH=size*num(config.lineHeight,1.25)+spacing,focusRow=Math.min(ai-first,last-first),firstY=canvas.height*top-(focusRow-(last-first)/2)*rowH;
    for(var i=first;i<=last;i++){var cy=firstY+(i-first)*rowH;if(Math.abs(y-cy)<=size*.75)return lines[i];}
    return null;
  }

  async function loadTrack(data) {
    data=data||{};var source=data.ttmlLyrics!=null?data.ttmlLyrics:data.lyrics||'',lyrics;
    if(Array.isArray(source))lyrics=normaliseLines(source);
    else if(data.format==='lrc'||(!data.ttmlLyrics&&typeof source==='string'&&/^\s*\[\d+:\d+\.\d+\]/m.test(source)))lyrics=parseAppleLRC(source);
    else lyrics=parseAppleTTML(source);
    if(window.state){
      window.state.lyrics.lines=lyrics.map(function(line){return {...line,time:line.startTime/1000,endTime:line.endTime/1000,words:line.words.map(function(word){return {...word,text:word.word,time:word.startTime/1000,endTime:word.endTime/1000};})};});
      if(data.title!=null)window.state.audio.metadata.title=String(data.title);
      if(data.artist!=null)window.state.audio.metadata.artist=String(data.artist);
      window.state.captions.lines=[];
      window.state.playback.currentTime=0;
    }
    if(typeof window.setMasterTime==='function')window.setMasterTime(0);
    if(typeof window.redrawCurrentPreviewFrame==='function')window.redrawCurrentPreviewFrame();
    return {...data,lyrics:lyrics};
  }

  var effect=Object.freeze({
    id:'apple',name:'Apple',description:'Apple Music-style word-by-word lyric rendering',
    render:renderAppleLyrics,parse:function(source,format){if(format==='ttml')return parseAppleTTML(source);if(format==='lrc')return parseAppleLRC(source);throw new Error('Unsupported format: '+format);},
    hitTest:hitTest,defaultConfig:{fontSize:76,lineHeight:1.25,lineSpacing:22,activeOpacity:1,inactiveOpacity:.32,pastOpacity:.14,activeScale:1,inactiveScale:.985,blurRadius:1.2,glowRadius:7,highlightColor:'#fff',inactiveColor:'rgba(255,255,255,.32)',paddingTop:.245,visibleLines:4,fontFamily:FONT_STACK}
  });

  window.kefeAppleLyricsEffect=effect;
  window.kefeAppleLyrics=Object.freeze({...effect,FONT_STACK:FONT_STACK,parseAppleTTML:parseAppleTTML,parseAppleLRC:parseAppleLRC,renderAppleLyrics:renderAppleLyrics,hitTest:hitTest,loadTrack:loadTrack});
  window.loadTrack=loadTrack;
  window.KEFE_APPLE_FONT_STACK=FONT_STACK;
})();