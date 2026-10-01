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

function drawPulseEffect(ctx, w, h, style, lines, time) {
    const line = activeEffectLine(lines, time);
    if (!line) return;
    const text = String(line.text || '').trim();
    if (!text) return;

    const amplitude = linaClamp(Number(style.pulseAmplitude) || 0.4, 0.05, 1);
    const glowSize = Number(style.pulseGlowSize) || 1;
    const colour = style.accentColor || '#FFFFFF';
    const fontSize = Number(style.fontSize) || 76;
    const lineStart = Number(line.time) || 0;
    const lineEnd = Math.max(lineStart + 0.4, Number(line.endTime) || lineStart + 3);
    const tokens = text.split(/\s+/).filter(Boolean);
    if (!tokens.length) return;

    const perWord = Array.isArray(line.words) && line.words.length === tokens.length
        ? line.words.map((w, i) => ({
            text: tokens[i],
            start: Number(w.time) || lineStart + (i / tokens.length) * (lineEnd - lineStart),
            end: Number(w.endTime) || lineStart + ((i + 1) / tokens.length) * (lineEnd - lineStart)
        }))
        : tokens.map((t, i) => ({
            text: t,
            start: lineStart + (i / tokens.length) * (lineEnd - lineStart),
            end: lineStart + ((i + 1) / tokens.length) * (lineEnd - lineStart)
        }));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const contract = window.KEFE_TYPE?.effects?.pulse || {};
    ctx.font = `${contract.weight || 400} ${fontSize}px "${contract.family || "AuraSerif"}",Arial,sans-serif`;
    const spaceW = ctx.measureText(' ').width;
    const widths = perWord.map(w => ctx.measureText(w.text).width);
    const totalW = widths.reduce((a, b) => a + b, 0) + spaceW * (perWord.length - 1);
    const startX = (w - totalW) / 2;
    const y = h * 0.46;
    let cursorX = startX;
    for (let i = 0; i < perWord.length; i++) {
        const word = perWord[i];
        const duration = Math.max(0.001, word.end - word.start);
        const local = linaClamp((time - word.start) / duration);
        const pulse = linaSmoother(Math.sin(local * Math.PI));
        const scale = 1 + amplitude * 0.28 * pulse;
        const glow = fontSize * 0.10 * glowSize * pulse;
        const alpha = time < word.start ? 0.28 : time >= word.end ? 0.88 : 1.0;
        const cx = cursorX + widths[i] / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.shadowColor = colour;
        ctx.shadowBlur = glow;
        ctx.translate(cx, y);
        ctx.scale(scale, scale);
        ctx.fillText(word.text, -widths[i] / 2, 0);
        ctx.restore();
        cursorX += widths[i] + spaceW;
    }
    ctx.restore();
}

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.pulse = drawPulseEffect;
})();
