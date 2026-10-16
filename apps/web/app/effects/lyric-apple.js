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


/* Apple Music-style lyric fill.
   One soft-edged highlight glides continuously across each row (linear within a word, short glide
   across the space to the next), so there is no per-word stop/start. Letters float up as the
   highlight reaches them (eased, driven by the same front position, so the lift and the fill are
   always in sync) and settle back as the line scrolls away. Sustained words get a soft glow. */
const APPLE_WAVE = { lift: 0.075, pop: 0.02, dim: 0.18, fade: 0.55, riseSpan: 0.9, glowDur: 0.9 };
const appleLetterCache = new Map();
const appleRowCache = new Map();
const APPLE_OFFSCREEN = 20000;

function appleLetterBox(ctx, token) {
    const key = ctx.font + '|' + token;
    let hit = appleLetterCache.get(key);
    if (hit) return hit;
    const chars = Array.from(token), xs = [], ws = [];
    let acc = '';
    for (const ch of chars) {
        const a = ctx.measureText(acc).width;
        acc += ch;
        const b = ctx.measureText(acc).width;
        xs.push(a);
        ws.push(Math.max(0.001, b - a));
    }
    hit = { chars, xs, ws, W: Math.max(1, ctx.measureText(token).width) };
    appleLetterCache.set(key, hit);
    if (appleLetterCache.size > 2500) appleLetterCache.delete(appleLetterCache.keys().next().value);
    return hit;
}

/* Blur that works everywhere (ctx.filter is missing on Safari/iOS): draw the glyph far off-canvas and
   let its blurred shadow land back in place. shadowBlur ~= 2 x CSS blur radius. */
function appleBlurText(ctx, text, x, y, blurPx, color, scale) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blurPx * 2;
    ctx.shadowOffsetX = APPLE_OFFSCREEN;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#000';
    ctx.fillText(text, x - APPLE_OFFSCREEN / Math.max(0.01, scale), y);
    ctx.restore();
}

/* Position of the highlight front (px) for one row of timed tokens at `time`. */
function appleFrontPos(entries, time) {
    const first = entries[0];
    if (time <= first.t0) return first.x;
    for (let k = 0; k < entries.length; k++) {
        const en = entries[k];
        const endX = en.x + en.box.W;
        if (time < en.t1) {
            if (time >= en.t0) return en.x + en.box.W * linaClamp((time - en.t0) / Math.max(0.05, en.t1 - en.t0));
            const prev = entries[k - 1];
            const prevEnd = prev.x + prev.box.W;
            const w = Math.min(0.14, Math.max(0.02, en.t0 - prev.t1));
            return prevEnd + (en.x - prevEnd) * linaSmooth((time - (en.t0 - w)) / w);
        }
        const next = entries[k + 1];
        if (!next) return endX;
        if (time < next.t0) {
            const w = Math.min(0.14, Math.max(0.02, next.t0 - en.t1));
            return endX + (next.x - endX) * linaSmooth((time - (next.t0 - w)) / w);
        }
    }
    const last = entries[entries.length - 1];
    return last.x + last.box.W;
}

function appleDrawRow(ctx, entries, y, fs, time, act, sungA, unsungA, P, scale, shadowBlur, shadowOff, blurPx) {
    const first = entries[0], last = entries[entries.length - 1];
    const xs = first.x, xe = last.x + last.box.W;
    const p = appleFrontPos(entries, time);
    const fade = fs * P.fade;
    const e = p + fade * linaClamp((p - xs) / Math.max(1, xe - xs));
    const sungColor = 'rgba(255,255,255,' + sungA.toFixed(3) + ')';
    const unsungColor = 'rgba(255,255,255,' + unsungA.toFixed(3) + ')';
    const grad = ctx.createLinearGradient(e - fade, 0, Math.max(e, e - fade + 0.01), 0);
    grad.addColorStop(0, sungColor);
    grad.addColorStop(1, unsungColor);
    const actK = linaSmooth(act);
    for (const en of entries) {
        const dur = Math.max(0.06, en.t1 - en.t0);
        const glowK = linaClamp((dur - P.glowDur) / 1.2);
        for (let k = 0; k < en.box.chars.length; k++) {
            const lx = en.x + en.box.xs[k], lw = en.box.ws[k], cx = lx + lw / 2;
            const q = linaSmoother((p - cx) / (fs * P.riseSpan) + 0.25);
            const lift = q * actK;
            ctx.save();
            if (lift > 0.002) {
                const py = y + fs * 0.2;
                const sc = 1 + lift * P.pop;
                ctx.translate(cx, py);
                ctx.scale(sc, sc);
                ctx.translate(-cx, -py - lift * P.lift * fs);
            }
            if (blurPx > 0.08) {
                appleBlurText(ctx, en.box.chars[k], lx, y, blurPx, sungColor, scale);
            } else {
                ctx.fillStyle = grad;
                if (glowK > 0 && lift > 0.01) {
                    ctx.shadowColor = 'rgba(255,255,255,' + (0.55 * glowK * lift).toFixed(3) + ')';
                    ctx.shadowBlur = fs * 0.35 * glowK * lift;
                    ctx.shadowOffsetY = 0;
                } else {
                    ctx.shadowColor = 'rgba(0,0,0,0.35)';
                    ctx.shadowBlur = shadowBlur;
                    ctx.shadowOffsetY = shadowOff;
                }
                ctx.fillText(en.box.chars[k], lx, y);
            }
            ctx.restore();
        }
    }
}

function drawAppleEffect(ctx, w, h, style, lines, time, albumArtworkImage) {
    if (!Array.isArray(lines) || !lines.length) return;

    const baseDimension = Math.min(w, h);
    const aspectRatio = w / Math.max(1, h);
    const landscapeSplit = aspectRatio >= 1.25;
    const compositionWidth = landscapeSplit ? w * 0.60 : (aspectRatio < 0.75 ? w * 0.84 : w * 0.78);
    const horizontalPadding = compositionWidth * (landscapeSplit ? 0.06 : (31 / 390));
    const contentWidth = Math.max(1, compositionWidth - horizontalPadding * 2);
    const activeFontSize = baseDimension * (32 / 390);
    const inactiveFontSize = baseDimension * (29 / 390);
    const lineSpacing = baseDimension * (5 / 390);
    const contract = window.KEFE_TYPE?.effects?.apple || {};
    const family = `"SF Pro Display","SF Pro Text","Inter Tight",system-ui,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    if (!drawAppleEffect._fontReq && document.fonts && document.fonts.load) {
        drawAppleEffect._fontReq = true;
        document.fonts.load('700 48px "Inter Tight"').catch(() => {});
        document.fonts.load('600 48px "Inter Tight"').catch(() => {});
    }
    const boundaryLeft = landscapeSplit ? w * 0.35 : Math.max(0, (w - compositionWidth) / 2);
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
    const rowCacheFont = ctx.font;
    for (const line of displayLines) {
        // Tokens come from line.text (same split the word-timing uses) so rows and
        // timings always line up 1:1.
        const cacheKey = rowCacheFont + '|' + maxWidth.toFixed(1) + '|' + line.text;
        let rows = appleRowCache.get(cacheKey);
        if (!rows) {
            const tokens = line.text.split(' ').filter(Boolean);
            rows = [];
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
            if (!rows.length) rows.push(line.text);
            appleRowCache.set(cacheKey, rows);
            if (appleRowCache.size > 800) appleRowCache.delete(appleRowCache.keys().next().value);
        }
        line.appleRows = rows;
        line.appleRowCount = rows.length;
        line.appleBlockHeight = rows.length * activeFontSize * 1.18 + Math.max(0, rows.length - 1) * lineSpacing;
    }
    ctx.restore();
    const activeIndex = linaFindActiveLine(displayLines, time);
    if (activeIndex < 0) return;

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

    // The lyric canvas is a transparent overlay. Album artwork/palette belongs
    // to the background/visualiser layer and must never paint an opaque layer
    // over the WebGL visualiser.

    const displayLine = activeIndex >= 0 ? displayLines[activeIndex] : null;
    if (activeIndex < 0 || !displayLine) return;

    const rowHeight = activeFontSize * 1.18;
    const blockGap = baseDimension * (24 / 390);
        const visibleLines = Math.round(linaClamp(Number(style.appleVisibleLines) || 4, 2, 6));
    const appleHeaderSize = baseDimension * 0.11;
    const appleHeaderTop = Math.max(baseDimension * 0.065, h * 0.035);
    const appleHeaderBottom = landscapeSplit ? 0 : Math.max(32, h * 0.07) + baseDimension * 0.11;
    const activeBlockHeight = displayLine.appleBlockHeight || rowHeight;
    const topAnchor = landscapeSplit
        ? h * 0.13 + Math.min(baseDimension * 0.38, w * 0.24) - activeBlockHeight / 2
        : appleHeaderBottom + activeBlockHeight / 2 + blockGap + (aspectRatio < 0.75 ? baseDimension * 0.07 : 0);
    const activeScale = 1;

    const active = linaNormaliseLine(displayLines, activeIndex);
    if (!active) return;

    const transitionDuration = linaClamp((Number(active.nextLineTime) - Number(active.time)) * 0.16, 0.18, 0.30);
    const posT = linaSmooth((time - active.time) / transitionDuration);

    const scalePoints = [[-4, 0.97], [-3, 0.97], [-2, 0.97], [-1, 0.97], [0, activeScale], [1, 0.97], [2, 0.97], [3, 0.97], [4, 0.97]];
    const opacityPoints = [[-4, 0.24], [-3, 0.28], [-2, 0.33], [-1, 0.40], [0, 1], [1, 0.42], [2, 0.36], [3, 0.30], [4, 0.26]];
    const blurPoints = [[-4, activeFontSize * 0.26], [-3, activeFontSize * 0.2], [-2, activeFontSize * 0.14], [-1, activeFontSize * 0.075], [0, 0], [1, activeFontSize * 0.075], [2, activeFontSize * 0.14], [3, activeFontSize * 0.2], [4, activeFontSize * 0.26]];

    /* Continuous scroll: every line is positioned and styled from one fractional "focus" index so
       nothing pops when the active line changes – position, size, opacity, blur and the white
       highlight all interpolate together (like Apple Music). */
    const focus = activeIndex > 0 ? activeIndex - 1 + posT : 0;
    const heightOf = i => (displayLines[i]?.appleBlockHeight || rowHeight);
    const cum = [0];
    for (let i = 1; i < displayLines.length; i++) cum[i] = cum[i - 1] + heightOf(i - 1) / 2 + heightOf(i) / 2 + blockGap;
    const fl = Math.max(0, Math.min(displayLines.length - 1, Math.floor(focus)));
    const fn1 = Math.min(displayLines.length - 1, fl + 1);
    const focusY = cum[fl] + (cum[fn1] - cum[fl]) * (focus - fl);

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    try { ctx.fontKerning = 'normal'; ctx.textRendering = 'geometricPrecision'; } catch (_) {}
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let i = Math.max(0, activeIndex - 2); i <= Math.min(displayLines.length - 1, activeIndex + visibleLines); i++) {
        const line = displayLines[i];
        if (!line || !String(line.text || '').trim()) continue;

        const d = i - focus;
        const act = linaClamp(1 - Math.abs(d), 0, 1);           // 1 = fully focused, 0 = fully inactive
        const words = appleWordsForLine(line);
        const rows = line.appleRows || [String(line.text || '').trim()];
        const x = margin;
        const y = topAnchor + cum[i] - focusY;
        const scaleAmt = appleKeyframeLerp(d, scalePoints);
        const lineHeightForFade = line.appleBlockHeight || rowHeight;
        const topFade = landscapeSplit ? 1 : linaClamp((y + lineHeightForFade / 2 - (appleHeaderBottom - lineHeightForFade * 0.8)) / Math.max(1, lineHeightForFade * 0.72), 0, 1);
        const alphaAmt = linaClamp(appleKeyframeLerp(d, opacityPoints), 0, 1) * topFade;
        const blurAmt = i === activeIndex ? 0 : Math.max(0, appleKeyframeLerp(d, blurPoints));
        const rowFontSize = inactiveFontSize + (activeFontSize - inactiveFontSize) * act;

        ctx.save();
        ctx.font = `${contract.weight || 700} ${rowFontSize.toFixed(2)}px ${family}`;
        ctx.translate(x, y);
        ctx.scale(scaleAmt, scaleAmt);
        ctx.translate(-x, -y);

        const rowYs = rows.map((_, ri) => y + (ri - (rows.length - 1) / 2) * (rowHeight + lineSpacing));
        const baseShadowBlur = Math.max(2, baseDimension * (1.2 / 390));
        const baseShadowOff = Math.max(1, baseDimension * (0.5 / 390));

        // Word timing for the line being sung and the one that just finished.
        const utils = window.kefeEffectUtils;
        const tokens = line.text.split(' ').filter(Boolean);
        let times = null;
        if (utils?.tokenTimes && i === activeIndex) {
            try {
                const timed = utils.tokenTimes(line, displayLines[i + 1], tokens);
                if (timed.length === tokens.length && timed.every(v => Number.isFinite(v.time) && Number.isFinite(v.endTime))) times = timed;
            } catch (_) { times = null; }
        }

        if (times) {
            // Alpha is baked into the colours (not globalAlpha) so the unsung/sung contrast stays right
            // while the line fades in as it becomes active.
            const P = Object.assign({}, APPLE_WAVE, {
                lift: Number.isFinite(Number(style.appleLetterLift)) ? Number(style.appleLetterLift) : APPLE_WAVE.lift,
                dim: linaClamp(Number.isFinite(Number(style.appleUnsungOpacity)) ? Number(style.appleUnsungOpacity) : APPLE_WAVE.dim, 0.15, 0.9)
            });
            const sungA = alphaAmt;
            const unsungA = Math.min(alphaAmt, P.dim);
            const spaceWidth = ctx.measureText(' ').width;
            let ti = 0;
            for (let ri = 0; ri < rows.length; ri++) {
                const rowTokens = rows[ri].split(' ').filter(Boolean);
                const entries = [];
                let cursorX = x;
                for (let k = 0; k < rowTokens.length; k++) {
                    const box = appleLetterBox(ctx, rowTokens[k]);
                    const tm = times[ti + k];
                    entries.push({ x: cursorX, box, t0: tm.time, t1: Math.max(tm.endTime, tm.time + 0.06) });
                    cursorX += box.W + spaceWidth;
                }
                ti += rowTokens.length;
                if (entries.length) appleDrawRow(ctx, entries, rowYs[ri], rowFontSize, time, act, sungA, unsungA, P, scaleAmt, baseShadowBlur, baseShadowOff, blurAmt);
            }
        } else {
            // Upcoming / older lines (or no usable word timing): dim white, blurred by distance.
            ctx.globalAlpha = alphaAmt;
            if (blurAmt > 0.08) {
                rows.forEach((rowText, ri) => appleBlurText(ctx, rowText, x, rowYs[ri], blurAmt, 'rgb(255,255,255)', scaleAmt));
            } else {
                ctx.fillStyle = 'rgb(255,255,255)';
                ctx.shadowColor = 'rgba(0,0,0,0.45)';
                ctx.shadowBlur = baseShadowBlur;
                ctx.shadowOffsetY = baseShadowOff;
                rows.forEach((rowText, ri) => ctx.fillText(rowText, x, rowYs[ri]));
            }
        }
        ctx.restore();
    }
    ctx.restore();
}

window.kefeEffects = window.kefeEffects || {};
window.kefeEffects.apple = drawAppleEffect;
window.dispatchEvent(new Event('kefe-effects-ready'));
