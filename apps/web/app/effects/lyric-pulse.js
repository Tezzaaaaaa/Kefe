(() => {
  'use strict';
/* =========================================================================
 * PULSE EFFECT (Standalone Module)
 * ========================================================================= */

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const linaSmooth = (value) => { const t = linaClamp(value); return t * t * (3 - 2 * t); };
const linaSmoother = (value) => { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };
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

function activeEffectLine(lines, time) {
    const index = linaFindActiveLine(lines, time);
    return index >= 0 ? linaNormaliseLine(lines, index) : null;
}

/* Per-word timing aligned 1:1 with the whitespace tokens of the line. Real word timing when it lines up, else the engine's vocal-capped estimate. */
function pulseWords(line, next, tokens) {
    const U = window.kefeEffectUtils;
    let words = U.wordsFor(line, next);
    if (words.length !== tokens.length) {
        const model = window.kefeLyricModel;
        const start = Number(line.time) || 0, end = Number(line.endTime) || start + 3;
        words = model ? model.estimateWords(line.text, start, end, true) : tokens.map((t, i) => ({ text: t, time: start + (i / tokens.length) * (end - start), endTime: start + ((i + 1) / tokens.length) * (end - start) }));
    }
    return tokens.map((t, i) => ({ text: t, start: Number(words[i].time), end: Number(words[i].endTime) }));
}

const pulseGeometryCache = new Map();
const PULSE_GEOMETRY_CACHE_LIMIT = 8;

function pulseGlyphGeometry(ctx, words, width, size, setFont) {
    const key = [width, size, ctx.font, words.map(word => word.text).join(' ')].join('|');
    if (pulseGeometryCache.has(key)) {
        const cached = pulseGeometryCache.get(key);
        pulseGeometryCache.delete(key);
        pulseGeometryCache.set(key, cached);
        return cached;
    }
    // Build a 2x mask so contour geometry retains smooth curves at large export sizes.
    const scale = 2, mask = document.createElement('canvas');
    const maskHeight = Math.max(1, Math.ceil(size * 1.55 * scale));
    const baseline = maskHeight / scale * 0.72;
    mask.height = maskHeight;
    const maskMargin = 6;
    // Measure offscreen: geometry generation must not mutate the live render context.
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return null;
    setFont(measureCtx, size);
    const textWidths = words.map(word => measureCtx.measureText(word.text).width);
    const spaceWidth = measureCtx.measureText(' ').width;
    const totalWidth = textWidths.reduce((sum, value) => sum + value, 0) + spaceWidth * (words.length - 1);
    const centeredStart = Math.max(0, (width - totalWidth) / 2);
    mask.width = Math.max(1, Math.ceil((totalWidth + maskMargin * 2) * scale));
    const mctx = mask.getContext('2d', { willReadFrequently: true });
    if (!mctx) return null;
    mctx.scale(scale, scale);
    setFont(mctx, size);
    mctx.textBaseline = 'alphabetic';
    mctx.textAlign = 'left';
let cursor = centeredStart;
    const wordRanges = words.map((word, i) => {
        const range = { startX: cursor, endX: cursor + textWidths[i], text: word.text };
        mctx.fillStyle = '#FFFFFF';
        mctx.fillText(word.text, cursor - centeredStart + maskMargin, baseline);
        cursor += textWidths[i] + spaceWidth;
        return range;
    });
    let pixels;
    try { pixels = mctx.getImageData(0, 0, mask.width, mask.height).data; }
    catch (_) { return null; }
    const mw = mask.width, mh = mask.height, ink = new Uint8Array(mw * mh);
    for (let i = 0; i < ink.length; i++) ink[i] = pixels[i * 4 + 3] > 64 ? 1 : 0;
    pixels = null;

    // Marching squares follows the real letter silhouette, preserving counters.
    const segments = [];
    const edge = (x, y, side) => side === 0 ? [x + 0.5, y]
        : side === 1 ? [x + 1, y + 0.5]
        : side === 2 ? [x + 0.5, y + 1] : [x, y + 0.5];
    const pairs = [[], [[3,0]], [[0,1]], [[3,1]], [[1,2]], [], [[0,2]], [[3,2]],
        [[2,3]], [[0,2]], [], [[1,2]], [[3,1]], [[0,1]], [[3,0]], []];
    for (let y = 0; y < mh - 1; y++) {
        let idx = y * mw;
        for (let x = 0; x < mw - 1; x++, idx++) {
            const code = ink[idx] | (ink[idx + 1] << 1) | (ink[idx + mw + 1] << 2) | (ink[idx + mw] << 3);
            if (!code || code === 15) continue;
            const cellPairs = code === 5 ? [[0,1],[2,3]] : code === 10 ? [[0,3],[1,2]] : pairs[code];
            for (const pair of cellPairs) segments.push([edge(x, y, pair[0]), edge(x, y, pair[1])]);
        }
    }
    const pointKey = p => Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);
    const adjacency = new Map();
    segments.forEach((seg, i) => {
        for (let e = 0; e < 2; e++) {
            const k = pointKey(seg[e]);
            if (!adjacency.has(k)) adjacency.set(k, []);
            adjacency.get(k).push([i, e]);
        }
    });
    const used = new Uint8Array(segments.length), contours = [];
    for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        used[i] = 1;
        const points = [segments[i][0], segments[i][1]];
        let current = segments[i][1], guard = 0;
        while (guard++ < segments.length) {
            const options = adjacency.get(pointKey(current)) || [];
            let nextSegment = -1, nextEnd = -1;
            for (const option of options) {
                if (!used[option[0]]) { nextSegment = option[0]; nextEnd = option[1]; break; }
            }
            if (nextSegment < 0) break;
            used[nextSegment] = 1;
            current = segments[nextSegment][1 - nextEnd];
            if (pointKey(current) === pointKey(points[0])) break;
            points.push(current);
        }
        if (points.length < 5) continue;
        const simplified = [points[0]];
        let last = points[0];
        for (let p = 1; p < points.length - 1; p++) {
            const candidate = points[p];
            if (Math.hypot(candidate[0] - last[0], candidate[1] - last[1]) >= 0.8) {
                simplified.push(candidate);
                last = candidate;
            }
        }
        simplified.push(points[points.length - 1]);
        if (simplified.length < 4) continue;
        const avgX = centeredStart + simplified.reduce((sum, p) => sum + p[0] / scale - maskMargin, 0) / simplified.length;
        const wordIndex = wordRanges.findIndex(r => avgX >= r.startX - 1 && avgX <= r.endX + 1);
        // Tiny detached details (for example the dot on an i) are assigned by
        // their horizontal centre; retain the nearest word rather than dropping ink.
        const nearestWord = wordIndex >= 0 ? wordIndex : wordRanges.reduce((best, range, index) => {
            const distance = avgX < range.startX ? range.startX - avgX : avgX > range.endX ? avgX - range.endX : 0;
            return distance < best.distance ? { index, distance } : best;
        }, { index: -1, distance: Infinity }).index;
        if (nearestWord < 0) continue;
        contours.push({ wordIndex: nearestWord, points: simplified.map(p => [centeredStart + p[0] / scale - maskMargin, p[1] / scale - baseline]) });
    }
    const contoursByWord = Array.from({ length: words.length }, () => []);
    for (const contour of contours) {
        if (contoursByWord[contour.wordIndex]) contoursByWord[contour.wordIndex].push(contour);
    }
    const geometry = { contours, contoursByWord, wordRanges, baseline, size };
    pulseGeometryCache.set(key, geometry);
    while (pulseGeometryCache.size > PULSE_GEOMETRY_CACHE_LIMIT) pulseGeometryCache.delete(pulseGeometryCache.keys().next().value);
    return geometry;
}
function drawPulseLine(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim();
    if (!text || !w || !h) return;
    const U = window.kefeEffectUtils;
    const amplitude = linaClamp(Number(style.pulseAmplitude) || 0.4, 0.05, 1);
    const glowSize = Number(style.pulseGlowSize) || 1;
    const colour = style.accentColor || '#FFFFFF';
    const fontSize = Number(style.fontSize) || 76;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const perWord = pulseWords(line, next, tokens);
    const contract = window.KEFE_TYPE?.effects?.pulse || {};
    const face = String(contract.weight || 400), fam = contract.family || 'AuraSerif';
    const setF = (c, sz) => { c.font = face + ' ' + sz + 'px "' + fam + '",Arial,sans-serif'; };
    const layout = U.layoutText(ctx, text, {
        setFont: setF, size: fontSize, minSize: 18, maxWidth: w * 0.88,
        maxHeight: h * 0.58, lineHeight: 1.12, maxLines: 4
    });
    const size = layout.size;
    setF(ctx, size);
    const rows = layout.lines.map(row => row.split(/\s+/).filter(Boolean));
    const flattened = rows.reduce((n, row) => n + row.length, 0);
    const timedRows = [];
    if (flattened === perWord.length) {
        let k = 0;
        rows.forEach(row => timedRows.push(row.map(() => perWord[k++])));
    } else {
        timedRows.push(perWord);
    }

    const rowHeight = size * 1.12;
    const rowCount = timedRows.length;
    const cy = h * 0.43;
    const lineY = (1 - phase.enter) * size * 0.18 - phase.leave * size * 0.2;
    const firstY = cy + lineY - ((rowCount - 1) * rowHeight) / 2;
    const beatPeriod = 1.05;
    const beatPhase = ((time % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
    const traceAmplitude = Math.min(h * 0.17, size * (0.44 + amplitude * 0.38));
    const beatOffset = ((beatPhase - 0.415 + 1.5) % 1) - 0.5;
    const beatPulse = Math.exp(-0.5 * Math.pow(beatOffset / 0.035, 2));

    ctx.save();
    ctx.globalAlpha *= linaClamp(phase.alpha);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 8;

    timedRows.forEach((rowWords, rowIndex) => {
        if (!rowWords.length) return;
        const geometry = pulseGlyphGeometry(ctx, rowWords, w, size, setF);
        if (!geometry) return;
        const traceY = firstY + rowIndex * rowHeight + size * 0.18;
        const contoursByWord = geometry.contoursByWord || [];
        const ranges = geometry.wordRanges;
        rowWords.forEach((word, wordIndex) => {
            const timing = U.wordProgress({ time: word.start, endTime: word.end }, time, 0.09);
            const reveal = linaClamp(timing.sweep);
            if (reveal <= 0.002) return;
            const range = ranges[wordIndex];
            if (!range) return;
            const startX = Math.max(0, range.startX);
            const endX = Math.min(w, range.startX + (range.endX - range.startX) * reveal);
            if (endX <= startX) return;
            const beatAt = x => {
                const p = ((x / Math.max(1, w)) + beatPhase) % 1;
                const bump = (center, width, height) => height * Math.exp(-0.5 * Math.pow((p - center) / width, 2));
                const qrsOffset = ((p - 0.415 + 1.5) % 1) - 0.5;
                const qrsPulse = Math.exp(-0.5 * Math.pow(qrsOffset / 0.026, 2));
                return bump(0.19, 0.035, traceAmplitude * 0.12) - bump(0.385, 0.012, traceAmplitude * 0.16)
                    + bump(0.415, 0.009, traceAmplitude * (0.48 + qrsPulse * 0.3))
                    - bump(0.447, 0.014, traceAmplitude * 0.28) + bump(0.64, 0.065, traceAmplitude * 0.2);
            };
            const traceY = firstY + rowIndex * rowHeight + size * 0.18;
            const tracePath = new Path2D();
            // Geometry is bucketed by word once; avoid rescanning every contour for
            // every token and avoid allocating a transformed point array each frame.
            for (const contour of (contoursByWord[wordIndex] || [])) {
                const pts = contour.points;
                if (pts.length < 4) continue;
                const pointY = point => traceY + point[1] * 0.76 + beatAt(point[0]) * 0.24;
                const first = pts[0], last = pts[pts.length - 1];
                tracePath.moveTo((last[0] + first[0]) * 0.5, (pointY(last) + pointY(first)) * 0.5);
                for (let i = 0; i < pts.length; i++) {
                    const current = pts[i], nextPoint = pts[(i + 1) % pts.length];
                    tracePath.quadraticCurveTo(
                        current[0], pointY(current),
                        (current[0] + nextPoint[0]) * 0.5,
                        (pointY(current) + pointY(nextPoint)) * 0.5
                    );
                }
                tracePath.closePath();
            }

            // One cached path keeps the glow, core and specular pass geometrically identical.
            ctx.save();
            ctx.beginPath();
            ctx.rect(startX - 1, -h, Math.max(1, endX - startX + 2), h * 3);
            ctx.clip();

            ctx.save();
            ctx.strokeStyle = colour;
            ctx.lineWidth = Math.max(1.6, size * 0.026);
            ctx.shadowColor = colour;
            ctx.shadowBlur = size * 0.12 * glowSize;
            ctx.globalAlpha *= 0.2 + beatPulse * 0.08;
            ctx.stroke(tracePath);
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = colour;
            ctx.lineWidth = Math.max(1.1, size * 0.012);
            ctx.shadowColor = colour;
            ctx.shadowBlur = size * 0.035 * glowSize;
            ctx.globalAlpha *= 0.78 + 0.22 * timing.pulse;
            ctx.stroke(tracePath);
            ctx.restore();

            const headX = (((0.415 - beatPhase) + 1) % 1) * w, headWidth = Math.max(w * 0.1, size * 1.5);
            const gradient = ctx.createLinearGradient(headX - headWidth * 0.5, 0, headX + headWidth * 0.5, 0);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(0.38, 'rgba(255,255,255,0.12)');
            gradient.addColorStop(0.5, 'rgba(255,255,255,0.96)');
            gradient.addColorStop(0.62, 'rgba(255,255,255,0.12)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.save();
            ctx.strokeStyle = gradient;
            ctx.lineWidth = Math.max(1.2, size * 0.018);
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = size * 0.075 * glowSize;
            ctx.stroke(tracePath);
            ctx.restore();
            ctx.restore();
        });
    });
    ctx.restore();
}
function drawPulseEffect(ctx, w, h, style, lines, time) {
    const stack = window.kefeEffectUtils.lineStack(lines, time);
    for (const it of stack) drawPulseLine(ctx, w, h, style, it.line, it.next, time, it);
}

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.pulse = drawPulseEffect;
})();
