(() => {
  'use strict';
/* =========================================================================
 * ETERNAL SUNSHINE EFFECT (Standalone Module)
 * ========================================================================= */

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const linaSmooth = (value) => { const t = linaClamp(value); return t * t * (3 - 2 * t); };
const linaSmoother = (value) => { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
const linaSeededRandom = (seed) => { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
const hasFiniteNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function linaNormaliseLine(lines, index) {
    if (!Array.isArray(lines) || index < 0 || index >= lines.length) return null;
    const source = lines[index];
    const start = Number(source.time) || 0;
    const nextLineTime = hasFiniteNumber(lines[index + 1]?.time) ? Number(lines[index + 1].time) : null;
    const end = hasFiniteNumber(source.endTime) ? Number(source.endTime) : (nextLineTime !== null ? nextLineTime : start + 3);
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (source.words && source.words.length > 0 && hasFiniteNumber(source.words[source.words.length - 1]?.endTime) ? Number(source.words[source.words.length - 1].endTime) : end);
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

const MAX_INK_CACHE_SIZE = 50;
let eternalFontReady = false;
let eternalFontPromise = null;
const eternalInkCache = new Map();

async function ensureEternalFont() {
    if (eternalFontReady) return true;
    if (eternalFontPromise) return eternalFontPromise;
    eternalFontPromise = (async () => {
        try {
            try { await document.fonts.load('76px "Homemade Apple"'); } catch (e) {}
            if (document.fonts && document.fonts.ready) {
                try { await document.fonts.ready; } catch (e) {}
            }
            if (document.fonts && typeof document.fonts.check === 'function') {
                eternalFontReady = document.fonts.check('76px "Homemade Apple"');
                if (!eternalFontReady) eternalFontReady = true;
            } else {
                eternalFontReady = true;
            }
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
    while (cache.textWidth > maxWidth && size > 14) { size -= 2; cache = makeInkRowCache(text, size); if (!cache) return null; }
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

function getEternalSubjectParts(text) {
    const stopWords = new Set(["about","after","again","against","being","could","every","from","have","into","just","like","more","most","only","over","said","some","than","that","them","then","there","these","they","this","those","through","very","what","when","where","which","while","with","would","your","you","are","and","but","for","not","the","was","were","will","his","her","she","him","our","out","all","can","did","does","had","has","how","its","let","may","off","one","who"]);
    const matches = [...text.matchAll(/[A-Za-zÀ-ž’'-]+/g)];
    if (!matches.length) return { prefix: text, subject: "", suffix: "" };
    const ranked = matches.map(m => ({ word: m[0], index: m.index, score: m[0].replace(/[^A-Za-zÀ-ž]/g, "").length, common: stopWords.has(m[0].toLowerCase()) }));
    const candidates = ranked.filter(x => !x.common && x.score >= 3);
    const chosen = (candidates.length ? candidates : ranked).sort((a, b) => b.score - a.score || a.index - b.index)[0];
    return { prefix: text.slice(0, chosen.index).trimEnd(), subject: chosen.word, suffix: text.slice(chosen.index + chosen.word.length).trimStart() };
}

function drawEternalSunshineEffect(ctx, w, h, style, lines, time) {
    if (!eternalFontReady) {
        ensureEternalFont();
        const ci = linaFindActiveLine(lines, time);
        if (ci < 0) return;
        const line = linaNormaliseLine(lines, ci);
        if (!line || !line.text) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = style.eternalInkColor || style.textColor || '#FFF';
        let size = Math.max(20, Math.min(150, Number(style.fontSize) || 76));
        ctx.font = '400 ' + size + 'px "Homemade Apple", cursive, serif';
        while (size > 14 && ctx.measureText(String(line.text)).width > w * 0.86) { size -= 2; ctx.font = '400 ' + size + 'px "Homemade Apple", cursive, serif'; }
        ctx.fillText(String(line.text), w / 2, h * 0.58);
        ctx.restore();
        return;
    }
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
        const parts = getEternalSubjectParts(text);
        const targetSize = linaClamp(baseSize * sizes[slot], 20, 150);
        const duration = Math.max(0.001, line.endTime - line.time);
        const rawProgress = linaClamp((time - line.time) / (duration * Math.max(0.20, writeSpan)));
        const progress = linaSmoother(rawProgress);
        const inkOptions = { inkColor, penWidth, glow };
        const maxWidth = Math.max(40, w - margin * 2.3);
        const prefixFit = parts.prefix ? fitEternalText(parts.prefix, targetSize, maxWidth) : null;
        const suffixFit = parts.suffix ? fitEternalText(parts.suffix, targetSize, maxWidth) : null;
        const subjectFit = parts.subject ? fitEternalText(parts.subject, targetSize * 5, maxWidth) : null;
        const normalWordFit = parts.subject ? fitEternalText(parts.subject, targetSize, maxWidth) : null;
        if (!subjectFit || !normalWordFit) continue;
        const prefixWidth = prefixFit ? prefixFit.cache.textWidth : 0;
        const suffixWidth = suffixFit ? suffixFit.cache.textWidth : 0;
        const wordSlotWidth = normalWordFit.cache.textWidth;
        const fullWidth = prefixWidth + wordSlotWidth + suffixWidth;
        const vh = Math.max(prefixFit ? prefixFit.cache.ascent + prefixFit.cache.descent : 0,
            suffixFit ? suffixFit.cache.ascent + suffixFit.cache.descent : 0,
            normalWordFit.cache.ascent + normalWordFit.cache.descent);
        const placement = getEternalPlacement(positions[slot], w, h, fullWidth, vh, margin);
        let alpha = getEternalLineAlpha(slot, group, time);
        if (finalLine) {
            const fd = Math.max(0.20, finalLine.endTime - finalLine.time);
            const cs = finalLine.endTime - Math.min(0.65, Math.max(0.30, fd * 0.18));
            if (time > cs) alpha *= 1 - linaSmooth((time - cs) / Math.min(0.65, Math.max(0.30, fd * 0.18)));
        }
        const isWriting = rawProgress > 0 && rawProgress < 1;
        const writeEnergy = isWriting ? Math.sin(rawProgress * Math.PI) : 0;
        const popScale = 1 + presence * 0.018 * writeEnergy;
        const bloom = targetSize * (glow / 100 + presence * 0.055 * writeEnergy);
        const echoAlpha = alpha * presence * 0.13 * writeEnergy;
        const lineX = linaClamp(placement.x, margin, Math.max(margin, w - margin - fullWidth));
        const lineY = placement.y;
        const subjectCentreX = lineX + prefixWidth + wordSlotWidth / 2;
        const drawPiece = (fit, x, y) => {
            if (!fit) return;
            const cache = fit.cache;
            const rendered = renderInkRow(cache, progress, { ...inkOptions, fontSize: fit.fontSize });
            if (!rendered) return;
            const drawX = x - cache.padding, drawY = y - cache.padding;
            if (echoAlpha > 0.001) {
                ctx.save(); ctx.globalAlpha = echoAlpha; ctx.shadowColor = inkColor;
                ctx.shadowBlur = bloom * 1.7;
                ctx.drawImage(rendered, drawX + fit.fontSize * 0.012, drawY + fit.fontSize * 0.010);
                ctx.restore();
            }
            ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = inkColor;
            ctx.shadowBlur = fit.fontSize * (glow / 100 + presence * 0.055 * writeEnergy);
            ctx.drawImage(rendered, drawX, drawY); ctx.restore();
        };
        ctx.save();
        ctx.translate(lineX + fullWidth / 2, lineY + vh / 2);
        ctx.scale(popScale, popScale);
        ctx.translate(-(lineX + fullWidth / 2), -(lineY + vh / 2));
        drawPiece(prefixFit, lineX, lineY);
        drawPiece(suffixFit, lineX + prefixWidth + wordSlotWidth, lineY);
        const subjectCache = subjectFit.cache;
        const subjectY = Math.max(margin, lineY - subjectCache.ascent * 0.88);
        drawPiece(subjectFit, subjectCentreX - subjectCache.textWidth / 2, subjectY);
        ctx.restore();
    }
    ctx.restore();
}

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.eternal = drawEternalSunshineEffect;
})();
