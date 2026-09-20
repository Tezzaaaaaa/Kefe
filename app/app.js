function renderPersistentNowPlaying(ctx, w, h, time, appState) {
    if (appState.style.titleCardEnabled === false) return;
    if (appState.projectType === 'captioned') return;

    const introDuration = linaClamp(Number(appState.style.titleCardDuration) || 3, 1, 15);
    const transitionDuration = 0.72;

    // The full title card owns the intro. Do not render the compact now-playing
    // card on top of it — that created a second copy of the title/artwork and
    // made the handoff appear to jump sideways.
    const elapsed = time - introDuration;
    if (elapsed < 0) return;

    const progress = linaSmoother(linaClamp(elapsed / transitionDuration));
    drawCompactNowPlaying(ctx, w, h, appState, progress);
}

function renderPersistentNowPlaying(ctx, w, h, time, appState) {
    if (appState.style.titleCardEnabled === false) return;
    if (appState.projectType === 'captioned') return;
    if (titleCardPhase(appState, time)) return;

    const introDuration = linaClamp(Number(appState.style.titleCardDuration) || 3, 1, 15);
    const transitionDuration = 0.72;
    const elapsed = time - introDuration;
    if (elapsed < 0) return;

    const progress = linaSmoother(linaClamp(elapsed / transitionDuration));
    drawCompactNowPlaying(ctx, w, h, appState, progress);
}

function wrapTitleText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const rows = [];
    let row = '';
    for (const word of words) {
        const proposed = row ? row + ' ' + word : word;
        if (row && ctx.measureText(proposed).width > maxWidth) { rows.push(row); row = word; }
        else row = row ? row + ' ' + word : word;
    }
    if (row) rows.push(row);
    return rows.length ? rows : [''];
}

/* Design: Minimal — restrained wash, centred artwork + title (KEFE classic). */
function renderTitleCardMinimal(ctx, w, h, phase, info) {
    const { alpha, enter } = phase;
    const unit = Math.min(w, h);
    const title = String(info.title || 'UNTITLED').trim();
    const artist = String(info.artist || '').trim();
    const album = String(info.album || '').trim();
    const artwork = info.artwork;
    const maxTextWidth = Math.min(w * 0.80, unit * 5.6);

    ctx.save();

    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, 'rgba(0,0,0,0.10)');
    wash.addColorStop(0.5, 'rgba(0,0,0,0.28)');
    wash.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    // The intro has one stable typographic grid: artwork, title rows, artist, album.
    // All vertical spacing is derived from the title metrics so multi-line titles
    // never collide with metadata or change their rhythm unexpectedly.
    const artworkSize = artwork ? linaClamp(unit * 0.18, 126, 220) : 0;
    const artworkGap = artwork ? unit * 0.055 : 0;
    const titleStartSize = linaClamp(unit * 0.066, 36, 88);
    const titleMinSize = 30;
    let titleSize = titleStartSize;
    let titleRows = [];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${titleSize}px ${APPLE_FONT_STACK}`;
    titleRows = wrapTitleText(ctx, title, maxTextWidth);
    while (titleSize > titleMinSize && titleRows.length > 2) {
        titleSize -= 2;
        ctx.font = `800 ${titleSize}px ${APPLE_FONT_STACK}`;
        titleRows = wrapTitleText(ctx, title, maxTextWidth);
    }
    while (titleSize > titleMinSize && titleRows.some(row => ctx.measureText(row).width > maxTextWidth)) {
        titleSize -= 2;
        ctx.font = `800 ${titleSize}px ${APPLE_FONT_STACK}`;
        titleRows = wrapTitleText(ctx, title, maxTextWidth);
    }

    const titleLineHeight = Math.round(titleSize * 1.10);
    const artistSize = artist ? Math.max(19, Math.min(30, Math.round(unit * 0.026))) : 0;
    const albumSize = album ? Math.max(15, Math.min(22, Math.round(unit * 0.019))) : 0;
    const titleMetaGap = Math.max(18, Math.round(unit * 0.026));
    const artistAlbumGap = Math.max(9, Math.round(unit * 0.012));
    const titleBlockHeight = titleRows.length * titleLineHeight;
    const metadataHeight = (artist ? artistSize : 0) + (album ? albumSize : 0) +
        (artist && album ? artistAlbumGap : 0);
    const artworkBlockHeight = artwork ? artworkSize + artworkGap : 0;
    const contentHeight = artworkBlockHeight + titleBlockHeight + titleMetaGap + metadataHeight;
    const introCenterY = h * 0.50 + (1 - enter) * unit * 0.022;
    const top = introCenterY - contentHeight / 2;

    if (artwork) {
        const artY = top;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-artworkSize / 2, artY, artworkSize, artworkSize, Math.max(12, artworkSize * 0.07));
        ctx.clip();
        const sw = artwork.naturalWidth || artwork.videoWidth || artwork.width;
        const sh = artwork.naturalHeight || artwork.videoHeight || artwork.height;
        if (sw && sh) {
            const side = Math.min(sw, sh);
            ctx.drawImage(
                artwork,
                (sw - side) / 2, (sh - side) / 2, side, side,
                -artworkSize / 2, artY, artworkSize, artworkSize
            );
        }
        ctx.restore();
    }

    let cursorY = top + artworkBlockHeight + titleBlockHeight / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = Math.max(8, unit * 0.014);
    ctx.shadowOffsetY = Math.max(2, unit * 0.003);
    ctx.font = `800 ${titleSize}px ${APPLE_FONT_STACK}`;
    ctx.fillStyle = '#FFFFFF';
    titleRows.forEach((row, index) => {
        ctx.fillText(row, w / 2, cursorY - titleBlockHeight / 2 + index * titleLineHeight + titleLineHeight / 2);
    });

    cursorY = top + artworkBlockHeight + titleBlockHeight + titleMetaGap;
    ctx.shadowBlur = Math.max(5, unit * 0.009);

    if (artist) {
        ctx.font = `600 ${artistSize}px ${APPLE_FONT_STACK}`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText(artist, w / 2, cursorY + artistSize / 2);
        cursorY += artistSize + (album ? artistAlbumGap : 0);
    }

    if (album) {
        ctx.font = `500 ${albumSize}px ${APPLE_FONT_STACK}`;
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        ctx.fillText(album, w / 2, cursorY + albumSize / 2);
    }

    ctx.restore();
    return true;
}

/* Design: Spotlight — cinematic radial glow, large artwork, title beneath. */
function renderTitleCardSpotlight(ctx, w, h, phase, info) {
    const { alpha, enter } = phase;
    const unit = Math.min(w, h);
    const glow = ctx.createRadialGradient(w / 2, h * 0.42, unit * 0.08, w / 2, h * 0.42, unit * 0.85);
    glow.addColorStop(0, 'rgba(255,255,255,0.16)');
    glow.addColorStop(0.45, 'rgba(0,0,0,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const lift = (1 - enter) * unit * 0.03;
    const cy = h * 0.5 + lift;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let cursorY = cy;
    const artSize = linaClamp(unit * 0.34, 180, 460);
    if (drawTitleArtwork(ctx, info.artwork, w / 2, cy - unit * 0.10, artSize, Math.max(14, artSize * 0.06))) {
        cursorY = cy - unit * 0.10 + artSize / 2 + unit * 0.075;
    }
    const titleSize = fitTitleText(ctx, info.title, 800, '"Open Sans"', Math.max(40, Math.round(unit * 0.062)), w * 0.80);
    ctx.font = `800 ${titleSize}px "Open Sans", Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.max(8, unit * 0.016);
    ctx.fillText(info.title, w / 2, cursorY);
    let below = cursorY + titleSize * 0.72;
    if (info.artist) {
        const artistSize = fitTitleText(ctx, info.artist, 600, '"Open Sans"', Math.max(20, Math.round(unit * 0.028)), w * 0.7);
        ctx.font = `600 ${artistSize}px "Open Sans", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.shadowBlur = Math.max(4, unit * 0.008);
        ctx.fillText(info.artist, w / 2, below + artistSize);
        below += artistSize * 2.1;
    }
    if (info.album) {
        const albumSize = fitTitleText(ctx, info.album, 500, '"Open Sans"', Math.max(15, Math.round(unit * 0.019)), w * 0.6);
        ctx.font = `500 ${albumSize}px "Open Sans", Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.fillText(info.album, w / 2, below + albumSize);
    }
    ctx.restore();
    return true;
}

/* Design: Editorial — print-inspired rules, Courier caps kicker, Bricolage title. */
function renderTitleCardEditorial(ctx, w, h, phase, info) {
    const { alpha, enter } = phase;
    const unit = Math.min(w, h);
    ctx.save();
    ctx.globalAlpha = alpha;
    const lift = (1 - enter) * unit * 0.016;
    const marginX = w * 0.12;
    const maxTextWidth = w - marginX * 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centreY = h * 0.5 + lift;
    const kicker = info.artist ? 'NOW PLAYING' : 'A SONG';
    const kickerSize = Math.max(13, Math.round(unit * 0.016));
    ctx.font = `700 ${kickerSize}px "Courier Prime", monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(kicker, w / 2, centreY - unit * 0.085);
    const ruleWidth = unit * 0.05;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1.5, unit * 0.0022);
    ctx.beginPath();
    ctx.moveTo(w / 2 - ruleWidth, centreY - unit * 0.055);
    ctx.lineTo(w / 2 + ruleWidth, centreY - unit * 0.055);
    ctx.stroke();
    let titleSize = Math.max(44, Math.round(unit * 0.078));
    ctx.font = `600 ${titleSize}px "Bricolage Grotesque", "Open Sans", Arial, sans-serif`;
    let rows = wrapTitleText(ctx, info.title, maxTextWidth);
    while (titleSize > 34 && rows.length > 3) {
        titleSize -= 2;
        ctx.font = `600 ${titleSize}px "Bricolage Grotesque", "Open Sans", Arial, sans-serif`;
        rows = wrapTitleText(ctx, info.title, maxTextWidth);
    }
    const lineHeight = titleSize * 1.12;
    const blockTop = centreY - ((rows.length - 1) * lineHeight) / 2 - unit * 0.004;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = Math.max(6, unit * 0.012);
    rows.forEach((row, i) => ctx.fillText(row, w / 2, blockTop + i * lineHeight));
    ctx.shadowBlur = 0;
    const metaY = blockTop + (rows.length - 1) * lineHeight + titleSize * 0.85;
    if (info.artist) {
        const artistSize = fitTitleText(ctx, info.artist, 500, '"Courier Prime"', Math.max(16, Math.round(unit * 0.021)), maxTextWidth * 0.8);
        ctx.font = `500 ${artistSize}px "Courier Prime", monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.66)';
        ctx.fillText(info.artist.toUpperCase(), w / 2, metaY);
    }
    // Corner registration marks give the print feel without a card.
    const corner = unit * 0.045;
    const inset = unit * 0.055;
    ctx.strokeStyle = 'rgba(255,255,255,0.34)';
    ctx.lineWidth = Math.max(1.5, unit * 0.0018);
    for (const mark of [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(mark[0], mark[1] + mark[3] * corner);
        ctx.lineTo(mark[0], mark[1]);
        ctx.lineTo(mark[0] + mark[2] * corner, mark[1]);
        ctx.stroke();
    }
    ctx.restore();
    return true;
}

/* Design: Statement — bold flat panel, oversized condensed type, per-effect accent. */
const STATEMENT_THEMES = {
    brat: { bg: '#C8FF00', ink: '#111111', muted: 'rgba(17,17,17,0.62)', family: '"Archivo Narrow"' },
    instagram: { bg: '#F08B35', ink: '#FFFFFF', muted: 'rgba(255,255,255,0.66)', family: '"Inter Tight"' },
    default: { bg: 'rgba(12,12,14,0.94)', ink: '#FFFFFF', muted: 'rgba(255,255,255,0.55)', family: '"Archivo Narrow"' }
};
function renderTitleCardStatement(ctx, w, h, appState, phase, info) {
    const { alpha, enter } = phase;
    const unit = Math.min(w, h);
    const themeKey = STATEMENT_THEMES[appState.style.effect] ? appState.style.effect : 'default';
    const theme = STATEMENT_THEMES[themeKey];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    const slide = (1 - enter) * unit * 0.05;
    const marginX = w * (themeKey === 'brat' ? 0.055 : 0.09);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top: artist kicker.
    if (info.artist) {
        const kickerSize = Math.max(18, Math.round(unit * 0.026));
        ctx.font = `700 ${kickerSize}px ${theme.family}, Arial, sans-serif`;
        ctx.fillStyle = theme.muted;
        ctx.fillText(info.artist.toUpperCase(), marginX, unit * 0.13 + slide * 0.4);
    }
    // Bottom: huge wrapped title.
    const maxTextWidth = w - marginX * 2;
    let titleSize = Math.max(64, Math.round(unit * 0.135));
    ctx.font = `700 ${titleSize}px ${theme.family}, Arial, sans-serif`;
    let rows = wrapTitleText(ctx, info.title, maxTextWidth);
    while (titleSize > 40 && rows.length > 3) {
        titleSize -= 2;
        ctx.font = `700 ${titleSize}px ${theme.family}, Arial, sans-serif`;
        rows = wrapTitleText(ctx, info.title, maxTextWidth);
    }
    const lineHeight = titleSize * 0.96;
    const baselineStart = h * 0.86 - (rows.length - 1) * lineHeight;
    ctx.fillStyle = theme.ink;
    rows.forEach((row, i) => ctx.fillText(row, marginX, baselineStart + i * lineHeight));
    // Thin blue rule — the KEFE logo accent.
    ctx.fillStyle = '#ef3f38';
    ctx.fillRect(marginX, h * 0.86 + unit * 0.022, Math.min(w - marginX * 2, unit * 0.16), Math.max(3, unit * 0.005));
    if (info.album) {
        const albumSize = Math.max(14, Math.round(unit * 0.018));
        ctx.font = `600 ${albumSize}px "Open Sans", Arial, sans-serif`;
        ctx.fillStyle = theme.muted;
        ctx.textAlign = 'right';
        ctx.fillText(info.album.toUpperCase(), w - marginX, unit * 0.13 + slide * 0.4);
    }
    ctx.restore();
    return true;
}

function render(ctx, w, h, appState, mediaCache) {
    if (!ctx || !w || !h) return;
    ctx.save();
    try {
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, w, h);
        drawBackground(ctx, w, h, appState.background, mediaCache);
        const masterMode = getMasterMode();
        const missingMaster = masterMode === 'uploaded' ? !appState.audio?.file : masterMode === 'video' ? !(mediaCache?.video && mediaCache.videoFile) : false;
        /* placeholder removed — empty canvas until media is loaded */
        const time = Number.isFinite(appState.playback.currentTime) ? appState.playback.currentTime : 0;
        const cappedTime = (appState.playback.trimTo != null && time > appState.playback.trimTo)
            ? appState.playback.trimTo : time;
        const style = { ...appState.style };
        // The captioned pathway has no title-card step. A title card left
        // over from a previous lyric session must not bleed into a captioned
        // video, so we explicitly skip it in this pathway.
        const isVisualiser = appState.projectType === 'visualiser';
        const tcActive = appState.projectType === 'captioned'
            ? false
            : renderTitleCard(ctx, w, h, cappedTime, appState);
        if (!tcActive) {
            const timedLines = activeTimedLines();
            if (timedLines.length) {
                const lyricTime = Math.max(0, cappedTime - (Number(appState.lyricsOffset) || 0));
                try {
                    // Captions use the dedicated caption/subtitle style — never a lyric effect.
                    if (activeTextMode() === 'captions') renderCaptionStyle(ctx, w, h, timedLines, lyricTime);
                    else renderLyricsEffect(ctx, w, h, style, timedLines, lyricTime);
                }
                catch(e) { console.error(`${style.effect} render error:`, e); }
            } else if (isVisualiser && window.kefeVisualiser) {
                window.kefeVisualiser.draw(ctx, w, h, cappedTime, appState);
            }
        }
        renderPersistentNowPlaying(ctx, w, h, cappedTime, appState);
    } finally { ctx.restore(); }
}

// export/ui.js (a module, so it can't see this script's lexical `state`/`media`/
// `render`) drives frame-accurate export by calling window.kefeRenderFrame for
// each output frame. Without this bridge, export always fails immediately with
// "KEFE export renderer is not connected".
window.kefeRenderFrame = function(ctx, w, h, time) {
    state.playback.currentTime = time;
    render(ctx, w, h, state, media);
};

function getMasterMode() {
    return (state.audioSource && state.audioSource.master) || 'uploaded';
}
function isMasterPlaying() {
    const mode = getMasterMode();
    if (mode === 'video') { const v = media?.video; return v ? !v.paused : false; }
    if (mode === 'none') return noneClockRunning;
    return !audio.paused;
}
function getMasterDuration() {
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    }
    if (mode === 'none') {
        const vd = (media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0) ? media.video.duration : 0;
        const ad = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
        // For a muted composition, the timeline should at least cover the timed text.
        let textEnd = 0;
        const lastLine = state.projectType === 'visualiser' ? null : state.lyrics.lines[state.lyrics.lines.length - 1];
        if (lastLine) {
            const t = Number(lastLine.time);
            const e = Number(lastLine.endTime);
            textEnd = Number.isFinite(e) ? e : (Number.isFinite(t) ? t + 3 : 0);
        }
        return Math.max(vd, ad, textEnd + 1, 1);
    }
    return Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? state.audio.duration : 0;
}
function getMasterTime() {
    if (exportClockTime !== null && exportClockTime !== undefined) return exportClockTime;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        return (v && Number.isFinite(v.currentTime)) ? v.currentTime : 0;
    }
    if (mode === 'none') {
        if (noneClockRunning) {
            let t = noneClockBase + (performance.now() - noneClockWall) / 1000;
            const d = getMasterDuration();
            if (Number.isFinite(d) && d > 0 && t >= d) { t = d; stopNoneClock(); }
            state.playback.currentTime = t;
            return t;
        }
        return Number.isFinite(state.playback.currentTime) ? state.playback.currentTime : 0;
    }
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
}
function setMasterTime(target) {
    const t = Math.max(0, Number(target) || 0);
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        // A new seek supersedes an in-flight seek; do not silently drop rapid scrubs.
        if (v && Number.isFinite(v.duration) && v.duration > 0) v.currentTime = wrappedVideoTime(t, v.duration);
    } else if (mode === 'none') {
        // Rebase the virtual clock at the new position; if it was running it keeps running from here.
        noneClockBase = t; noneClockWall = performance.now();
    } else {
        audio.currentTime = t;
    }
    state.playback.currentTime = t;
}
function startNoneClock(fromTime) {
    noneClockBase = Number.isFinite(fromTime) ? fromTime : state.playback.currentTime;
    noneClockWall = performance.now();
    noneClockRunning = true;
    state.playback.isPlaying = true;
}
function stopNoneClock() {
    noneClockRunning = false;
    noneClockBase = 0; noneClockWall = 0;
    state.playback.isPlaying = false;
}
function wrappedVideoTime(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return ((time % duration) + duration) % duration;
}
function circularVideoDrift(cur, target, dur) {
    let drift = target - cur;
    if (dur > 0) { if (drift > dur/2) drift -= dur; else if (drift < -dur/2) drift += dur; }
    return drift;
}
function maintainBackgroundVideoSync(masterTime) {
    if (getMasterMode() === 'video') return; // video is the driving clock; don't fight it
    if (exportClockTime !== null) return;
    const video = media?.video;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.readyState < 2) return;
    const target = wrappedVideoTime(masterTime, video.duration);
    const drift = circularVideoDrift(video.currentTime, target, video.duration);
    const distance = Math.abs(drift);
    const shouldPlay = isMasterPlaying();
    if (!shouldPlay || userScrubbing) {
        if (!video.paused) video.pause();
        if (distance > 0.035 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        return;
    }
    if (distance <= 0.18) video.playbackRate = linaClamp(1 + drift * 0.20, 0.97, 1.03);
    else video.playbackRate = 1;
    const now = performance.now();
    if (distance > 0.40 && !video.seeking && now - lastVideoHardSync > 250) {
        lastVideoHardSync = now;
        video.currentTime = target;
    }
    if (video.paused && !video.seeking) video.play().catch(() => {});
}
function syncPreviewTransportUI(t) {
    const seek = $('seek'); if (seek) { seek.value = String(t); seek.max = getMasterDuration(); }
    const clock = $('clock');
    const total = getMasterDuration();
    if (clock) clock.textContent = `${fmt(t)} / ${fmt(total)}`;
}
function syncVisualiserMiniPlayer(t) {
    const player = $('visualiserMiniPlayer');
    const progress = $('visualiserMiniProgress');
    const current = $('visualiserMiniCurrent');
    const duration = $('visualiserMiniDuration');
    const intro = linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15);
    const visible = state.projectType === 'visualiser' && state.style.titleCardEnabled && getMasterDuration() > 0 && t >= intro;
    player?.classList.toggle('hidden', !visible);
    if (!visible) return;
    const total = getMasterDuration();
    const ratio = total > 0 ? linaClamp(t / total) : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (current) current.textContent = fmt(t);
    if (duration) duration.textContent = fmt(total);
}
function redrawCurrentPreviewFrame() {
    if (isExporting) return;
    const t = getMasterTime();
    state.playback.currentTime = t;
    maintainBackgroundVideoSync(t);
    updateSyncLive(t);
    try { render(ctx, canvas.width, canvas.height, state, media); }
    catch(e) { console.error("Preview redraw error:", e); }
    syncPreviewTransportUI(t);
}
window.redrawCurrentPreviewFrame = redrawCurrentPreviewFrame;
function tick() {
    if (!isExporting) {
        const t = getMasterTime();
        state.playback.currentTime = t;
        const seek = $('seek');
        if (seek && !userScrubbing) seek.value = String(t);
        const clock = $('clock');
        if (clock) {
            const total = getMasterDuration();
            clock.textContent = `${fmt(t)} / ${fmt(total)}`;
        }
        syncVisualiserMiniPlayer(t);
        maintainBackgroundVideoSync(t);
        updateSyncLive(t);
        try { render(ctx, canvas.width, canvas.height, state, media); }
        catch(e) { console.error("Preview render error:", e); }
    }
    renderLoopId = requestAnimationFrame(tick);
}
function startSingleRenderLoop() {
    if (renderLoopId !== null) cancelAnimationFrame(renderLoopId);
    renderLoopId = requestAnimationFrame(tick);
}

const EFFECT_LABELS = {
    apple: "Apple Music-style focus line with a continuous scrolling lyric stack",
    brat: "5-line album-cover typewriter (edge-to-edge justified)",
    eternal: "Three-line handwritten cycle (Homemade Apple only)",
    aurora: "Flowing colour-gradient lyrics with a soft aurora glow",
    pulse: "Bold lyrics with a rhythmic scale and glow pulse",
    typewriter: "Character-by-character typewriter reveal with a blinking caret",
    instagram: "Bold uppercase Instagram-style stack with a dominant active line",
    fadeup: "Word-by-word fade-up reveal with a soft glow",
    decrypt: "Characters scramble through random glyphs before locking in, left to right",
    blur: "Words drift up from a blur into sharp focus, staggered word by word",
    shiny: "Solid lyric text with a bright diagonal shine sweeping across it"
};
// Every effect in the manifest is a valid effect (project load / prefs restore
// previously reset the 16 newer effects to Apple).
for (const def of (window.KEFE_EFFECTS || [])) if (!EFFECT_LABELS[def.key]) EFFECT_LABELS[def.key] = def.description || def.label || def.key;

function renderEffectControls() {
    const effect = state.style.effect;
    let container = $('effectControls');
    if (!container) {
        const host = document.querySelector('#lyricStyleBlock');
        if (!host) return;
        container = document.createElement('div');
        container.id = 'effectControls';
        container.className = 'effect-controls';
        host.appendChild(container);
    }
    container.innerHTML = "";
    // Every effect gets the same five layout controls (size, position, width, spacing).
    const controls = window.kefeLayout ? window.kefeLayout.controls(effect).map(c => ({ key: c.key, label: c.label, type: "range", min: c.min, max: c.max, step: c.step, suffix: c.suffix, scale: 1 })) : [{ key: "fontSize", label: "Size", type: "range", min: 36, max: 150, step: 1, suffix: "px", scale: 1 }];
    if (effect === "apple") {
        controls.push({ key: "align", label: "Alignment", type: "select", options: [["left","Left"],["center","Center"],["right","Right"]] });
    }
    let extraControls = [];
    if (effect === "apple") {
        extraControls = [
            { key: "appleInactiveOpacity", label: "Upcoming opacity", type: "range", min: 10, max: 45, step: 1, suffix: "%", scale: 0.01 },
            { key: "appleVisibleLines", label: "Upcoming lines", type: "range", min: 2, max: 6, step: 1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "brat") {
        extraControls = [
            { key: "bratTypingSpeed", label: "Typing speed", type: "range", min: 50, max: 180, step: 5, suffix: "%", scale: 0.01 },
            { key: "bratSideMargin", label: "Side margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 },
            { key: "bratTopMargin", label: "Top margin", type: "range", min: 1, max: 10, step: 0.5, suffix: "%", scale: 1 }
        ];
    }
    if (effect === "eternal") {
        extraControls = [
            { key: "eternalPenWidth", label: "Ink width", type: "range", min: 8, max: 40, step: 1, suffix: "%", scale: 1 },
            { key: "eternalWriteSpan", label: "Writing speed", type: "range", min: 60, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalGlow", label: "Ink glow", type: "range", min: 0, max: 15, step: 1, suffix: "", scale: 1 },
            { key: "eternalPresence", label: "Presence", type: "range", min: 0, max: 100, step: 1, suffix: "%", scale: 0.01 },
            { key: "eternalInkColor", label: "Ink colour", type: "color" }
        ];
    }
    if (effect === "aurora") {
        extraControls = [
            { key: "auroraSpeed", label: "Flow speed", type: "range", min: 0.2, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "auroraIntensity", label: "Glow intensity", type: "range", min: 0.1, max: 1.5, step: 0.1, suffix: "", scale: 1 },
            { key: "auroraSaturation", label: "Colour saturation", type: "range", min: 0.2, max: 1.8, step: 0.1, suffix: "", scale: 1 }
        ];
    }
    if (effect === "pulse") {
        extraControls = [
            { key: "pulseAmplitude", label: "Pulse strength", type: "range", min: 0.05, max: 1, step: 0.05, suffix: "", scale: 1 },
            { key: "pulseFrequency", label: "Pulse speed", type: "range", min: 0.3, max: 2.5, step: 0.1, suffix: "x", scale: 1 },
            { key: "pulseGlowSize", label: "Glow size", type: "range", min: 0.1, max: 2, step: 0.1, suffix: "", scale: 1 },
            { key: "accentColor", label: "Glow colour", type: "color" }
        ];
    }
    // Title Card controls live in their own section (05) — see wireTitleCardControls().
    const allControls = [...controls, ...extraControls];
    for (const control of allControls) {
        const row = document.createElement("div");
        row.className = "control-row";
        const label = document.createElement("label");
        label.textContent = control.label;
        row.appendChild(label);
        if (control.type === "range") {
            const val = document.createElement("span");
            val.style.marginLeft = "6px";
            const raw = state.style[control.key] !== undefined ? state.style[control.key] : 76;
            const disp = control.scale !== 1 ? Math.round(raw / control.scale * 100) / 100 : raw;
            val.textContent = `${disp}${control.suffix || ""}`;
            label.appendChild(val);
            const input = document.createElement("input");
            input.type = "range"; input.min = control.min; input.max = control.max; input.step = control.step;
            input.value = disp;
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = control.scale !== 1 ? Math.round(state.style[control.key] / control.scale * 100) / 100 : state.style[control.key]; return; }
                const next = Number(input.value);
                const scaled = control.scale !== 1 ? next * control.scale : next;
                state.style[control.key] = scaled;
                val.textContent = `${control.scale !== 1 ? Math.round(next * 100) / 100 : next}${control.suffix || ""}`;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        } else if (control.type === "select") {
            const select = document.createElement("select");
            for (const [value, text] of control.options) {
                const opt = document.createElement("option");
                opt.value = value; opt.textContent = text;
                select.appendChild(opt);
            }
            select.value = state.style.align || "left";
            select.addEventListener("change", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); select.value = state.style.align || "left"; return; }
                state.style.align = select.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(select);
        } else if (control.type === "color") {
            const input = document.createElement("input");
            input.type = "color";
            input.value = state.style[control.key] || "#FFFFFF";
            input.addEventListener("input", () => {
                if (isExporting) { toast('Finish or cancel the current export first', 'error'); input.value = state.style[control.key] || "#FFFFFF"; return; }
                state.style[control.key] = input.value;
                redrawCurrentPreviewFrame();
            });
            row.appendChild(input);
        }
        container.appendChild(row);
    }
    if (window.kefeLayout) {
        const reset = document.createElement("button");
        reset.type = "button"; reset.className = "segmented-btn"; reset.textContent = "Reset layout";
        reset.addEventListener("click", () => {
            if (isExporting) return;
            for (const c of window.kefeLayout.controls(effect)) state.style[c.key] = c.def;
            renderEffectControls(); redrawCurrentPreviewFrame(); saveLinaPrefs();
        });
        container.appendChild(reset);
    }
}

function setEffect(name) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    state.style.effect = name;
    qsa("[data-effect]").forEach(b => b.classList.toggle("active-effect", b.dataset.effect === name));
    const label = $('effectLabel');
    if (label) label.textContent = EFFECT_LABELS[name] || "";
    if (typeof updateTitleCardHint === 'function') updateTitleCardHint();
    renderEffectControls();
    redrawCurrentPreviewFrame();
    saveLinaPrefs();
    return true;
}
qsa("[data-effect]").forEach(b => b.addEventListener("click", () => {
    if (setEffect(b.dataset.effect)) {
        toast(b.textContent + ' activated', 'success');
    }
}));

const fmt = t => {
    if (!t || !isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};
function toast(msg, type = '') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3000);
}
function readiness() {
    const masterDur = getMasterDuration();
    const timedLines = activeTimedLines();
    const timingValid = timedLines.length > 0 && validateLyricTiming(timedLines, masterDur).errors.length === 0;
    const masterReady = hasMasterSource() && masterDur > 0;
    // Visualiser / Custom exports are valid without timed text.
    const ready = masterReady && (timedTextRequired() ? timingValid : true);
    // Export remains clickable so the authoritative preflight can explain what is missing.\n    // Do not disable it here; a disabled Export button makes the flow appear broken.\n    $('exportBtn').disabled = false;\n    $('exportBottom').disabled = false;
    refreshLyricsTimingStatus();
    updateSectionNav();
}
function ensureDefaultBackground() {
    if (media.image || media.video) return;
    state.background.type = 'solid';
    state.background.image = null;
    state.background.video = null;
    state.background.solid = state.background.solid || '#0A0A0A';
}
function hasMasterSource() {
    const mode = getMasterMode();
    if (mode === 'video') return Boolean(media.video && media.videoFile);
    if (mode === 'none') return getMasterDuration() > 0; // virtual timeline is a valid master
    return Boolean(state.audio.file) && state.audio.ready;
}
document.addEventListener('click', (event) => {
    const link = event.target.closest('.section-nav-link[data-nav]');
    if (!link) return;
    const targetId = link.getAttribute('aria-controls');
    const target = document.getElementById(targetId);
    if (!target) return;
    document.querySelectorAll('.sidebar > .section').forEach(section => {
        section.classList.toggle('active', section === target);
    });
    document.querySelectorAll('.section-nav-link').forEach(item => {
        const active = item === link;
        item.classList.toggle('active', active);
        if (active) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });
});

function updateSectionNav() {
    const masterDur = getMasterDuration();
    const timed = activeTimedLines();
    const timingOk = timed.length > 0 && validateLyricTiming(timed, masterDur).errors.length === 0;
    const done = {
        audio: hasMasterSource() && masterDur > 0,
        text: timingOk,
        fx: state.touched.fx,
        background: state.touched.background || Boolean(media.image) || Boolean(media.video),
        title: state.touched.title,
        export: hasMasterSource() && masterDur > 0 && timingOk
    };
    qsa('.section-nav-link').forEach(link => {
        const key = link.dataset.nav;
        if (key) link.classList.toggle('done', Boolean(done[key]));
    });
}
function projectValidationIssues() {
    const issues = [];
    const masterDur = getMasterDuration();
    const timedLines = activeTimedLines();
    if (!hasMasterSource()) issues.push('an audio or video source');
    else if (masterDur <= 0) issues.push('a source with a readable duration');
    if (timedTextRequired() && !timedLines.length) issues.push(activeTextMode() === 'captions' ? 'captions' : 'synced lyrics');
    else if (timedLines.length && validateLyricTiming(timedLines, masterDur).errors.length) issues.push('valid lyric timing');
    return issues;
}
function validateLyricTiming(lines, duration = 0) {
    const errors = [], warnings = [];
    if (!Array.isArray(lines) || !lines.length) return { errors, warnings };
    let previous = -Infinity;
    for (let i = 0; i < lines.length; i++) {
        const time = Number(lines[i]?.time);
        if (!Number.isFinite(time) || time < 0) errors.push(`Line ${i + 1} has an invalid timestamp`);
        if (time < previous) errors.push(`Line ${i + 1} is earlier than the previous line`);
        if (time === previous) warnings.push(`Lines ${i} and ${i + 1} share a timestamp`);
        if (Number.isFinite(duration) && duration > 0 && time > duration + 0.1) errors.push(`Line ${i + 1} starts after the audio ends`);
        if (Number.isFinite(time) && Number.isFinite(previous) && previous >= 0 && time - previous > 18) warnings.push(`Long ${Math.round(time - previous)}s gap before line ${i + 1}`);
        const end = Number(lines[i]?.endTime);
        if (Number.isFinite(end) && Number.isFinite(time) && end < time) errors.push(`Line ${i + 1} ends before it starts`);
        previous = time;
    }
    const last = Number(lines[lines.length - 1]?.time);
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(last) && duration - last > 30) warnings.push('Lyrics finish more than 30 seconds before the audio');
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
const LYRIC_FIX_HINTS = [
    { test: m => /invalid timestamp/i.test(m), hint: 'Open Edit Lyrics and correct the [mm:ss.xx] tag on that line.' },
    { test: m => /earlier than the previous line/i.test(m), hint: 'Lines must be in chronological order — reorder or fix the timestamps in Edit Lyrics.' },
    { test: m => /starts after the audio ends/i.test(m), hint: 'That line plays after your audio finishes. Remove it in Edit Lyrics, or use audio that covers it.' },
    { test: m => /ends before it starts/i.test(m), hint: 'Fix that line so its end time is later than its start (Edit Lyrics).' },
    { test: m => /share a timestamp/i.test(m), hint: 'Two lines start at the same moment — stagger them slightly unless they really overlap.' },
    { test: m => /gap before line/i.test(m), hint: 'Long silence before that line. Use the Sync controls to nudge timing, or leave the pause as intended.' },
    { test: m => /finish more than 30 seconds/i.test(m), hint: 'The tail of the audio has no text — that is fine; the title-card outro covers the ending.' }
];
function adviceForMessage(message) {
    const found = LYRIC_FIX_HINTS.find(h => h.test(message));
    return found ? found.hint : '';
}
function refreshLyricsTimingStatus() {
    const status = activeTextMode() === 'captions' ? $('captionsStatus') : $('lyricsStatus');
    if (!status) return;
    const timedLines = activeTimedLines();
    if (!timedLines.length) {
        status.textContent = activeTextMode() === 'captions'
            ? 'No captions yet — use Auto-generate Timing, or switch to Lyrics.'
            : 'No lyrics yet — search, upload an LRC, or paste your own.';
        status.className = 'status';
        updateSyncStatusUI();
        return;
    }
    const report = validateLyricTiming(timedLines, getMasterDuration());
    if (report.errors.length) {
        const advice = adviceForMessage(report.errors[0]);
        status.textContent = `${timedLines.length} lines · ${report.errors[0]}${advice ? ' — How to fix: ' + advice : ''}`;
        status.className = 'status error';
    } else if (report.warnings.length) {
        const advice = adviceForMessage(report.warnings[0]);
        status.textContent = `${timedLines.length} timed lines · ${report.warnings[0]}${advice ? ' — ' + advice : ''}`;
        status.className = 'status';
    } else {
        status.textContent = `${timedLines.length} timed lines · timing valid`;
        status.className = 'status success';
    }
    updateSyncStatusUI();
}

/* ---------- Sync diagnostics & repair ---------- */
function shiftedLines(delta, lines) {
    return lines.map(line => {
        const copy = { ...line, time: Math.max(0, Number(line.time) + delta) };
        if (Number.isFinite(Number(line.endTime))) copy.endTime = Math.max(copy.time, Number(line.endTime) + delta);
        if (Array.isArray(line.words)) copy.words = line.words.map(w => ({
            ...w,
            time: Math.max(0, Number(w.time) + delta),
            endTime: Number.isFinite(Number(w.endTime)) ? Math.max(0, Number(w.endTime) + delta) : null
        }));
        return copy;
    });
}
function nudgeLyricTiming(delta) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast(mode === 'captions' ? 'Generate captions first' : 'Load lyrics first', 'error'); return; }
    store.lines = shiftedLines(delta, store.lines);
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
    toast(`Shifted all ${mode} by ${delta > 0 ? '+' : ''}${delta}s`, 'success');
}
function updateSyncStatusUI() {
    const slider = $('lyricsOffset');
    const value = $('offsetVal');
    if (slider && document.activeElement !== slider) slider.value = String(state.lyricsOffset || 0);
    if (value) value.textContent = `${(state.lyricsOffset || 0) > 0 ? '+' : ''}${Number(state.lyricsOffset || 0).toFixed(2)}s`;
}
let lastSyncLiveUpdate = 0;
function updateSyncLive(t) {
    const el = $('syncLive');
    if (!el) return;
    const now = performance.now();
    if (now - lastSyncLiveUpdate < 180) return;
    lastSyncLiveUpdate = now;
    const lines = activeTimedLines();
    if (!lines.length) {
        el.textContent = activeTextMode() === 'captions'
            ? 'No captions yet — generate timing to see live sync.'
            : 'No lyrics yet — load lyrics to see live sync.';
        return;
    }
    const idx = linaFindActiveLine(lines, t);
    const total = lines.length;
    const label = activeTextMode() === 'captions' ? 'Caption' : 'Line';
    if (idx < 0) {
        const first = Number(lines[0].time) || 0;
        el.textContent = `First line starts in ${Math.max(0, first - t).toFixed(1)}s · 1/${total}.`;
        return;
    }
    const line = linaNormaliseLine(lines, idx);
    const next = Number(lines[idx + 1]?.time);
    const text = String(line.text || '').slice(0, 42);
    if (Number.isFinite(next) && t < next) el.textContent = `${label} ${idx + 1}/${total} · next in ${(next - t).toFixed(1)}s — “${text}”`;
    else el.textContent = `${label} ${idx + 1}/${total} (last) — “${text}”`;
}
function wireSyncControls() {
    $('lyricsOffset')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.lyricsOffset || 0); return; }
        state.lyricsOffset = Number(this.value) || 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    $('resetOffset')?.addEventListener('click', () => {
        if (isExporting) return;
        state.lyricsOffset = 0;
        updateSyncStatusUI();
        redrawCurrentPreviewFrame();
    });
    qsa('[data-nudge]').forEach(b => b.addEventListener('click', () => nudgeLyricTiming(Number(b.dataset.nudge))));
}
function songFromFilename(name) {
    if (!name) return { artist: '', track: '' };
    let base = String(name)
        .replace(/\.[^.]+$/, '')         // strip extension
        .replace(/_/g, ' ')               // underscores to spaces
        .trim();

    // Strip any trailing parenthetical / bracketed descriptor first.
    base = base
        .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K|MV)\s*$/ig, '')
        .trim();

    // Strip leading track numbers like "01 - " or "01. " or "01 ".
    base = base.replace(/^\d{1,3}\s*[-._]?\s*/, '').trim();

    const parts = base.split(/\s+-\s+/);
    if (parts.length >= 2) {
        return {
            artist: parts[0].trim(),
            track: parts.slice(1).join(' - ').trim()
        };
    }
    return { artist: '', track: base };
}
const ASPECTS = {
    '9:16': { w: 1080, h: 1920, label: '1080 × 1920 (Vertical)' },
    '1:1': { w: 1080, h: 1080, label: '1080 × 1080 (Square)' },
    '16:9': { w: 1920, h: 1080, label: '1920 × 1080 (Horizontal)' }
};
function setAspectRatio(key) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const aspect = ASPECTS[key];
    if (!aspect) return;
    state.aspect = key;
    canvas.width = aspect.w;
    canvas.height = aspect.h;
    const select = $('aspectSelect');
    if (select && select.value !== key) select.value = key;
    const info = $('aspectInfo');
    if (info) info.textContent = aspect.label;
    saveLinaPrefs();
    redrawCurrentPreviewFrame();
}
function parseLyrics(raw) {
    if (typeof raw !== 'string') throw new Error('Lyrics must be text');
    const TIME_TAG = /\[(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g;
    const METADATA_TAG = /^\[(ar|ti|al|au|length|by|offset|re|tool|ve|cover|coverart|artwork|image):/i;
    const lines = raw.split(/\r?\n/);
    const parsed = [];
    const skipped = [];
    const metadata = { title: '', artist: '', album: '', artwork: '' };
    const declaredOffset = /^\[offset:([+-]?\d+)\]$/im.exec(raw);
    let offsetSeconds = declaredOffset ? Number(declaredOffset[1]) / 1000 : 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        TIME_TAG.lastIndex = 0;
        const timeMatches = [];
        let expectedTimeIndex = 0;
        let timeMatch;
        while ((timeMatch = TIME_TAG.exec(line)) !== null) {
            if (timeMatch.index !== expectedTimeIndex) break;
            timeMatches.push({ match: timeMatch, time: Number(timeMatch[1]) * 60 + Number(timeMatch[2]) + (timeMatch[3] ? Number('0.' + timeMatch[3]) : 0) });
            expectedTimeIndex = timeMatch.index + timeMatch[0].length;
        }
        if (!timeMatches.length) {
            const metaMatch = /^\[(ar|ti|al|offset|cover|coverart|artwork|image):(.+)\]$/i.exec(line);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                if (key === 'ar') metadata.artist = value;
                else if (key === 'ti') metadata.title = value;
                else if (key === 'al') metadata.album = value;
                else if (key === 'offset') offsetSeconds = (Number(value) || 0) / 1000;
                else metadata.artwork = value;
            } else if (!METADATA_TAG.test(line)) skipped.push(line);
            continue;
        }
        const contentStart = Math.max(...timeMatches.map(item => item.match.index + item.match[0].length));
        const content = line.slice(contentStart);
        const wordMatches = [];
        const WORD_TAG = /<(\d{1,3}):([0-5]?\d)(?:[.:](\d{1,3}))?>/g;
        const hasWordTimings = content.includes('<') && content.includes('>');
        if (hasWordTimings) {
            const temp = content;
            WORD_TAG.lastIndex = 0;
            let wm;
            while ((wm = WORD_TAG.exec(temp)) !== null) {
                const wt = Math.max(0, Number(wm[1]) * 60 + Number(wm[2]) + (wm[3] ? Number('0.' + wm[3]) : 0) + offsetSeconds);
                const si = wm.index + wm[0].length;
                const ni = temp.indexOf('<', si);
                const ei = ni !== -1 ? ni : temp.length;
                const wtxt = temp.slice(si, ei).trim();
                if (wtxt) wordMatches.push({ text: wtxt, time: wt, explicitEndTime: false, endTime: null });
            }
        }
        const text = content.replace(/<[^>]*>/g, '').trim();
        if (text) {
            for (const item of timeMatches) {
                const time = Math.max(0, item.time + offsetSeconds);
                const entry = { time, endTime: time + 3, text, words: null };
                if (wordMatches.length > 0 && timeMatches.length === 1) entry.words = wordMatches;
                parsed.push(entry);
            }
        } else {
            skipped.push(line);
        }
    }
    parsed.sort((a, b) => a.time - b.time);
    const unique = parsed.filter((entry, index) => index === 0 || entry.time !== parsed[index-1].time || entry.text !== parsed[index-1].text);
    for (let i = 0; i < unique.length; i++) {
        if (i < unique.length - 1) { unique[i].endTime = unique[i+1].time; unique[i].nextLineTime = unique[i+1].time; }
        else unique[i].endTime = unique[i].time + 5;
    }
    return { lines: normaliseEnhancedWordEnds(unique), skippedCount: skipped.length, skippedLines: skipped, metadata };
}

function updateMetadataInputs() {
    const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
    if (titleInput) titleInput.value = state.audio.metadata.title || '';
    if (artistInput) artistInput.value = state.audio.metadata.artist || '';
    if (albumInput) albumInput.value = state.audio.metadata.album || '';
}

function setAlbumArtworkBlob(blob, token = audioLoadToken) {
    if (!blob || !String(blob.type || '').startsWith('image/')) return;
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    albumArtworkURL = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { if (token !== audioLoadToken) return; albumArtworkImage = image; state.audio.hasArtwork = true; redrawCurrentPreviewFrame(); };
    image.onerror = () => {
        if (token !== audioLoadToken) return;
        state.audio.hasArtwork = false;
        albumArtworkImage = null;
        if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    };
    image.src = albumArtworkURL;
}

async function setAlbumArtworkReference(reference) {
    const value = String(reference || '').trim();
    if (!value.startsWith('data:image/') || value.length > 14 * 1024 * 1024) return false;
    try { const response = await fetch(value); setAlbumArtworkBlob(await response.blob()); return true; }
    catch (error) { return false; }
}

function loadMediaInfoLibrary() {
    if (window.MediaInfo) return Promise.resolve(window.MediaInfo);
    if (!window.kefeMediaInfoLoadPromise) {
        window.kefeMediaInfoLoadPromise = import("/vendor/mediainfo/MediaInfo.js")
            .then(module => module.default || module.MediaInfo || module)
            .catch(error => {
                window.kefeMediaInfoLoadPromise = null;
                throw error;
            });
    }
    return window.kefeMediaInfoLoadPromise;
}

async function readEmbeddedVideoMetadata(file, token) {
    try {
        const MediaInfo = await loadMediaInfoLibrary();
        const mediaInfo = await (function(){ try { return MediaInfo({
            locateFile: () => "/vendor/mediainfo/MediaInfoModule.wasm" }); } catch (e) { return new MediaInfo({ locateFile: () => "/vendor/mediainfo/MediaInfoModule.wasm" }); } })();

        const result = await mediaInfo.analyzeData(
            file.size,
            async (chunkSize, offset) => {
                const buffer = await file.slice(offset, offset + chunkSize).arrayBuffer();
                return new Uint8Array(buffer);
            }
        );

        mediaInfo.close();

        if (token !== backgroundLoadToken || media.videoFile !== file) return;

        const general = Array.isArray(result?.media?.track)
            ? result.media.track.find(track => track?.['@type'] === 'General')
            : null;

        if (!general || ["project", "manual", "lyrics-service", "lrc"].includes(state.audio.metadataSource)) return;

        const title = String(general.Title || '').trim();
        const artist = String(general.Performer || general.Album_Performer || '').trim();
        const album = String(general.Album || '').trim();

        if (title) state.audio.metadata.title = title;
        if (artist) state.audio.metadata.artist = artist;
        if (album) state.audio.metadata.album = album;

        if (title || artist || album) {
            state.audio.metadataSource = 'embedded';
            updateMetadataInputs();
            saveLinaPrefs();
            redrawCurrentPreviewFrame();
            audioStatus.textContent = file.name + ' · embedded metadata';
        }
        readEmbeddedAudioMetadata(file, token, 'video');
    } catch (error) {
        console.info('No readable embedded video metadata:', error?.message || error);
    }
}

function loadMediaTagsLibrary() {
    if (window.jsmediatags) return Promise.resolve(window.jsmediatags);
    if (!mediaTagsLoadPromise) {
        mediaTagsLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './vendor/jsmediatags/jsmediatags.min.js';
            script.onload = () => window.jsmediatags ? resolve(window.jsmediatags) : reject(new Error('Metadata reader unavailable'));
            script.onerror = () => reject(new Error('Metadata reader failed to load'));
            document.head.appendChild(script);
        }).catch(error => { mediaTagsLoadPromise = null; throw error; });
    }
    return mediaTagsLoadPromise;
}

async function readEmbeddedAudioMetadata(file, token, source = 'audio') {
    try {
        const tagsLibrary = await loadMediaTagsLibrary();
        const result = await new Promise((resolve, reject) => tagsLibrary.read(file, { onSuccess: resolve, onError: reject }));
        const sourceStillCurrent = source === 'video'
            ? token === backgroundLoadToken && media.videoFile === file
            : token === audioLoadToken && state.audio.file === file;
        if (!sourceStillCurrent) return;
        const tags = result?.tags || {};
        if (!["project", "manual", "lyrics-service", "lrc"].includes(state.audio.metadataSource)) {
            if (tags.title) state.audio.metadata.title = String(tags.title).trim();
            if (tags.artist) state.audio.metadata.artist = String(tags.artist).trim();
            if (tags.album) state.audio.metadata.album = String(tags.album).trim();
            if (tags.title || tags.artist || tags.album) state.audio.metadataSource = 'embedded';
        }
        updateMetadataInputs();
        const picture = tags.picture;
        if (picture?.data?.length) {
            setAlbumArtworkBlob(new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }), token);
            audioStatus.textContent = file.name + ' · embedded artwork';
        }
        saveLinaPrefs();
        redrawCurrentPreviewFrame();
    } catch (error) {
        console.info('No readable embedded audio metadata:', error?.message || error);
    }
}

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 500 * 1024 * 1024;
const MAX_LRC_BYTES = 5 * 1024 * 1024;

function handleAudioFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm)$/i.test(file.name)) {
        toast('That doesn\'t look like an audio file', 'error');
        return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
        toast('Audio file too large (max ' + Math.round(MAX_AUDIO_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    // Apple Music's lossless downloads are ALAC. Safari's <audio> tag can
    // play them, but decodeAudioData() (which the analysis engine needs for
    // FFT) doesn't support ALAC at all. Reject early with a real reason —
    // otherwise the file loads, appears "OK", and then silently fails to
    // analyse, leaving the user staring at a dead visualiser.
    var __name = (file.name || '').toLowerCase();
    var __type = (file.type || '').toLowerCase();
    if (/\[alac\]/.test(__name) || /\balac\b/.test(__name) || __type === 'audio/x-alac') {
        toast('❌ "' + file.name + '" is a lossless ALAC file. Your browser can play it, but can\u2019t analyse it — the visualiser needs PCM/AAC. Export it as MP3 or AAC/M4A first.', 'error');
        audioStatus.textContent = file.name + ' \u2014 ALAC not supported. Export as MP3 or AAC.';
        audioStatus.className = 'status error';
        return;
    }
    const replacingAudio = Boolean(state.audio.file);
    const token = ++audioLoadToken;
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(file);
    state.audio.file = file;
    state.audio.url = audioURL;
    state.audio.duration = 0;
    state.audio.ready = false;
    // Uploading audio is an explicit user action — route master to it.
    if (state.audioSource) { state.audioSource.master = "uploaded"; state.audioSource.userChosen = false; }
    const parsedMeta = songFromFilename(file.name);
    const usingProjectMetadata = Boolean(pendingProjectMetadata);
    state.audio.metadata = pendingProjectMetadata || { title: parsedMeta.track || '', artist: parsedMeta.artist || '', album: '' };
    pendingProjectMetadata = null;
    state.audio.metadataSource = usingProjectMetadata ? 'project' : 'filename';
    if (replacingAudio) {
        state.lyrics.lines = [];
        $('lyricsStatus').textContent = 'No lyrics loaded';
        $('lyricsStatus').className = 'status';
    }
    albumArtworkImage = null;
    state.audio.hasArtwork = false;
    if (albumArtworkURL) { URL.revokeObjectURL(albumArtworkURL); albumArtworkURL = null; }
    updateMetadataInputs();
    audio.src = audioURL;
    audio.load();
    audioStatus.textContent = file.name;
    audioStatus.className = 'status success';
    toast('Audio loaded: ' + file.name, 'success');
    // Additive error listener — fires only if the browser can't decode
    // the file. Does not replace the success path; runs in parallel.
    (function() {
      var fileName = file.name;
      function onLoadError() {
        var code = audio.error ? audio.error.code : 0;
        var reason = code === 4 ? 'unsupported format or codec (Opus, AC3, unusual MP4 variants)'
                   : code === 3 ? 'file is corrupt or truncated'
                   : code === 2 ? 'network error while loading'
                   : code === 1 ? 'load was aborted'
                   : 'unknown error';
        audioStatus.textContent = fileName + ' — ' + reason;
        audioStatus.className = 'status error';
        if (typeof toast === 'function') {
          toast('❌ Could not play "' + fileName + '" — ' + reason + '. Try MP3 or re-encode to AAC/M4A.', 'error');
        }
      }
      audio.addEventListener('error', onLoadError, { once: true });
    })();
    readiness();
    readEmbeddedAudioMetadata(file, token);
}

async function detectVideoHasAudio(file, vid) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && file) {
            const ctx = new AudioCtx();
            try {
                const bytes = await file.arrayBuffer();
                const decoded = await new Promise((resolve, reject) => {
                    const maybePromise = ctx.decodeAudioData(bytes.slice(0), resolve, reject);
                    if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
                });
                return Boolean(decoded && decoded.numberOfChannels > 0 && decoded.length > 0);
            } finally {
                try { await ctx.close(); } catch (e) {}
            }
        }
    } catch (e) {}
    try {
        if (vid.audioTracks && vid.audioTracks.length) return true;
        if (vid.mozHasAudio) return true;
        if (vid.webkitAudioDecodedByteCount && vid.webkitAudioDecodedByteCount > 0) return true;
    } catch (e) {}
    return false;
}
function handleBackgroundFile(file) {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (!file) return;
    if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
        toast('Background must be an image or video file', 'error');
        return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
        toast('Background file too large (max ' + Math.round(MAX_BACKGROUND_BYTES / 1024 / 1024) + 'MB)', 'error');
        return;
    }
    const token = ++backgroundLoadToken;
    const candidateURL = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true;
        vid.src = candidateURL;
        vid.load();
        vid.addEventListener('loadeddata', async function() {
            if (isExporting || token !== backgroundLoadToken) { vid.pause(); vid.src = ''; URL.revokeObjectURL(candidateURL); return; }
            const videoHasAudio = await detectVideoHasAudio(file, vid);
            if (isExporting || token !== backgroundLoadToken) { vid.pause(); vid.src = ''; URL.revokeObjectURL(candidateURL); return; }
            if (media.video && media.video !== vid) { media.video.pause(); media.video.src = ''; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            // When the video acts as the master clock it must stop at its end (no loop).
            vid.addEventListener('ended', function() {
                if (getMasterMode() !== 'video') return;
                setPlayIcon(false);
                state.playback.isPlaying = false;
                if (!isExporting) redrawCurrentPreviewFrame();
            });
            media.video = vid;
            media.videoFile = file;
            media.image = null;
            // Detection completed before master-source selection.
            media.videoHasAudio = videoHasAudio;
            state.background.type = 'video';
            $('backgroundStatus').textContent = file.name + (media.videoHasAudio ? ' · has audio' : '');
            $('backgroundStatus').className = 'status success';
            toast('Background video loaded' + (media.videoHasAudio ? '' : ' (no audio track)'), 'success');
            // If no title/artist has been set yet (no uploaded-audio ID3 tags, no
            // manual entry), take a best guess from the video filename so users
            // relying on the video's own audio as master still get a usable
            // starting point for Find Synced Lyrics instead of a dead end.
            if (!state.audio.metadata.title && !state.audio.metadata.artist) {
                const guess = songFromFilename(file.name);
                if (guess.track || guess.artist) {
                    state.audio.metadata.title = guess.track;
                    state.audio.metadata.artist = guess.artist;
                    state.audio.metadataSource = 'filename-guess';
                    updateMetadataInputs();
                }
            }

            // Video media uses the same metadata pipeline as uploaded audio.
            // The video remains the master media source; its metadata only
            // populates the shared song metadata fields used by lyric lookup.
            readEmbeddedVideoMetadata(file, token);
            // Default master selection (only when the user has not explicitly chosen):
            // - no uploaded audio + video has audio  -> video audio becomes master
            // - no uploaded audio + video has no audio -> virtual timeline (muted) driven by video duration
            // - uploaded audio exists + lyrics already synced to it -> ask the user
            //   which source should be master rather than silently deciding for them
            // - uploaded audio exists, no lyrics synced yet -> uploaded stays master
            //   (classic flow), except the wizard's dedicated "Background Video" audio
            //   source step, which still switches automatically as before
            if (!state.audio.file) {
                applyMasterSelection(media.videoHasAudio ? 'video' : 'none', { userInitiated: false, silent: true });
            } else if (media.videoHasAudio && getMasterMode() !== "video") {
                if (window.kefeWizardSource === "media") {
                    // Wizard "Background Video" audio source: the video's own track takes
                    // over as master, even when uploaded audio is already loaded.
                    state.audioSource.userChosen = false;
                    applyMasterSelection('video', { userInitiated: false, silent: true });
                } else {
                    if (media.video) media.video.muted = true;
                    state.audioSource.master = "uploaded";
                    state.audioSource.userChosen = true;
                    if (typeof syncMasterSourceUI === "function") syncMasterSourceUI();
                }
            }
            readiness();
            hasLastVideoFrame = false;
            const t = getMasterTime();
            if (Number.isFinite(vid.duration) && vid.duration > 0) vid.currentTime = wrappedVideoTime(t, vid.duration);
            redrawCurrentPreviewFrame();
        });
        vid.addEventListener('error', function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Video failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading video';
            $('backgroundStatus').className = 'status error';
        });
    } else {
        const img = new Image();
        img.onload = function() {
            if (isExporting || token !== backgroundLoadToken) { URL.revokeObjectURL(candidateURL); return; }
            if (media.video) { media.video.pause(); media.video.src = ''; media.video = null; }
            if (backgroundURL) URL.revokeObjectURL(backgroundURL);
            backgroundURL = candidateURL;
            media.image = img;
            state.background.type = 'image';
            $('backgroundStatus').textContent = file.name;
            $('backgroundStatus').className = 'status success';
            toast('Background image loaded', 'success');
            readiness();
            redrawCurrentPreviewFrame();
        };
        img.onerror = function() {
            URL.revokeObjectURL(candidateURL);
            if (token !== backgroundLoadToken) return;
            toast('Image failed to load', 'error');
            $('backgroundStatus').textContent = 'Error loading image';
            $('backgroundStatus').className = 'status error';
        };
        img.src = candidateURL;
    }
}

const audioInput = $('audioInput'), audioStatus = $('audioStatus');
const audioChooseBtn = document.getElementById('audioChooseBtn');

// The Media step accepts either an audio file or a video file. A video
// uploaded here becomes both the background video AND (when it has an
// audio track) the master audio source — so the user doesn't have to
// upload the same file again later in the Background step just to get
// at its audio.
function handleMediaSourceFile(file) {
    if (!file) return;
    const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
    if (isVideo) handleBackgroundFile(file);
    else handleAudioFile(file);
}

audioChooseBtn.addEventListener('click', function () {
    if (isExporting) {
        toast('Finish or cancel the current export first', 'error');
        return;
    }
    audioInput.value = '';
    audioInput.click();
});

audioInput.addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    handleMediaSourceFile(file);
});

const backgroundInput = $('backgroundInput');
backgroundInput.addEventListener('change', function(e) {
    handleBackgroundFile(this.files[0]);
});

$('backgroundColor').addEventListener('input', function() {
    if (isExporting) { this.value = state.background.solid || '#0A0A0A'; return; }
    state.background.solid = this.value;
    $('backgroundColorValue').textContent = this.value.toUpperCase();
    if (!media.image && !media.video) state.background.type = 'solid';
    redrawCurrentPreviewFrame();
});

function serialiseProject() {
    return {
        format: 'KEFE Visualiser Project', version: 1, savedAt: new Date().toISOString(),
        metadata: { ...state.audio.metadata }, lyrics: state.lyrics.lines,
        lyricsSource: $('lyricsText').value || '', style: { ...state.style },
        background: { solid: state.background.solid, dim: state.background.dim, blur: state.background.blur },
        masterAudio: state.audioSource.master,
        textMode: state.captions.mode,
        captions: sanitiseProjectLyrics(state.captions.lines),
        lyricsOffset: Number(state.lyricsOffset) || 0,
        aspect: state.aspect,
        projectType: state.projectType,
        captionStyle: { ...state.captionStyle }
    };
}
function sanitiseProjectLyrics(lines) {
    if (!Array.isArray(lines) || lines.length > 10000) return [];
    return lines.map(line => {
        const time = Number(line?.time), endTime = Number(line?.endTime);
        if (!Number.isFinite(time) || time < 0) return null;
        const words = Array.isArray(line.words) ? line.words.slice(0, 500).map(word => ({
            text: String(word?.text || '').slice(0, 200), time: Number(word?.time),
            endTime: Number.isFinite(Number(word?.endTime)) ? Number(word.endTime) : null
        })).filter(word => word.text && Number.isFinite(word.time)) : null;
        return { text: String(line?.text || '').slice(0, 1000), time, endTime: Number.isFinite(endTime) ? endTime : time + 3, words };
    }).filter(line => line?.text).sort((a, b) => a.time - b.time);
}
function applyProjectStyle(projectStyle) {
    if (!projectStyle || typeof projectStyle !== 'object') return;
    for (const [key, current] of Object.entries(state.style)) {
        const incoming = projectStyle[key];
        if (typeof current === 'number' && Number.isFinite(Number(incoming))) state.style[key] = linaClamp(Number(incoming), -1000, 1000);
        else if (typeof current === 'boolean' && typeof incoming === 'boolean') state.style[key] = incoming;
        else if (typeof current === 'string' && typeof incoming === 'string' && incoming.length <= 100) state.style[key] = incoming;
    }
    if (!EFFECT_LABELS[state.style.effect]) state.style.effect = 'apple';
    if (!['left','center','right'].includes(state.style.align)) state.style.align = 'left';
    for (const key of ['accentColor','textColor','bratTextColor','eternalInkColor']) if (!/^#[0-9a-f]{6}$/i.test(state.style[key])) state.style[key] = '#FFFFFF';
}
function downloadProject() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(serialiseProject(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    const label = sanitiseExportFilenamePart(resolveAudioLabels(state.audio).title) || 'Untitled';
    link.href = url; link.download = `${label} - KEFE Project.kefe`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Project settings saved', 'success');
}
async function loadProjectFile(file) {
    if (!file || isExporting) return;
    if (file.size > 5 * 1024 * 1024) { toast('Project file is too large', 'error'); return; }
    try {
        const project = JSON.parse(await file.text());
        if (project?.format !== 'KEFE Visualiser Project' || project?.version !== 1) throw new Error('Not a supported KEFE project');
        state.audio.metadata = { title: String(project.metadata?.title || ''), artist: String(project.metadata?.artist || ''), album: String(project.metadata?.album || '') };
        pendingProjectMetadata = { ...state.audio.metadata };
        state.lyrics.lines = sanitiseProjectLyrics(project.lyrics);
        state.captions.lines = sanitiseProjectLyrics(project.captions);
        state.captions.mode = project.textMode === 'captions' ? 'captions' : 'lyrics';
        if (PROJECT_TYPES.includes(project.projectType)) state.projectType = project.projectType;
        if (project.captionStyle && typeof project.captionStyle === 'object') {
            const cs = project.captionStyle;
            state.captionStyle = {
                position: CAPTION_POSITIONS.includes(cs.position) ? cs.position : 'bottom',
                opacity: linaClamp(Number(cs.opacity) || 1, 0.3, 1),
                color: /^#[0-9a-f]{6}$/i.test(cs.color || '') ? cs.color : '#FFFFFF',
                shadow: cs.shadow !== false
            };
        }
        state.lyricsOffset = Number.isFinite(Number(project.lyricsOffset)) ? linaClamp(Number(project.lyricsOffset), -2, 2) : 0;
        applyProjectStyle(project.style);
        if (project.background && typeof project.background === 'object') {
            if (/^#[0-9a-f]{6}$/i.test(project.background.solid || '')) state.background.solid = project.background.solid;
            state.background.dim = linaClamp(Number(project.background.dim) || 0, 0, 1);
            state.background.blur = linaClamp(Number(project.background.blur) || 0, 0, 100);
        }
        if (MASTER_MODES.includes(project.masterAudio) && project.masterAudio !== 'uploaded') {
            // Restore an explicitly-saved master choice after media is loaded again.
            state.audioSource.master = project.masterAudio;
            state.audioSource.userChosen = true;
        }
        state.aspect = ASPECTS[project.aspect] ? project.aspect : state.aspect;
        $('lyricsText').value = String(project.lyricsSource || '').slice(0, 1000000);
        updateMetadataInputs();
        applyTextMode(state.captions.mode);
        syncCaptionStyleUI();
        updateSyncStatusUI();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();
        setAspectRatio(state.aspect);
        setEffect(EFFECT_LABELS[state.style.effect] ? state.style.effect : 'apple');
        readiness(); redrawCurrentPreviewFrame();
        toast('Project opened · select its audio file to continue', 'success');
    } catch (error) { toast(error.message || 'Could not open project', 'error'); }
}
$('saveProject').addEventListener('click', downloadProject);
$('loadProject').addEventListener('click', () => $('projectFileInput').click());
$('projectFileInput').addEventListener('change', function() { loadProjectFile(this.files?.[0]); this.value = ''; });

['metaTitle','metaArtist','metaAlbum'].forEach(id => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('input', () => {
        const key = id === 'metaTitle' ? 'title' : id === 'metaArtist' ? 'artist' : 'album';
        state.audio.metadata[key] = input.value.trim();
        state.audio.metadataSource = 'manual';
        redrawCurrentPreviewFrame();
        saveLinaPrefs();
    });
});

audio.addEventListener('loadedmetadata', function() {
    if (!Number.isFinite(this.duration) || this.duration <= 0) {
        state.audio.ready = false;
        readiness();
        toast('Audio duration could not be read', 'error');
        return;
    }
    state.audio.duration = this.duration;
    state.audio.ready = true;
    // Default master selection: uploaded audio takes priority (per product spec).
    applyMasterSelection('uploaded', { userInitiated: false, silent: true });
    const seek = $('seek'); if (seek) seek.max = getMasterDuration();
    $('clock').textContent = '0:00 / ' + fmt(getMasterDuration());
    readiness();
});
audio.addEventListener('error', function() {
    state.audio.ready = false;
    readiness();
    toast('Audio error', 'error');
    audioStatus.textContent = 'Error loading audio';
    audioStatus.className = 'status error';
});
audio.addEventListener('timeupdate', function() { if (getMasterMode() === 'uploaded') state.playback.currentTime = this.currentTime || 0; });
audio.addEventListener('play', function() {
    if (getMasterMode() !== 'uploaded') return; // only the selected master source drives preview
    setPlayIcon(true);
    state.playback.isPlaying = true;
    if (isExporting) return;
    const video = media?.video;
    if (video && video.readyState >= 2) {
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Math.abs(video.currentTime - target) > 0.20 && !video.seeking) video.currentTime = target;
        video.playbackRate = 1;
        video.play().catch(() => {});
    }
});
audio.addEventListener('pause', function() {
    if (getMasterMode() !== 'uploaded') return;
    setPlayIcon(false);
    state.playback.isPlaying = false;
    if (isExporting) return;
    const video = media?.video;
    if (video) {
        video.pause();
        const target = wrappedVideoTime(audio.currentTime, video.duration);
        if (Number.isFinite(video.duration) && !video.seeking) video.currentTime = target;
    }
    redrawCurrentPreviewFrame();
});
audio.addEventListener('ended', function() { if (getMasterMode() === 'none') return; setPlayIcon(false); state.playback.isPlaying = false; if (!isExporting) redrawCurrentPreviewFrame(); });
audio.addEventListener('seeked', function() { if (!isExporting) redrawCurrentPreviewFrame(); });

async function togglePlayback() {
    if (exportClockTime !== null) return;
    const mode = getMasterMode();
    if (mode === 'video') {
        const v = media?.video;
        if (v) {
            if (v.paused) {
                v.muted = false;
                try { await v.play(); } catch(e) { toast('Playback error', 'error'); }
                setPlayIcon(true); state.playback.isPlaying = true;
            } else {
                v.pause(); setPlayIcon(false); state.playback.isPlaying = false;
            }
        }
        redrawCurrentPreviewFrame();
        return;
    }
    if (mode === 'none') {
        if (noneClockRunning) { stopNoneClock(); setPlayIcon(false); state.playback.isPlaying = false; }
        else { startNoneClock(getMasterTime()); setPlayIcon(true); state.playback.isPlaying = true; }
        redrawCurrentPreviewFrame();
        return;
    }
    if (audio.paused) { try { await audio.play(); } catch(e) { toast('Playback error', 'error'); } }
    else audio.pause();
}
function isIPhoneSafari() {
    return /iPhone|iPod/.test(navigator.platform) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
function isPreviewFullscreenActive() {
    const target = $('canvasWrapper');
    const preview = document.querySelector('.preview');
    return document.fullscreenElement === target ||
        document.webkitFullscreenElement === target ||
        preview?.classList.contains('kefe-mobile-fullscreen');
}
function syncPreviewFullscreenButton() {
    const btn = $('previewFocusButton');
    if (!btn) return;
    const active = isPreviewFullscreenActive();
    btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    btn.title = active ? 'Exit fullscreen' : 'Fullscreen';
    btn.setAttribute('aria-pressed', String(active));
}
function setMobilePreviewFullscreen(active) {
    const preview = document.querySelector('.preview');
    if (!preview) return;
    preview.classList.toggle('kefe-mobile-fullscreen', active);
    document.body.classList.toggle('kefe-preview-fullscreen', active);
    syncPreviewFullscreenButton();
}
async function togglePreviewFullscreen() {
    const target = $('canvasWrapper');
    const preview = document.querySelector('.preview');
    if (!target || !preview) return;

    if (isPreviewFullscreenActive()) {
        if (document.fullscreenElement === target) {
            try { await document.exitFullscreen(); } catch (error) { console.warn('Preview fullscreen exit error:', error); }
        } else if (document.webkitFullscreenElement === target && document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        setMobilePreviewFullscreen(false);
        return;
    }

    if (isIPhoneSafari()) {
        setMobilePreviewFullscreen(true);
        return;
    }

    try {
        if (target.requestFullscreen) {
            await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
            target.webkitRequestFullscreen();
        } else {
            setMobilePreviewFullscreen(true);
            return;
        }
    } catch (error) {
        console.warn('Preview fullscreen error:', error);
        setMobilePreviewFullscreen(true);
        return;
    }
    syncPreviewFullscreenButton();
}
window.kefeTogglePreviewFullscreen = togglePreviewFullscreen;
$('previewFocusButton')?.addEventListener('click', togglePreviewFullscreen);
document.addEventListener('fullscreenchange', syncPreviewFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncPreviewFullscreenButton);
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.preview')?.classList.contains('kefe-mobile-fullscreen')) {
        setMobilePreviewFullscreen(false);
    }
});
$('playBtn').addEventListener('click', togglePlayback);

function seekPreview(target) {
    if (isExporting) return;
    if (!Number.isFinite(target)) return;
    setMasterTime(target);
    redrawCurrentPreviewFrame();
}
$('seek').addEventListener('pointerdown', function() { userScrubbing = true; if (!isExporting) media?.video?.pause(); });
$('seek').addEventListener('input', function(e) {
    if (exportClockTime !== null) return;
    const target = Number(e.target.value);
    if (!Number.isFinite(target)) return;
    seekPreview(target);
});
function finishScrubbing() {
    if (!userScrubbing) return;
    userScrubbing = false;
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) media?.video?.play().catch(() => {});
    else if (mode === 'video') media?.video?.play().catch(() => {});
}
$('seek').addEventListener('pointerup', finishScrubbing);
$('seek').addEventListener('change', finishScrubbing);
function stopPlayback() {
    if (isExporting) return;
    const mode = getMasterMode();
    if (mode === 'video') { if (media?.video) { media.video.pause(); media.video.currentTime = 0; } }
    else if (mode === 'none') { stopNoneClock(); }
    else { audio.pause(); audio.currentTime = 0; }
    state.playback.currentTime = 0;
    if (media?.video && mode === 'uploaded' && Number.isFinite(media.video.duration) && media.video.duration > 0) media.video.currentTime = 0;
    redrawCurrentPreviewFrame();
}
$('stopBtn').addEventListener('click', stopPlayback);

/* =========================================================================
 * AUDIO SOURCE SELECTION (Phase 1)
 * The master audio source decides BOTH the audible preview audio AND the
 * timing reference. Preview and export always read the same selection, so a
 * source can never silently change between them.
 * ========================================================================= */
const MASTER_MODES = ['uploaded', 'video', 'none'];
const MASTER_MODE_LABELS = {
    uploaded: 'Uploaded Audio',
    video: 'Background Video Audio',
    none: 'No audio / Muted'
};
function masterModeAvailable(mode) {
    if (mode === 'uploaded') return Boolean(state.audio.file);
    if (mode === 'video') return Boolean(media.video && media.videoFile && media.videoHasAudio);
    return true;
}
function applyMasterSelection(mode, opts = {}) {
    const userInitiated = Boolean(opts.userInitiated);
    const silent = Boolean(opts.silent);
    if (!MASTER_MODES.includes(mode)) return false;
    if (userInitiated && !masterModeAvailable(mode)) {
        toast('That audio source is not available right now', 'error');
        syncMasterSourceUI();
        return false;
    }
    // Automatic defaults must never override an explicit user choice.
    if (!userInitiated && state.audioSource.userChosen) {
        syncMasterSourceUI();
        return false;
    }
    // Never silently switch during playback/export: if the user is changing the
    // source while something is playing or exporting, stop first.
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return false; }
    if (isMasterPlaying()) { pauseMasterPlayback(); }
    const previous = getMasterMode();
    state.audioSource.master = mode;
    if (userInitiated) {
        state.audioSource.userChosen = true;
        // A user-driven selection may have a different timing reference, so warn
        // whenever timed text exists — its synchronization may no longer match.
        if (!silent && state.lyrics.lines.length) {
            toast('Timed text was synchronized against another source — it may no longer match the new master audio', '');
            console.warn('[KEFE] Master audio source changed while timed text exists; the text may be out of sync.');
        }
    }
    if (previous !== mode) {
        // Load the new master ready for playback and enforce mute routing so only
        // the selected master source is audible at any time.
        if (mode === 'uploaded' && state.audio.file) {
            if (!audio.src || audio.src !== state.audio.url) { audio.src = state.audio.url; audio.load(); }
            if (media?.video) { media.video.muted = true; media.video.loop = true; } // uploaded audio is authoritative; video stays silent + loops as artwork
        } else if (mode === 'video' && media.video) {
            media.video.muted = false; // allow the background video's own audio to be heard
            media.video.loop = false;  // the video is the master clock: it should stop at its end like audio
            if (audio && !audio.paused) audio.pause();
        } else {
            if (audio && !audio.paused) audio.pause();
            if (media?.video) { media.video.muted = true; media.video.loop = true; if (!media.video.paused) media.video.pause(); }
        }
    }
    syncMasterSourceUI();
    readiness();
    redrawCurrentPreviewFrame();
    return true;
}
function pauseMasterPlayback() {
    const mode = getMasterMode();
    if (mode === 'uploaded' && !audio.paused) audio.pause();
    else if (mode === 'video' && media?.video && !media.video.paused) media.video.pause();
    else if (mode === 'none' && noneClockRunning) stopNoneClock();
}
function renderMasterSourceUI() {
    const box = $('audioSourceButtons');
    if (!box) return;
    if (box.dataset.wired !== '1') {
        box.dataset.wired = '1';
        for (const mode of MASTER_MODES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.master = mode;
            btn.textContent = MASTER_MODE_LABELS[mode];
            btn.addEventListener('click', () => {
                const ok = applyMasterSelection(mode, { userInitiated: true, silent: false });
                if (ok) toast(MASTER_MODE_LABELS[mode] + ' is now the audio source', 'success');
            });
            box.appendChild(btn);
        }
    }
    syncMasterSourceUI();
}
function syncMasterSourceUI() {
    const mode = getMasterMode();
    const buttons = qsa('#audioSourceButtons button');
    buttons.forEach(b => {
        b.classList.toggle('active-effect', b.dataset.master === mode);
        b.disabled = !masterModeAvailable(b.dataset.master) && b.dataset.master !== mode;
    });
    const status = $('audioSourceStatus');
    if (!status) return;
    const uploadedDur = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
    const videoDur = media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0 ? fmt(media.video.duration) : '—';
    const parts = [];
    parts.push(`<strong>${MASTER_MODE_LABELS[mode] || mode}</strong>`);
    parts.push(`Uploaded: ${uploadedDur}`);
    parts.push(`Video audio: ${media?.videoHasAudio ? videoDur + ' (available)' : '—'}`);
    if (mode === 'video') parts.push('The background video audio drives the timeline.');
    if (mode === 'video' && !state.audio.metadata.title) parts.push('Add a song title above to search for synced lyrics.');
    if (mode === 'none') parts.push('No audio will be heard or exported.');
    status.innerHTML = parts.join(' · ');
}

// Shown when the user already has uploaded audio with lyrics synced to it,
// and then adds a video that also has its own audio track. Rather than
// silently pick one, ask which source the lyrics should stay synced to.
const masterAudioChoiceModal = $('masterAudioChoice');
function promptMasterAudioChoice() {
    if (!masterAudioChoiceModal) return;
    const info = $('masterAudioChoiceInfo');
    if (info) {
        const uploadedDur = Number.isFinite(state.audio.duration) && state.audio.duration > 0 ? fmt(state.audio.duration) : '—';
        const videoDur = media?.video && Number.isFinite(media.video.duration) && media.video.duration > 0 ? fmt(media.video.duration) : '—';
        info.innerHTML = `Uploaded audio: ${uploadedDur} &middot; Video audio: ${videoDur}`;
    }
    masterAudioChoiceModal.classList.remove('hidden');
}
function closeMasterAudioChoice() { masterAudioChoiceModal?.classList.add('hidden'); }
if (masterAudioChoiceModal) {
    qsa('#masterAudioChoice [data-master]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.master;
            state.audioSource.userChosen = false; // let this explicit pick set the record, not block itself
            applyMasterSelection(mode, { userInitiated: true, silent: mode === getMasterMode() });
            closeMasterAudioChoice();
        });
    });
}

let resetConfirmTimer = null;
function disarmReset() {
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = null;
    const button = $('resetBtn');
    button.dataset.confirmed = '';
    button.textContent = 'Reset';
    button.classList.remove('confirming');
    button.setAttribute('aria-label', 'Reset project');
}
function armReset() {
    const button = $('resetBtn');
    button.dataset.confirmed = 'true';
    button.textContent = 'Are you sure?';
    button.classList.add('confirming');
    button.setAttribute('aria-label', 'Confirm project reset');
    clearTimeout(resetConfirmTimer);
    resetConfirmTimer = setTimeout(disarmReset, 4500);
}
function resetProject() {
    if (isExporting) {
        toast('Finish or cancel the current export first', 'error');
        return;
    }
    const button = $('resetBtn');
    if (button.dataset.confirmed !== 'true') {
        armReset();
        return;
    }
    clearTimeout(resetConfirmTimer);
    try { localStorage.removeItem(LINA_PREFS_KEY); } catch (e) { /* storage unavailable */ }
    window.location.href = new URL('./', window.location.href).href;
}
$('resetBtn').addEventListener('click', resetProject);
document.addEventListener('click', event => {
    if (event.target !== $('resetBtn') && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('resetBtn').dataset.confirmed === 'true') disarmReset();
});

async function fetchWithRetry(url, options, retries = 2, backoffMs = 600) {
    for (let attempt = 0; ; attempt++) {
        let resp;
        try {
            resp = await fetch(url, options);
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') throw fetchErr;
            if (attempt >= retries) throw new Error('Lyrics search failed (network error)');
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        // Retry on server errors / rate limiting, not on 4xx client errors (retrying won't help those).
        if ((resp.status >= 500 || resp.status === 429) && attempt < retries) {
            await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
            continue;
        }
        return resp;
    }
}

function cleanTrackName(value) {
    return String(value || "")
        // Strip any trailing parenthetical or bracketed descriptor:
        //   (official music video), (Official Video), [Lyric Video], etc.
        .replace(/\s*[\[\(][^\]\)]*[\]\)]\s*$/g, "")
        // Strip common suffix keywords without brackets
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isUsefulExportLabel(value) {
    const label = String(value || '').trim();
    return Boolean(label) && !/^(unknown|untitled|audio|track|song|recording|output|new recording|voice memo)(?:\s*\d+)?$/i.test(label);
}
function sanitiseExportFilenamePart(value) {
    return String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .trim();
}
function buildExportFilename(extension) {
    const resolved = resolveAudioLabels(state.audio);
    const title = sanitiseExportFilenamePart(resolved.title) || 'Lyric Video';
    const artist = sanitiseExportFilenamePart(resolved.artist);
    const parts = [title];
    if (artist && artist.toLocaleLowerCase() !== title.toLocaleLowerCase()) parts.push(artist);
    parts.push('KEFE Visualiser');
    const ext = String(extension || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
    return parts.join(' - ') + '.' + ext;
}
function normalisedMetadataLabel(value) {
    return cleanTrackName(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function resolveAudioLabels(audioState = state.audio) {
    const metadata = audioState?.metadata || {};
    const fallback = audioState?.file ? songFromFilename(audioState.file.name) : { track: '', artist: '' };
    const fallbackTitle = cleanTrackName(fallback.track);
    const fallbackArtist = String(fallback.artist || '').trim();
    const useWebsiteFields = audioState === state.audio;
    const titleField = useWebsiteFields ? $('metaTitle') : null;
    const artistField = useWebsiteFields ? $('metaArtist') : null;
    const albumField = useWebsiteFields ? $('metaAlbum') : null;
    let title = cleanTrackName(titleField ? titleField.value : metadata.title);
    let artist = String(artistField ? artistField.value : (metadata.artist || '')).trim();
    const album = String(albumField ? albumField.value : (metadata.album || '')).trim();

    if (!isUsefulExportLabel(title)) title = fallbackTitle;
    if (!isUsefulExportLabel(artist)) artist = fallbackArtist;
    return {
        title: String(title || '').trim(),
        artist: String(artist || '').trim(),
        album
    };
}

async function requestSyncedLyrics(artist, track, duration, signal) {
    track = String(track || "")
        .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, "")
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, "")
        .trim();
    artist = String(artist || "").trim();

    // Strip trailing descriptor suffixes from the title before searching.
    track = String(track || "")
        .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, "")
        .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, "")
        .trim();
    artist = String(artist || "").trim();

    const candidates = [];

    // Levenshtein distance for spelling correction.
    function lev(a, b) {
        if (a === b) return 0;
        if (!a) return b.length;
        if (!b) return a.length;
        let prev = [];
        for (let j = 0; j <= b.length; j++) prev[j] = j;
        for (let i = 1; i <= a.length; i++) {
            const curr = [i];
            for (let j = 1; j <= b.length; j++) {
                const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            }
            prev = curr;
        }
        return prev[b.length];
    }
    function similar(a, b) {
        a = String(a || "").toLowerCase().trim();
        b = String(b || "").toLowerCase().trim();
        if (!a || !b) return 0;
        const d = lev(a, b);
        return 1 - d / Math.max(a.length, b.length);
    }

    // ---- 1. Try the exact match first ----
    const exact = new URLSearchParams({ artist_name: artist, track_name: track });
    if (Number.isFinite(duration) && duration > 0) exact.set("duration", String(Math.round(duration)));
    let exactResp = null;
    if (artist) {
        exactResp = await fetchWithRetry("https://lrclib.net/api/get?" + exact.toString(), { signal }, 1);
        if (exactResp.ok) {
            const data = await exactResp.json();
            if (data && data.syncedLyrics) return data;
            candidates.push(data);
        }
    }

    // ---- 2. Search by track name alone — LRCLIB will tell us the correct artist spelling ----
    const trackOnly = new URLSearchParams({ track_name: track });
    const trackResp = await fetchWithRetry("https://lrclib.net/api/search?" + trackOnly.toString(), { signal });
    if (!trackResp.ok && trackResp.status === 429) throw new Error("Lyrics service is rate-limited, try again shortly");
    const trackResults = trackResp.ok ? (await trackResp.json()) : [];
    if (Array.isArray(trackResults)) {
        // Find results whose artist is CLOSE to what the user typed.
        // That is the correction we want.
        const scored = trackResults
            .filter(function(r){ return r && r.syncedLyrics; })
            .map(function(r){
                const artistScore = similar(r.artistName || "", artist);
                const trackScore = similar(r.trackName || "", track);
                let durScore = 0;
                if (Number.isFinite(duration) && duration > 0 && Number.isFinite(Number(r.duration))) {
                    const diff = Math.abs(Number(r.duration) - duration);
                    durScore = diff <= 5 ? 1 : diff <= 20 ? 0.5 : 0;
                }
                return { item: r, score: artistScore * 0.5 + trackScore * 0.35 + durScore * 0.15 };
            })
            .sort(function(a, b){ return b.score - a.score; });

        const best = scored[0];
        if (best && best.score >= 0.55) {
            // If the matched artist spelling is different, note it so the
            // caller can update the metadata fields.
            best.item._correctedArtist = best.item.artistName;
            best.item._correctedTrack = best.item.trackName;
            return best.item;
        }
    }

    // ---- 3. Fall back to the broader search ----
    const searches = [
        new URLSearchParams({ track_name: track, ...(artist ? { artist_name: artist } : {}) }),
        new URLSearchParams({ q: [artist, track].filter(Boolean).join(" ") })
    ];
    for (const params of searches) {
        const response = await fetchWithRetry("https://lrclib.net/api/search?" + params.toString(), { signal });
        if (!response.ok) throw new Error(response.status === 429 ? "Lyrics service is rate-limited, try again shortly" : "Lyrics service unavailable (" + response.status + ")");
        const results = await response.json();
        if (Array.isArray(results)) candidates.push(...results);
        if (candidates.some(function(item){ return item && item.syncedLyrics; })) break;
    }
    return candidates.find(function(item){ return item && item.syncedLyrics; }) || null;
}

$('findLyricsBtn').addEventListener('click', async function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    let resolved = resolveAudioLabels(state.audio);
    let artist = resolved.artist;
    let track = resolved.title;

    // If the metadata fields are empty, guess from the media filename.
    // The video/audio file name is often "Artist - Title (extra words)".
    if (!track || !artist) {
        const media = window.kefeMedia || {};
        const sourceFile = (media.videoFile && media.videoFile.name) ||
                           (state.audio && state.audio.file && state.audio.file.name) ||
                           '';
        if (sourceFile) {
            const guessed = songFromFilename(sourceFile);
            if (!track && guessed.track) track = guessed.track;
            if (!artist && guessed.artist) artist = guessed.artist;
            // Strip trailing descriptors like "(official music video)".
            track = String(track || '')
                .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
                .replace(/\s+(official|lyric|lyrics|audio|visuali[sz]er|video|HD|4K)\s*$/ig, '')
                .trim();
            artist = String(artist || '').trim();
            // Mirror the guess into the fields so the user sees what we used.
            if (track && $('metaTitle') && !$('metaTitle').value.trim()) $('metaTitle').value = track;
            if (artist && $('metaArtist') && !$('metaArtist').value.trim()) $('metaArtist').value = artist;
            if (track) state.audio.metadata.title = track;
            if (artist) state.audio.metadata.artist = artist;
        }
    }

    if (!track || !artist) {
        const missing = !track && !artist
            ? 'Enter the song title and artist first'
            : (!track ? 'Enter the song title first' : 'Enter the artist first');
        $('lyricsStatus').textContent = missing;
        $('lyricsStatus').className = 'status error';
        toast(missing, 'error');
        return;
    }
    $('lyricsStatus').textContent = 'Searching...';
    $('lyricsStatus').className = 'status loading';
    this.disabled = true;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 18000);
        let match;
        try {
            match = await requestSyncedLyrics(artist, track, getMasterDuration() || state.audio.duration || audio.duration, controller.signal);
        } catch (fetchErr) {
            throw new Error(fetchErr.name === 'AbortError' ? 'Lyrics search timed out' : (fetchErr.message || 'Lyrics search failed (network error)'));
        } finally {
            clearTimeout(timeoutId);
        }
        if (!match || !match.syncedLyrics) throw new Error('No synced lyrics');
        const parsed = parseLyrics(match.syncedLyrics);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found');
        if (isExporting) return;
        state.lyrics.lines = parsed.lines;
        if (match.trackName) state.audio.metadata.title = String(match.trackName).trim();
        if (match.artistName) state.audio.metadata.artist = String(match.artistName).trim();
        if (match.albumName) state.audio.metadata.album = String(match.albumName).trim();
        if (match.trackName || match.artistName || match.albumName) state.audio.metadataSource = 'lyrics-service';
        updateMetadataInputs();

        document.dispatchEvent(new CustomEvent('kefe:lyrics-resolved', {
            detail: {
                source: 'lrclib',
                artist,
                track,
                lines: state.lyrics.lines
            }
        }));

        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        toast('Lyrics loaded' + (parsed.skippedCount ? ', ' + parsed.skippedCount + ' line(s) could not be parsed' : ''), 'success');
        readiness();
        redrawCurrentPreviewFrame();
    } catch(error) {
        if (isExporting) return;
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
    this.disabled = false;
});

$('aspectSelect')?.addEventListener('change', function() { setAspectRatio(this.value); });

$('editLyricsBtn').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    if (state.lyrics.lines.length) {
        let text = '';
        for (const line of state.lyrics.lines) {
            text += '[' + formatTime(line.time) + ']' + line.text + '\n';
        }
        $('lyricsText').value = text;
    }
    $('lyricsEditor').classList.remove('hidden');
});
$('closeEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('cancelEditor').addEventListener('click', () => $('lyricsEditor').classList.add('hidden'));
$('pasteLyrics').addEventListener('click', async function() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        $('editorStatus').textContent = window.isSecureContext
            ? 'Clipboard paste isn\'t supported in this browser — try Ctrl/Cmd+V into the box instead'
            : 'Clipboard paste needs HTTPS — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const text = await navigator.clipboard.readText();
        if (!text) {
            $('editorStatus').textContent = 'Clipboard is empty';
            $('editorStatus').className = 'status error';
            return;
        }
        $('lyricsText').value = text;
        $('editorStatus').textContent = 'Pasted from clipboard';
        $('editorStatus').className = 'status success';
    } catch(err) {
        $('editorStatus').textContent = err?.name === 'NotAllowedError'
            ? 'Clipboard permission denied — allow it or paste manually with Ctrl/Cmd+V'
            : 'Could not read clipboard — try Ctrl/Cmd+V into the box instead';
        $('editorStatus').className = 'status error';
    }
});
async function loadLrcFile(file, openEditor = false) {
    if (!file) return;
    if (!/\.(lrc|txt)$/i.test(file.name)) {
        toast('Choose an .lrc or .txt file', 'error');
        return;
    }
    if (file.size > MAX_LRC_BYTES) {
        toast('Lyrics file too large (max 5MB)', 'error');
        return;
    }
    try {
        const raw = await file.text();
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) throw new Error('No valid timed lyrics found in ' + file.name);
        $('lyricsText').value = raw;
        state.lyrics.lines = parsed.lines;
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) state.audio.metadataSource = 'lrc';
        updateMetadataInputs();
        if (parsed.metadata?.artwork) await setAlbumArtworkReference(parsed.metadata.artwork);
        $('lyricsStatus').textContent = parsed.lines.length + ' synced lines loaded';
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Loaded ' + file.name;
        $('editorStatus').className = 'status success';
        readiness();
        redrawCurrentPreviewFrame();
        toast('Loaded ' + file.name, 'success');
        if (openEditor) $('lyricsEditor').classList.remove('hidden');
    } catch (error) {
        $('lyricsStatus').textContent = error.message;
        $('lyricsStatus').className = 'status error';
        toast(error.message, 'error');
    }
}
$('uploadLrcMain').addEventListener('click', () => $('lrcFileInput').click());
$('lrcFileInput').addEventListener('change', function() {
    loadLrcFile(this.files?.[0]);
    this.value = '';
});
$('uploadLrc').addEventListener('click', () => $('lrcFileInput').click());
$('saveLyrics').addEventListener('click', function() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const raw = $('lyricsText').value.trim();
    if (!raw) {
        $('editorStatus').textContent = 'No lyrics to save';
        $('editorStatus').className = 'status error';
        return;
    }
    try {
        const parsed = parseLyrics(raw);
        if (!parsed.lines.length) {
            $('editorStatus').textContent = 'No valid timed lyrics found';
            $('editorStatus').className = 'status error';
            return;
        }
        state.lyrics.lines = parsed.lines;
        if (parsed.metadata?.title) state.audio.metadata.title = parsed.metadata.title;
        if (parsed.metadata?.artist) state.audio.metadata.artist = parsed.metadata.artist;
        if (parsed.metadata?.album) state.audio.metadata.album = parsed.metadata.album;
        if (parsed.metadata?.title || parsed.metadata?.artist || parsed.metadata?.album) {
            state.audio.metadataSource = 'lrc';
            updateMetadataInputs();
        }
        $('lyricsStatus').textContent = parsed.lines.length + ' lines loaded' + (parsed.skippedCount ? ' (' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') + ' skipped)' : '');
        $('lyricsStatus').className = 'status success';
        $('editorStatus').textContent = 'Saved ' + parsed.lines.length + ' lines' + (parsed.skippedCount ? ', skipped ' + parsed.skippedCount + ' unparsable line' + (parsed.skippedCount === 1 ? '' : 's') : '');
        $('editorStatus').className = parsed.skippedCount ? 'status' : 'status success';
        toast(parsed.skippedCount ? 'Lyrics saved, ' + parsed.skippedCount + ' line(s) skipped' : 'Lyrics saved', 'success');
        readiness();
        redrawCurrentPreviewFrame();
        setTimeout(() => $('lyricsEditor').classList.add('hidden'), 800);
    } catch(err) {
        $('editorStatus').textContent = err.message;
        $('editorStatus').className = 'status error';
    }
});
function formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60), c = Math.floor((seconds % 1) * 100);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function getExportDimensions(preset) {
    const aspect = state.aspect || '9:16';
    const sizes = {
        '1080p': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
        '720p': { '9:16':[720,1280], '1:1':[720,720], '16:9':[1280,720] },
        '480p': { '9:16':[480,854], '1:1':[480,480], '16:9':[854,480] },
        'instagram': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] },
        'tiktok': { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] }
    };
    const encoding = {
        '1080p':[60,14000000], '720p':[30,5000000], '480p':[24,2000000],
        'instagram':[30,8000000], 'tiktok':[30,6000000]
    };
    const selected = sizes[preset] ? preset : '720p';
    const dims = sizes[selected][aspect] || sizes[selected]['9:16'];
    const enc = encoding[selected];
    return { width:dims[0], height:dims[1], fps:enc[0], bitrate:enc[1] };
}

function openExportPreflight() {
    if (isExporting) return;
    const issues = projectValidationIssues();
    if (issues.length) { toast('Before export, add: ' + issues.join(', '), 'error'); return; }
    ensureDefaultBackground();
    const config = getExportDimensions($('exportPreset').value);
    const duration = getMasterDuration();
    const report = validateLyricTiming(state.lyrics.lines, duration);
    const masterLabel = MASTER_MODE_LABELS[getMasterMode()] || getMasterMode();
    const presetLabel = $('exportPreset')?.selectedOptions?.[0]?.textContent?.trim() || 'Current preset';
    const rows = [
        ['Duration', fmt(duration)],
        ['Output', `${config.width} × ${config.height}`],
        ['Frame rate', `${config.fps} fps`],
        ['Preset', presetLabel],
        ['Audio', masterLabel + (getMasterMode() === 'none' ? ' (muted)' : '')],
        ['Text', activeTimedLines().length
            ? `${activeTextMode() === 'captions' ? 'Captions' : 'Lyrics'} · ${activeTimedLines().length} lines`
            : 'None — visual only'],
        ['Background', media.image ? 'Image' : media.video ? 'Video' : 'Solid colour']
    ];
    $('preflightSummary').replaceChildren(...rows.map(([label, value]) => {
        const row = document.createElement('div'); row.className = 'preflight-row';
        const left = document.createElement('span'); left.textContent = label;
        const right = document.createElement('strong'); right.textContent = value;
        row.append(left, right); return row;
    }));
    const warnings = [...report.warnings];
    const demand = config.width * config.height * config.fps * duration;
    if (demand > 5e10) warnings.unshift('Higher-resolution exports can take longer on a phone. The finished MP4 timing remains frame-accurate.');

    // --- Sync repair: offer solutions when timed text is out of sync with the
    //     chosen master source (uploaded audio or background video audio) ---
    const syncReport = assessSyncQuality();
    const preflightRepair = $('preflightRepair');
    if (syncReport.problems.length) {
        $('preflightWarning').textContent = '⚠ ' + syncReport.problems.join(' · ');
        $('preflightWarning').classList.remove('hidden');
        preflightRepair.innerHTML = '';
        syncReport.solutions.forEach((sol, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'primary';
            btn.textContent = sol.label;
            btn.addEventListener('click', () => {
                sol.apply();
                openExportPreflight(); // refresh the existing preflight after repair
            });
            preflightRepair.appendChild(btn);
        });
    } else {
        $('preflightWarning').textContent = warnings.join(' ');
        $('preflightWarning').classList.toggle('hidden', warnings.length === 0);
        preflightRepair.innerHTML = '';
    }
    $('exportPreflight').classList.remove('hidden');
}

/* ---------- Sync quality assessment + repair ---------- */
function assessSyncQuality() {
    const lines = activeTimedLines();
    const duration = getMasterDuration();
    const report = validateLyricTiming(lines, duration);
    const problems = [];
    const solutions = [];

    if (report.errors.length) {
        problems.push(report.errors[0]);
    }
    // Out-of-sync detection: lyrics finishing well before the audio ends,
    // or starting late — the classic "timed against the wrong source" symptom.
    if (lines.length && Number.isFinite(duration) && duration > 0) {
        const first = Number(lines[0]?.time);
        const last = Number(lines[lines.length - 1]?.time);
        if (Number.isFinite(last) && duration - last > 30) {
            problems.push(`Lyrics end ${Math.round(duration - last)}s before the audio finishes`);
            solutions.push({
                label: '1. Stretch lyrics to fill the track',
                apply: () => stretchLyricsToDuration(duration)
            });
            solutions.push({
                label: '2. Trim audio to the lyrics',
                apply: () => trimMasterToLyrics(duration, last)
            });
        }
        if (Number.isFinite(first) && first > 3 && duration > 3) {
            problems.push(`First lyric starts ${Math.round(first)}s in — likely a sync offset`);
            solutions.push({
                label: '3. Shift all lyrics earlier',
                apply: () => nudgeLyricTiming(-first)
            });
        }
    }
    // Deduplicate solutions (a single problem can trigger multiple repairs)
    const seen = new Set();
    return {
        problems: problems.length ? problems : ['Sync check passed'],
        solutions: solutions.filter(s => { if (seen.has(s.label)) return false; seen.add(s.label); return true; })
    };
}

function stretchLyricsToDuration(duration) {
    const mode = activeTextMode();
    const store = mode === 'captions' ? state.captions : state.lyrics;
    if (!store.lines.length) { toast('Load lyrics first', 'error'); return; }
    const last = Number(store.lines[store.lines.length - 1]?.time);
    if (!Number.isFinite(last) || last <= 0) { toast('Cannot stretch: last line has no time', 'error'); return; }
    const scale = duration / last;
    if (!Number.isFinite(scale) || scale <= 0) { toast('Invalid duration', 'error'); return; }
    store.lines = store.lines.map(line => {
        const copy = { ...line, time: Math.max(0, Number(line.time) * scale) };
        if (Number.isFinite(Number(line.endTime))) copy.endTime = Math.max(copy.time, Number(line.endTime) * scale);
        if (Array.isArray(line.words)) copy.words = line.words.map(w => ({
            ...w,
            time: Math.max(0, Number(w.time) * scale),
            endTime: Number.isFinite(Number(w.endTime)) ? Math.max(0, Number(w.endTime) * scale) : null
        }));
        return copy;
    });
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
    toast(`Lyrics stretched to fit ${fmt(duration)} track`, 'success');
}

function trimMasterToLyrics(duration, lastLyricTime) {
    // Trims the master source to end where the lyrics do, so the exported
    // video stops with the last line instead of running on into silence.
    const mode = getMasterMode();
    if (mode === 'video' && media?.video) {
        try { media.video.currentTime = 0; } catch (e) {}
        toast(`Video will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info');
    } else if (mode === 'uploaded' && state.audio?.file) {
        toast(`Audio will export up to ${fmt(lastLyricTime)} — the tail is silent`, 'info');
    } else {
        toast('Trim applies to the master source on export', 'info');
    }
    state.playback.trimTo = lastLyricTime;
}

function closeExportPreflight() { $('exportPreflight').classList.add('hidden'); }
$('closePreflight').addEventListener('click', closeExportPreflight);
$('cancelPreflight').addEventListener('click', closeExportPreflight);

$('exportBtn').addEventListener('click', openExportPreflight);
$('exportBottom').addEventListener('click', openExportPreflight);

document.addEventListener('keydown', function(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    switch(e.key) {
        case ' ': e.preventDefault(); togglePlayback(); break;
        case 'ArrowLeft': e.preventDefault(); seekPreview(Math.max(0, getMasterTime() - 5)); break;
        case 'ArrowRight': e.preventDefault(); seekPreview(Math.min(getMasterDuration(), getMasterTime() + 5)); break;
        case '1': document.querySelector('[data-effect="apple"]')?.click(); break;
        case '2': document.querySelector('[data-effect="brat"]')?.click(); break;
        case '3': document.querySelector('[data-effect="eternal"]')?.click(); break;
        case 'e': case 'E': openExportPreflight(); break;
        case 'f': case 'F':
            if (document.fullscreenElement) document.exitFullscreen();
            else document.querySelector('.preview')?.requestFullscreen().catch(() => {});
            break;
        case '0': stopPlayback(); break;
    }
});

function setupDropZone(zone, inputId) {
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        if (inputId === 'audioInput') handleMediaSourceFile(file);
        if (inputId === 'backgroundInput') handleBackgroundFile(file);
    });
}
setupDropZone($('audioDrop'), 'audioInput');
setupDropZone($('bgDrop'), 'backgroundInput');

/* =========================================================================
 * TITLE CARD SECTION (05) — dedicated controls, per-effect default designs.
 * ========================================================================= */
function syncTitleCardUI() {
    const toggle = $('titleCardEnabled');
    if (toggle) toggle.checked = state.style.titleCardEnabled !== false;
    const dur = $('titleCardDuration');
    if (dur) dur.value = String(linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15));
    const durVal = $('titleCardDurationVal');
    if (durVal) durVal.textContent = `${linaClamp(Number(state.style.titleCardDuration) || 3, 1, 15)}s`;
    const styleSel = $('titleCardStyle');
    if (styleSel) styleSel.value = state.style.titleCardStyle || 'auto';
    updateTitleCardHint();
}
function updateTitleCardHint() {
    const hint = $('titleCardStyleHint');
    if (!hint) return;
    const chosen = state.style.titleCardStyle || 'auto';
    const resolved = resolveTitleCardDesign(state);
    hint.textContent = chosen === 'auto' ? `Auto → ${TITLECARD_DESIGN_LABELS[resolved]}` : TITLECARD_DESIGN_LABELS[chosen] || '';
}
function wireTitleCardControls() {
    $('titleCardEnabled')?.addEventListener('change', function() {
        if (isExporting) { this.checked = state.style.titleCardEnabled; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardEnabled = this.checked;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
    $('titleCardStyle')?.addEventListener('change', function() {
        if (isExporting) { this.value = state.style.titleCardStyle || 'auto'; toast('Finish or cancel the current export first', 'error'); return; }
        state.style.titleCardStyle = this.value;
        markSectionTouched('title');
        updateTitleCardHint();
        redrawCurrentPreviewFrame();
    });
    $('titleCardDuration')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.style.titleCardDuration || 3); return; }
        state.style.titleCardDuration = linaClamp(Number(this.value) || 3, 1, 15);
        $('titleCardDurationVal').textContent = `${state.style.titleCardDuration}s`;
        markSectionTouched('title');
        redrawCurrentPreviewFrame();
    });
}

/* =========================================================================
 * TEXT MODE (Lyrics ⇄ Captions)
 * ========================================================================= */
function applyTextMode(mode) {
    state.captions.mode = mode === 'captions' ? 'captions' : 'lyrics';
    qsa('[data-text-mode]').forEach(b => {
        const active = b.dataset.textMode === state.captions.mode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('lyricsPanel')?.classList.toggle('hidden', state.captions.mode !== 'lyrics');
    $('captionsPanel')?.classList.toggle('hidden', state.captions.mode !== 'captions');
    // Architecture separation: lyric effects belong to lyrics, caption style to captions.
    $('lyricStyleBlock')?.classList.toggle('hidden', state.captions.mode === 'captions');
    const badge = $('previewModeBadge');
    if (badge) badge.textContent = state.captions.mode === 'captions' ? 'Captions' : 'Lyrics';
    refreshLyricsTimingStatus();
    redrawCurrentPreviewFrame();
}

/* =========================================================================
 * CAPTION STYLE (dedicated subtitle styling — separate from lyric effects)
 * ========================================================================= */
const CAPTION_POSITIONS = ['bottom', 'top'];
function applyCaptionPosition(pos) {
    state.captionStyle.position = CAPTION_POSITIONS.includes(pos) ? pos : 'bottom';
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === state.captionStyle.position));
    redrawCurrentPreviewFrame();
}
function syncCaptionStyleUI() {
    const cs = state.captionStyle || {};
    qsa('[data-caption-pos]').forEach(b => b.classList.toggle('active-effect', b.dataset.captionPos === (cs.position || 'bottom')));
    const opacityPct = Math.round(linaClamp(Number(cs.opacity) || 1, 0.3, 1) * 100);
    const op = $('captionOpacity');
    if (op) op.value = String(opacityPct);
    const opVal = $('captionOpacityVal');
    if (opVal) opVal.textContent = `${opacityPct}%`;
    const colour = $('captionColor');
    if (colour && /^#[0-9a-f]{6}$/i.test(cs.color || '')) colour.value = cs.color;
    const shadow = $('captionShadow');
    if (shadow) shadow.checked = cs.shadow !== false;
}
function wireCaptionStyleControls() {
    qsa('[data-caption-pos]').forEach(btn => btn.addEventListener('click', () => {
        if (isExporting) { syncCaptionStyleUI(); return; }
        applyCaptionPosition(btn.dataset.captionPos);
    }));
    $('captionOpacity')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(Math.round((Number(state.captionStyle.opacity) || 1) * 100)); return; }
        state.captionStyle.opacity = linaClamp(Number(this.value) / 100, 0.3, 1);
        const opVal = $('captionOpacityVal');
        if (opVal) opVal.textContent = `${Math.round(state.captionStyle.opacity * 100)}%`;
        redrawCurrentPreviewFrame();
    });
    $('captionColor')?.addEventListener('input', function() {
        if (isExporting) { this.value = state.captionStyle.color || '#FFFFFF'; return; }
        if (/^#[0-9a-f]{6}$/i.test(this.value)) state.captionStyle.color = this.value;
        redrawCurrentPreviewFrame();
    });
    $('captionShadow')?.addEventListener('change', function() {
        if (isExporting) { this.checked = state.captionStyle.shadow !== false; return; }
        state.captionStyle.shadow = this.checked;
        redrawCurrentPreviewFrame();
    });
}

/* ---------- Guided-workflow bridge: the final selected video type decides
   what content is rendered (see activeTimedLines / timedTextRequired). ---------- */
window.kefeSetProjectType = function(type) {
    if (!PROJECT_TYPES.includes(type)) return;
    if (state.projectType === type) return;
    state.projectType = type;
    // Captioned pathway forces the captions panel; other pathways reset to lyrics.
    if (type === 'captioned') {
        if (typeof applyTextMode === 'function') applyTextMode('captions');
        else state.captions.mode = 'captions';
    } else if (type === 'lyric' && state.captions.mode === 'captions') {
        if (typeof applyTextMode === 'function') applyTextMode('lyrics');
        else state.captions.mode = 'lyrics';
    }
    readiness();
    redrawCurrentPreviewFrame();
};

/* =========================================================================
 * CAPTIONS — automatic timed-block generation from the master audio.
 * Analyses loudness (energy voice-activity detection) entirely in-browser.
 * ========================================================================= */
const CAPTION_MIN_SEGMENT = 0.5;
const CAPTION_MERGE_GAP = 0.35;
const CAPTION_PAD_HEAD = 0.10;
const CAPTION_PAD_TAIL = 0.28;
const CAPTION_MAX_BLOCKS = 2000;
async function autoGenerateCaptions() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    const mode = getMasterMode();
    const file = mode === 'video' ? media?.videoFile : state.audio.file;
    if (!file) {
        $('captionsStatus').textContent = 'Add an audio file (or a video with sound) in Step 01 first — captions are generated from its sound.';
        $('captionsStatus').className = 'status error';
        toast('Add audio first — captions are generated from sound', 'error');
        return;
    }
    const button = $('autoCaptionsBtn');
    if (button) button.disabled = true;
    $('captionsStatus').textContent = 'Analysing audio for speech and vocals…';
    $('captionsStatus').className = 'status loading';
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) throw new Error('This browser cannot analyse audio');
        const buffer = await file.arrayBuffer();
        const actx = new AudioCtx();
        const decoded = await actx.decodeAudioData(buffer);
        const sampleRate = decoded.sampleRate;
        const data = decoded.getChannelData(0);
        const win = Math.max(1, Math.round(sampleRate * 0.05)); // 50ms windows
        const rms = [];
        for (let i = 0; i + win <= data.length; i += win) {
            let sum = 0;
            for (let j = i; j < i + win; j += 4) sum += data[j] * data[j];
            rms.push(Math.sqrt(sum / (win / 4)));
        }
        actx.close?.();
        if (!rms.length) throw new Error('Audio is too short to analyse');
        const sorted = rms.slice().sort((a, b) => a - b);
        const floor = sorted[Math.floor(sorted.length * 0.10)] || 0;
        const peak = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] || 1;
        const threshold = Math.max(0.012, floor + (peak - floor) * 0.14);
        const minWindows = Math.max(1, Math.round(CAPTION_MIN_SEGMENT / 0.05));
        const mergeWindows = Math.max(1, Math.round(CAPTION_MERGE_GAP / 0.05));
        const segments = [];
        let start = -1, silence = 0;
        for (let i = 0; i < rms.length; i++) {
            const loud = rms[i] >= threshold;
            if (loud) {
                if (start < 0) start = i;
                silence = 0;
            } else if (start >= 0) {
                silence++;
                if (silence >= mergeWindows) {
                    const end = i - silence + 1;
                    if (end - start >= minWindows) segments.push([start, end]);
                    start = -1; silence = 0;
                }
            }
        }
        if (start >= 0 && rms.length - start >= minWindows) segments.push([start, rms.length]);
        if (!segments.length) {
            $('captionsStatus').textContent = 'No clear speech or vocals found — the audio may be too quiet. Try louder source material, or add caption blocks manually.';
            $('captionsStatus').className = 'status error';
            return;
        }
        const total = decoded.duration;
        state.captions.lines = segments.slice(0, CAPTION_MAX_BLOCKS).map(([a, b]) => ({
            time: Math.max(0, a * 0.05 - CAPTION_PAD_HEAD),
            endTime: Math.min(total, b * 0.05 + CAPTION_PAD_TAIL),
            text: ''
        }));
        markSectionTouched('text');
        $('captionsStatus').textContent = `Generated ${state.captions.lines.length} timed caption blocks — open Edit Captions and type what you hear for each block.`;
        $('captionsStatus').className = 'status success';
        toast(`Generated ${state.captions.lines.length} caption blocks`, 'success');
        readiness();
        redrawCurrentPreviewFrame();
        openCaptionsEditor();
    } catch (error) {
        const reason = error?.name === 'EncodingError'
            ? 'this audio format could not be decoded in the browser — try MP3, M4A or WAV, or add caption blocks manually'
            : (error?.message || 'analysis failed');
        $('captionsStatus').textContent = `Caption generation failed: ${reason}`;
        $('captionsStatus').className = 'status error';
        toast('Caption generation failed', 'error');
    } finally {
        if (button) button.disabled = false;
    }
}

/* ---------- Captions editor ---------- */
function openCaptionsEditor() {
    if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
    renderCaptionRows();
    $('captionsEditor').classList.remove('hidden');
}
function renderCaptionRows() {
    const box = $('captionsRows');
    if (!box) return;
    const lines = state.captions.lines;
    if (!lines.length) {
        box.innerHTML = '<div class="caption-hint">No blocks yet — use Auto-generate Timing first, or add blocks below.</div>';
        return;
    }
    box.replaceChildren(...lines.map((line, i) => {
        const row = document.createElement('div');
        row.className = 'caption-row';
        const time = document.createElement('span');
        time.className = 'caption-time';
        time.textContent = `${formatTime(Number(line.time) || 0)} → ${formatTime(Number(line.endTime) || 0)}`;
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.idx = String(i);
        input.value = String(line.text || '');
        input.placeholder = 'What is said in this block…';
        input.addEventListener('input', () => { if (lines[i]) lines[i].text = input.value; });
        row.append(time, input);
        return row;
    }));
}
function splitCaptionText(raw) {
    const parts = [];
    for (const chunk of String(raw || '').split(/\r?\n+/)) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const sentences = trimmed.match(/[^.!?…]+[.!?…]*/g) || [trimmed];
        for (const s of sentences) { if (s.trim()) parts.push(s.trim()); }
    }
    return parts;
}

function wireCaptions() {
    $('autoCaptionsBtn')?.addEventListener('click', autoGenerateCaptions);
    $('editCaptionsBtn')?.addEventListener('click', openCaptionsEditor);
    $('closeCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('cancelCaptions')?.addEventListener('click', () => $('captionsEditor').classList.add('hidden'));
    $('addCaptionRow')?.addEventListener('click', () => {
        const lines = state.captions.lines;
        const last = lines[lines.length - 1];
        const start = last ? (Number(last.endTime) || (Number(last.time) + 3)) : 0;
        lines.push({ time: start, endTime: start + 3, text: '' });
        renderCaptionRows();
    });
    $('clearCaptionText')?.addEventListener('click', () => {
        state.captions.lines.forEach(l => { l.text = ''; });
        renderCaptionRows();
    });
    $('pasteCaptions')?.addEventListener('click', async function() {
        const status = $('captionsEditorStatus');
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            status.textContent = 'Clipboard paste is not supported here — paste manually with Ctrl/Cmd+V into the text box instead.';
            status.className = 'status error';
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) { status.textContent = 'Clipboard is empty'; status.className = 'status error'; return; }
            $('captionsBulkText').value = text;
            status.textContent = 'Pasted — now use “Fit Text to Blocks”.';
            status.className = 'status success';
        } catch (err) {
            status.textContent = 'Could not read the clipboard — paste manually with Ctrl/Cmd+V instead.';
            status.className = 'status error';
        }
    });
    $('distributeCaptions')?.addEventListener('click', () => {
        const status = $('captionsEditorStatus');
        const parts = splitCaptionText($('captionsBulkText').value);
        const lines = state.captions.lines;
        if (!lines.length) { status.textContent = 'Generate timing first, then fit text to the blocks.'; status.className = 'status error'; return; }
        if (!parts.length) { status.textContent = 'Add or paste some text first.'; status.className = 'status error'; return; }
        lines.forEach((line, i) => { line.text = parts[i] || line.text || ''; });
        if (parts.length > lines.length) {
            status.textContent = `Fitted ${lines.length} of ${parts.length} text parts — add ${parts.length - lines.length} more block(s) for the rest.`;
            status.className = 'status';
        } else {
            status.textContent = 'Text fitted across all blocks.';
            status.className = 'status success';
        }
        renderCaptionRows();
    });
    $('saveCaptions')?.addEventListener('click', function() {
        if (isExporting) { toast('Finish or cancel the current export first', 'error'); return; }
        const lines = state.captions.lines;
        const withText = lines.filter(l => String(l.text || '').trim());
        if (!lines.length || !withText.length) {
            $('captionsEditorStatus').textContent = 'Add at least one caption block with text.';
            $('captionsEditorStatus').className = 'status error';
            return;
        }
        state.captions.lines = withText.sort((a, b) => a.time - b.time);
        markSectionTouched('text');
        readiness();
        redrawCurrentPreviewFrame();
        $('captionsEditorStatus').textContent = `Saved ${withText.length} caption blocks.`;
        $('captionsEditorStatus').className = 'status success';
        toast(`Captions saved · ${withText.length} blocks`, 'success');
        setTimeout(() => $('captionsEditor').classList.add('hidden'), 700);
    });
}

/* ---------- Background customisation ---------- */
function wireBackgroundControls() {
    $('bgDim')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(Math.round((state.background.dim || 0) * 100)); return; }
        state.background.dim = Number(this.value) / 100;
        $('bgDimVal').textContent = `${this.value}%`;
        redrawCurrentPreviewFrame();
    });
    $('bgBlur')?.addEventListener('input', function() {
        if (isExporting) { this.value = String(state.background.blur || 0); return; }
        state.background.blur = Number(this.value) || 0;
        $('bgBlurVal').textContent = `${this.value}px`;
        redrawCurrentPreviewFrame();
    });
}
function syncBackgroundControls() {
    const dim = $('bgDim');
    if (dim) dim.value = String(Math.round((state.background.dim ?? 0.35) * 100));
    const dimVal = $('bgDimVal');
    if (dimVal) dimVal.textContent = `${Math.round((state.background.dim ?? 0.35) * 100)}%`;
    const blur = $('bgBlur');
    if (blur) blur.value = String(state.background.blur || 0);
    const blurVal = $('bgBlurVal');
    if (blurVal) blurVal.textContent = `${state.background.blur || 0}px`;
}

function init() {
    try {
        ensureDefaultBackground();
        initTheme();
        $('backgroundColor').value = state.background.solid;
        $('backgroundColorValue').textContent = state.background.solid.toUpperCase();
        const prefs = loadLinaPrefs();
        if (prefs?.metadata && typeof prefs.metadata === 'object') {
            state.audio.metadata.title = prefs.metadata.title || '';
            state.audio.metadata.artist = prefs.metadata.artist || '';
            state.audio.metadata.album = prefs.metadata.album || '';
            const titleInput = $('metaTitle'), artistInput = $('metaArtist'), albumInput = $('metaAlbum');
            if (titleInput) titleInput.value = state.audio.metadata.title;
            if (artistInput) artistInput.value = state.audio.metadata.artist;
            if (albumInput) albumInput.value = state.audio.metadata.album;
        }
        setAspectRatio(prefs?.aspect && ASPECTS[prefs.aspect] ? prefs.aspect : '9:16');
        renderMasterSourceUI();
        wireTitleCardControls();
        syncTitleCardUI();
        wireSyncControls();
        wireCaptions();
        wireBackgroundControls();
        syncBackgroundControls();
        qsa('[data-text-mode]').forEach(b => b.addEventListener('click', () => applyTextMode(b.dataset.textMode)));
        applyTextMode(state.captions.mode);
        wireCaptionStyleControls();
        syncCaptionStyleUI();
        readiness();
        setEffect(prefs?.effect && EFFECT_LABELS[prefs.effect] ? prefs.effect : (state.style.effect || 'apple'));
        redrawCurrentPreviewFrame();
        toast('KEFE Visualiser ready', 'success');
    } catch(err) {
        console.error('Init error:', err);
        toast('Error initializing', 'error');
    }
}

window.addEventListener('error', function(e) {
    console.error('Unhandled error:', e.error || e.message);
    if (!isExporting) toast('Something went wrong: ' + (e.message || 'unknown error'), 'error');
});
window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled rejection:', e.reason);
    if (!isExporting) toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error');
});

function checkExportCapability() {
    const missing = [];
    if (typeof WebAssembly === 'undefined') missing.push('WebAssembly');
    if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.toBlob !== 'function') missing.push('canvas image encoding');
    if (typeof TextEncoder === 'undefined') missing.push('text encoding');
    if (missing.length) {
        toast('This browser is missing: ' + missing.join(', ') + '. MP4 export is unavailable — try a current Chrome, Edge, Firefox, or Safari release.', 'error');
        $('exportBtn').disabled = true;
        $('exportBottom').disabled = true;
        return false;
    }
    return true;
}

startSingleRenderLoop();
init();
checkExportCapability();

window.addEventListener('beforeunload', function() {
    if (renderLoopId) cancelAnimationFrame(renderLoopId);
    if (audioURL) URL.revokeObjectURL(audioURL);
    if (backgroundURL) URL.revokeObjectURL(backgroundURL);
    if (albumArtworkURL) URL.revokeObjectURL(albumArtworkURL);
    if (media.video) { media.video.pause(); media.video.src = ''; }
    audio.pause();
    audio.src = '';
    try { window.kefeExportAbort?.abort(); } catch (e) {}
});

// KEFE section navigation: single native owner.
if (!window.__kefeSectionNavBound) {
  window.__kefeSectionNavBound = true;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('.section-nav-link[data-nav]');
    if (!link) return;
    const id = link.getAttribute('aria-controls');
    const section = id && document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    document.querySelectorAll('.section-nav-link').forEach(x => x.classList.toggle('active', x === link));
    document.querySelectorAll('.sidebar > .section').forEach(x => x.classList.toggle('active', x === section));
    section.scrollIntoView({block:'nearest'});
  });
}
