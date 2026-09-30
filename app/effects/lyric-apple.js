/* =========================================================================
 * APPLE MUSIC LYRICS EFFECT (Standalone Module)
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

function estimateFinalVocalWordEnd(words, nextLineTime = Infinity) {
    if (!Array.isArray(words) || !words.length) return null;
    const last = words[words.length - 1];
    const start = Number(last.time);
    if (!Number.isFinite(start)) return null;
    const gaps = [];
    for (let i = 0; i < words.length - 1; i++) {
        const a = Number(words[i].time), b = Number(words[i + 1].time);
        const gap = b - a;
        if (Number.isFinite(gap) && gap >= 0.08 && gap <= 1.8) gaps.push(gap);
    }
    const cadence = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0.48;
    const letters = Array.from(String(last.text || "").replace(/[^\p{L}\p{N}]/gu, "")).length;
    const textDuration = linaClamp(0.24 + letters * 0.055, 0.28, 1.15);
    const cadenceDuration = linaClamp(cadence * 1.10, 0.28, 1.25);
    let duration = Math.max(textDuration, cadenceDuration);
    duration = linaClamp(duration, 0.28, 1.35);
    let end = start + duration;
    if (Number.isFinite(nextLineTime)) end = Math.min(end, Math.max(start + 0.12, nextLineTime - 0.08));
    return end;
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

function appleWordsForLine(line) {
    if (Array.isArray(line?.words) && line.words.length) {
        return line.words.map(w => ({ ...w, estimated: false }));
    }
    return [];
}

function appleKeyframeLerp(ed, points) {
    if (ed <= points[0][0]) return points[0][1];
    if (ed >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (let i = 0; i < points.length - 1; i++) {
        const [ed0, v0] = points[i];
        const [ed1, v1] = points[i + 1];
        if (ed >= ed0 && ed <= ed1) {
            const t = (ed - ed0) / (ed1 - ed0);
            return v0 + (v1 - v0) * t;
        }
    }
    return points[points.length - 1][1];
}

function appleCubicBezier(t, x1, y1, x2, y2) {
    t = linaClamp(t);
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = u => ((ax * u + bx) * u + cx) * u;
    const sampleY = u => ((ay * u + by) * u + cy) * u;
    const sampleDX = u => (3 * ax * u + 2 * bx) * u + cx;
    let u = t;
    for (let i = 0; i < 8; i++) {
        const dx = sampleX(u) - t;
        if (Math.abs(dx) < 1e-4) break;
        const d = sampleDX(u);
        if (Math.abs(d) < 1e-6) break;
        u -= dx / d;
    }
    return sampleY(linaClamp(u));
}

function appleSpringOut(t) {
    t = linaClamp(t);
    const c1 = 1.2, c3 = c1 + 1;
    const u = t - 1;
    return 1 + c3 * u * u * u + c1 * u * u;
}

function drawAppleEffect(ctx, w, h, style, lines, time, albumArtworkImage) {
    if (!Array.isArray(lines) || !lines.length) return;

    const baseDimension = Math.min(w, h);
    const aspectRatio = w / Math.max(1, h);
    const compositionWidth = aspectRatio < 0.75 ? w * 0.84 : (aspectRatio < 1.25 ? w * 0.78 : w * 0.72);
    const horizontalPadding = compositionWidth * (31 / 390);
    const contentWidth = Math.max(1, compositionWidth - horizontalPadding * 2);
    const activeFontSize = baseDimension * (32 / 390);
    const inactiveFontSize = baseDimension * (29 / 390);
    const lineSpacing = baseDimension * (5 / 390);
    const contract = window.KEFE_TYPE?.effects?.apple || {};
    const family = `"${contract.family || 'SF Pro Display'}",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    const boundaryLeft = Math.max(0, (w - compositionWidth) / 2);
    const margin = boundaryLeft + horizontalPadding;
    const maxWidth = contentWidth;
    const displayLines = [];

    for (let li = 0; li < lines.length; li++) {
        const original = linaNormaliseLine(lines, li);
        if (!original) continue;
        const text = String(original.text || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        displayLines.push({ ...original, text });
    }

    ctx.save();
    ctx.font = `${contract.weight || 700} ${activeFontSize}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const line of displayLines) {
        const words = appleWordsForLine(line);
        const tokens = words.length ? words.map(word => String(word.text || '').trim()).filter(Boolean) : String(line.text || '').split(' ').filter(Boolean);
        const rows = [];
        let row = '';
        for (const token of tokens) {
            const candidate = row ? `${row} ${token}` : token;
            if (row && ctx.measureText(candidate).width > maxWidth) {
                rows.push(row);
                row = token;
            } else {
                row = candidate;
            }
        }
        if (row) rows.push(row);
        if (!rows.length) rows.push(String(line.text || ''));
        line.appleRows = rows;
        line.appleRowCount = rows.length;
        line.appleBlockHeight = rows.length * activeFontSize * 1.18 + Math.max(0, rows.length - 1) * lineSpacing;
    }
    ctx.restore();
    const activeIndex = Math.max(0, linaFindActiveLine(displayLines, time));

    const source = albumArtworkImage;
    let palette = source?.__kefeApplePalette;
    if (source && !palette) {
        try {
            const sample = document.createElement('canvas');
            sample.width = 32;
            sample.height = 32;
            const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
            const sw = source.videoWidth || source.naturalWidth || source.width;
            const sh = source.videoHeight || source.naturalHeight || source.height;
            if (sampleCtx && sw && sh) {
                sampleCtx.drawImage(source, 0, 0, sw, sh, 0, 0, 32, 32);
                const data = sampleCtx.getImageData(0, 0, 32, 32).data;
                const buckets = Array.from({ length: 12 }, () => ({ r: 0, g: 0, b: 0, n: 0, lum: 0 }));
                for (let p = 0; p < data.length; p += 4) {
                    const a = data[p + 3] / 255;
                    if (a < 0.2) continue;
                    const r0 = data[p], g0 = data[p + 1], b0 = data[p + 2];
                    const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
                    const sat = mx ? (mx - mn) / mx : 0;
                    const lum = (0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0) / 255;
                    const hue = Math.atan2(Math.sqrt(3) * (g0 - b0), 2 * r0 - g0 - b0);
                    const bucket = sat < 0.12 ? 11 : Math.min(10, Math.floor(((hue + Math.PI) / (Math.PI * 2)) * 11));
                    const weight = a * (0.45 + sat);
                    buckets[bucket].r += r0 * weight;
                    buckets[bucket].g += g0 * weight;
                    buckets[bucket].b += b0 * weight;
                    buckets[bucket].n += weight;
                    buckets[bucket].lum += lum * weight;
                }
                const ranked = buckets.filter(bucket => bucket.n).sort((a, b) => {
                    const av = a.lum / a.n, bv = b.lum / b.n;
                    return (b.n * (0.65 + bv)) - (a.n * (0.65 + av));
                });
                const selected = [];
                for (const bucket of ranked) {
                    const color = { r: bucket.r / bucket.n, g: bucket.g / bucket.n, b: bucket.b / bucket.n };
                    if (selected.every(item => Math.hypot(color.r - item.r, color.g - item.g, color.b - item.b) >= 28)) {
                        selected.push(color);
                    }
                    if (selected.length >= 6) break;
                }
                palette = selected;
                if (palette.length) source.__kefeApplePalette = palette;
            }
        } catch (_) {
            palette = null;
        }
    }

    ctx.save();
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, w, h);
    if (palette?.length) {
        const positions = [
            [0.12, 0.18],
            [0.52, 0.12],
            [0.88, 0.22],
            [0.20, 0.72],
            [0.58, 0.82],
            [0.88, 0.68]
        ];
        const radii = [0.82, 0.78, 0.84, 0.86, 0.80, 0.84];
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.48;
        for (let pi = 0; pi < Math.min(6, palette.length); pi++) {
            const color = palette[pi];
            const gradient = ctx.createRadialGradient(
                w * positions[pi][0], h * positions[pi][1], 0,
                w * positions[pi][0], h * positions[pi][1], Math.max(w, h) * radii[pi]
            );
            gradient.addColorStop(0, 'rgb(' + Math.round(color.r * 0.62) + ' ' + Math.round(color.g * 0.62) + ' ' + Math.round(color.b * 0.62) + ')');
            gradient.addColorStop(0.55, 'rgb(' + Math.round(color.r * 0.34) + ' ' + Math.round(color.g * 0.34) + ' ' + Math.round(color.b * 0.34) + ')');
            gradient.addColorStop(1, 'rgba(8,8,8,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    const displayLine = activeIndex >= 0 ? displayLines[activeIndex] : null;
    if (activeIndex < 0 || !displayLine) return;

    const appleLineSpacing = linaClamp(Number(style.appleLineSpacing) || 0.58, 0.45, 1.10);
    const lineHeight = activeFontSize * 1.18 + appleLineSpacing;
    const rowHeight = activeFontSize * 1.18;
    const blockGap = baseDimension * (24 / 390);
    const upcomingOpacity = linaClamp(Number(style.appleInactiveOpacity) ?? 0.30, 0.20, 0.40);
    const pastOpacity = linaClamp(upcomingOpacity * 0.72, 0.20, 0.30);
    const visibleLines = Math.round(linaClamp(Number(style.appleVisibleLines) || 4, 2, 6));
    const appleHeaderSize = baseDimension * 0.08;
    const appleHeaderTop = Math.max(24, h * 0.035);
    const appleHeaderBottom = appleHeaderTop + appleHeaderSize;
    const activeBlockHeight = displayLine.appleBlockHeight || rowHeight;
    const topAnchor = Math.max(
        h * linaClamp(Number(style.appleTopOffset) || 0.50, 0.40, 0.60),
        appleHeaderBottom + activeBlockHeight / 2 + blockGap
    );
    const activeScale = 1;

    const active = linaNormaliseLine(displayLines, activeIndex);
    if (!active) return;

    const posT = appleSpringOut((time - active.time) / 0.35);
    const styleT = appleCubicBezier((time - active.time) / 0.3, 0.25, 0.1, 0.25, 1);

    const scalePoints = [[-1, 1], [0, activeScale], [1, 1]];
    const opacityPoints = [[-2, pastOpacity], [-1, upcomingOpacity], [0, 1], [1, upcomingOpacity], [2, pastOpacity]];
    const blurPoints = [[-2, activeFontSize * 0.07], [-1, activeFontSize * 0.035], [0, 0], [1, activeFontSize * 0.035], [2, activeFontSize * 0.07], [3, activeFontSize * 0.07], [4, activeFontSize * 0.07]];

    const previousBlock = displayLines[activeIndex - 1];
    const transitionShift = previousBlock
        ? ((previousBlock.appleBlockHeight || rowHeight) + (displayLine.appleBlockHeight || rowHeight)) / 2 + blockGap
        : (displayLine.appleBlockHeight || rowHeight) + blockGap;

    for (let i = Math.max(0, activeIndex - 2); i <= Math.min(displayLines.length - 1, activeIndex + visibleLines); i++) {
        const line = displayLines[i];
        if (!line || !String(line.text || '').trim()) continue;

        const distance = i - activeIndex;
        let settledOffset = 0;
        if (distance > 0) {
            for (let oi = activeIndex; oi < i; oi++) {
                settledOffset += ((displayLines[oi]?.appleBlockHeight || rowHeight) / 2)
                    + ((displayLines[oi + 1]?.appleBlockHeight || rowHeight) / 2)
                    + blockGap;
            }
        } else if (distance < 0) {
            for (let oi = activeIndex; oi > i; oi--) {
                settledOffset -= ((displayLines[oi]?.appleBlockHeight || rowHeight) / 2)
                    + ((displayLines[oi - 1]?.appleBlockHeight || rowHeight) / 2)
                    + blockGap;
            }
        }

        const edStyle = distance + (1 - styleT);
        const isActiveRow = distance === 0;
        const words = appleWordsForLine(line);
        const rows = line.appleRows || [String(line.text || '').trim()];
        const x = margin;
        const y = topAnchor + settledOffset + (1 - posT) * transitionShift;
        const scaleAmt = appleKeyframeLerp(edStyle, scalePoints);
        const alphaAmt = linaClamp(appleKeyframeLerp(edStyle, opacityPoints), 0, 1);
        const blurAmt = appleKeyframeLerp(edStyle, blurPoints);

        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.globalAlpha = alphaAmt;
        const rowFontSize = isActiveRow ? activeFontSize : inactiveFontSize;
        ctx.font = `${contract.weight || 700} ${rowFontSize}px ${family}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.translate(x, y);
        ctx.scale(scaleAmt, scaleAmt);
        ctx.translate(-x, -y);

        if (isActiveRow) {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.filter = 'none';
        } else {
            const visibleBlur = Math.max(0, blurAmt);
            ctx.filter = 'blur(' + visibleBlur.toFixed(2) + 'px)';
            ctx.shadowColor = 'rgba(255,255,255,0.22)';
            ctx.shadowBlur = visibleBlur * 0.75;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        const rowYs = rows.map((_, ri) => y + (ri - (rows.length - 1) / 2) * (rowHeight + lineSpacing));
        if (!isActiveRow || !words.length) {
            ctx.fillStyle = isActiveRow ? '#FFFFFF' : '#FFFFFF';
            rows.forEach((rowText, ri) => ctx.fillText(rowText, x, rowYs[ri]));
        } else {
            let wordIndex = 0;
            const easeWindow = 0.10;
            for (let ri = 0; ri < rows.length; ri++) {
                const rowTokens = rows[ri].split(/\s+/).filter(Boolean);
                let cursorX = x;
                for (let ti = 0; ti < rowTokens.length; ti++) {
                    const word = words[wordIndex + ti];
                    const wordText = String(word?.text || rowTokens[ti]);
                    const wordWidth = ctx.measureText(wordText).width;
                    const spaceWidth = ctx.measureText(' ').width;
                    const wordTime = Number(word?.time);
                    const wordEndTime = Number(word?.endTime);
                    let progress = 0;
                    if (Number.isFinite(wordTime) && time >= wordTime) {
                        progress = Number.isFinite(wordEndTime) && wordEndTime > wordTime
                            ? linaSmooth((time - wordTime) / Math.min(easeWindow, wordEndTime - wordTime))
                            : 1;
                    }
                    ctx.fillStyle = 'rgba(255,255,255,0.30)';
                    ctx.fillText(wordText, cursorX, rowYs[ri]);
                    if (progress > 0) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(cursorX - 2, rowYs[ri] - rowHeight * 0.62, wordWidth * progress + 4, rowHeight * 1.24);
                        ctx.clip();
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillText(wordText, cursorX, rowYs[ri]);
                        ctx.restore();
                    }
                    cursorX += wordWidth + spaceWidth;
                }
                wordIndex += rowTokens.length;
            }
        }
        ctx.restore();
    }
}

window.kefeEffects = window.kefeEffects || {};
window.kefeEffects.apple = drawAppleEffect;
window.dispatchEvent(new Event('kefe-effects-ready'));
