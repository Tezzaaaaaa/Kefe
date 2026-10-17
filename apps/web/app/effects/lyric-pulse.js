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

function drawPulseLine(ctx, w, h, style, line, next, time, phase) {
    const text = String(line.text || '').trim();
    if (!text) return;
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
    } else timedRows.push(perWord);

    ctx.save();
    ctx.globalAlpha = linaClamp(phase.alpha);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cy = h * 0.43;
    const rowH = size * 1.12;
    const rowCount = timedRows.length;
    const lineY = (1 - phase.enter) * size * 0.18 - phase.leave * size * 0.2;
    const traceY = cy + lineY + rowH * (rowCount - 1) * 0.5 + size * 0.72;
    const beatPeriod = 1.05;
    const beatPhase = ((time % beatPeriod) + beatPeriod) % beatPeriod / beatPeriod;
    const traceAmplitude = Math.min(h * 0.17, size * (0.44 + amplitude * 0.38));
    const xStep = Math.max(2, Math.min(4, w / 300));
    const points = [];
    for (let x = 0; x <= w + xStep; x += xStep) {
        const p = ((x / w) + beatPhase) % 1;
        const bump = (center, width, height) => height * Math.exp(-0.5 * Math.pow((p - center) / width, 2));
        let y = traceY;
        y -= bump(0.19, 0.035, traceAmplitude * 0.16);
        y += bump(0.385, 0.012, traceAmplitude * 0.18);
        y -= bump(0.415, 0.009, traceAmplitude);
        y += bump(0.447, 0.014, traceAmplitude * 0.38);
        y -= bump(0.64, 0.065, traceAmplitude * 0.29);
        points.push([x, y]);
    }
    const drawTrace = (blur, alpha, width, stroke) => {
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.shadowColor = colour;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        points.forEach((point, i) => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
        ctx.stroke();
        ctx.restore();
    };
    drawTrace(size * 0.22 * glowSize, 0.22, size * 0.12, colour);
    drawTrace(size * 0.08 * glowSize, 0.85, Math.max(1.4, size * 0.025), colour);

    const headX = ((time * 0.42) % 1) * w;
    const headWidth = Math.max(w * 0.1, size * 1.5);
    const gradient = ctx.createLinearGradient(Math.max(0, headX - headWidth), 0, Math.max(1, headX), 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = size * 0.16 * glowSize;
    ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1]));
    ctx.stroke();
    ctx.restore();

    timedRows.forEach((rowWords, ri) => {
        const widths = rowWords.map(word => ctx.measureText(word.text).width);
        const spaceW = ctx.measureText(' ').width;
        const totalW = widths.reduce((a, b) => a + b, 0) + spaceW * (rowWords.length - 1);
        let cursorX = (w - totalW) / 2;
        const y = cy + lineY + (ri - (rowCount - 1) / 2) * rowH;
        for (let i = 0; i < rowWords.length; i++) {
            const word = rowWords[i];
            const wp = U.wordProgress({ time: word.start, endTime: word.end }, time, 0.09);
            const pulse = linaSmoother(wp.pulse);
            const scale = 1 + amplitude * 0.12 * pulse;
            const alpha = linaClamp((0.3 + 0.7 * wp.pre) * (1 - 0.1 * linaSmoother((time - word.end) / 0.35) * (wp.started ? 1 : 0)));
            const cx = cursorX + widths[i] / 2;
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.translate(cx, y);
            ctx.scale(scale, scale);
            ctx.strokeStyle = colour;
            ctx.lineWidth = Math.max(1.1, size * 0.018);
            ctx.shadowColor = colour;
            ctx.shadowBlur = size * (0.09 + pulse * 0.1) * glowSize;
            ctx.strokeText(word.text, -widths[i] / 2, 0);
            ctx.globalAlpha *= 0.16 + pulse * 0.12;
            ctx.fillStyle = colour;
            ctx.fillText(word.text, -widths[i] / 2, 0);
            ctx.restore();
            cursorX += widths[i] + spaceW;
        }
    });

    const beatX = ((0.415 - beatPhase + 1) % 1) * w;
    const beatY = traceY - traceAmplitude;
    const beatStrength = 0.55 + 0.45 * Math.sin(time * Math.PI * 2 / beatPeriod) ** 2;
    ctx.save();
    ctx.globalAlpha *= beatStrength;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = colour;
    ctx.shadowBlur = size * 0.24 * glowSize;
    ctx.beginPath();
    ctx.arc(beatX, beatY, Math.max(1.5, size * 0.025), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
}
function drawPulseEffect(ctx, w, h, style, lines, time) {
    const stack = window.kefeEffectUtils.lineStack(lines, time);
    for (const it of stack) drawPulseLine(ctx, w, h, style, it.line, it.next, time, it);
}

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.pulse = drawPulseEffect;
})();
