/* =========================================================================
 * AURORA EFFECT (Standalone Module)
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

function linaFindActiveLine(lines, time) {
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
        if (hasFiniteNumber(lines[i].time) && time >= Number(lines[i].time)) index = i;
        else break;
    }
    return index;
}

function fitCentredEffectText(ctx, text, baseSize, maxWidth, weight, family) {
    const face = family || '"Open Sans"';
    let size = Number(baseSize) || 76;
    ctx.font = `${weight} ${size}px ${face},Arial,sans-serif`;
    while (size > 30 && ctx.measureText(text).width > maxWidth) {
        size -= 2;
        ctx.font = `${weight} ${size}px ${face},Arial,sans-serif`;
    }
    return size;
}

function activeEffectLine(lines, time) {
    const index = linaFindActiveLine(lines, time);
    return index >= 0 ? linaNormaliseLine(lines, index) : null;
}

export function drawAuroraEffect(ctx, w, h, style, lines, time) {
    const line = activeEffectLine(lines, time);
    if (!line) return;
    const text = String(line.text || '').trim();
    if (!text) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = w * 0.84;
    const size = fitCentredEffectText(ctx, text, style.fontSize, maxWidth, 500, '"Bricolage Grotesque"');
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
