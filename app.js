const $ = id => document.getElementById(id);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const canvas = $('stageCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const audio = new Audio();

const state = {
    audio: { file: null, url: null, duration: 0, ready: false, metadata: { title: '', artist: '', album: '' }, metadataSource: 'none', hasArtwork: false },
    lyrics: { lines: [] },
    style: {
        effect: 'apple',
        fontSize: 76,
        align: 'left',
        accentColor: '#FFFFFF',
        textColor: '#FFFFFF',
        bratTextColor: '#FFFFFF',
        appleInactiveOpacity: 0.25,
        appleGlow: 0.012,
        appleDepth: 0.008,
        appleLift: 0,
        appleHighlightSpan: 0.92,
        appleVisibleLines: 4,
        appleTopOffset: 0.245,
        appleLineSpacing: 0.72,
        bratSideMargin: 4.5,
        bratTopMargin: 4.5,
        bratTypingSpeed: 1,
        eternalInkColor: '#FFFFFF',
        eternalPenWidth: 21,
        eternalWriteSpan: 0.90,
        eternalGlow: 3,
        eternalPresence: 0.65,
        auroraSpeed: 1.2,
        auroraIntensity: 0.7,
        auroraSaturation: 1.0,
        pulseAmplitude: 0.4,
        pulseFrequency: 1.2,
        pulseGlowSize: 1.0,
        titleCardEnabled: true,
        titleCardDuration: 3
    },
    background: { type: 'solid', image: null, video: null, dim: 0.35, solid: '#0A0A0A', blur: 0 },
    playback: { isPlaying: false, currentTime: 0, isSeeking: false },
    audioSource: { master: 'uploaded', userChosen: false },
    aspect: '9:16'
};

let media = { image: null, video: null, videoFile: null, videoHasAudio: false };
let audioURL = null;
let backgroundURL = null;
let albumArtworkImage = null;
let albumArtworkURL = null;
let mediaTagsLoadPromise = null;
let audioLoadToken = 0;
let backgroundLoadToken = 0;
let pendingProjectMetadata = null;
let exportClockTime = null;
let renderLoopId = null;
var isExporting = false;
let userScrubbing = false;
let lastVideoHardSync = -Infinity;
let noneClockRunning = false; // virtual clock active (sync parity: uses performance.now")
let noneClockBase = 0;        // master time the virtual clock started at
let noneClockWall = 0;        // performance.now() when virtual clock started

const MAX_INK_CACHE_SIZE = 50;
const lastVideoFrame = document.createElement("canvas");
const lastVideoFrameCtx = lastVideoFrame.getContext("2d");
let hasLastVideoFrame = false;

const LINA_PREFS_KEY = 'lina-visualiser-prefs-v1';
function saveLinaPrefs() {
    try {
        localStorage.setItem(LINA_PREFS_KEY, JSON.stringify({
            metadata: state.audio.metadata,
            aspect: state.aspect,
            effect: state.style.effect
        }));
    } catch (e) { /* storage unavailable (private mode / quota) — not critical, skip silently */ }
}
function loadLinaPrefs() {
    try {
        const raw = localStorage.getItem(LINA_PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) { return null; }
}

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const hasFiniteNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
function linaSmooth(value) { const t = linaClamp(value); return t * t * (3 - 2 * t); }
function linaSmoother(value) { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); }
function linaSeededRandom(seed) { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }
function median(values) { const valid = values.filter(Number.isFinite).sort((a,b) => a-b); if (!valid.length) return null; const m = Math.floor(valid.length/2); if (valid.length % 2) return valid[m]; return (valid[m-1] + valid[m]) / 2; }

function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextLineTime = hasFiniteNumber(lines[index+1]?.time) ? Number(lines[index+1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextLineTime !== null ? nextLineTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (source.words && source.words.length > 0 && hasFiniteNumber(source.words[source.words.length-1]?.endTime) ? Number(source.words[source.words.length-1].endTime) : end);
    return { ...source, time: start, endTime: end, vocalEndTime: vocalEnd, nextLineTime };
}

function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i;
        else break;
    }
    return index;
}

function estimateFinalVocalWordEnd(words, nextLineTime = Infinity) {
    if (!Array.isArray(words) || !words.length) return null;
    const last = words[words.length-1];
    const start = Number(last.time);
    if (!Number.isFinite(start)) return null;
    const gaps = [];
    for (let i = 0; i < words.length-1; i++) {
        const a = Number(words[i].time), b = Number(words[i+1].time);
        const gap = b - a;
        if (Number.isFinite(gap) && gap >= 0.08 && gap <= 1.8) gaps.push(gap);
    }
    const cadence = median(gaps) ?? 0.48;
    const letters = Array.from(String(last.text || "").replace(/[^\p{L}\p{N}]/gu, "")).length;
    const textDuration = linaClamp(0.24 + letters * 0.055, 0.28, 1.15);
    const cadenceDuration = linaClamp(cadence * 1.10, 0.28, 1.25);
    let duration = Math.max(textDuration, cadenceDuration);
    duration = linaClamp(duration, 0.28, 1.35);
    let end = start + duration;
    if (Number.isFinite(nextLineTime)) end = Math.min(end, Math.max(start + 0.12, nextLineTime - 0.08));
    return end;
}

function normaliseEnhancedWordEnds(lines) {
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (!Array.isArray(line.words) || !line.words.length) continue;
        const nextLineTime = Number(lines[li+1]?.time) || null;
        for (let wi = 0; wi < line.words.length; wi++) {
            const word = line.words[wi];
            const nextWord = line.words[wi+1];
            if (word.explicitEndTime === true && hasFiniteNumber(word.endTime)) continue;
            if (nextWord && hasFiniteNumber(nextWord.time)) {
                word.endTime = Math.max(Number(word.time) + 0.04, Number(nextWord.time));
            } else {
                word.endTime = estimateFinalVocalWordEnd(line.words, nextLineTime);
            }
        }
        const finalWord = line.words[line.words.length-1];
        line.vocalEndTime = hasFiniteNumber(finalWord.endTime) ? Number(finalWord.endTime) : Number(line.time) + 0.8;
    }
    return lines;
}

function estimateLineVocalEnd(line, nextLine) {
    const start = Number(line.time);
    if (!Number.isFinite(start)) return null;
    const tokens = String(line.text || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return start;
    const nextStart = Number(nextLine?.time);
    const estimated = tokens.reduce((total, token) => {
        const letters = Array.from(token.replace(/[^\p{L}\p{N}]/gu, "")).length || 1;
        return total + linaClamp(0.16 + letters * 0.045, 0.24, 0.78);
    }, 0) + Math.max(0, tokens.length - 1) * 0.055;
    let duration = linaClamp(estimated, 0.65, 5.0);
    if (Number.isFinite(nextStart)) {
        const available = Math.max(0.20, nextStart - start - 0.10);
        duration = Math.min(duration, available);
    }
    return start + duration;
}

function appleWordsForLine(line, nextLine) {
    if (Array.isArray(line?.words) && line.words.length) {
        return line.words.map(w => ({ ...w, estimated: false }));
    }
    const tokens = String(line?.text || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || !hasFiniteNumber(line?.time)) return [];
    const start = Number(line.time);
    const vocalEnd = estimateLineVocalEnd(line, nextLine);
    const duration = Math.max(0.15, vocalEnd - start);
    const weights = tokens.map(token => {
        const letters = Array.from(token.replace(/[^\p{L}\p{N}]/gu, "")).length || 1;
        const punctuation = /[,.!?;:]$/.test(token) ? 0.20 : 0;
        return Math.max(0.75, Math.pow(letters, 0.72)) + punctuation;
    });
    const total = weights.reduce((s, v) => s + v, 0) || tokens.length;
    let cursor = 0;
    return tokens.map((text, i) => {
        const ws = start + duration * (cursor / total);
        cursor += weights[i];
        const we = start + duration * (cursor / total);
        return { text, time: ws, endTime: Math.max(ws + 0.05, we), estimated: true };
    });
}

function buildAppleRows(ctx, line, nextLine, maxWidth) {
    const words = appleWordsForLine(line, nextLine);
    const spaceWidth = ctx.measureText(" ").width;
    const rows = [];
    let current = [], currentWidth = 0;
    for (const word of words) {
        const width = ctx.measureText(word.text).width;
        const proposed = current.length ? currentWidth + spaceWidth + width : width;
        if (current.length && proposed > maxWidth) {
            rows.push({ words: current, width: currentWidth });
            current = []; currentWidth = 0;
        }
        current.push({ ...word, width });
        currentWidth = current.length === 1 ? width : currentWidth + spaceWidth + width;
    }
    if (current.length) rows.push({ words: current, width: currentWidth });
    return rows;
}

function measureAppleLineBlock(ctx, w, line, settings, nextLine = null) {
    if (!line || !line.text) return { rows: [], rowHeight: 0, totalHeight: 0 };
    const fontSize = settings.fontSize;
    ctx.save();
    ctx.font = `650 ${fontSize}px system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif`;
    const margin = Math.max(40, w * 0.075);
    const rows = buildAppleRows(ctx, line, nextLine, w - margin * 2);
    const rowHeight = fontSize * 1.25;
    const totalHeight = rows.length * rowHeight;
    ctx.restore();
    return { rows, rowHeight, totalHeight };
}

function drawAppleActiveWord(ctx, word, x, y, time, fontSize, settings, overallAlpha = 1) {
    const duration = Math.max(0.001, word.endTime - word.time);
    const progress = linaClamp((time - word.time) / duration);
    const enter = linaSmoother(progress / 0.28);
    const exit = linaSmoother((progress - 0.72) / 0.28);
    const foreground = enter * (1 - exit * 0.84);
    const scale = 1 + foreground * settings.depth;
    const lift = fontSize * foreground * settings.lift;
    const wordWidth = ctx.measureText(word.text).width;
    const centreX = x + wordWidth / 2;
    ctx.save();
    ctx.translate(centreX, y - lift);
    ctx.scale(scale, scale);
    ctx.translate(-centreX, -y);
    ctx.save();
    ctx.globalAlpha = settings.inactiveOpacity * overallAlpha;
    ctx.fillStyle = settings.inactiveColor;
    ctx.shadowBlur = 0;
    ctx.fillText(word.text, x, y);
    ctx.restore();
    const chars = Array.from(word.text);
    const hp = linaSmoother(linaClamp(progress / settings.highlightSpan));
    const sweep = hp * (chars.length + 1.8);
    for (let i = 0; i < chars.length; i++) {
        const local = linaSmoother(linaClamp((sweep - i + 0.4) / 1.8));
        if (local <= 0.001) continue;
        const charX = x + ctx.measureText(word.text.slice(0, i)).width;
        ctx.save();
        ctx.globalAlpha = (0.25 + local * 0.75) * overallAlpha;
        ctx.fillStyle = settings.activeColor;
        ctx.shadowColor = settings.activeColor;
        ctx.shadowBlur = fontSize * settings.glow * local;
        ctx.fillText(chars[i], charX, y);
        ctx.restore();
    }
    ctx.restore();
}

function drawAppleLineBlock(ctx, w, centreY, line, time, settings, options = {}) {
    if (!line || !line.text) return;
    const active = options.active === true;
    const alpha = Number.isFinite(options.alpha) ? options.alpha : 1;
    const scale = Number.isFinite(options.scale) ? options.scale : 1;
    const fontSize = settings.fontSize;
    const nextLine = options.nextLine || null;
    const measurement = options.measurement || measureAppleLineBlock(ctx, w, line, settings, nextLine);
    ctx.save();
    ctx.filter = Number(options.blur) > 0 ? `blur(${Number(options.blur)}px)` : "none";
    ctx.font = `650 ${fontSize}px system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const margin = Math.max(40, w * 0.075);
    const rows = measurement.rows;
    const rowHeight = measurement.rowHeight;
    const totalHeight = measurement.totalHeight;
    let y = centreY - totalHeight / 2 + rowHeight / 2;
    ctx.translate(w / 2, centreY);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -centreY);
    const spaceWidth = ctx.measureText(" ").width;
    for (const row of rows) {
        let x = settings.align === "center" ? (w - row.width) / 2 : settings.align === "right" ? w - margin - row.width : margin;
        for (let i = 0; i < row.words.length; i++) {
            const word = row.words[i];
            if (!active) {
                ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = settings.backgroundColor; ctx.shadowBlur = 0; ctx.fillText(word.text, x, y); ctx.restore();
            } else if (time < word.time) {
                ctx.save(); ctx.globalAlpha = settings.inactiveOpacity * alpha; ctx.fillStyle = settings.inactiveColor; ctx.shadowBlur = 0; ctx.fillText(word.text, x, y); ctx.restore();
            } else if (time >= word.endTime) {
                ctx.save(); ctx.globalAlpha = 0.96 * alpha; ctx.fillStyle = settings.activeColor; ctx.shadowColor = settings.activeColor; ctx.shadowBlur = fontSize * 0.014; ctx.fillText(word.text, x, y); ctx.restore();
            } else {
                drawAppleActiveWord(ctx, word, x, y, time, fontSize, settings, alpha);
            }
            x += word.width;
            if (i < row.words.length - 1) x += spaceWidth;
        }
        y += rowHeight;
    }
    ctx.restore();
}

function appleTransitionTiming(fromLine, toLine) {
    const fromTime = Number(fromLine?.time) || 0;
    const toTime = Number(toLine?.time) || fromTime + 1;
    const gap = Math.max(0.35, toTime - fromTime);
    const duration = Math.min(0.46, Math.max(0.38, gap * 0.18));
    return { duration, start: toTime - duration, end: toTime };
}

function getAppleFocalMotion(lines, time) {
    const activeIndex = linaFindActiveLine(lines, time);
    if (activeIndex < 0) return null;

    const active = linaNormaliseLine(lines, activeIndex);
    if (!active) return null;

    // Finish the hand-off into the current line even after its timestamp has passed.
    if (activeIndex > 0) {
        const previous = linaNormaliseLine(lines, activeIndex - 1);
        const incoming = appleTransitionTiming(previous, active);
        if (time < incoming.end) {
            return {
                fromIndex: activeIndex - 1,
                toIndex: activeIndex,
                progress: linaSmoother((time - incoming.start) / incoming.duration),
                transitionStart: incoming.start,
                transitionEnd: incoming.end
            };
        }
    }

    // Begin the next hand-off just before the upcoming timestamp so motion never snaps.
    const next = linaNormaliseLine(lines, activeIndex + 1);
    if (next) {
        const outgoing = appleTransitionTiming(active, next);
        if (time >= outgoing.start) {
            return {
                fromIndex: activeIndex,
                toIndex: activeIndex + 1,
                progress: linaSmoother((time - outgoing.start) / outgoing.duration),
                transitionStart: outgoing.start,
                transitionEnd: outgoing.end
            };
        }
    }

    return { fromIndex: activeIndex, toIndex: activeIndex, progress: 1, transitionStart: active.time, transitionEnd: active.time };
}

function drawAppleMusicHeader(ctx, w, h) {
    const resolved = resolveAudioLabels(state.audio);
    const title = resolved.title;
    const artist = resolved.artist;
    if (!title && !artist) return;
    const margin = Math.max(40, w * 0.075);
    const artSize = Math.max(58, Math.min(w, h) * 0.067);
    const y = Math.max(34, h * 0.052);
    const source = albumArtworkImage;
    ctx.save();
    if (source) {
        ctx.beginPath(); ctx.roundRect(margin, y, artSize, artSize, artSize * 0.12); ctx.clip();
        const sw = source.videoWidth || source.naturalWidth || source.width;
        const sh = source.videoHeight || source.naturalHeight || source.height;
        if (sw && sh) { const side = Math.min(sw, sh); ctx.drawImage(source, (sw-side)/2, (sh-side)/2, side, side, margin, y, artSize, artSize); }
        ctx.restore(); ctx.save();
    }
    const tx = source ? margin + artSize + Math.max(16, w * 0.018) : margin;
    const maxText = w - tx - margin * 1.8;
    const titleSize = Math.max(18, Math.min(w, h) * 0.025);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${titleSize}px "Open Sans",Arial,sans-serif`;
    let shownTitle = title || 'Untitled';
    while (shownTitle.length > 1 && ctx.measureText(shownTitle).width > maxText) shownTitle = shownTitle.slice(0,-2).trim() + '…';
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.96; ctx.fillText(shownTitle, tx, y + artSize * 0.38);
    ctx.font = `500 ${Math.max(14, titleSize * 0.72)}px "Open Sans",Arial,sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fillText(artist, tx, y + artSize * 0.68);
    ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.beginPath();
    const dotY = y + artSize * 0.5, dotX = w - margin;
    for (let i=-1;i<=1;i++) ctx.arc(dotX + i * 10, dotY, 2.3, 0, Math.PI*2);
    ctx.fill(); ctx.restore();
}

function buildAppleMusicLayout(ctx, w, h, settings, lines, focusIndex, visibleCount) {
    const output = [];
    const focusY = h * settings.topOffset;
    const gap = Math.max(settings.fontSize * settings.lineSpacing, h * 0.018);
    const add = (index, centreY, relation, measurement = null) => {
        const line = linaNormaliseLine(lines, index); if (!line) return null;
        const nextLine = linaNormaliseLine(lines, index + 1);
        measurement ||= measureAppleLineBlock(ctx, w, line, settings, nextLine);
        const item = { lineIndex:index, line, nextLine, measurement, centreY, relation };
        output.push(item); return item;
    };
    const focus = add(focusIndex, focusY, 0); if (!focus) return output;
    const previous = linaNormaliseLine(lines, focusIndex - 1);
    if (previous) {
        const pm = measureAppleLineBlock(ctx, w, previous, settings, focus.line);
        add(focusIndex - 1, focusY - focus.measurement.totalHeight/2 - gap - pm.totalHeight/2, -1, pm);
    }
    let cursorY = focusY + focus.measurement.totalHeight/2 + gap;
    for (let distance=1; distance<=visibleCount; distance++) {
        const line = linaNormaliseLine(lines, focusIndex + distance); if (!line) break;
        const next = linaNormaliseLine(lines, focusIndex + distance + 1);
        const measurement = measureAppleLineBlock(ctx, w, line, settings, next);
        add(focusIndex + distance, cursorY + measurement.totalHeight/2, distance, measurement);
        cursorY += measurement.totalHeight + gap;
    }
    return output;
}

function drawAppleMusicTransition(ctx, w, h, settings, lines, time, visibleCount, motion) {
    const fromLayout = buildAppleMusicLayout(ctx,w,h,settings,lines,motion.fromIndex,visibleCount);
    const toLayout = buildAppleMusicLayout(ctx,w,h,settings,lines,motion.toIndex,visibleCount);
    const fromMap = new Map(fromLayout.map(e=>[e.lineIndex,e]));
    const toMap = new Map(toLayout.map(e=>[e.lineIndex,e]));
    const transitioning = motion.fromIndex !== motion.toIndex;
    const p = transitioning ? linaClamp(motion.progress) : 1;
    const focusTransfer = transitioning ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 1;
    const relationOpacity = relation => relation === 0 ? 1 : relation < 0 ? 0.22 : Math.max(0.07,settings.inactiveOpacity*Math.pow(0.72,relation-1));
    for (const index of [...new Set([...fromMap.keys(),...toMap.keys()])]) {
        const from=fromMap.get(index), to=toMap.get(index), entry=to||from; if(!entry) continue;
        const relation=to?to.relation:-2;
        const y=from&&to ? from.centreY+(to.centreY-from.centreY)*p : (to ? to.centreY+h*0.035*(1-p) : from.centreY-h*0.055*p);
        let backgroundAlpha=from&&to ? relationOpacity(from.relation)+(relationOpacity(to.relation)-relationOpacity(from.relation))*p : relationOpacity(relation);
        if(!from) backgroundAlpha*=p;
        if(!to) backgroundAlpha*=1-p;

        let focus=0;
        if (!transitioning && index===motion.toIndex) focus=1;
        else if (transitioning && index===motion.fromIndex) focus=1-focusTransfer;
        else if (transitioning && index===motion.toIndex) focus=focusTransfer;

        const backgroundWeight=1-focus;
        const depth=Math.max(0,relation);
        const maxBlur=settings.fontSize*(relation<0?0.070:0.058+Math.max(0,depth-1)*0.012);
        const blur=maxBlur*backgroundWeight;
        const scale=0.98+focus*0.02;

        if (backgroundWeight>0.001 && backgroundAlpha>0.001) {
            drawAppleLineBlock(ctx,w,y,entry.line,time,settings,{active:false,alpha:backgroundAlpha*backgroundWeight,scale,blur,nextLine:entry.nextLine,measurement:entry.measurement});
        }
        if (focus>0.001) {
            drawAppleLineBlock(ctx,w,y,entry.line,time,settings,{active:true,alpha:focus,scale,blur,nextLine:entry.nextLine,measurement:entry.measurement});
        }
    }
}

function drawAppleEffect(ctx, w, h, style, lines, time) {
    if (!Array.isArray(lines) || !lines.length) return;
    const wash=ctx.createLinearGradient(0,0,0,h); wash.addColorStop(0,'rgba(18,18,20,0.20)'); wash.addColorStop(0.55,'rgba(8,8,10,0.08)'); wash.addColorStop(1,'rgba(0,0,0,0.34)');
    ctx.save(); ctx.fillStyle=wash; ctx.fillRect(0,0,w,h); ctx.restore();
    drawAppleMusicHeader(ctx,w,h);
    const settings={fontSize:Number(style.fontSize)||76,align:style.align||'left',activeColor:'#FFFFFF',inactiveColor:'rgba(255,255,255,0.46)',backgroundColor:'#FFFFFF',inactiveOpacity:Number.isFinite(Number(style.appleInactiveOpacity))?Number(style.appleInactiveOpacity):0.25,glow:0.012,depth:0.008,lift:0,highlightSpan:0.96,topOffset:Number(style.appleTopOffset)||0.245,lineSpacing:Number(style.appleLineSpacing)||0.72};
    const visibleCount=Math.max(2,Math.min(6,Math.round(Number(style.appleVisibleLines)||4)));
    const first=linaNormaliseLine(lines,0); if(!first||time<Math.max(0,first.time-1.2)) return;
    const motion=getAppleFocalMotion(lines,time)||{fromIndex:0,toIndex:0,progress:1};
    drawAppleMusicTransition(ctx,w,h,settings,lines,time,visibleCount,motion);
}

function buildBratWords(lines) {
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const line = linaNormaliseLine(lines, i);
        if (!line) continue;
        const words = appleWordsForLine(line, lines[i+1] || null);
        for (const w of words) output.push({ ...w, globalIndex: output.length });
    }
    return output;
}
function setBratFont(ctx, fontSize) {
    ctx.font = `400 ${fontSize}px "Arial Narrow","Helvetica Neue Condensed","Roboto Condensed",Arial,sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function buildBratRows(ctx, words, w, h, style) {
    const baseSize = Number(style.fontSize) || 76;
    const side = w * (Number(style.bratSideMargin) || 4.5) / 100;
    const top = h * (Number(style.bratTopMargin) || 4.5) / 100;
    const bottom = h * 0.05;
    const slotHeight = (h - top - bottom) / 5;
    const sizePattern = [1.16, 0.91, 1.10, 0.96, 1.20];
    const wordPattern = [3, 3, 2, 2, 3];
    const rows = [];
    let cursor = 0, rowNumber = 0;
    while (cursor < words.length) {
        const slot = rowNumber % 5;
        const lineWords = words.slice(cursor, cursor + wordPattern[slot]);
        cursor += lineWords.length;
        let fontSize = Math.min(slotHeight * 0.72, baseSize * 1.75 * sizePattern[slot]);
        fontSize = Math.max(34, fontSize);
        const usableWidth = w - side * 2;
        while (fontSize > 32) {
            setBratFont(ctx, fontSize);
            let total = 0;
            for (const w of lineWords) total += ctx.measureText(w.text).width;
            if (total + fontSize * 0.14 * Math.max(0, lineWords.length - 1) <= usableWidth) break;
            fontSize -= 2;
        }
        setBratFont(ctx, fontSize);
        let wordWidth = 0;
        for (const w of lineWords) { w.renderWidth = ctx.measureText(w.text).width; wordWidth += w.renderWidth; }
        const gap = lineWords.length > 1 ? (usableWidth - wordWidth) / (lineWords.length - 1) : 0;
        rows.push({ words: lineWords, fontSize, gap, side, top, slot, page: Math.floor(rowNumber / 5) });
        rowNumber++;
    }
    return rows;
}
function drawBratEffect(ctx, w, h, style, lines, time) {
    const typingSpeed = Number(style.bratTypingSpeed) || 1;
    const words = buildBratWords(lines);
    if (!words.length) return;
    let currentIndex = -1;
    for (let i = 0; i < words.length; i++) {
        if (time >= words[i].time) currentIndex = i; else break;
    }
    if (currentIndex < 0) return;
    const rows = buildBratRows(ctx, words, w, h, style);
    let activeRow = -1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].words.some(w => w.globalIndex === currentIndex)) { activeRow = i; break; }
    }
    if (activeRow < 0) return;
    const page = Math.floor(activeRow / 5);
    const pageStart = page * 5;
    const pageEnd = Math.min(rows.length, pageStart + 5);
    const top = rows[pageStart].top;
    const rowPitch = (h - top - h * 0.05) / 5;
    ctx.save();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.filter = "none";
    for (let ri = pageStart; ri < pageEnd; ri++) {
        const row = rows[ri];
        setBratFont(ctx, row.fontSize);
        ctx.fillStyle = style.bratTextColor || style.textColor || "#FFFFFF";
        const baseline = top + rowPitch * (ri - pageStart) + rowPitch * 0.70;
        let x = row.side;
        for (const word of row.words) {
            if (word.globalIndex > currentIndex) break;
            if (word.globalIndex < currentIndex) {
                ctx.fillText(word.text, x, baseline);
            } else {
                const duration = Math.max(0.001, word.endTime - word.time);
                const progress = linaClamp((time - word.time) / duration);
                const typingProgress = linaClamp(progress / (0.88 / typingSpeed));
                const chars = Array.from(word.text);
                const count = Math.min(chars.length, Math.ceil(chars.length * typingProgress));
                ctx.fillText(chars.slice(0, count).join(""), x, baseline);
            }
            x += word.renderWidth + row.gap;
        }
    }
    ctx.restore();
}

let eternalFontReady = false;
let eternalFontPromise = null;
const eternalInkCache = new Map();

async function ensureEternalFont() {
    if (eternalFontReady) return true;
    if (eternalFontPromise) return eternalFontPromise;
    eternalFontPromise = (async () => {
        try {
            await document.fonts.load('76px "Homemade Apple"');
            await document.fonts.ready;
            eternalFontReady = document.fonts.check('76px "Homemade Apple"');
            if (eternalFontReady) eternalInkCache.clear();
            return eternalFontReady;
        } catch (error) {
            eternalFontReady = false;
            return false;
        } finally {
            eternalFontPromise = null;
        }
    })();
    return eternalFontPromise;
}
ensureEternalFont();

function manageInkCacheSize() {
    if (eternalInkCache.size <= MAX_INK_CACHE_SIZE) return;
    const entries = Array.from(eternalInkCache.entries());
    for (let i = 0; i < entries.length - MAX_INK_CACHE_SIZE; i++) eternalInkCache.delete(entries[i][0]);
}
function makeInkRowCache(text, fontSize) {
    if (!eternalFontReady) return null;
    const key = `${fontSize}:${text}`;
    if (eternalInkCache.has(key)) return eternalInkCache.get(key);
    const fontName = '"Homemade Apple"';
    const mc = document.createElement("canvas");
    const mctx = mc.getContext("2d");
    mctx.font = `${fontSize}px ${fontName}`;
    const metrics = mctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 1.4;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.65;
    const padding = fontSize * 0.95;
    const width = Math.ceil(metrics.width + padding * 2);
    const height = Math.ceil(ascent + descent + padding * 2);
    const baseline = padding + ascent;
    const sc = document.createElement("canvas");
    sc.width = width; sc.height = height;
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    sctx.font = `${fontSize}px ${fontName}`;
    sctx.textAlign = "left"; sctx.textBaseline = "alphabetic";
    sctx.fillStyle = "#FFFFFF";
    sctx.fillText(text, padding, baseline);
    const data = sctx.getImageData(0, 0, width, height).data;
    const rawPoints = [];
    const step = 2;
    for (let x = 0; x < width; x += step) {
        let at = 0, wy = 0;
        for (let y = 0; y < height; y++) {
            const a = data[(y * width + x) * 4 + 3];
            if (a > 10) { at += a; wy += y * a; }
        }
        if (at > 0) rawPoints.push({ x, y: wy / at });
    }
    const points = [];
    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        const prev = points[points.length - 1];
        if (prev) {
            const gap = p.x - prev.x;
            if (gap > step * 1.5 && gap < fontSize * 0.52) {
                const n = Math.ceil(gap / step);
                for (let j = 1; j < n; j++) {
                    const t = j / n;
                    points.push({ x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * linaSmoother(t) });
                }
            }
        }
        points.push(p);
    }
    const mask = document.createElement("canvas");
    mask.width = width; mask.height = height;
    const reveal = document.createElement("canvas");
    reveal.width = width; reveal.height = height;
    const result = { sourceCanvas: sc, maskCanvas: mask, revealCanvas: reveal, points, width, height, padding, ascent, descent, textWidth: metrics.width };
    eternalInkCache.set(key, result);
    manageInkCacheSize();
    return result;
}
function renderInkRow(cache, progress, options) {
    if (!cache) return null;
    const mctx = cache.maskCanvas.getContext("2d");
    const rctx = cache.revealCanvas.getContext("2d");
    mctx.clearRect(0, 0, cache.width, cache.height);
    const pts = cache.points;
    if (!pts.length) return cache.revealCanvas;
    const amount = linaClamp(progress);
    const index = Math.min(pts.length - 1, Math.floor(amount * pts.length));
    if (amount >= 1) {
        mctx.fillStyle = "#FFF"; mctx.fillRect(0, 0, cache.width, cache.height);
    } else if (amount > 0) {
        const cur = pts[index];
        const radius = options.fontSize * (options.penWidth / 100);
        mctx.fillStyle = "#FFF";
        mctx.fillRect(0, 0, Math.max(0, cur.x - radius * 0.4), cache.height);
        const grad = mctx.createRadialGradient(cur.x, cur.y, 0, cur.x, cur.y, radius);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.55, "rgba(255,255,255,1)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        mctx.fillStyle = grad;
        mctx.beginPath(); mctx.arc(cur.x, cur.y, radius, 0, Math.PI * 2); mctx.fill();
        const ps = Math.max(0, index - 18);
        mctx.beginPath();
        for (let i = ps; i <= index; i++) {
            if (i === ps) mctx.moveTo(pts[i].x, pts[i].y);
            else mctx.lineTo(pts[i].x, pts[i].y);
        }
        mctx.strokeStyle = "#FFF"; mctx.lineWidth = radius * 1.2; mctx.lineCap = "round"; mctx.lineJoin = "round"; mctx.stroke();
    }
    rctx.clearRect(0, 0, cache.width, cache.height);
    rctx.drawImage(cache.sourceCanvas, 0, 0);
    rctx.globalCompositeOperation = "destination-in";
    rctx.drawImage(cache.maskCanvas, 0, 0);
    rctx.globalCompositeOperation = "source-in";
    rctx.fillStyle = options.inkColor;
    rctx.fillRect(0, 0, cache.width, cache.height);
    rctx.globalCompositeOperation = "source-over";
    return cache.revealCanvas;
}
const ETERNAL_POSITIONS = ["top-left", "middle-right", "bottom-left"];
function getEternalPositions(ci) {
    const pos = [...ETERNAL_POSITIONS];
    for (let i = pos.length - 1; i > 0; i--) {
        const j = Math.floor(linaSeededRandom(ci * 37.41 + i * 17.23) * (i + 1));
        [pos[i], pos[j]] = [pos[j], pos[i]];
    }
    return pos;
}
function getEternalSizes(ci) {
    const patterns = [[0.92,1.25,1.00],[1.20,0.94,1.04],[1.00,1.22,0.90],[0.95,1.06,1.24],[1.23,0.91,1.02],[1.04,1.27,0.93],[1.10,0.91,1.28],[0.93,1.19,1.05]];
    const sel = Math.floor(linaSeededRandom(ci * 91.73 + 14.2) * patterns.length);
    return [...patterns[linaClamp(sel, 0, patterns.length - 1)]];
}
function fitEternalText(text, targetSize, maxWidth) {
    let size = targetSize;
    let cache = makeInkRowCache(text, size);
    if (!cache) return null;
    while (cache.textWidth > maxWidth && size > 30) { size -= 2; cache = makeInkRowCache(text, size); if (!cache) return null; }
    return { cache, fontSize: size };
}
function getEternalPlacement(pos, w, h, tw, vh, margin) {
    switch(pos) {
        case "top-left": return { x: margin, y: linaClamp(h * 0.13, margin, h - margin - vh) };
        case "middle-right": return { x: Math.max(margin, w - margin - tw), y: linaClamp(h * 0.50 - vh / 2, margin, h - margin - vh) };
        default: return { x: margin, y: linaClamp(h * 0.79 - vh / 2, margin, h - margin - vh) };
    }
}
function getEternalLineAlpha(slot, group, time) {
    const line = group[slot];
    if (!line || time < line.time) return 0;
    const next = group[slot + 1];
    if (!next) return 1;
    if (time < next.time) return 1;
    const fade = linaSmooth((time - next.time) / Math.max(0.8, Math.min(2.3, (next.endTime - next.time) * 0.90)));
    return 1 - fade * 0.84;
}
function drawEternalSunshineEffect(ctx, w, h, style, lines, time) {
    if (!eternalFontReady) { ensureEternalFont(); return; }
    const ci = linaFindActiveLine(lines, time);
    if (ci < 0) return;
    const pageStart = Math.floor(ci / 3) * 3;
    const cycleIndex = Math.floor(pageStart / 3);
    const group = [linaNormaliseLine(lines, pageStart), linaNormaliseLine(lines, pageStart+1), linaNormaliseLine(lines, pageStart+2)];
    const positions = getEternalPositions(cycleIndex);
    const sizes = getEternalSizes(cycleIndex);
    const margin = Math.max(50, Math.min(w, h) * 0.065);
    const baseSize = Number(style.fontSize) || 76;
    const inkColor = style.eternalInkColor || style.textColor || "#FFF";
    const penWidth = Number(style.eternalPenWidth) || 21;
    const writeSpan = Number(style.eternalWriteSpan) || 0.90;
    const glow = Number(style.eternalGlow) || 3;
    const presence = linaClamp(Number(style.eternalPresence) || 0.65, 0, 1);
    const validLines = group.filter(Boolean);
    const finalLine = validLines[validLines.length - 1];

    ctx.save();
    for (let slot = 0; slot < 3; slot++) {
        const line = group[slot];
        if (!line || time < line.time) continue;
        const text = String(line.text || "").trim();
        if (!text) continue;

        let targetSize = linaClamp(baseSize * sizes[slot], 34, 150);
        const prepared = fitEternalText(text, targetSize, w - margin * 2);
        if (!prepared) continue;

        const cache = prepared.cache, fontSize = prepared.fontSize;
        const duration = Math.max(0.001, line.endTime - line.time);
        const rawProgress = linaClamp((time - line.time) / (duration * Math.max(0.20, writeSpan)));
        const progress = linaSmoother(rawProgress);
        const rendered = renderInkRow(cache, progress, { fontSize, inkColor, penWidth, glow });
        if (!rendered) continue;

        const vh = cache.ascent + cache.descent;
        const placement = getEternalPlacement(positions[slot], w, h, cache.textWidth, vh, margin);
        let alpha = getEternalLineAlpha(slot, group, time);

        if (finalLine) {
            const fd = Math.max(0.20, finalLine.endTime - finalLine.time);
            const cs = finalLine.endTime - Math.min(0.65, Math.max(0.30, fd * 0.18));
            if (time > cs) alpha *= 1 - linaSmooth((time - cs) / Math.min(0.65, Math.max(0.30, fd * 0.18)));
        }

        const isWriting = rawProgress > 0 && rawProgress < 1;
        const writeEnergy = isWriting ? Math.sin(rawProgress * Math.PI) : 0;
        const popScale = 1 + presence * 0.018 * writeEnergy;
        const bloom = fontSize * (glow / 100 + presence * 0.055 * writeEnergy);
        const echoAlpha = alpha * presence * 0.13 * writeEnergy;

        const drawX = placement.x - cache.padding;
        const drawY = placement.y - cache.padding;
        const centreX = placement.x + cache.textWidth / 2;
        const centreY = placement.y + vh / 2;

        ctx.save();
        ctx.translate(centreX, centreY);
        ctx.scale(popScale, popScale);
        ctx.translate(-centreX, -centreY);

        if (echoAlpha > 0.001) {
            ctx.save();
            ctx.globalAlpha = echoAlpha;
            ctx.shadowColor = inkColor;
            ctx.shadowBlur = bloom * 1.7;
            ctx.drawImage(rendered, drawX + fontSize * 0.012, drawY + fontSize * 0.010);
            ctx.restore();
        }

        ctx.globalAlpha = alpha;
        ctx.shadowColor = inkColor;
        ctx.shadowBlur = bloom;
        ctx.drawImage(rendered, drawX, drawY);
        ctx.restore();
    }
    ctx.restore();
}

function fitCentredEffectText(ctx, text, baseSize, maxWidth, weight) {
    let size = Number(baseSize) || 76;
    ctx.font = `${weight} ${size}px "Open Sans",Arial,sans-serif`;
    while (size > 30 && ctx.measureText(text).width > maxWidth) {
        size -= 2;
        ctx.font = `${weight} ${size}px "Open Sans",Arial,sans-serif`;
    }
    return size;
}

function activeEffectLine(lines, time) {
    const index = linaFindActiveLine(lines, time);
    return index >= 0 ? linaNormaliseLine(lines, index) : null;
}

function drawAuroraEffect(ctx, w, h, style, lines, time) {
    const line = activeEffectLine(lines, time);
    if (!line) return;
    const text = String(line.text || '').trim();
    if (!text) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = w * 0.84;
    const size = fitCentredEffectText(ctx, text, style.fontSize, maxWidth, 700);
    const speed = Number(style.auroraSpeed) || 1.2;
    const intensity = Number(style.auroraIntensity) || 0.7;
    const saturation = linaClamp(Number(style.auroraSaturation) || 1, 0.2, 1.8);
    const hueBase = (time * speed * 28 + 180) % 360;
    const y = h * 0.46;
    const gradient = ctx.createLinearGradient(w * 0.08, y - size, w * 0.92, y + size);
    for (let i = 0; i <= 6; i++) {
        const stop = i / 6;
        const hue = (hueBase + stop * 135) % 360;
        const light = 63 + 12 * Math.sin(time * speed + i * 0.85);
        gradient.addColorStop(stop, `hsl(${hue} ${Math.min(100, 76 * saturation)}% ${light}%)`);
    }
    ctx.fillStyle = gradient;
    ctx.shadowColor = `hsl(${(hueBase + 65) % 360} 100% 72%)`;
    ctx.shadowBlur = size * 0.20 * intensity;
    ctx.fillText(text, w / 2, y);
    ctx.restore();
}

function drawPulseEffect(ctx, w, h, style, lines, time) {
    const line = activeEffectLine(lines, time);
    if (!line) return;
    const text = String(line.text || '').trim();
    if (!text) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = w * 0.84;
    const baseSize = fitCentredEffectText(ctx, text, style.fontSize, maxWidth, 800);
    const amplitude = linaClamp(Number(style.pulseAmplitude) || 0.4, 0.05, 1);
    const frequency = Number(style.pulseFrequency) || 1.2;
    const glowSize = Number(style.pulseGlowSize) || 1;
    const colour = style.accentColor || '#FFFFFF';
    const beat = 0.5 + 0.5 * Math.sin(time * frequency * Math.PI * 2);
    const easedBeat = linaSmoother(beat);
    const finalSize = baseSize * (1 + amplitude * 0.12 * easedBeat);
    const y = h * 0.46;
    ctx.font = `800 ${finalSize}px "Open Sans",Arial,sans-serif`;
    ctx.fillStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = finalSize * 0.30 * glowSize * easedBeat;
    ctx.globalAlpha = 0.22 + 0.18 * easedBeat;
    ctx.fillText(text, w / 2, y);
    ctx.shadowBlur = finalSize * 0.045 * glowSize * easedBeat;
    ctx.globalAlpha = 0.86 + 0.14 * easedBeat;
    ctx.fillText(text, w / 2, y);
    ctx.restore();
}

function renderLyricsEffect(ctx, w, h, style, lines, time) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0;
    switch(style.effect) {
        case "apple": drawAppleEffect(ctx, w, h, style, lines, time); break;
        case "brat": drawBratEffect(ctx, w, h, style, lines, time); break;
        case "eternal": drawEternalSunshineEffect(ctx, w, h, style, lines, time); break;
        case "aurora": drawAuroraEffect(ctx, w, h, style, lines, time); break;
        case "pulse": drawPulseEffect(ctx, w, h, style, lines, time); break;
        case "typewriter":
        case "instagram":
        case "fadeup": {
            const fn = window.kefeEffects && window.kefeEffects[style.effect];
            if (typeof fn === "function") fn(ctx, w, h, style, lines, time);
            else drawAppleEffect(ctx, w, h, style, lines, time);
            break;
        }
        default: drawAppleEffect(ctx, w, h, style, lines, time);
    }
    ctx.restore();
}

function drawCover(ctx, media, w, h, blur) {
    const mw = media.videoWidth || media.width, mh = media.videoHeight || media.height;
    if (!mw || !mh) return;
    const scale = Math.max(w / mw, h / mh);
    const dw = mw * scale, dh = mh * scale;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    if (blur > 0) { ctx.filter = `blur(${blur}px)`; ctx.drawImage(media, dx - blur*2, dy - blur*2, dw + blur*4, dh + blur*4); ctx.filter = "none"; }
    else ctx.drawImage(media, dx, dy, dw, dh);
}
function ensureVideoFrameCacheSize(w, h) {
    if (lastVideoFrame.width !== w || lastVideoFrame.height !== h) { lastVideoFrame.width = w; lastVideoFrame.height = h; hasLastVideoFrame = false; }
}
function drawVideoBackgroundStable(ctx, video, w, h, blur) {
    ensureVideoFrameCacheSize(w, h);
    const valid = video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.seeking;
    if (valid) {
        drawCover(ctx, video, w, h, blur);
        lastVideoFrameCtx.clearRect(0, 0, w, h);
        drawCover(lastVideoFrameCtx, video, w, h, blur);
        hasLastVideoFrame = true;
        return;
    }
    if (hasLastVideoFrame) { ctx.drawImage(lastVideoFrame, 0, 0, w, h); return; }
    ctx.fillStyle = state.background.solid || "#0A0A0A";
    ctx.fillRect(0, 0, w, h);
}
function drawBackground(ctx, w, h, bg, media) {
    ctx.save();
    ctx.fillStyle = bg.solid || "#0A0A0A";
    ctx.fillRect(0, 0, w, h);
    if (bg.type === "image" && media.image) drawCover(ctx, media.image, w, h, bg.blur);
    else if (bg.type === "video") drawVideoBackgroundStable(ctx, media.video, w, h, bg.blur);
    if (bg.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${linaClamp(bg.dim)})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
}

function renderTitleCard(ctx, w, h, time, appState) {
    if (!appState.style.titleCardEnabled) return false;

    const introDuration = linaClamp(Number(appState.style.titleCardDuration) || 3, 1, 5);
    const totalDuration = Number(appState.audio?.duration) || 0;
    const outroDuration = 1.6;
    const isIntro = time >= 0 && time < introDuration;
    const outroStart = totalDuration > outroDuration ? totalDuration - outroDuration : Infinity;
    const isOutro = time >= outroStart && time <= totalDuration + 0.05;
    if (!isIntro && !isOutro) return false;

    const metadata = resolveAudioLabels(appState.audio);
    const title = metadata.title || 'UNTITLED';
    const artist = metadata.artist;
    const album = metadata.album;
    const artwork = appState.audio?.hasArtwork && albumArtworkImage ? albumArtworkImage : null;
    const phaseTime = isOutro ? time - outroStart : time;
    const phaseDuration = isOutro ? outroDuration : introDuration;
    const enter = linaSmoother(linaClamp(phaseTime / 0.5));
    const exit = isIntro
        ? 1 - linaSmoother(linaClamp((phaseTime - (phaseDuration - 0.45)) / 0.45))
        : 1;
    const alpha = linaClamp(enter * exit);
    const unit = Math.min(w, h);
    const lift = (1 - enter) * unit * 0.022;
    const contentY = h * 0.52 + lift;
    const maxTextWidth = w * 0.78;

    ctx.save();

    // A restrained full-frame wash keeps type readable without placing it in a card.
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(0,0,0,0.10)');
    wash.addColorStop(0.5, 'rgba(0,0,0,0.28)');
    wash.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    ctx.translate(w / 2, contentY);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = Math.max(8, unit * 0.014);
    ctx.shadowOffsetY = Math.max(2, unit * 0.003);

    let textOriginY = 0;
    if (artwork) {
        const artworkSize = linaClamp(unit * 0.18, 126, 220);
        const artY = -artworkSize - unit * 0.055;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-artworkSize / 2, artY, artworkSize, artworkSize, Math.max(12, artworkSize * 0.07));
        ctx.clip();
        const sw = artwork.naturalWidth || artwork.videoWidth || artwork.width;
        const sh = artwork.naturalHeight || artwork.videoHeight || artwork.height;
        if (sw && sh) {
            const side = Math.min(sw, sh);
            ctx.drawImage(artwork, (sw - side) / 2, (sh - side) / 2, side, side,
                -artworkSize / 2, artY, artworkSize, artworkSize);
        }
        ctx.restore();
        textOriginY = unit * 0.025;
    }

    let titleSize = Math.max(36, Math.round(unit * 0.066));
    ctx.font = `800 ${titleSize}px "Open Sans",Arial,sans-serif`;
    while (titleSize > 30 && ctx.measureText(title).width > maxTextWidth) {
        titleSize -= 2;
        ctx.font = `800 ${titleSize}px "Open Sans",Arial,sans-serif`;
    }

    const metadataLines = Number(Boolean(artist)) + Number(Boolean(album));
    const titleY = textOriginY - (metadataLines ? titleSize * 0.55 : 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, 0, titleY);

    ctx.shadowBlur = Math.max(5, unit * 0.009);
    let cursorY = titleY + Math.max(42, titleSize * 0.92);

    if (artist) {
        let artistSize = Math.max(19, Math.round(unit * 0.026));
        ctx.font = `600 ${artistSize}px "Open Sans",Arial,sans-serif`;
        while (artistSize > 15 && ctx.measureText(artist).width > maxTextWidth) {
            artistSize -= 1;
            ctx.font = `600 ${artistSize}px "Open Sans",Arial,sans-serif`;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText(artist, 0, cursorY);
        cursorY += Math.max(30, artistSize * 1.45);
    }

    if (album) {
        let albumSize = Math.max(15, Math.round(unit * 0.019));
        ctx.font = `500 ${albumSize}px "Open Sans",Arial,sans-serif`;
        while (albumSize > 13 && ctx.measureText(album).width > maxTextWidth) {
            albumSize -= 1;
            ctx.font = `500 ${albumSize}px "Open Sans",Arial,sans-serif`;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        ctx.fillText(album, 0, cursorY);
    }

    ctx.restore();
    return true;
}

function render(ctx, w, h, appState, mediaCache) {
    if (!ctx || !w || !h) return;
    ctx.save();
    try {
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, w, h);
        drawBackground(ctx, w, h, appState.background, mediaCache);
        const masterMode = getMasterMode();
        const missingMaster = masterMode === 'uploaded' ? !appState.audio?.file : masterMode === 'video' ? !(mediaCache?.video && mediaCache.videoFile) : false;
        if (missingMaster) {
            const unit = Math.min(w, h);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255,255,255,0.82)';
            ctx.font = `800 ${Math.max(34, unit * 0.095)}px "Open Sans", Arial, sans-serif`;
            ctx.fillText('KEFE', w / 2, h / 2 - unit * 0.035);
            ctx.fillStyle = 'rgba(255,255,255,0.38)';
            ctx.font = `600 ${Math.max(12, unit * 0.022)}px "Open Sans", Arial, sans-serif`;
            ctx.fillText('ADD AUDIO OR VIDEO + SYNCED LYRICS', w / 2, h / 2 + unit * 0.055);
            return;
        }
        const time = Number.isFinite(appState.playback.currentTime) ? appState.playback.currentTime : 0;
        const style = { ...appState.style };
        const tcActive = renderTitleCard(ctx, w, h, time, appState);
        if (!tcActive) {
            try { renderLyricsEffect(ctx, w, h, style, appState.lyrics.lines, time); }
            catch(e) { console.error(`${style.effect} render error:`, e); }
        }
    } finally { ctx.restore(); }
}

function getMasterMode() {
    return (state.audioSource && state.audioSource.master) || 'uploaded';
}
function isMasterPlaying() {
    const mode = getMasterMode();
    if (mode === 'video') { const v = media?.video; return v ? !v.paused : false; }
    if (mode === 'none') return noneClockRunning;
    return !audio.paused;
}
function getMasterDuration() {
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    }
    if (mode === 'none') {
        const vd = (media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0) ? media.video.duration : 0;
        const ad = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
        // For a muted composition, the timeline should at least cover the timed text.
        let textEnd = 0;
        const lastLine = state.lyrics.lines[state.lyrics.lines.length - 1];
        if (lastLine) {
            const t = Number(lastLine.time);
            const e = Number(lastLine.endTime);
            textEnd = Number.isFinite(e) ? e : (Number.isFinite(t) ? t + 3 : 0);
        }
        return Math.max(vd, ad, textEnd + 1, 1);
    }
    return Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
}
function getMasterTime() {
    if (exportClockTime !== null && exportClockTime !== undefined) return exportClockTime;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.currentTime)) ? v.currentTime : 0;
    }
    if (mode === 'none') {
        if (noneClockRunning) {
            let t = noneClockBase + (performance.now() - noneClockWall) / 1000;
            const d = getMasterDuration();
            if (Number.isFinite(d) && d > 0 && t >= d) { t = d; stopNoneClock(); }
            state.playback.currentTime = t;
            return t;
        }
        return Number.isFinite(state.playback.currentTime) ? state.playback.currentTime : 0;
    }
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
}
function setMasterTime(target) {
    const t = Math.max(0, Number(target) || 0);
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        if (v && Number.isFinite(v.duration) && v.duration > 0 && !v.seeking) v.currentTime = wrappedVideoTime(t, v.duration);
    } else if (mode === 'none') {
        // Rebase the virtual clock at the new position; if it was running it keeps running from here.
        noneClockBase = t; noneClockWall = performance.now();
    } else {
        audio.currentTime = t;
    }
    state.playback.currentTime = t;
}
function startNoneClock(fromTime) {
    noneClockBase = Number.isFinite(fromTime) ? fromTime : state.playback.currentTime;
    noneClockWall = performance.now();
    noneClockRunning = true;
    state.playback.isPlaying = true;
}
function stopNoneClock() {
    noneClockRunning = false;
    noneClockBase = 0; noneClockWall = 0;
    state.playback.isPlaying = false;
}
function wrappedVideoTime(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return ((time % duration) + duration) % duration;
}
function circularVideoDrift(cur, target, dur) {
    let drift = target - cur;
    if (dur > 0) { if (drift > dur/2) drift -= dur; else if (drift < -dur/2) drift += dur; }
    return drift;
}
function maintainBackgroundVideoSync(masterTime) {
    if (getMasterMode() === 'video') return; // video is the driving clock; don't fight it
    if (exportClockTime !== null) return;
    const video = media?.video;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2) return;
    const target = wrappedVideoTime(masterTime, video.duration);
    const drift = circularVideoDrift(video.currentTime, target, video.duration);
    const distance = Math.abs(drift);
    const shouldPlay = isMasterPlaying();
    if (!shouldPlay || userScrubbing) {
        if (!video.paused) video.pause();
        if (distance > 0.035 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        return;
    }
    if (distance <= 0.18) video.playbackRate = linaClamp(1 + drift * 0.20, 0.97, 1.03);
    else video.playbackRate = 1;
    const now = performance.now();
    if (distance > 0.40 && !video.seeking && now - lastVideoHardSync > 250) {
        lastVideoHardSync = now;
        video.currentTime = target;
    }
    if (video.paused && !video.seeking) video.play().catch(() => {});
}
function syncPreviewTransportUI(t) {
    const seek = $('seek'); if (seek) { seek.value = String(t); seek.max = getMasterDuration(); }
    const clock = $('clock');
    const total = getMasterDuration();
    if (clock) clock.textContent = `${fmt(t)} / ${fmt(total)}`;
}
function redrawCurrentPreviewFrame() {
    if (isExporting) return;
    const t = getMasterTime();
    state.playback.currentTime = t;
    maintainBackgroundVideoSync(t);
    try { render(ctx, canvas.width, canvas.height, state, media); }
    catch(e) { console.error("Preview redraw error:", e); }
    syncPreviewTransportUI(t);
}
function tick() {
    if (!isExporting) {
        const t = getMasterTime();
        state.playback.currentTime = t;
        const seek = $('seek');
        if (seek && !userScrubbing) seek.value = String(t);
        const clock = $('clock');
        if (clock) {
            const total = getMasterDuration();
            clock.textContent = `${fmt(t)} / ${fmt(total)}`;
        }
        maintainBackgroundVideoSync(t);
        try { render(ctx, canvas.width, canvas.height, state, media); }
        catch(e) { console.error("Preview render error:", e); }
    }
    renderLoopId = requestAnimationFrame(tick);
}
function startSingleRenderLoop() {
    if (renderLoopId !== null) cancelAnimationFrame(renderLoopId);
    renderLoopId = requestAnimationFrame(tick);
}

const EFFECT_LABELS = {
    apple: "Apple Music-style focus line with a continuous scrolling lyric stack",
    brat: "5-line album-cover typewriter (edge-to-edge justified)",
    eternal: "Three-line handwritten cycle (Homemade Apple only)",
    aurora: "Flowing colour-gradient lyrics with a soft aurora glow",
    pulse: "Bold lyrics with a rhythmic scale and glow pulse"
};

function renderEffectControls() {
    const effect = state.style.effect;
    const container = $('effectControls');
    if (!container) return;
    container.innerHTML = "";
    const controls = [{ key: "fontSize", label: "Size", type: "range", min: 36, max: 150, step: 1, suffix: "px", scale: 1 }];
    if (effect === "apple") {
        controls.push({ key: "align", label: "Alignment", type: "select", options: [["left","Left"],["center","Center"],["right","Right"]] });
    }
    let extraControls = [];
    if (effect === "apple") {
        extraControls = [
            { key: "appleTopOffset", label: "Lyrics position", type: "range", min: 20, max: 38, step: 0.5, suffix: "%", scale: 0.01 },
            { key: "appleLineSpacing", label: "Line spacing", type: "range", min: 45, max: 110, step: 1, suffix: "%", scale: 0.01 },
            { key: "appleInactiveOpacity", label: "Upcoming opacity", type: "range", min: 10, max: 45, step: 1, suffix: "%", scale: 0.01 },
            { key: "appleVisibleLines", label: "Upcoming lines", type: "range", min: 2, max: 6, step: 1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "brat") {
        extraControls = [
            { key: "bratTypingSpeed", label: "Typing speed", type: "range", min: 50, max: 180, step: 5, suffix: "%", scale: 0.01 },
            { key: "bratSideMargin", label: "Side margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 },
            { key: "bratTopMargin", label: "Top margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 }
        ];
    }
    if (effect === "eternal") {
        extraControls = [
            { key: "eternalPenWidth", label: "Ink width", type: "range", min: 8, max: 40, step: 1, suffix: "%", scale: 1 },
            { key: "eternalWriteSpan", label: "Writing speed", type: "range", min: 60, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalGlow", label: "Ink glow", type: "range", min: 0, max: 15, step: 1, suffix: "", scale: 1 },
            { key: "eternalPresence", label: "Presence", type: "range", min: 0, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalInkColor", label: "Ink colour", type: "color" }
        ];
    }
    if (effect === "aurora") {
        extraControls = [
            { key: "auroraSpeed", label: "Flow speed", type: "range", min: 0.2, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "auroraIntensity", label: "Glow intensity", type: "range", min: 0.1, max: 1.5, step: 0.1, suffix: "", scale: 1 },
            { key: "auroraSaturation", label: "Colour saturation", type: "range", min: 0.2, max: 1.8, step: 0.1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "pulse") {
        extraControls = [
            { key: "pulseAmplitude", label: "Pulse strength", type: "range", min: 0.05, max: 1, step: 0.05, suffix: "", scale: 1 },
            { key: "pulseFrequency", label: "Pulse speed", type: "range", min: 0.3, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "pulseGlowSize", label: "Glow size", type: "range", min: 0.1, max: 2, step: 0.1, suffix: "", scale: 1 },
            { key: "accentColor", label: "Glow colour", type: "color" }
        ];
    }
    const tr = document.createElement("div");
    tr.className = "toggle-row";
    const tl = document.createElement("label");
    tl.textContent = "Title Card";
    tr.appendChild(tl);
    const ts = document.createElement("label");
    ts.className = "toggle-switch";
    const ti = document.createElement("input");
    ti.type = "checkbox";
    ti.checked = state.style.titleCardEnabled !== false;
    ti.addEventListener("change", () => {
        if (isExporting) { toast('Finish or cancel the current export first', 'error'); ti.checked = state.style.titleCardEnabled; return; }
        state.style.titleCardEnabled = ti.checked;
        redrawCurrentPreviewFrame();
    });
    const tsl = document.createElement("span");
    tsl.className = "slider";
    ts.appendChild(ti); ts.appendChild(tsl);
    tr.appendChild(ts);
    container.appendChild(tr);

    const durRow = document.createElement("div");
    durRow.className = "control-row";
    const durLabel = document.createElement("label");
    durLabel.textContent = "Title Card Duration";
    const durVal = document.createElement("span");
    durVal.style.marginLeft = "6px";
    durVal.textContent = `${state.style.titleCardDuration || 3}s`;
    durLabel.appendChild(durVal);
    durRow.appendChild(durLabel);
    const durInput = document.createElement("input");
    durInput.type = "range";
    durInput.min = 1; durInput.max = 5; durInput.step = 1;
    durInput.value = state.style.titleCardDuration || 3;
    durInput.addEventListener("input", () => {
        if (isExporting) { toast('Finish or cancel the current export first', 'error'); durInput.value = state.style.titleCardDuration || 3; return; }
        state.style.titleCardDuration = linaClamp(Number(durInput.value) || 3, 1, 5);
        durVal.textContent = `${state.style.titleCardDuration}s`;
        redrawCurrentPreviewFrame();
    });
    durRow.appendChild(durInput);
    container.appendChild(durRow);

    const allControls = [...controls, ...extraControls];
    for (const control of allControls) {
        const row = document.createElement("div");
        row.className = "control-row";
        const label = document.createElement("label");
        label.textContent = control.label;
        row.appendChild(label);
        if (control.type === "range") {
            const val = document.createElement("span");
            val.style.marginLeft = "6px";
            const raw = state.style[control.key] !== undefined ? state.style[control.key] : 76;
            const disp = control.scale !== 1 ? Math.round(raw / control.scale * 100) / 100 : raw;
            val.textContent = `${disp}${control.suffix || ""}`;
            label.appendChild(val);
            const input = document.createElement("input");
            input.type = "range"; input.min = control.min; input.max = control.max; input.step = control.step;
            input.value = disp;
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = control.scale !== 1 ? Math.round(state.style[control.key] / control.scale * 100) / 100 : state.style[control.key]; return; }
                const next = Number(input.value);
                const scaled = control.scale !== 1 ? next * control.scale : next;
                state.style[control.key] = scaled;
                val.textContent = `${control.scale !== 1 ? Math.round(next * 100) / 100 : next}${control.suffix || ""}`;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        } else if (control.type === "select") {
            const select = document.createElement("select");
            for (const [value, text] of control.options) {
                const opt = document.createElement("option");
                opt.value = value; opt.textContent = text;
                select.appendChild(opt);
            }
            select.value = state.style.align || "left";
            select.addEventListener("change", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); select.value = state.style.align || "left"; return; }
                state.style.align = select.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(select);
        } else if (control.type === "color") {
            const input = document.createElement("input");
            input.type = "color";
            input.value = state.style[control.key] || "#FFFFFF";
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = state.style[control.key] || "#FFFFFF"; return; }
                state.style[control.key] = input.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        }
        container.appendChild(row);
    }
}

function setEffect(name) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    state.style.effect = name;
    qsa("[data-effect]").forEach(b => b.classList.toggle("active-effect", b.dataset.effect === name));
    const label = $('effectLabel');
    if (label) label.textContent = EFFECT_LABELS[name] || "";
    renderEffectControls();
    redrawCurrentPreviewFrame();
    saveLinaPrefs();
    return true;
}
qsa("[data-effect]").forEach(b => b.addEventListener("click", () => {
    if (setEffect(b.dataset.effect)) {
        toast(b.textContent + ' activated', 'success');
    }
}));

const fmt = t => {
    if (!t || !isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};
function toast(msg, type = '') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3000);
}
function readiness() {
    const masterDur = getMasterDuration();
    const timingValid = state.lyrics.lines.length > 0 && validateLyricTiming(state.lyrics.lines, masterDur).errors.length === 0;
    const masterReady = hasMasterSource() && masterDur > 0;
    const ready = masterReady && timingValid;
    $('exportBtn').disabled = $('exportBottom').disabled = !ready;
    if (state.lyrics.lines.length) refreshLyricsTimingStatus();
}
function ensureDefaultBackground() {
    if (media.image || media.video) return;
    state.background.type = 'solid';
    state.background.image = null;
    state.background.video = null;
    state.background.solid = state.background.solid || '#0A0A0A';
}
function hasMasterSource() {
    const mode = getMasterMode();
    if (mode === 'video') return Boolean(media.video && media.videoFile);
    if (mode === 'none') return getMasterDuration() > 0; // virtual timeline is a valid master
    return Boolean(state.audio.file) && state.audio.ready;
}
function projectValidationIssues() {
    const issues = [];
    const masterDur = getMasterDuration();
    if (!hasMasterSource()) issues.push('an audio or video source');
    else if (masterDur <= 0) issues.push('a source with a readable duration');
    if (!state.lyrics.lines.length) issues.push('synced lyrics');
    else if (validateLyricTiming(state.lyrics.lines, masterDur).errors.length) issues.push('valid lyric timing');
    return issues;
}
function validateLyricTiming(lines, duration = 0) {
    const errors = [], warnings = [];
    if (!Array.isArray(lines) || !lines.length) return { errors, warnings };
    let previous = -Infinity;
    for (let i = 0; i < lines.length; i++) {
        const time = Number(lines[i]?.time);
        if (!Number.isFinite(time) || time < 0) errors.push(`Line ${i + 1} has an invalid timestamp`);
        if (time < previous) errors.push(`Line ${i + 1} is earlier than the previous line`);
        if (time === previous) warnings.push(`Lines ${i} and ${i + 1} share a timestamp`);
        if (Number.isFinite(duration) && duration > 0 && time > duration + 0.1) errors.push(`Line ${i + 1} starts after the audio ends`);
        if (Number.isFinite(time) && Number.isFinite(previous) && previous >= 0 && time - previous > 18) warnings.push(`Long ${Math.round(time - previous)}s gap before line ${i + 1}`);
        const end = Number(lines[i]?.endTime);
        if (Number.isFinite(end) && Number.isFinite(time) && end < time) errors.push(`Line ${i + 1} ends before it starts`);
        previous = time;
    }
    const last = Number(lines[lines.length - 1]?.time);
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(last) && duration - last > 30) warnings.push('Lyrics finish more than 30 seconds before the audio');
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
function refreshLyricsTimingStatus() {
    const status = $('lyricsStatus');
    if (!status || !state.lyrics.lines.length) return;
    const report = validateLyricTiming(state.lyrics.lines, getMasterDuration());
    if (report.errors.length) {
        status.textContent = `${state.lyrics.lines.length} lines · ${report.errors[0]}`;
        status.className = 'status error';
    } else if (report.warnings.length) {
        status.textContent = `${state.lyrics.lines.length} synced lines · ${report.warnings[0]}`;
        status.className = 'status';
    } else {
        status.textContent = `${state.lyrics.lines.length} synced lines · timing valid`;
        status.className = 'status success';
    }
}
function songFromFilename(name) {
    if (!name) return { artist: '', track: '' };
    const base = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
    const parts = base.split(/\s+-\s+/);
    return parts.length > 1 ? { track: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() } : { artist: '', track: base };
}
const ASPECTS = {
    '9:16': { w: 1080, h: 1920, label: '1080 × 1920 (Vertical)' },
    '1:1': { w: 1080, h: 1080, label: '1080 × 1080 (Square)' },
    '16:9': { w: 1920, h: 1080, label: '1920 × 1080 (Horizontal)' }
};
function setAspectRatio(key) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const aspect = ASPECTS[key];
    if (!aspect) return;
    state.aspect = key;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    qsa('[data-aspect]').forEach(b => b.classList.toggle('active-aspect', b.dataset.aspect === key));
    $('aspectInfo').textContent = aspect.label;
    saveLinaPrefs();
    redrawCurrentPreviewFrame();
}
function parseLyrics(raw) {
    if (typeof raw !== 'string') throw new Error('Lyrics must be text');
    const TIME_TAG = /\[(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;
    const METADATA_TAG = /^\[(ar|ti|al|au|length|by|offset|re|tool|ve|cover|coverart|artwork|image):/i;
    const lines = raw.split(/\r?\n/);
    const parsed = [];
    const skipped = [];
    const metadata = { title: '', artist: '', album: '', artwork: '' };
    const declaredOffset = /^\[offset:([+-]?\d+)\]$/im.exec(raw);
    let offsetSeconds = declaredOffset ? Number(declaredOffset[1]) / 1000 : 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        TIME_TAG.lastIndex = 0;
        const timeMatches = [];
        let expectedTimeIndex = 0;
        let timeMatch;
        while ((timeMatch = TIME_TAG.exec(line)) !== null) {
            if (timeMatch.index !== expectedTimeIndex) break;
            timeMatches.push({ match: timeMatch, time: Number(timeMatch[1]) * 60 + Number(timeMatch[2]) + (timeMatch[3] ? Number('0.' + timeMatch[3]) : 0) });
            expectedTimeIndex = timeMatch.index + timeMatch[0].length;
        }
        if (!timeMatches.length) {
            const metaMatch = /^\[(ar|ti|al|offset|cover|coverart|artwork|image):(.+)\]$/i.exec(line);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                if (key === 'ar') metadata.artist = value;
                else if (key === 'ti') metadata.title = value;
                else if (key === 'al') metadata.album = value;
                else if (key === 'offset') offsetSeconds = (Number(value) || 0) / 1000;
                else metadata.artwork = value;
            } else if (!METADATA_TAG.test(line)) skipped.push(line);
            continue;
        }
        const contentStart = Math.max(...timeMatches.map(item => item.match.index + item.match[0].length));
        const content = line.slice(contentStart);
        const wordMatches = [];
        const WORD_TAG = /<(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?>/g;
        const hasWordTimings = content.includes('<') && content.includes('>');
        if (hasWordTimings) {
            const temp = content;
            WORD_TAG.lastIndex = 0;
            let wm;
            while ((wm = WORD_TAG.exec(temp)) !== null) {
                const wt = Math.max(0, Number(wm[1]) * 60 + Number(wm[2]) + (wm[3] ? Number('0.' + wm[3]) : 0) + offsetSeconds);
                const si = wm.index + wm[0].length;
                const ni = temp.indexOf('<', si);
                const ei = ni !== -1 ? ni : temp.length;
                const wtxt = temp.slice(si, ei).trim();
                if (wtxt) wordMatches.push({ text: wtxt, time: wt, explicitEndTime: false, endTime: null });
            }
        }
        const text = content.replace(/<[^>]*>/g, '').trim();
        if (text) {
            for (const item of timeMatches) {
                const time = Math.max(0, item.time + offsetSeconds);
                const entry = { time, endTime: time + 3, text, words: null };
                if (wordMatches.length > 0 && timeMatches.length === 1) entry.words = wordMatches;
                parsed.push(entry);
            }
        } else {
            skipped.push(line);
        }
    }
    parsed.sort((a, b) => a.time - b.time);
    const unique = parsed.filter((entry, index) => index === 0 || entry.time !== parsed[index-1].time || entry.text !== parsed[index-1].text);
    for (let i = 0; i < unique.length; i++) {
        if (i < unique.length - 1) { unique[i].endTime = unique[i+1].time; unique[i].nextLineTime = unique[i+1].time; }
        else unique[i].endTime = unique[i].time + 5;
    }
    return { lines: normaliseEnhancedWordEnds(unique), skippedCount: skipped.length, skippedLines: skipped, metadata };
}

function updateMetadataInputs() {
    const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
    if (titleInput) titleInput.value = state.audio.metadata.title || '';
    if (artistInput) artistInput.value = state.audio.metadata.artist || '';
    if (albumInput) albumInput.value = state.audio.metadata.album || '';
}

function setAlbumArtworkBlob(blob, token = audioLoadToken) {
    if (!blob || !String(blob.type || '').startsWith('image/')) return;
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    albumArtworkURL = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { if (token !== audioLoadToken) return; albumArtworkImage = image; state.audio.hasArtwork = true; redrawCurrentPreviewFrame(); };
    image.onerror = () => {
        if (token !== audioLoadToken) return;
        state.audio.hasArtwork = false;
        albumArtworkImage = null;
        if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    };
    image.src = albumArtworkURL;
}

async function setAlbumArtworkReference(reference) {
    const value = String(reference || '').trim();
    if (!value.startsWith('data:image/') || value.length > 14 * 1024 * 1024) return false;
    try { const response = await fetch(value); setAlbumArtworkBlob(await response.blob()); return true; }
    catch (error) { return false; }
}

function loadMediaTagsLibrary() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    if (!mediaTagsLoadPromise) {
        mediaTagsLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsmediatags@0.1.1/dist/jsmediatags.min.js';
            script.onload = () => window.jsmediatags ? resolve(window.jsmediatags) : reject(new Error('Metadata reader unavailable'));
            script.onerror = () => reject(new Error('Metadata reader failed to load'));
            document.head.appendChild(script);
        }).catch(error => { mediaTagsLoadPromise = null; throw error; });
    }
    return mediaTagsLoadPromise;
}

async function readEmbeddedAudioMetadata(file, token) {
    try {
        const tagsLibrary = await loadMediaTagsLibrary();
        const result = await new Promise((resolve, reject) => tagsLibrary.read(file, { onSuccess: resolve, onError: reject }));
        if (token !== audioLoadToken || state.audio.file !== file) return;
        const tags = result?.tags || {};
        if (state.audio.metadataSource !== 'project') {
            if (tags.title) state.audio.metadata.title = String(tags.title).trim();
            if (tags.artist) state.audio.metadata.artist = String(tags.artist).trim();
            if (tags.album) state.audio.metadata.album = String(tags.album).trim();
            if (tags.title || tags.artist || tags.album) state.audio.metadataSource = 'embedded';
        }
        updateMetadataInputs();
        const picture = tags.picture;
        if (picture?.data?.length) {
            setAlbumArtworkBlob(new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }), token);
            audioStatus.textContent = file.name + ' · embedded artwork';
        }
        saveLinaPrefs();
        redrawCurrentPreviewFrame();
    } catch (error) {
        console.info('No readable embedded audio metadata:', error?.message || error);
    }
}

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
const MAX_LRC_BYTES = 5 * 1024 * 1024;

function handleAudioFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm)$/i.test(file.name)) {
        toast('That doesn\'t look like an audio file', 'error');
        return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
        toast('Audio file too large (max ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    const replacingAudio = Boolean(state.audio.file);
    const token = ++audioLoadToken;
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(file);
    state.audio.file = file;
    state.audio.url = audioURL;
    state.audio.duration = 0;
    state.audio.ready = false;
    const parsedMeta = songFromFilename(file.name);
    const usingProjectMetadata = Boolean(pendingProjectMetadata);
    state.audio.metadata = pendingProjectMetadata || { title: parsedMeta.track || '', artist: parsedMeta.artist || '', album: '' };
    pendingProjectMetadata = null;
    state.audio.metadataSource = usingProjectMetadata ? 'project' : 'filename';
    if (replacingAudio) {
        state.lyrics.lines = [];
        $('lyricsStatus').textContent = 'No lyrics loaded';
        $('lyricsStatus').className = 'status';
    }
    albumArtworkImage = null;
    state.audio.hasArtwork = false;
    if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    updateMetadataInputs();
    audio.src = audioURL;
    audio.load();
    audioStatus.textContent = file.name;
    audioStatus.className = 'status success';
    toast('Audio loaded: ' + file.name, 'success');
    readiness();
    readEmbeddedAudioMetadata(file, token);
}

function handleBackgroundFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
        toast('Background must be an image or video file', 'error');
        return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
        toast('Background file too large (max ' + Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    const token = ++backgroundLoadToken;
    const candidateURL = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true;
        vid.src = candidateURL;
        vid.load();
        vid.addEventListener('loadeddata', function() {
            if (isExporting || token !== backgroundLoadToken) { vid.pause(); vid.src = ''; URL.revokeObjectURL(candidateURL); return; }
            if (media.video && media.video !== vid) { media.video.pause(); media.video.src = ''; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            // When the video acts as the master clock it must stop at its end (no loop).
            vid.addEventListener('ended', function() {
                if (getMasterMode() !== 'video') return;
                $('playBtn').textContent = 'Play';
                state.playback.isPlaying = false;
                if (!isExporting) redrawCurrentPreviewFrame();
            });
            media.video = vid;
            media.videoFile = file;
            media.image = null;
            // Detect whether the video has an embedded audio track (used to decide if it can act as master).
            media.videoHasAudio = false;
            try {
                if (vid.audioTracks && vid.audioTracks.length) media.videoHasAudio = true;
                else if (vid.mozHasAudio) media.videoHasAudio = true;
                else if (vid.webkitAudioDecodedByteCount && vid.webkitAudioDecodedByteCount > 0) media.videoHasAudio = true;
            } catch (e) { media.videoHasAudio = false; }
            state.background.type = 'video';
            $('backgroundStatus').textContent = file.name + (media.videoHasAudio ? ' · has audio' : '');
            $('backgroundStatus').className = 'status success';
            toast('Background video loaded' + (media.videoHasAudio ? '' : ' (no audio track)'), 'success');
            // Default master selection (only when the user has not explicitly chosen):
            // - no uploaded audio + video has audio  -> video audio becomes master
            // - no uploaded audio + video has no audio -> virtual timeline (muted) driven by video duration
            // - uploaded audio exists                 -> uploaded stays/master takes priority (left as-is)
            if (!state.audio.file) {
                applyMasterSelection(media.videoHasAudio ? 'video' : 'none', { userInitiated: false, silent: true });
            }
            readiness();
            hasLastVideoFrame = false;
            const t = getMasterTime();
            if (Number.isFinite(vid.duration) && vid.duration > 0) vid.currentTime = wrappedVideoTime(t, vid.duration);
            redrawCurrentPreviewFrame();
        });
        vid.addEventListener('error', function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Video failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading video';
            $('backgroundStatus').className = 'status error';
        });
    } else {
        const img = new Image();
        img.onload = function() {
            if (isExporting || token !== backgroundLoadToken) { URL.revokeObjectURL(candidateURL); return; }
            if (media.video) { media.video.pause(); media.video.src = ''; media.video = null; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            media.image = img;
            state.background.type = 'image';
            $('backgroundStatus').textContent = file.name;
            $('backgroundStatus').className = 'status success';
            toast('Background image loaded', 'success');
            readiness();
            redrawCurrentPreviewFrame();
        };
        img.onerror = function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Image failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading image';
            $('backgroundStatus').className = 'status error';
        };
        img.src = candidateURL;
    }
}

const audioInput = $('audioInput'), audioStatus = $('audioStatus');
const audioChooseBtn = document.getElementById('audioChooseBtn');

audioChooseBtn.addEventListener('click', function () {
    if (isExporting) {
        toast('Finish or cancel the current export first', 'error');
        return;
    }
    audioInput.value = '';
    audioInput.click();
});

audioInput.addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    handleAudioFile(file);
});

const backgroundInput = $('backgroundInput');
backgroundInput.addEventListener('change', function(e) {
    handleBackgroundFile(this.files[0]);
});

$('backgroundColor').addEventListener('input', function() {
    if (isExporting) { this.value = state.background.solid || '#0A0A0A'; return; }
    state.background.solid = this.value;
    $('backgroundColorValue').textContent = this.value.toUpperCase();
    if (!media.image && !media.video) state.background.type = 'solid';
    redrawCurrentPreviewFrame();
});

function serialiseProject() {
    return {
        format: 'KEFE Visualiser Project', version: 1, savedAt: new Date().toISOString(),
        metadata: { ...state.audio.metadata }, lyrics: state.lyrics.lines,
        lyricsSource: $('lyricsText').value || '', style: { ...state.style },
        background: { solid: state.background.solid, dim: state.background.dim, blur: state.background.blur },
        masterAudio: state.audioSource.master,
        aspect: state.aspect
    };
}
function sanitiseProjectLyrics(lines) {
    if (!Array.isArray(lines) || lines.length > 10000) return [];
    return lines.map(line => {
        const time = Number(line?.time), endTime = Number(line?.endTime);
        if (!Number.isFinite(time) || time < 0) return null;
        const words = Array.isArray(line.words) ? line.words.slice(0, 500).map(word => ({
            text: String(word?.text || '').slice(0, 200), time: Number(word?.time),
            endTime: Number.isFinite(Number(word?.endTime)) ? Number(word.endTime) : null
        })).filter(word => word.text && Number.isFinite(word.time)) : null;
        return { text: String(line?.text || '').slice(0, 1000), time, endTime: Number.isFinite(endTime) ? endTime : time + 3, words };
    }).filter(line => line?.text).sort((a, b) => a.time - b.time);
}
function applyProjectStyle(projectStyle) {
    if (!projectStyle || typeof projectStyle !== 'object') return;
    for (const [key, current] of Object.entries(state.style)) {
        const incoming = projectStyle[key];
        if (typeof current === 'number' && Number.isFinite(Number(incoming))) state.style[key] = linaClamp(Number(incoming), -1000, 1000);
        else if (typeof current === 'boolean' && typeof incoming === 'boolean') state.style[key] = incoming;
        else if (typeof current === 'string' && typeof incoming === 'string' && incoming.length <= 100) state.style[key] = incoming;
    }
    if (!EFFECT_LABELS[state.style.effect]) state.style.effect = 'apple';
    if (!['left','center','right'].includes(state.style.align)) state.style.align = 'left';
    for (const key of ['accentColor','textColor','bratTextColor','eternalInkColor']) if (!/^#[0-9a-f]{6}$/i.test(state.style[key])) state.style[key] = '#FFFFFF';
}
function downloadProject() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(serialiseProject(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    const label = sanitiseExportFilenamePart(resolveAudioLabels(state.audio).title) || 'Untitled';
    link.href = url; link.download = `${label} - KEFE Project.kefe`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Project settings saved', 'success');
}
async function loadProjectFile(file) {
    if (!file || isExporting) return;
    if (file.size > 5 * 1024 * 1024) { toast('Project file is too large', 'error'); return; }
    try {
        const project = JSON.parse(await file.text());
        if (project?.format !== 'KEFE Visualiser Project' || project?.version !== 1) throw new Error('Not a supported KEFE project');
        state.audio.metadata = { title: String(project.metadata?.title || ''), artist: String(project.metadata?.artist || ''), album: String(project.metadata?.album || '') };
        pendingProjectMetadata = { ...state.audio.metadata };
        state.lyrics.lines = sanitiseProjectLyrics(project.lyrics);
        applyProjectStyle(project.style);
        if (project.background && typeof project.background === 'object') {
            if (/^#[0-9a-f]{6}$/i.test(project.background.solid || '')) state.background.solid = project.background.solid;
            state.background.dim = linaClamp(Number(project.background.dim) || 0, 0, 1);
            state.background.blur = linaClamp(Number(project.background.blur) || 0, 0, 100);
        }
        if (MASTER_MODES.includes(project.masterAudio) && project.masterAudio !== 'uploaded') {
            // Restore an explicitly-saved master choice after media is loaded again.
            state.audioSource.master = project.masterAudio;
            state.audioSource.userChosen = true;
        }
        state.aspect = ASPECTS[project.aspect] ? project.aspect : state.aspect;
        $('lyricsText').value = String(project.lyricsSource || '').slice(0, 1000000);
        updateMetadataInputs();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();
        setAspectRatio(state.aspect);
        setEffect(EFFECT_LABELS[state.style.effect] ? state.style.effect : 'apple');
        readiness(); redrawCurrentPreviewFrame();
        toast('Project opened · select its audio file to continue', 'success');
    } catch (error) { toast(error.message || 'Could not open project', 'error'); }
}
$('saveProject').addEventListener('click', downloadProject);
$('loadProject').addEventListener('click', () => $('projectFileInput').click());
$('projectFileInput').addEventListener('change', function() { loadProjectFile(this.files?.[0]); this.value = ''; });

['metaTitle','metaArtist','metaAlbum'].forEach(id => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('input', () => {
        const key = id === 'metaTitle' ? 'title' : id === 'metaArtist' ? 'artist' : 'album';
        state.audio.metadata[key] = input.value.trim();
        state.audio.metadataSource = 'manual';
        redrawCurrentPreviewFrame();
        saveLinaPrefs();
    });
});

audio.addEventListener('loadedmetadata', function() {
    if (!Number.isFinite(this.duration) || this.duration <= 0) {
        state.audio.ready = false;
        readiness();
        toast('Audio duration could not be read', 'error');
        return;
    }
    state.audio.duration = this.duration;
    state.audio.ready = true;
    // Default master selection: uploaded audio takes priority (per product spec).
    applyMasterSelection('uploaded', { userInitiated: false, silent: true });
    const seek = $('seek'); if (seek) seek.max = getMasterDuration();
    $('clock').textContent = '0:00 / ' + fmt(getMasterDuration());
    readiness();
});
audio.addEventListener('error', function() {
    state.audio.ready = false;
    readiness();
    toast('Audio error', 'error');
    audioStatus.textContent = 'Error loading audio';
    audioStatus.className = 'status error';
});
audio.addEventListener('timeupdate', function() { if (getMasterMode() === 'uploaded') state.playback.currentTime = this.currentTime || 0; });
audio.addEventListener('play', function() {
    if (getMasterMode() !== 'uploaded') return; // only the selected master source drives preview
    $('playBtn').textContent = 'Pause';
    state.playback.isPlaying = true;
    if (isExporting) return;
    const video = media?.video;
    if (video && video.readyState >= 2) {
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Math.abs(video.currentTime - target) > 0.20 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        video.play().catch(() => {});
    }
});
audio.addEventListener('pause', function() {
    if (getMasterMode() !== 'uploaded') return;
    $('playBtn').textContent = 'Play';
    state.playback.isPlaying = false;
    if (isExporting) return;
    const video = media?.video;
    if (video) {
        video.pause();
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Number.isFinite(video.duration) && !video.seeking) video.currentTime = target;
    }
    redrawCurrentPreviewFrame();
});
audio.addEventListener('ended', function() { if (getMasterMode() === 'none') return; $('playBtn').textContent = 'Play'; state.playback.isPlaying = false; if (!isExporting) redrawCurrentPreviewFrame(); });
audio.addEventListener('seeked', function() { if (!isExporting) redrawCurrentPreviewFrame(); });

async function togglePlayback() {
    if (exportClockTime !== null) return;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        if (v) {
            if (v.paused) {
                v.muted = false;
                try { await v.play(); } catch(e) { toast('Playback error', 'error'); }
                $('playBtn').textContent = 'Pause'; state.playback.isPlaying = true;
            } else {
                v.pause(); $('playBtn').textContent = 'Play'; state.playback.isPlaying = false;
            }
        }
        redrawCurrentPreviewFrame();
        return;
    }
    if (mode === 'none') {
        if (noneClockRunning) { stopNoneClock(); $('playBtn').textContent = 'Play'; state.playback.isPlaying = false; }
        else { startNoneClock(getMasterTime()); $('playBtn').textContent = 'Pause'; state.playback.isPlaying = true; }
        redrawCurrentPreviewFrame();
        return;
    }
    if (audio.paused) { try { await audio.play(); } catch(e) { toast('Playback error', 'error'); } }
    else audio.pause();
}
$('playBtn').addEventListener('click', togglePlayback);

function seekPreview(target) {
    if (isExporting) return;
    if (!Number.isFinite(target)) return;
    setMasterTime(target);
    redrawCurrentPreviewFrame();
}
$('seek').addEventListener('pointerdown', function() { userScrubbing = true; if (!isExporting) media?.video?.pause(); });
$('seek').addEventListener('input', function(e) {
    if (exportClockTime !== null) return;
    const target = Number(e.target.value);
    if (!Number.isFinite(target)) return;
    seekPreview(target);
});
function finishScrubbing() {
    if (!userScrubbing) return;
    userScrubbing = false;
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) media?.video?.play().catch(() => {});
    else if (mode === 'video') media?.video?.play().catch(() => {});
}
$('seek').addEventListener('pointerup', finishScrubbing);
$('seek').addEventListener('change', finishScrubbing);
function stopPlayback() {
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'video') { if (media?.video) { media.video.pause(); media.video.currentTime = 0; } }
    else if (mode === 'none') { stopNoneClock(); }
    else { audio.pause(); audio.currentTime = 0; }
    state.playback.currentTime = 0;
    if (media?.video && mode === 'uploaded' && Number.isFinite(media.video.duration) && media.video.duration > 0) media.video.currentTime = 0;
    redrawCurrentPreviewFrame();
}
$('stopBtn').addEventListener('click', stopPlayback);

/* =========================================================================
 * AUDIO SOURCE SELECTION (Phase 1)
 * The master audio source decides BOTH the audible preview audio AND the
 * timing reference. Preview and export always read the same selection, so a
 * source can never silently change between them.
 * ========================================================================= */
const MASTER_MODES = ['uploaded', 'video', 'none'];
const MASTER_MODE_LABELS = {
    uploaded: 'Uploaded Audio',
    video: 'Background Video Audio',
    none: 'No audio / Muted'
};
function masterModeAvailable(mode) {
    if (mode === 'uploaded') return Boolean(state.audio.file);
    if (mode === 'video') return Boolean(media.video && media.videoFile && media.videoHasAudio);
    return true;
}
function applyMasterSelection(mode, opts = {}) {
    const userInitiated = Boolean(opts.userInitiated);
    const silent = Boolean(opts.silent);
    if (!MASTER_MODES.includes(mode)) return false;
    if (userInitiated && !masterModeAvailable(mode)) {
        toast('That audio source is not available right now', 'error');
        syncMasterSourceUI();
        return false;
    }
    // Automatic defaults must never override an explicit user choice.
    if (!userInitiated && state.audioSource.userChosen) {
        syncMasterSourceUI();
        return false;
    }
    // Never silently switch during playback/export: if the user is changing the
    // source while something is playing or exporting, stop first.
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    if (isMasterPlaying()) { pauseMasterPlayback(); }
    const previous = getMasterMode();
    state.audioSource.master = mode;
    if (userInitiated) {
        state.audioSource.userChosen = true;
        // A user-driven selection may have a different timing reference, so warn
        // whenever timed text exists — its synchronization may no longer match.
        if (!silent && state.lyrics.lines.length) {
            toast('Timed text was synchronized against another source — it may no longer match the new master audio', '');
            console.warn('[KEFE] Master audio source changed while timed text exists; the text may be out of sync.');
        }
    }
    if (previous !== mode) {
        // Load the new master ready for playback and enforce mute routing so only
        // the selected master source is audible at any time.
        if (mode === 'uploaded' && state.audio.file) {
            if (!audio.src || audio.src !== state.audio.url) { audio.src = state.audio.url; audio.load(); }
            if (media?.video) { media.video.muted = true; media.video.loop = true; } // uploaded audio is authoritative; video stays silent + loops as artwork
        } else if (mode === 'video' && media.video) {
            media.video.muted = false; // allow the background video's own audio to be heard
            media.video.loop = false;  // the video is the master clock: it should stop at its end like audio
            if (audio && !audio.paused) audio.pause();
        } else {
            if (audio && !audio.paused) audio.pause();
            if (media?.video) { media.video.muted = true; media.video.loop = true; if (!media.video.paused) media.video.pause(); }
        }
    }
    syncMasterSourceUI();
    readiness();
    redrawCurrentPreviewFrame();
    return true;
}
function pauseMasterPlayback() {
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) audio.pause();
    else if (mode === 'video' && media?.video && !media.video.paused) media.video.pause();
    else if (mode === 'none' && noneClockRunning) stopNoneClock();
}
function renderMasterSourceUI() {
    if ($('masterSourceSection')) return;
    const audioSection = $('audioSection');
    if (!audioSection) return;
    const section = document.createElement('div');
    section.className = 'section';
    section.id = 'masterSourceSection';
    section.innerHTML = `<h3><span class="section-index">+</span>Master Audio</h3>
        <p class="status" id="masterSourceHint">Decides what you hear and what the timeline follows.</p>
        <div class="effect-buttons" id="masterSourceButtons" role="group" aria-label="Master audio source"></div>
        <div id="masterSourceStatus" class="status"></div>`;
    audioSection.appendChild(section);
    const box = $('masterSourceButtons');
    for (const mode of MASTER_MODES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.master = mode;
        btn.textContent = MASTER_MODE_LABELS[mode];
        btn.addEventListener('click', () => {
            const ok = applyMasterSelection(mode, { userInitiated: true, silent: false });
            if (ok) toast(MASTER_MODE_LABELS[mode] + ' is now the master audio source', 'success');
        });
        box.appendChild(btn);
    }
    syncMasterSourceUI();
}
function syncMasterSourceUI() {
    const mode = getMasterMode();
    const buttons = qsa('#masterSourceButtons button');
    buttons.forEach(b => b.classList.toggle('active-effect', b.dataset.master === mode));
    const status = $('masterSourceStatus');
    if (!status) return;
    const uploadedDur = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
    const videoDur = media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0 ? fmt(media.video.duration) : '—';
    const parts = [];
    parts.push(`Master: <strong>${MASTER_MODE_LABELS[mode] || mode}</strong>`);
    parts.push(`Uploaded: ${uploadedDur}`);
    parts.push(`Video audio: ${media?.videoHasAudio ? videoDur + ' (available)' : '—'}`);
    if (mode === 'video') parts.push('The background video audio is authoritative. Timed text must be interpreted against it.');
    if (mode === 'none') parts.push('No audio will be heard or exported.');
    status.innerHTML = parts.join(' · ');
}

let resetConfirmTimer = null;
function disarmReset() {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
    const button = $('resetBtn');
    button.dataset.confirmed = '';
    button.textContent = 'Reset';
    button.classList.remove('confirming');
    button.setAttribute('aria-label', 'Reset project');
}
function armReset() {
    const button = $('resetBtn');
    button.dataset.confirmed = 'true';
    button.textContent = 'Are you sure?';
    button.classList.add('confirming');
    button.setAttribute('aria-label', 'Confirm project reset');
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(disarmReset, 4500);
}
function resetProject() {
    if (isExporting) {
        toast('Finish or cancel the current export first', 'error');
        return;
    }
    const button = $('resetBtn');
    if (button.dataset.confirmed !== 'true') {
        armReset();
        return;
    }
    clearTimeout(resetConfirmTimer);
    try { localStorage.removeItem(LINA_PREFS_KEY); } catch (e) { /* storage unavailable */ }
    window.location.href = new URL('./', window.location.href).href;
}
$('resetBtn').addEventListener('click', resetProject);
document.addEventListener('click', event => {
    if (event.target !== $('resetBtn') && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});

async function fetchWithRetry(url, options, retries = 2, backoffMs = 600) {
    for (let attempt = 0; ; attempt++) {
        let resp;
        try {
            resp = await fetch(url, options);
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') throw fetchErr;
            if (attempt >= retries) throw new Error('Lyrics search failed (network error)');
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        // Retry on server errors / rate limiting, not on 4xx client errors (retrying won't help those).
        if ((resp.status >= 500 || resp.status === 429) && attempt < retries) {
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        return resp;
    }
}

function cleanTrackName(value) {
    return String(value || '')
        .replace(/\s*[\[(](official\s+)?(music|lyric|lyrics|audio|visuali[sz]er|video).*?[\])]/ig, '')
        .replace(/\s+(official\s+)?(music|lyric|lyrics|audio|visuali[sz]er|video)\s*$/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isUsefulExportLabel(value) {
    const label = String(value || '').trim();
    return Boolean(label) && !/^(unknown|untitled|audio|track|song|recording|output|new recording|voice memo)(?:\s*\d+)?$/i.test(label);
}
function sanitiseExportFilenamePart(value) {
    return String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();
}
function buildExportFilename(extension) {
    const resolved = resolveAudioLabels(state.audio);
    const title = sanitiseExportFilenamePart(resolved.title) || 'Lyric Video';
    const artist = sanitiseExportFilenamePart(resolved.artist);
    const parts = [title];
    if (artist && artist.toLocaleLowerCase() !== title.toLocaleLowerCase()) parts.push(artist);
    parts.push('KEFE Visualiser');
    const ext = String(extension || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
    return parts.join(' - ') + '.' + ext;
}
function normalisedMetadataLabel(value) {
    return cleanTrackName(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function resolveAudioLabels(audioState = state.audio) {
    const metadata = audioState?.metadata || {};
    const fallback = audioState?.file ? songFromFilename(audioState.file.name) : { track: '', artist: '' };
    const fallbackTitle = cleanTrackName(fallback.track);
    const fallbackArtist = String(fallback.artist || '').trim();
    const useWebsiteFields = audioState === state.audio;
    const titleField = useWebsiteFields ? $('metaTitle') : null;
    const artistField = useWebsiteFields ? $('metaArtist') : null;
    const albumField = useWebsiteFields ? $('metaAlbum') : null;
    let title = cleanTrackName(titleField ? titleField.value : metadata.title);
    let artist = String(artistField ? artistField.value : (metadata.artist || '')).trim();
    const album = String(albumField ? albumField.value : (metadata.album || '')).trim();

    if (!isUsefulExportLabel(title)) title = fallbackTitle;
    if (!isUsefulExportLabel(artist)) artist = fallbackArtist;
    return {
        title: String(title || '').trim(),
        artist: String(artist || '').trim(),
        album
    };
}

async function requestSyncedLyrics(artist, track, duration, signal) {
    const candidates = [];
    const exact = new URLSearchParams({ artist_name: artist, track_name: track });
    if (Number.isFinite(duration) && duration > 0) exact.set('duration', String(Math.round(duration)));
    if (artist) {
        const exactResp = await fetchWithRetry('https://lrclib.net/api/get?' + exact.toString(), { signal }, 1);
        if (exactResp.ok) candidates.push(await exactResp.json());
        else if (exactResp.status !== 404) throw new Error(exactResp.status === 429 ? 'Lyrics service is rate-limited, try again shortly' : 'Lyrics service unavailable (' + exactResp.status + ')');
    }

    const searches = [
        new URLSearchParams({ track_name: track, ...(artist ? { artist_name: artist } : {}) }),
        new URLSearchParams({ q: [artist, track].filter(Boolean).join(' ') })
    ];
    for (const params of searches) {
        const response = await fetchWithRetry('https://lrclib.net/api/search?' + params.toString(), { signal });
        if (!response.ok) throw new Error(response.status === 429 ? 'Lyrics service is rate-limited, try again shortly' : 'Lyrics service unavailable (' + response.status + ')');
        const results = await response.json();
        if (Array.isArray(results)) candidates.push(...results);
        if (candidates.some(item => item?.syncedLyrics)) break;
    }
    return candidates.find(item => item?.syncedLyrics) || null;
}

$('findLyricsBtn').addEventListener('click', async function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!state.audio.file) { toast('Load audio first', 'error'); return; }
    const resolved = resolveAudioLabels(state.audio);
    const artist = resolved.artist;
    const track = resolved.title;
    if (!track) { toast('Enter the song title first', 'error'); return; }
    $('lyricsStatus').textContent = 'Searching...';
    $('lyricsStatus').className = 'status loading';
    this.disabled = true;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);
        let match;
        try {
            match = await requestSyncedLyrics(artist, track, state.audio.duration || audio.duration, controller.signal);
        } catch (fetchErr) {
            throw new Error(fetchErr.name === 'AbortError' ? 'Lyrics search timed out' : (fetchErr.message || 'Lyrics search failed (network error)'));
        } finally {
            clearTimeout(timeoutId);
        }
        if (!match || !match.syncedLyrics) throw new Error('No synced lyrics');
        const parsed = parseLyrics(match.syncedLyrics);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found');
        if (isExporting) return;
        state.lyrics.lines = parsed.lines;
        if (match.trackName) state.audio.metadata.title = String(match.trackName).trim();
        if (match.artistName) state.audio.metadata.artist = String(match.artistName).trim();
        if (match.albumName) state.audio.metadata.album = String(match.albumName).trim();
        if (match.trackName || match.artistName || match.albumName) state.audio.metadataSource = 'lyrics-service';
        updateMetadataInputs();
        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        toast('Lyrics loaded' + (parsed.skippedCount ? ', ' + parsed.skippedCount + ' line(s) could not be parsed' : ''), 'success');
        readiness();
        redrawCurrentPreviewFrame();
    } catch(error) {
        if (isExporting) return;
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
    this.disabled = false;
});

qsa('[data-aspect]').forEach(b => b.addEventListener('click', function() { setAspectRatio(this.dataset.aspect); }));

$('editLyricsBtn').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (state.lyrics.lines.length) {
        let text = '';
        for (const line of state.lyrics.lines) {
            text += '[' + formatTime(line.time) + ']' + line.text + '\n';
        }
        $('lyricsText').value = text;
    }
    $('lyricsEditor').classList.remove('hidden');
});
$('closeEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('cancelEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('pasteLyrics').addEventListener('click', async function() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        $('editorStatus').textContent = window.isSecureContext
            ? 'Clipboard paste isn\'t supported in this browser — try Ctrl/Cmd+V into the box instead'
            : 'Clipboard paste needs HTTPS — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (!text) {
            $('editorStatus').textContent = 'Clipboard is empty';
            $('editorStatus').className = 'status error';
            return;
        }
        $('lyricsText').value = text;
        $('editorStatus').textContent = 'Pasted from clipboard';
        $('editorStatus').className = 'status success';
    } catch(err) {
        $('editorStatus').textContent = err?.name === 'NotAllowedError'
            ? 'Clipboard permission denied — allow it or paste manually with Ctrl/Cmd+V'
            : 'Could not read clipboard — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
    }
});
async function loadLrcFile(file, openEditor = false) {
    if (!file) return;
    if (!/\.(lrc|txt)$/i.test(file.name)) {
        toast('Choose an .lrc or .txt file', 'error');
        return;
    }
    if (file.size > MAX_LRC_BYTES) {
        toast('Lyrics file too large (max 5MB)', 'error');
        return;
    }
    try {
        const raw = await file.text();
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found in ' + file.name);
        $('lyricsText').value = raw;
        state.lyrics.lines = parsed.lines;
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) state.audio.metadataSource = 'lrc';
        updateMetadataInputs();
        if (parsed.metadata?.artwork) await setAlbumArtworkReference(parsed.metadata.artwork);
        $('lyricsStatus').textContent = parsed.lines.length + ' synced lines loaded';
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Loaded ' + file.name;
        $('editorStatus').className = 'status success';
        readiness();
        redrawCurrentPreviewFrame();
        toast('Loaded ' + file.name, 'success');
        if (openEditor) $('lyricsEditor').classList.remove('hidden');
    } catch (error) {
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
}
$('uploadLrcMain').addEventListener('click', () => $('lrcFileInput').click());
$('lrcFileInput').addEventListener('change', function() {
    loadLrcFile(this.files?.[0]);
    this.value = '';
});
$('uploadLrc').addEventListener('click', () => $('lrcFileInput').click());
$('saveLyrics').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const raw = $('lyricsText').value.trim();
    if (!raw) {
        $('editorStatus').textContent = 'No lyrics to save';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) {
            $('editorStatus').textContent = 'No valid timed lyrics found';
            $('editorStatus').className = 'status error';
            return;
        }
        state.lyrics.lines = parsed.lines;
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) {
            state.audio.metadataSource = 'lrc';
            updateMetadataInputs();
        }
        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Saved ' + parsed.lines.length + ' lines' + (parsed.skippedCount ? ', skipped ' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') : '');
        $('editorStatus').className = parsed.skippedCount ? 'status' : 'status success';
        toast(parsed.skippedCount ? 'Lyrics saved, ' + parsed.skippedCount + ' line(s) skipped' : 'Lyrics saved', 'success');
        readiness();
        redrawCurrentPreviewFrame();
        setTimeout(() => $('lyricsEditor').classList.add('hidden'), 800);
    } catch(err) {
        $('editorStatus').textContent = err.message;
        $('editorStatus').className = 'status error';
    }
});
function formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60), c = Math.floor((seconds % 1) * 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function getExportDimensions(preset) {
    const aspect = state.aspect || '9:16';
    const sizes = {
        '1080p': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
        '720p': { '9:16':[720,1280], '1:1':[720,720], '16:9':[1280,720] },
        '480p': { '9:16':[480,854], '1:1':[480,480], '16:9':[854,480] },
        'instagram': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
        'tiktok': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] }
    };
    const encoding = {
        '1080p':[60,14000000], '720p':[30,5000000], '480p':[24,2000000],
        'instagram':[30,8000000], 'tiktok':[30,6000000]
    };
    const selected = sizes[preset] ? preset : '720p';
    const dims = sizes[selected][aspect] || sizes[selected]['9:16'];
    const enc = encoding[selected];
    return { width:dims[0], height:dims[1], fps:enc[0], bitrate:enc[1] };
}

async function startExport() {
    if (isExporting) return;
    const issues = projectValidationIssues();
    if (issues.length) { toast('Before export, add: ' + issues.join(', '), 'error'); return; }
    ensureDefaultBackground();
    const config = getExportDimensions($('exportPreset').value);
    const duration = getMasterDuration();
    const totalFrames = Math.ceil(duration * config.fps);
    const report = validateLyricTiming(state.lyrics.lines, duration);
    const demand = config.width * config.height * config.fps * duration;
    const demandLabel = demand > 1.2e11 ? 'Very high' : demand > 5e10 ? 'High' : demand > 1.8e10 ? 'Moderate' : 'Light';
    const masterLabel = MASTER_MODE_LABELS[getMasterMode()] || getMasterMode();
    const rows = [
        ['Output', `${config.width} × ${config.height}`], ['Frame rate', `${config.fps} fps`],
        ['Duration', fmt(duration)], ['Frames', totalFrames.toLocaleString()],
        ['Master audio', masterLabel + (getMasterMode() === 'none' ? ' (muted)' : '')],
        ['Background', media.image ? 'Uploaded image' : media.video ? 'Uploaded video' : `Solid ${state.background.solid}`],
        ['Device demand', demandLabel]
    ];
    $('preflightSummary').replaceChildren(...rows.map(([label, value]) => {
        const row = document.createElement('div'); row.className = 'preflight-row';
        const left = document.createElement('span'); left.textContent = label;
        const right = document.createElement('strong'); right.textContent = value;
        row.append(left, right); return row;
    }));
    const warnings = [...report.warnings];
    if (demandLabel === 'High' || demandLabel === 'Very high') warnings.unshift('This export may take a long time on a phone. The finished MP4 timing will remain frame-accurate.');
    $('preflightWarning').textContent = warnings.join(' ');
    $('preflightWarning').classList.toggle('hidden', warnings.length === 0);
    $('exportPreflight').classList.remove('hidden');
}

function closeExportPreflight() { $('exportPreflight').classList.add('hidden'); }
$('closePreflight').addEventListener('click', closeExportPreflight);
$('cancelPreflight').addEventListener('click', closeExportPreflight);

$('exportBtn').addEventListener('click', startExport);
$('exportBottom').addEventListener('click', startExport);

document.addEventListener('keydown', function(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    switch(e.key) {
        case ' ': e.preventDefault(); togglePlayback(); break;
        case 'ArrowLeft': e.preventDefault(); seekPreview(Math.max(0, getMasterTime() - 5)); break;
        case 'ArrowRight': e.preventDefault(); seekPreview(Math.min(getMasterDuration(), getMasterTime() + 5)); break;
        case '1': document.querySelector('[data-effect="apple"]')?.click(); break;
        case '2': document.querySelector('[data-effect="brat"]')?.click(); break;
        case '3': document.querySelector('[data-effect="eternal"]')?.click(); break;
        case 'e': case 'E': startExport(); break;
        case 'f': case 'F':
            if (document.fullscreenElement) document.exitFullscreen();
            else document.querySelector('.preview')?.requestFullscreen().catch(() => {});
            break;
        case '0': stopPlayback(); break;
    }
});

function setupDropZone(zone, inputId) {
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (inputId === 'audioInput') handleAudioFile(file);
        if (inputId === 'backgroundInput') handleBackgroundFile(file);
    });
}
setupDropZone($('audioDrop'), 'audioInput');
setupDropZone($('bgDrop'), 'backgroundInput');

function init() {
    try {
        ensureDefaultBackground();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();
        const prefs = loadLinaPrefs();
        if (prefs?.metadata && typeof prefs.metadata === 'object') {
            state.audio.metadata.title = prefs.metadata.title || '';
            state.audio.metadata.artist = prefs.metadata.artist || '';
            state.audio.metadata.album = prefs.metadata.album || '';
            const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
            if (titleInput) titleInput.value = state.audio.metadata.title;
            if (artistInput) artistInput.value = state.audio.metadata.artist;
            if (albumInput) albumInput.value = state.audio.metadata.album;
        }
        setAspectRatio(prefs?.aspect && ASPECTS[prefs.aspect] ? prefs.aspect : '9:16');
        renderMasterSourceUI();
        readiness();
        setEffect(prefs?.effect && EFFECT_LABELS[prefs.effect] ? prefs.effect : (state.style.effect || 'apple'));
        redrawCurrentPreviewFrame();
        toast('KEFE Visualiser ready', 'success');
    } catch(err) {
        console.error('Init error:', err);
        toast('Error initializing', 'error');
    }
}

window.addEventListener('error', function(e) {
    console.error('Unhandled error:', e.error || e.message);
    if (!isExporting) toast('Something went wrong: ' + (e.message || 'unknown error'), 'error');
});
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled rejection:', e.reason);
    if (!isExporting) toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error');
});

function checkExportCapability() {
    const missing = [];
    if (typeof WebAssembly === 'undefined') missing.push('WebAssembly');
    if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.toBlob !== 'function') missing.push('canvas image encoding');
    if (typeof TextEncoder === 'undefined') missing.push('text encoding');
    if (missing.length) {
        toast('This browser is missing: ' + missing.join(', ') + '. MP4 export is unavailable — try a current Chrome, Edge, Firefox, or Safari release.', 'error');
        $('exportBtn').disabled = true;
        $('exportBottom').disabled = true;
        return false;
    }
    return true;
}

startSingleRenderLoop();
init();
checkExportCapability();

window.addEventListener('beforeunload', function() {
    if (renderLoopId) cancelAnimationFrame(renderLoopId);
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (backgroundURL) URL.revokeObjectURL(backgroundURL);
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    if (media.video) { media.video.pause(); media.video.src = ''; }
    audio.pause();
    audio.src = '';
    try { window.kefeExportAbort?.abort(); } catch (e) {}
});
