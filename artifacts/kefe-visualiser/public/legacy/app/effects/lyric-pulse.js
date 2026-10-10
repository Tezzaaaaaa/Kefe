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

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const contract = window.KEFE_TYPE?.effects?.pulse || {};
    const face = `${contract.weight || 400}`, fam = contract.family || 'AuraSerif';
    const setF = (c, sz) => { c.font = `${face} ${sz}px "${fam}",Arial,sans-serif`; };
    const lay = U.layoutText(ctx, text, { setFont: setF, size: fontSize, minSize: 18, maxWidth: w * 0.86, maxHeight: h * 0.8, lineHeight: 1.12, maxLines: 6 });
    const size = lay.size;
    setF(ctx, size);
    const spaceW = ctx.measureText(' ').width;
    // Map the timed words onto the wrapped rows, in order.
    const rowsTokens = lay.lines.map(t => t.split(' ').filter(Boolean));
    const flat = rowsTokens.reduce((n, r) => n + r.length, 0);
    const rowsWords = [];
    if (flat === perWord.length) { let k = 0; rowsTokens.forEach(r => { rowsWords.push(r.map(() => perWord[k++])); }); }
    else rowsWords.push(perWord);
    const rowH = lay.lineH, cy = h * 0.46;
    // whole-line motion: gentle rise in, drift up and out when replaced (crossfade with the next line)
    const lineY = (1 - phase.enter) * size * 0.28 - phase.leave * size * 0.26;
    ctx.globalAlpha = linaClamp(phase.alpha);
    rowsWords.forEach((rowWords, ri) => {
        const widths = rowWords.map(wd => ctx.measureText(wd.text).width);
        const totalW = widths.reduce((a, b) => a + b, 0) + spaceW * (rowWords.length - 1);
        let cursorX = (w - totalW) / 2;
        const y = cy + lineY + (ri - (rowsWords.length - 1) / 2) * rowH;
        for (let i = 0; i < rowWords.length; i++) {
            const word = rowWords[i];
            const wp = U.wordProgress({ time: word.start, endTime: word.end }, time, 0.09);
            // pulse peaks mid-word and is fully settled at the word's end; very short words still get a soft bump
            const pulse = linaSmoother(wp.pulse);
            const scale = 1 + amplitude * 0.28 * pulse;
            const glow = size * 0.10 * glowSize * pulse;
            // unsung 0.28 -> sung 1.0 (anticipated slightly before the word) -> settled 0.88, all eased (no stepped alpha)
            const alpha = (0.28 + 0.72 * wp.pre) * 1 - 0.12 * linaSmoother((time - word.end) / 0.35) * (wp.started ? 1 : 0);
            const cx = cursorX + widths[i] / 2;
            ctx.save();
            ctx.globalAlpha *= linaClamp(alpha);
            ctx.fillStyle = colour;
            ctx.shadowColor = colour;
            ctx.shadowBlur = glow;
            ctx.translate(cx, y);
            ctx.scale(scale, scale);
            ctx.fillText(word.text, -widths[i] / 2, 0);
            ctx.restore();
            cursorX += widths[i] + spaceW;
        }
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
