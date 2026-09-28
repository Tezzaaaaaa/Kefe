import { state, ctx as canvasCtx, canvas, media, albumArtwork, lastVideoFrame, lastVideoFrameCtx, runtime } from './context.js';
import { drawAppleEffect } from '../effects/lyric-apple.js';
import { drawBratEffect } from '../effects/lyric-brat.js';
import { drawEternalSunshineEffect } from '../effects/lyric-eternal.js';
import { drawAuroraEffect } from '../effects/lyric-aurora.js';
import { drawPulseEffect } from '../effects/lyric-pulse.js';
import { renderTitleCard, titleCardPhase } from '../effects/Titlecard.js';
import { linaClamp, activeTimedLines, activeTextMode } from './utils.js';
import { resolveAudioLabels } from './metadata.js';

export function renderLyricsEffect(ctx, w, h, style, lines, time) {
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
    switch (style.effect) {
        case 'apple':   drawAppleEffect(ctx, w, h, style, lines, time, albumArtwork.image); break;
        case 'brat':    drawBratEffect(ctx, w, h, style, lines, time); break;
        case 'eternal': drawEternalSunshineEffect(ctx, w, h, style, lines, time); break;
        case 'aurora':  drawAuroraEffect(ctx, w, h, style, lines, time); break;
        case 'pulse':   drawPulseEffect(ctx, w, h, style, lines, time); break;
        default: {
            const fn = window.kefeEffects && window.kefeEffects[style.effect];
            if (typeof fn === 'function') fn(ctx, w, h, style, lines, time);
            else drawAppleEffect(ctx, w, h, style, lines, time, albumArtwork.image);
        }
    }
    ctx.restore();
}

function captionActiveLine(lines, time) {
    let active = null;
    for (const line of lines) {
        const start = Number(line?.time);
        if (!Number.isFinite(start) || start > time) continue;
        if (!String(line?.text || '').trim()) continue;
        const end = Number(line?.endTime);
        const finish = Number.isFinite(end) && end > start ? end : start + 3;
        if (time < finish) active = { line, start, finish };
    }
    return active;
}
function wrapCaptionText(ctx, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const rows = []; let row = '';
    for (const w of words) {
        const proposed = row ? row + ' ' + w : w;
        if (row && ctx.measureText(proposed).width > maxWidth) { rows.push(row); row = w; }
        else row = proposed;
    }
    if (row) rows.push(row);
    return rows.slice(0, 3);
}
function renderCaptionStyle(ctx, w, h, lines, time) {
    const cs = state.captionStyle || {};
    const active = captionActiveLine(lines, time);
    if (!active) return;
    const unit = Math.min(w, h);
    const fontSize = Math.max(26, Math.round(unit * 0.037));
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
    ctx.font = `600 ${fontSize}px "Open Sans", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const rows = wrapCaptionText(ctx, active.line.text, w * 0.82);
    if (!rows.length) { ctx.restore(); return; }
    const lineHeight = fontSize * 1.32;
    const safe = unit * 0.085;
    const isTop = cs.position === 'top';
    const lastBaseline  = isTop ? safe + fontSize + (rows.length - 1) * lineHeight : h - safe;
    const firstBaseline = lastBaseline - (rows.length - 1) * lineHeight;
    const fade = linaClamp((time - active.start) / 0.15) * linaClamp((active.finish - time) / 0.25);
    const opacity = linaClamp(Number(cs.opacity) || 1, 0.1, 1);
    ctx.globalAlpha = opacity * fade;
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(cs.color || '') ? cs.color : '#FFFFFF';
    if (cs.shadow !== false) {
        ctx.strokeStyle = 'rgba(0,0,0,0.88)';
        ctx.lineWidth = Math.max(2, fontSize * 0.085);
        ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = fontSize * 0.22;
        ctx.shadowOffsetY = Math.max(1.5, fontSize * 0.055);
    }
    rows.forEach((row, i) => {
        const y = firstBaseline + i * lineHeight;
        if (cs.shadow !== false) ctx.strokeText(row, w / 2, y);
        ctx.fillText(row, w / 2, y);
    });
    ctx.restore();
}

function drawCover(ctx, src, w, h, blur) {
    const mw = src.videoWidth || src.width, mh = src.videoHeight || src.height;
    if (!mw || !mh) return;
    const scale = Math.max(w / mw, h / mh);
    const dw = mw * scale, dh = mh * scale, dx = (w - dw) / 2, dy = (h - dh) / 2;
    if (blur > 0) { ctx.filter = `blur(${blur}px)`; ctx.drawImage(src, dx - blur*2, dy - blur*2, dw + blur*4, dh + blur*4); ctx.filter = 'none'; }
    else ctx.drawImage(src, dx, dy, dw, dh);
}
function ensureVideoFrameCacheSize(w, h) {
    if (lastVideoFrame.width !== w || lastVideoFrame.height !== h) { lastVideoFrame.width = w; lastVideoFrame.height = h; runtime.hasLastVideoFrame = false; }
}
function drawVideoBackgroundStable(ctx, video, w, h, blur) {
    ensureVideoFrameCacheSize(w, h);
    const valid = video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.seeking;
    if (valid) {
        drawCover(ctx, video, w, h, blur);
        if (video.paused || video.seeking || !runtime.hasLastVideoFrame) {
            lastVideoFrameCtx.clearRect(0, 0, w, h);
            drawCover(lastVideoFrameCtx, video, w, h, blur);
            runtime.hasLastVideoFrame = true;
        }
        return;
    }
    if (runtime.hasLastVideoFrame) { ctx.drawImage(lastVideoFrame, 0, 0, w, h); return; }
    ctx.fillStyle = state.background.solid || '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
}
function drawBackground(ctx, w, h, bg, m) {
    ctx.save();
    ctx.fillStyle = bg.solid || '#0A0A0A';
    ctx.fillRect(0, 0, w, h);
    if (bg.type === 'image' && m.image) drawCover(ctx, m.image, w, h, bg.blur);
    else if (bg.type === 'video') drawVideoBackgroundStable(ctx, m.video, w, h, bg.blur);
    if (bg.dim > 0) { ctx.fillStyle = `rgba(0,0,0,${linaClamp(bg.dim)})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
}
function drawPlainLyrics(ctx, w, h, text) {
    const rows = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!rows.length) return;
    const unit = Math.min(w, h);
    const fontSize = Math.max(28, Math.min(74, unit * 0.038));
    const lineHeight = fontSize * 1.35;
    const maxWidth = w * 0.78;
    ctx.save();
    ctx.font = `600 ${fontSize}px "Open Sans", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = fontSize * 0.12;
    const visible = rows.slice(0, Math.max(1, Math.floor((h * 0.72) / lineHeight)));
    const total = visible.length * lineHeight;
    let y = (h - total) / 2 + lineHeight / 2;
    for (const row of visible) {
        let shown = row;
        while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) shown = shown.slice(0, -2).trim() + '…';
        ctx.fillText(shown, w / 2, y); y += lineHeight;
    }
    ctx.restore();
}

export function render(ctx, w, h, appState, mediaCache) {
    if (!ctx || !w || !h) return;
    ctx.save();
    try {
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, w, h);
        const hasPreviewMedia = Boolean(appState.audio?.file || mediaCache?.videoFile || mediaCache?.video || mediaCache?.image);
        if (hasPreviewMedia) drawBackground(ctx, w, h, appState.background, mediaCache);
        const time = Number.isFinite(appState.playback.currentTime) ? appState.playback.currentTime : 0;
        const cappedTime = (appState.playback.trimTo != null && time > appState.playback.trimTo) ? appState.playback.trimTo : time;
        const style = { ...appState.style };
        if (appState.projectType === 'visualiser' && window.kefeVisualiser) {
            window.kefeVisualiser.draw(ctx, w, h, cappedTime, appState, window.kefeAudioElement);
        }
        const appleTitleCard = appState.projectType !== 'captioned' && style.effect === 'apple';
        const tcActive = appState.projectType === 'captioned' ? false
            : appleTitleCard ? titleCardPhase(appState, cappedTime)
            : renderTitleCard(ctx, w, h, cappedTime, appState, albumArtwork.image, resolveAudioLabels);
        const titleLyricsStart = Number.isFinite(tcActive?.lyricsStart) ? tcActive.lyricsStart : Infinity;
        const timedLines = activeTimedLines();
        const lyricTime = Math.max(0, cappedTime - (Number(appState.lyricsOffset) || 0));

        if (appleTitleCard) {
            if (timedLines.length) { try { renderLyricsEffect(ctx, w, h, style, timedLines, lyricTime); } catch (e) { console.error(`${style.effect} render error:`, e); } }
            renderTitleCard(ctx, w, h, cappedTime, appState, albumArtwork.image, resolveAudioLabels);
        } else if (!tcActive || cappedTime >= titleLyricsStart) {
            if (timedLines.length) {
                try {
                    if (activeTextMode() === 'captions') renderCaptionStyle(ctx, w, h, timedLines, lyricTime);
                    else renderLyricsEffect(ctx, w, h, style, timedLines, lyricTime);
                } catch (e) { console.error(`${style.effect} render error:`, e); }
            } else if (appState.lyrics.plainText && appState.projectType !== 'visualiser') {
                drawPlainLyrics(ctx, w, h, appState.lyrics.plainText);
            }
        }
    } finally { ctx.restore(); }
}
window.render = render;