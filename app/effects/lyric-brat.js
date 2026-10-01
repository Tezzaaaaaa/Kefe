(() => {
  'use strict';
/* =========================================================================
 * BRAT EFFECT (Standalone Module)
 * ========================================================================= */

const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
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

function buildBratWords(lines) {
    const output = [];
    for (let i = 0; i < lines.length; i++) {
        const line = linaNormaliseLine(lines, i);
        if (!line) continue;
        const words = appleWordsForLine(line, lines[i + 1] || null);
        for (const w of words) output.push({ ...w, globalIndex: output.length });
    }
    return output;
}

function setBratFont(ctx, fontSize) {
    ctx.font = `700 ${fontSize}px "Archivo Narrow",Arial,sans-serif`;
    ctx.textAlign = "left"; 
    ctx.textBaseline = "alphabetic";
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

  window.kefeEffects = window.kefeEffects || {};
  window.kefeEffects.brat = drawBratEffect;
})();
