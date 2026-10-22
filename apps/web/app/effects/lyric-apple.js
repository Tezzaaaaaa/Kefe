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
    const startValue = source.time ?? source.startTime;
    const start = Number(startValue) || 0;
    const nextSource = lines[index + 1];
    const nextStartValue = nextSource?.time ?? nextSource?.startTime;
    const nextLineTime = hasFiniteNumber(nextStartValue) ? Number(nextStartValue) : null;
    const endValue = source.endTime ?? source.end;
    const end = hasFiniteNumber(endValue) ? Number(endValue) : (nextLineTime !== null ? nextLineTime : start + 3);
    const words = Array.isArray(source.words) ? source.words.map(word => ({
        ...word,
        text: String(word.text ?? word.word ?? '').trim(),
        time: word.time ?? word.startTime,
        endTime: word.endTime ?? word.end
    })) : source.words;
    const vocalEnd = hasFiniteNumber(source.vocalEndTime) ? Number(source.vocalEndTime) :
        (words && words.length > 0 && hasFiniteNumber(words[words.length - 1]?.endTime) ? Number(words[words.length - 1].endTime) : end);
    return {
        ...source,
        text: String(source.text ?? source.lyric ?? ''),
        time: start,
        endTime: end,
        words,
        translation: source.translation ?? source.translatedLyric ?? source.translationText ?? '',
        romanization: source.romanization ?? source.romanLyric ?? source.romanizedLyric ?? '',
        vocalEndTime: vocalEnd,
        nextLineTime
    };
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


/* Apple Music-style lyric fill — a 1:1 port of the reference player (apple-lyrics-standalone.html).
   Everything is WHITE; only alpha changes:
     sung part of the active line  = white @ 1.0
     unsung part / every other line = white @ dim (0.32), then multiplied by the line's distance fade
   No grey RGB values and no drop shadows (both made the old version look dark and muddy).
   Each letter is filled with its own soft-edged horizontal gradient whose front is driven by the
   word's timing, so the sweep is sub-pixel smooth instead of stepping letter by letter.
   Lift / pop / glow are pure functions of time per letter (rise before the front arrives, cosine
   settle after), so nothing is driven by hard per-word switches. */
// Measured from an iOS Apple Music screen recording: unsung words of the line being sung sit at ~46% white,
// every other line at ~28% (then blurred by distance); sung letters rise ~7% of the font size.
const APPLE_WAVE = { lift: 0.07, pop: 0.04, glow: 0.8, glowSize: 0.38, soft: 0.35, fall: 0.28, dim: 0.28, activeDim: 0.46 };
const appleLetterCache = new Map();
const appleRowCache = new Map();
const APPLE_OFFSCREEN = 20000;

function appleTextWidth(ctx, text) {
    return ctx.measureText(String(text || '')).width;
}

function appleLetterBox(ctx, token) {
    const key = ctx.font + '|' + token;
    let hit = appleLetterCache.get(key);
    if (hit) return hit;
    const chars = Array.from(token), xs = [], ws = [];
    let prefix = '';
    for (const ch of chars) {
        const start = ctx.measureText(prefix).width;
        prefix += ch;
        const end = ctx.measureText(prefix).width;
        xs.push(start);
        ws.push(Math.max(0.001, end - start));
    }
    hit = { chars, xs, ws, W: Math.max(1, ctx.measureText(token).width) };
    appleLetterCache.set(key, hit);
    if (appleLetterCache.size > 2500) appleLetterCache.delete(appleLetterCache.keys().next().value);
    return hit;
}

/* Blur that works everywhere (ctx.filter is missing on Safari/iOS): draw the glyph far off-canvas and
   let its blurred shadow land back in place. `blurRadius` is the CSS-equivalent radius, in the glyph's
   own (pre-transform) pixels. Shadow offset/blur are device-space, so both are scaled by the current
   transform; this keeps it correct under the row scale and the per-letter pop scale. */
function appleShadowText(ctx, text, x, y, blurRadius, color, cssFilterBlur) {
    const m = ctx.getTransform ? ctx.getTransform() : null;
    const sx = m ? (Math.hypot(m.a, m.b) || 1) : 1;
    ctx.save();
    ctx.shadowColor = color;
    // filter: blur(r) has sigma = r, canvas shadowBlur has sigma = shadowBlur / 2.
    // text-shadow radius R has sigma = R / 2, so shadowBlur = R.
    ctx.shadowBlur = (cssFilterBlur ? blurRadius * 2 : blurRadius) * sx;
    ctx.shadowOffsetX = APPLE_OFFSCREEN;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#000';
    ctx.fillText(text, x - APPLE_OFFSCREEN / sx, y);
    ctx.restore();
}

const appleWhite = alpha => 'rgba(255,255,255,' + linaClamp(alpha).toFixed(4) + ')';

/* One row of timed words. `entries`: [{x, box, t0, t1}] (t0/t1 = the word's own start/end).
   lineA = distance fade of the whole line, hi = alpha of the sung part (1 while live, eases to dim after). */
function appleDrawRow(ctx, entries, y, fs, time, P, lineA, hi, blurPx) {
    const dim = P.dim;
    const useBlur = blurPx > 0.04;
    for (const en of entries) {
        const dur = Math.max(0.05, en.t1 - en.t0);
        const progress = linaClamp((time - en.t0) / dur);
        const edgeSoft = linaClamp(P.soft * 0.16, 0.025, 0.10);
        const front = progress * (1 + edgeSoft * 2) - edgeSoft;
        const W = en.box.W;
        const charCount = en.box.chars.length;
        const amp = en.explicitTiming && dur >= 0.72 ? 0.48 : 0.68;
        for (let k = 0; k < charCount; k++) {
            const lx = en.x + en.box.xs[k], lw = en.box.ws[k];
            const a = en.box.xs[k] / W, b = (en.box.xs[k] + lw) / W;
            const wd = Math.max(0.0005, b - a);
            const charCenter = (a + b) / 2;
            const alphaAt = u => {
                const wordPosition = a + u * wd;
                const sweep = linaSmooth((front - wordPosition + edgeSoft) / (2 * edgeSoft));
                return (dim + (hi - dim) * sweep) * lineA;
            };
            const ch = en.box.chars[k];
            // Mexican-wave timing: neighbouring glyphs rise with a small overlap,
            // creating a connected travelling ripple rather than isolated letter jumps.
            // The wave changes only the approach timing; once lifted, each glyph stays up.
            const waveLead = 0.035;
            const liftProgress = linaClamp((front - charCenter + edgeSoft + waveLead) / (2 * edgeSoft));
            // Slow, sustained sweeps keep the glyph rise almost imperceptible; quicker
            // sweeps recover the normal Apple-style lift without a threshold snap.
            const slowSweep = linaSmooth((dur - 0.34) / 0.86);
            const liftStrength = 1 - slowSweep * 0.82;
            const lift = P.lift * liftStrength * linaSmoother(liftProgress);
            ctx.save();
            if (lift > 0.001) {
                const ox = lx + lw / 2, oy = y + fs * 0.46, sc = 1 + lift * P.pop;
                ctx.translate(0, -lift * fs);
                ctx.translate(ox, oy);
                ctx.scale(sc, sc);
                ctx.translate(-ox, -oy);
            }
            if (useBlur) {
                appleShadowText(ctx, ch, lx, y, blurPx, appleWhite(alphaAt(0.5)), true);
            } else {
                const g = ctx.createLinearGradient(lx, 0, lx + lw, 0);
                const stops = new Map();
                const addStop = position => {
                    const p = linaClamp(position);
                    stops.set(p, alphaAt(p));
                };
                addStop(0);
                addStop(1);
                for (const edge of [front - edgeSoft, front - edgeSoft * 0.5, front, front + edgeSoft * 0.5, front + edgeSoft]) {
                    addStop((edge - a) / wd);
                }
                for (const [position, alpha] of [...stops.entries()].sort((left, right) => left[0] - right[0])) {
                    g.addColorStop(position, appleWhite(alpha));
                }
                ctx.fillStyle = g;
                ctx.fillText(ch, lx, y);
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
    // Match the replacement's 100 × 216.4 portrait layout and 384 × 216.4 landscape split,
    // scaled to KEFE's canvas instead of relying on its standalone HTML/CSS viewport.
    const compositionWidth = landscapeSplit ? w * (186 / 384) : w * 0.836;
    const horizontalPadding = 0;
    const contentWidth = Math.max(1, compositionWidth - horizontalPadding * 2);
    // The landscape title card is confined to the left ~34% of the canvas; lyrics use the separate right column (x=180/384, width=186/384). Size lyrics against that column's height/width balance, not against the title-card artwork itself.
    const activeFontSize = landscapeSplit ? h * (13.6 / 216.4) : (aspectRatio >= 0.9 ? w * (5.6 / 100) : w * (5.2 / 100));
    // Apple Music keeps every lyric line at (almost) the same size; only blur/opacity change with distance.
    const inactiveFontSize = activeFontSize * 0.98;
    // Row pitch inside a line is ~1.25 x font size on iOS.
    const lineSpacing = activeFontSize * 0.07;
    const contract = window.KEFE_TYPE?.effects?.apple || {};
    const family = `"SF Pro Display","SF Pro Text","Inter Tight",system-ui,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    if (!drawAppleEffect._fontReq && document.fonts && document.fonts.load) {
        drawAppleEffect._fontReq = true;
        document.fonts.load('700 48px "Inter Tight"').catch(() => {});
        document.fonts.load('600 48px "Inter Tight"').catch(() => {});
    }
    const boundaryLeft = landscapeSplit
        ? w * (180 / 384)
        : (aspectRatio < 0.9 ? w * 0.07 : w * 0.08) + baseDimension * 0.183;
    const margin = boundaryLeft + horizontalPadding;
    let maxWidth = contentWidth;
    const displayLines = [];

    for (let li = 0; li < lines.length; li++) {
        const original = linaNormaliseLine(lines, li);
        if (!original) continue;
        const sourceText = String(original.text || (Array.isArray(original.words) ? original.words.map(word => word.text).join(' ') : '')).replace(/\s+/g, ' ').trim();
        // A musical-note marker denotes a cue line, not lyric text: route it to the existing animated three-dot renderer.
        const text = /[\u2669-\u266f]/u.test(sourceText) ? '…' : sourceText;
        if (!text) continue;
        displayLines.push({ ...original, text });
    }

    ctx.save();
    ctx.font = `${contract.weight || 700} ${activeFontSize}px ${family}`;
    try { ctx.fontKerning = 'normal'; } catch (_) {}
    // Offset by the width of two glyphs, not a fixed pixel value, so the adjustment scales with the lyric typography.
    const twoLetterOffset = appleTextWidth(ctx, 'MM');
    const horizontalLyricShift = landscapeSplit ? -twoLetterOffset : 0;
    // Measure wrapping against the actual right safe boundary after the aspect-specific x offset.
    // Keep a rendering buffer inside the visible safety boundary for glyph overhang and per-letter lift.
    maxWidth = Math.max(1, w * 0.92 - (margin + horizontalLyricShift));
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
                if (row && appleTextWidth(ctx, candidate) > maxWidth) {
                    rows.push(row);
                    row = '';
                }
                if (appleTextWidth(ctx, token) <= maxWidth) {
                    row = row ? row + ' ' + token : token;
                    continue;
                }
                // A single overlong word must also wrap at glyph boundaries, never past the safe zone.
                for (const glyph of Array.from(token)) {
                    const next = row + glyph;
                    if (row && appleTextWidth(ctx, next) > maxWidth) {
                        rows.push(row);
                        row = glyph;
                    } else {
                        row = next;
                    }
                }
            }
            if (row) rows.push(row);
            if (!rows.length) rows.push(line.text);
            appleRowCache.set(cacheKey, rows);
            if (appleRowCache.size > 800) appleRowCache.delete(appleRowCache.keys().next().value);
        }
        line.appleRows = rows;
        line.appleRowCount = rows.length;
        line.appleMainHeight = rows.length * activeFontSize * 1.18 + Math.max(0, rows.length - 1) * lineSpacing;

        // Optional translation and romanization are rendered as a compact secondary block.
        // They are only shown when the supplied lyric data actually contains them.
        const secondaryText = [line.translation, line.romanization]
            .map(value => String(value || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        const secondaryFontSize = activeFontSize * 0.42;
        const secondaryRowHeight = secondaryFontSize * 1.3;
        const secondaryGap = secondaryText.length ? secondaryFontSize * 0.7 : 0;
        const secondaryRows = [];
        if (secondaryText.length) {
            ctx.save();
            ctx.font = `${contract.weight || 700} ${secondaryFontSize}px ${family}`;
            for (const text of secondaryText) {
                let secondaryRow = '';
                for (const token of text.split(' ').filter(Boolean)) {
                    if (appleTextWidth(ctx, token) > maxWidth) {
                        if (secondaryRow) {
                            secondaryRows.push(secondaryRow);
                            secondaryRow = '';
                        }
                        for (const glyph of Array.from(token)) {
                            const glyphCandidate = secondaryRow + glyph;
                            if (secondaryRow && appleTextWidth(ctx, glyphCandidate) > maxWidth) {
                                secondaryRows.push(secondaryRow);
                                secondaryRow = glyph;
                            } else {
                                secondaryRow = glyphCandidate;
                            }
                        }
                        continue;
                    }
                    const candidate = secondaryRow ? `${secondaryRow} ${token}` : token;
                    if (secondaryRow && appleTextWidth(ctx, candidate) > maxWidth) {
                        secondaryRows.push(secondaryRow);
                        secondaryRow = token;
                    } else {
                        secondaryRow = candidate;
                    }
                }
                if (secondaryRow) secondaryRows.push(secondaryRow);
            }
            ctx.restore();
        }
        line.appleSecondaryRows = secondaryRows;
        line.appleSecondaryFontSize = secondaryFontSize;
        line.appleSecondaryRowHeight = secondaryRowHeight;
        line.appleSecondaryGap = secondaryRows.length ? secondaryGap : 0;
        line.appleSecondaryHeight = secondaryRows.length * secondaryRowHeight + Math.max(0, secondaryRows.length - 1) * lineSpacing * 0.45;
        line.appleBlockHeight = line.appleMainHeight + (secondaryRows.length ? secondaryGap + line.appleSecondaryHeight : 0);
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
    const blockGap = activeFontSize * 0.74;
        const visibleLines = Math.round(linaClamp(Number(style.appleVisibleLines) || 4, 2, 6));
    const appleHeaderSize = baseDimension * 0.11;
    const appleHeaderTop = Math.max(baseDimension * 0.065, h * 0.035);
    const appleHeaderBottom = landscapeSplit ? 0 : Math.max(32, h * 0.07) + baseDimension * 0.11;
    const artworkTop = aspectRatio < 0.75 ? baseDimension * 0.18 : Math.max(32, h * 0.12);
    // Keep each aspect ratio anchored to its own composition rather than to the
    // active lyric block's changing wrap height.
    const topAnchor = landscapeSplit
        ? h * 0.50
        : artworkTop + activeFontSize * 0.5 + (aspectRatio >= 0.9 ? rowHeight + blockGap : 0);
    const activeScale = 1;

    const active = linaNormaliseLine(displayLines, activeIndex);
    if (!active) return;

    // Smoothly scroll between lyric lines only at the cue boundary. Keeping this
    // transition short preserves the fixed reading lane without drifting throughout
    // the whole cue.
    const nextLineTime = hasFiniteNumber(active.nextLineTime) ? Number(active.nextLineTime) : null;
    const transitionDuration = nextLineTime !== null
        ? linaClamp((nextLineTime - Number(active.time)) * 0.42, 0.48, 0.72)
        : 0;
    const posT = nextLineTime !== null && transitionDuration > 0
        ? linaSmooth((time - (nextLineTime - transitionDuration)) / transitionDuration)
        : 0;

    const scalePoints = [[-4, 1], [-3, 1], [-2, 1], [-1, 1], [0, activeScale], [1, 1], [2, 1], [3, 1], [4, 1]];
    // Per-line fade + blur by distance from the focused line. Text is white; this scales the unsung alpha
    // (~0.28), so lines below read ~0.26 white and fade slowly with distance, matching the recording.
    const opacityPoints = [[-5, 0], [-4, 0.35], [-3, 0.55], [-2, 0.75], [-1, 0.9], [0, 1], [1, 1], [2, 0.95], [3, 0.85], [4, 0.7], [5, 0.55]];
    const blurUnit = activeFontSize / (landscapeSplit ? 12.6 : 7.9);
    const blurPoints = [[-5, 1.2], [-4, 1.2], [-3, 1.2], [-2, 0.7], [-1, 0.25], [0, 0], [1, 0.17], [2, 0.5], [3, 0.85], [4, 1.2], [5, 1.5]].map(([dd, m]) => [dd, m * blurUnit]);

    /* Continuous scroll: every line is positioned and styled from one fractional "focus" index so
       nothing pops when the active line changes – position, size, opacity, blur and the white
       highlight all interpolate together (like Apple Music). */
    const focus = activeIndex + posT;
    const heightOf = i => (displayLines[i]?.appleBlockHeight || rowHeight);
    const cum = [0];
    for (let i = 1; i < displayLines.length; i++) cum[i] = cum[i - 1] + heightOf(i - 1) / 2 + heightOf(i) / 2 + blockGap;
    const fl = Math.max(0, Math.min(displayLines.length - 1, Math.floor(focus)));
    const fn1 = Math.min(displayLines.length - 1, fl + 1);
    const focusY = cum[fl] + (cum[fn1] - cum[fl]) * (focus - fl);
    /* iOS scroll: every line rides the same ease, but lines further below the sung line start a beat later,
       so the stack "unfurls" instead of moving as one slab. Each line's scroll offset is the sum of the last
       few line-to-line steps, each with its own per-line delay, so nothing jumps when the active line changes. */
    const stepWindowStart = Math.max(0, activeIndex - 3);
    const stepWindowEnd = Math.min(displayLines.length - 2, activeIndex);
    const scrollOffsetFor = (i) => {
        let offset = cum[stepWindowStart];
        for (let j = stepWindowStart; j <= stepWindowEnd; j++) {
            const t0 = Number(displayLines[j].time), t1 = Number(displayLines[j + 1].time);
            if (!Number.isFinite(t0) || !Number.isFinite(t1)) { offset += cum[j + 1] - cum[j]; continue; }
            const dur = linaClamp((t1 - t0) * 0.42, 0.48, 0.72);
            const delay = Math.min(0.24, Math.max(0, i - (j + 1)) * 0.045);
            const p = linaSmooth((time - (t1 - dur) - delay) / dur);
            offset += (cum[j + 1] - cum[j]) * p;
        }
        return offset;
    };
    const isRightAligned = (line) => {
        const v = line.align ?? line.alignment ?? line.side ?? line.singer ?? line.agent ?? line.voice;
        return line.opposite === true || line.oppositeTurn === true || line.duet === true ||
            (typeof v === 'string' && /^(right|r|v2|2|secondary|opposite)$/i.test(v.trim())) || v === 2;
    };
    const rightEdge = w * 0.92;

    ctx.save();
    const layout=window.kefeAppleLayout?.lyrics;
    if(layout){ctx.translate(layout.x*w,layout.y*h);ctx.scale(layout.scale,layout.scale);}
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    try { ctx.fontKerning = 'normal'; ctx.textRendering = 'geometricPrecision'; } catch (_) {}
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const wave = Object.assign({}, APPLE_WAVE, {
        // Keep the letter rise subtle, including for older saved styles.
        lift: Number.isFinite(Number(style.appleLetterLift)) && Number(style.appleLetterLift) > 0
            ? linaClamp(Number(style.appleLetterLift), 0.06, 0.14)
            : APPLE_WAVE.lift,
        dim: linaClamp(Number.isFinite(Number(style.appleUnsungOpacity)) ? Number(style.appleUnsungOpacity) : APPLE_WAVE.dim, 0.15, 0.9)
    });

    for (let i = Math.max(0, activeIndex - 4); i <= Math.min(displayLines.length - 1, activeIndex + visibleLines + 1); i++) {
        const line = displayLines[i];
        if (!line || !String(line.text || '').trim()) continue;

        const d = i - focus;
        const act = linaClamp(1 - Math.abs(d), 0, 1);           // 1 = fully focused, 0 = fully inactive
        const rows = line.appleRows || [String(line.text || '').trim()];
        const x = margin + horizontalLyricShift;
        const y = topAnchor + cum[i] - scrollOffsetFor(i);
        const alignRight = isRightAligned(line);
        // Unsung alpha: the sung line's unsung words are brighter than the lines around it.
        const lineDim = wave.dim + (Math.min(0.9, wave.dim * (APPLE_WAVE.activeDim / APPLE_WAVE.dim)) - wave.dim) * act;
        const scaleAmt = appleKeyframeLerp(d, scalePoints);
        const lineHeightForFade = line.appleBlockHeight || rowHeight;
        const topFade = landscapeSplit ? 1 : linaClamp((y + lineHeightForFade / 2 - (appleHeaderBottom - lineHeightForFade * 0.8)) / Math.max(1, lineHeightForFade * 0.72), 0, 1);
        // The last visible line fades in as it scrolls into range instead of popping in when the active line changes.
        const edgeFade = linaClamp(visibleLines + 1 - d, 0, 1);
        const lineA = linaClamp(appleKeyframeLerp(d, opacityPoints), 0, 1) * topFade * edgeFade;
        // Blur follows the same continuous curve for every line (including the one being sung), so
        // nothing snaps when the active line changes.
        const blurAmt = Math.max(0, appleKeyframeLerp(d, blurPoints));
        const rowFontSize = inactiveFontSize + (activeFontSize - inactiveFontSize) * act;
        if (lineA < 0.004) continue;

        ctx.save();
        ctx.font = `${contract.weight || 700} ${rowFontSize.toFixed(2)}px ${family}`;
        ctx.translate(x, y);
        ctx.scale(scaleAmt, scaleAmt);
        ctx.translate(-x, -y);

        const secondaryHeight = line.appleSecondaryHeight || 0;
        const secondaryGap = line.appleSecondaryGap || 0;
        const mainCenterY = y - (secondaryHeight + secondaryGap) / 2;
        const rowYs = rows.map((_, ri) => mainCenterY + (ri - (rows.length - 1) / 2) * (rowHeight + lineSpacing));

        // Source musical-note markers become three dots, timed evenly across
        // the cue line's actual interval to the next lyric timestamp.
        if (/^(?:…|\\.\\.\\.)$/u.test(String(line.text || '').trim())) {
            const cueStart = Number(line.time);
            const nextCueTime = Number(displayLines[i + 1]?.time);
            const declaredCueEnd = Number(line.endTime);
            const cueEnd = Number.isFinite(nextCueTime) && nextCueTime > cueStart
                ? nextCueTime
                : (Number.isFinite(declaredCueEnd) && declaredCueEnd > cueStart ? declaredCueEnd : cueStart);
            const cueDuration = Math.max(0, cueEnd - cueStart);
            const dotRadius = Math.max(1.8, rowFontSize * 0.055);
            const dotGap = dotRadius * 3.8;
            const cueX = x + dotRadius;
            const cueY = rowYs[0];
            ctx.save();
            for (let dot = 0; dot < 3; dot++) {
                const dotStart = cueStart + cueDuration * dot / 3;
                const dotEnd = cueStart + cueDuration * (dot + 1) / 3;
                const progress = cueDuration > 0 ? linaClamp((time - dotStart) / Math.max(0.001, dotEnd - dotStart)) : 0;
                const alpha = wave.dim + (1 - wave.dim) * linaSmooth(progress);
                ctx.fillStyle = appleWhite(alpha * lineA);
                ctx.beginPath();
                ctx.arc(cueX + dot * dotGap, cueY, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            ctx.restore();
            continue;
        }

        // The line being sung stays "live" (timed fill + letter lift) until its highlight has faded
        // back to the unsung level and its letters have settled, then it becomes a plain dim line.
        // The old code dropped the previous line out of the timed renderer the instant the next line
        // began, which snapped it from bright to near-black.
        const nextStart = Number(displayLines[i + 1]?.time);
        const lineEnd = Number.isFinite(nextStart) ? nextStart : Number(line.endTime);
        const live = i === activeIndex || (i === activeIndex - 1 && time < lineEnd + wave.fall + 1.2);
        // The previous cue may finish fading, but its letter lift must not keep
        // running alongside the new cue. Fade that lift with the same end-of-line
        // window so there is only one active lifting wave at a time.
        const lineWave = i === activeIndex ? Object.assign({}, wave, { dim: lineDim }) : Object.assign({}, wave, {
            dim: lineDim,
            lift: wave.lift * (1 - linaSmooth((time - lineEnd) / wave.fall))
        });

        const utils = window.kefeEffectUtils;
        const tokens = line.text.split(' ').filter(Boolean);
        let times = null;
        if (live && utils?.tokenTimes) {
            try {
                const timed = utils.tokenTimes(line, displayLines[i + 1], tokens);
                if (timed.length === tokens.length && timed.every(v => Number.isFinite(v.time) && Number.isFinite(v.endTime))) times = timed;
            } catch (_) { times = null; }
        }
        // Line-level timing only: spread the line's duration across its words (same as the reference player).
        if (!times && live && tokens.length) {
            const start = Number(line.time) || 0;
            const endValue = Number(line.endTime);
            const end = Number.isFinite(endValue) && endValue > start
                ? endValue
                : (Number.isFinite(nextStart) && nextStart > start ? nextStart : start + 3.4);
            const duration = Math.max(0.5, end - start);
            const fillDuration = duration * 0.9;
            const weights = tokens.map((token, index) => (token.length + 1) * (index === tokens.length - 1 ? 2.2 : 1));
            const totalWeight = weights.reduce((sum, value) => sum + value, 0);
            let cursor = start;
            times = tokens.map((token, index) => {
                const wordStart = cursor;
                cursor += fillDuration * weights[index] / totalWeight;
                return { time: wordStart, endTime: Math.max(wordStart + 0.06, cursor) };
            });
        }

        if (times) {
            // A line's end timestamp is not necessarily the end of its final sung word.
            // If the final word has no explicit end time, estimate its vocal end from the line's cadence
            // instead of letting a long silent gap stretch its letter lift.
            const finalWordIndex = times.length - 1;
            const sourceWords = Array.isArray(line.words) ? line.words : null;
            const hasExplicitFinalEnd = sourceWords?.length
                ? hasFiniteNumber(sourceWords[sourceWords.length - 1]?.endTime) &&
                  Number(sourceWords[sourceWords.length - 1].endTime) > Number(sourceWords[sourceWords.length - 1].time)
                : false;
            if (finalWordIndex >= 0 && !hasExplicitFinalEnd) {
                const estimatedEnd = estimateFinalVocalWordEnd(
                    tokens.map((text, index) => ({ text, time: times[index]?.time, endTime: times[index]?.endTime })),
                    Number.isFinite(nextStart) ? nextStart : Infinity
                );
                if (Number.isFinite(estimatedEnd) && estimatedEnd > times[finalWordIndex].time) {
                    times[finalWordIndex] = {
                        ...times[finalWordIndex],
                        endTime: Math.min(times[finalWordIndex].endTime, estimatedEnd)
                    };
                }
            }
            // Sung part eases from 1 down to the unsung level after the line ends (reference: --hi over `fall`).
            const hi = 1 - (1 - lineDim) * linaSmooth((time - lineEnd) / wave.fall);
            const spaceWidth = ctx.measureText(' ').width;
            // Rows are built by wrapping, and a word wider than the column is split at glyph boundaries, so a row
            // piece is either a whole token or a fragment of one. Walk the tokens by character so every piece
            // gets the right word timing (fragments share their word's window, in order).
            let tokIdx = 0, charOff = 0;
            for (let ri = 0; ri < rows.length; ri++) {
                const rowTokens = rows[ri].split(' ').filter(Boolean);
                const entries = [];
                let cursorX = x;
                if (alignRight) {
                    // Opposite-voice lines hug the right edge of the lyric column, like Apple Music duets.
                    let rowW = 0;
                    for (const tk of rowTokens) rowW += appleLetterBox(ctx, tk).W + spaceWidth;
                    cursorX = rightEdge - Math.max(0, rowW - spaceWidth);
                }
                for (let k = 0; k < rowTokens.length; k++) {
                    const piece = rowTokens[k];
                    const box = appleLetterBox(ctx, piece);
                    const ix = Math.min(tokIdx, times.length - 1);
                    const tok = tokens[ix] || piece;
                    const tm = times[ix];
                    const pieceLen = Array.from(piece).length, tokLen = Math.max(1, Array.from(tok).length);
                    const isFragment = pieceLen < tokLen && (charOff > 0 || Array.from(tok).slice(0, pieceLen).join('') === piece);
                    const f0 = isFragment ? Math.min(1, charOff / tokLen) : 0;
                    const f1 = isFragment ? Math.min(1, (charOff + pieceLen) / tokLen) : 1;
                    const span = tm.endTime - tm.time;
                    const explicitTiming = Array.isArray(line.words) &&
                        line.words.length === tokens.length &&
                        hasFiniteNumber(line.words[ix]?.time) &&
                        hasFiniteNumber(line.words[ix]?.endTime) &&
                        Number(line.words[ix].endTime) > Number(line.words[ix].time);
                    entries.push({ x: cursorX, box, t0: tm.time + span * f0, t1: Math.max(tm.time + span * f0 + 0.05, tm.time + span * f1), explicitTiming });
                    cursorX += box.W + spaceWidth;
                    if (isFragment) {
                        charOff += pieceLen;
                        if (charOff >= tokLen) { tokIdx++; charOff = 0; }
                    } else { tokIdx++; charOff = 0; }
                }
                if (entries.length) appleDrawRow(ctx, entries, rowYs[ri], rowFontSize, time, lineWave, lineA, hi, blurAmt);
            }
        } else {
            // Every other line: white at the unsung alpha, softened by distance. No grey RGB, no drop shadow.
            const color = appleWhite(lineDim * lineA);
            const rowX = alignRight ? rightEdge : x;
            if (alignRight) ctx.textAlign = 'right';
            if (blurAmt > 0.08) {
                rows.forEach((rowText, ri) => appleShadowText(ctx, rowText, rowX, rowYs[ri], blurAmt, color, true));
            } else {
                ctx.fillStyle = color;
                rows.forEach((rowText, ri) => ctx.fillText(rowText, rowX, rowYs[ri]));
            }
            ctx.textAlign = 'left';
        }
        if (line.appleSecondaryRows?.length) {
            const secondaryCenterY = y + (line.appleMainHeight + secondaryGap) / 2;
            const secondaryRowHeight = line.appleSecondaryRowHeight || activeFontSize * 0.55;
            ctx.font = `${contract.weight || 600} ${line.appleSecondaryFontSize}px ${family}`;
            ctx.fillStyle = appleWhite(Math.min(0.78, 0.62 * lineA));
            line.appleSecondaryRows.forEach((secondaryText, secondaryIndex) => {
                const secondaryY = secondaryCenterY + (secondaryIndex - (line.appleSecondaryRows.length - 1) / 2) * (secondaryRowHeight + lineSpacing * 0.45);
                if (blurAmt > 0.08) {
                    appleShadowText(ctx, secondaryText, x, secondaryY, blurAmt * 0.6, appleWhite(Math.min(0.78, 0.62 * lineA)), true);
                } else {
                    ctx.fillText(secondaryText, x, secondaryY);
                }
            });
        }
        ctx.restore();
    }
    ctx.restore();
}

window.kefeEffects = window.kefeEffects || {};
window.kefeEffects.apple = drawAppleEffect;
window.dispatchEvent(new Event('kefe-effects-ready'));
