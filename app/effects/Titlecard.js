const linaClamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const linaSmoother = value => { const t = linaClamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };

const TITLECARD_DESIGN_LABELS = { auto: 'Auto (matches effect)', minimal: 'Minimal', spotlight: 'Spotlight', editorial: 'Editorial', statement: 'Statement' };
const TITLECARD_DESIGN_FOR_EFFECT = { apple: 'minimal', brat: 'statement', eternal: 'editorial', aurora: 'spotlight', pulse: 'spotlight', typewriter: 'editorial', instagram: 'statement', fadeup: 'minimal' };
export function resolveTitleCardDesign(appState) {
    const chosen = appState.style.titleCardStyle || 'auto';
    if (chosen !== 'auto' && TITLECARD_DESIGN_LABELS[chosen] && chosen !== 'auto') return chosen;
    return TITLECARD_DESIGN_FOR_EFFECT[appState.style.effect] || 'minimal';
}
export function titleCardPhase(appState, time) {
    const introDuration = linaClamp(Number(appState.style.titleCardDuration) || 3, 1, 15);
    const totalDuration = Number(appState.audio?.duration) || 0;
    const outroDuration = 1.6;
    const lyricLines = Array.isArray(appState.lyrics?.lines) ? appState.lyrics.lines : [];
    const firstLyricTime = lyricLines.reduce((first, line) => {
        const t = Number(line?.time);
        return Number.isFinite(t) ? Math.min(first, Math.max(0, t)) : first;
    }, Infinity);
    const lyricsStart = Number.isFinite(firstLyricTime) ? firstLyricTime : introDuration;
    const isIntro = time >= 0 && time < (Number.isFinite(firstLyricTime) ? totalDuration : introDuration);
    const outroStart = totalDuration > outroDuration ? totalDuration - outroDuration : Infinity;
    const isOutro = time >= outroStart && time <= totalDuration + 0.05;
    if (!isIntro && !isOutro) return null;
    const phaseTime = isOutro ? time - outroStart : time;
    const phaseDuration = isOutro ? outroDuration : introDuration;
    const enter = linaSmoother(linaClamp(phaseTime / 0.5));
    const exit = 1;
    const toLyrics = Number.isFinite(firstLyricTime)
        ? linaSmoother(linaClamp((time - (lyricsStart - 0.55)) / 0.65))
        : 0;
    return {
        intro: isIntro,
        alpha: linaClamp(enter * exit),
        enter,
        toLyrics,
        lyricsStart
    };
}
export function renderTitleCard(ctx, w, h, time, appState, artworkImage = null, audioLabelResolver = null) {
    if (!appState.style.titleCardEnabled) return false;
    const phase = titleCardPhase(appState, time);
    if (!phase) return false;
    const metadata = typeof audioLabelResolver === 'function' ? audioLabelResolver(appState.audio) : { title: '', artist: '', album: '' };
    const info = {
        title: metadata.title || '',
        artist: metadata.artist,
        album: metadata.album,
        artwork: appState.audio?.hasArtwork && artworkImage ? artworkImage : null
    };
    const design = resolveTitleCardDesign(appState);
    if (appState.style.effect === 'apple') {
        renderTitleCardMinimal(ctx, w, h, phase, info);
    } else if (design === 'spotlight') {
        renderTitleCardSpotlight(ctx, w, h, phase, info);
    } else if (design === 'editorial') renderTitleCardEditorial(ctx, w, h, phase, info);
    else if (design === 'statement') renderTitleCardStatement(ctx, w, h, appState, phase, info);
    else renderTitleCardMinimal(ctx, w, h, phase, info);
    return phase;
}

function drawTitleArtwork(ctx, artwork, cx, cy, size, radius) {
    if (!artwork) return false;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, radius);
    ctx.clip();
    const sw = artwork.naturalWidth || artwork.videoWidth || artwork.width;
    const sh = artwork.naturalHeight || artwork.videoHeight || artwork.height;
    if (sw && sh) {
        const side = Math.min(sw, sh);
        ctx.drawImage(artwork, (sw - side) / 2, (sh - side) / 2, side, side, cx - size / 2, cy - size / 2, size, size);
    }
    ctx.restore();
    return true;
}
function fitTitleText(ctx, text, weight, family, startSize, maxWidth, minSize = 24) {
    let size = Math.max(20, startSize);
    ctx.font = `${weight} ${size}px ${family}, Arial, sans-serif`;
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
        size -= 2;
        ctx.font = `${weight} ${size}px ${family}, Arial, sans-serif`;
    }
    return size;
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

function renderTitleCardMinimal(ctx, w, h, phase, info) {
    const { alpha, enter, toLyrics = 0 } = phase;
    const unit = Math.min(w, h);
    const lift = (1 - enter) * unit * 0.022;
    const centerY = h * 0.52 + lift;
    const contentY = centerY + (h * 0.16 - centerY) * toLyrics;
    const maxTextWidth = w * 0.78;
    const title = info.title;
    const artist = info.artist;
    const album = info.album;
    const artwork = info.artwork;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (toLyrics > 0.001) {
        const iphoneBoundaryWidth = Math.min(w, h * (390 / 844));
        const iphoneSideInset = iphoneBoundaryWidth * (31 / 390);
        const boundaryLeft = Math.max(0, (w - iphoneBoundaryWidth) / 2);
        const headerTop = Math.max(24, h * 0.035);
        const targetArtSize = 48;
        const targetLeft = boundaryLeft + iphoneSideInset;
        const targetRight = boundaryLeft + iphoneBoundaryWidth - iphoneSideInset;
        const targetArtY = headerTop;
        const targetDetailX = targetLeft + targetArtSize + 12;
        const iconGap = 16;
        const iconSize = 20;
        const targetIconsX = targetRight - iconSize;
        const targetTextRight = targetIconsX - iconGap;
        const morph = linaSmooth(toLyrics);
        const startArtSize = linaClamp(unit * 0.18, 126, 220);
        const startArtX = (w - startArtSize) / 2;
        const startArtY = contentY - startArtSize - unit * 0.055;
        const artSize = startArtSize + (targetArtSize - startArtSize) * morph;
        const artX = startArtX + (targetLeft - startArtX) * morph;
        const artY = startArtY + (targetArtY - startArtY) * morph;

        if (artwork) {
            ctx.save();
            ctx.shadowColor = `rgba(0,0,0,${0.24 * morph})`;
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(0,0,0,0.001)';
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, Math.max(6, artSize * 0.08));
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.beginPath();
            ctx.roundRect(artX, artY, artSize, artSize, Math.max(6, artSize * 0.08));
            ctx.clip();
            const sw = artwork.naturalWidth || artwork.videoWidth || artwork.width;
            const sh = artwork.naturalHeight || artwork.videoHeight || artwork.width;
            if (sw && sh) {
                const side = Math.min(sw, sh);
                ctx.drawImage(artwork, (sw - side) / 2, (sh - side) / 2, side, side, artX, artY, artSize, artSize);
            }
            ctx.restore();
        }

        const startTextX = w / 2;
        const startTitleY = contentY + startArtSize * 0.025;
        const startArtistY = startTitleY + Math.max(42, Math.round(startArtSize * 0.22));
        const titleX = startTextX + (targetDetailX - startTextX) * morph;
        const titleY = startTitleY + (headerTop + 15 - startTitleY) * morph;
        const artistY = startArtistY + (headerTop + 34 - startArtistY) * morph;
        const detailWidth = Math.max(1, targetTextRight - targetDetailX);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.24)';
        ctx.shadowBlur = 4;

        ctx.font = '700 16px -apple-system, "SF Pro Display", sans-serif';
        let displayTitle = String(title || '');
        while (displayTitle && ctx.measureText(displayTitle).width > detailWidth) {
            displayTitle = displayTitle.slice(0, -1);
            if (displayTitle.length > 1) displayTitle = displayTitle.slice(0, -1) + '…';
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = alpha;
        ctx.fillText(displayTitle, titleX, titleY);

        ctx.font = '500 14px -apple-system, "SF Pro Display", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(String(artist || album || ''), titleX, artistY);

        ctx.globalAlpha = alpha * morph;
        ctx.font = '400 20px -apple-system, "SF Pro Display", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('☆', targetIconsX - iconSize - 8, headerTop + targetArtSize / 2);
        ctx.fillText('⋯', targetIconsX, headerTop + targetArtSize / 2);

        ctx.restore();
        return true;
    }

    const artworkSize = linaClamp(unit * 0.18, 126, 220);
    ctx.translate(w / 2, contentY);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = Math.max(8, unit * 0.014);
    ctx.shadowOffsetY = Math.max(2, unit * 0.003);

    let textOriginY = 0;
    if (artwork) {
        const artY = -artworkSize - unit * 0.055;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(-artworkSize / 2, artY, artworkSize, artworkSize, Math.max(12, artworkSize * 0.07));
        ctx.clip();
        const sw = artwork.naturalWidth || artwork.videoWidth || artwork.width;
        const sh = artwork.naturalHeight || artwork.height;
        if (sw && sh) {
            const side = Math.min(sw, sh);
            ctx.drawImage(artwork, (sw - side) / 2, (sh - side) / 2, side, side, -artworkSize / 2, artY, artworkSize, artworkSize);
        }
        ctx.restore();
        textOriginY = unit * 0.025;
    }

    let titleSize = Math.max(36, Math.round(unit * 0.066));
    ctx.font = `800 ${titleSize}px "Open Sans",Arial,sans-serif`;
    while (titleSize > 30 && ctx.measureText(title).width > maxTextWidth) {
        titleSize -= 2;
        ctx.font = `800 ${titleSize}px "Open Sans",Arial,sans-serif`;
    }
    const metadataLines = Number(Boolean(artist)) + Number(Boolean(album));
    const titleY = textOriginY - (metadataLines ? titleSize * 0.55 : 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, 0, titleY);

    ctx.shadowBlur = Math.max(5, unit * 0.009);
    let cursorY = titleY + Math.max(42, titleSize * 0.92);
    if (artist) {
        let artistSize = Math.max(19, Math.round(unit * 0.026));
        ctx.font = `600 ${artistSize}px "Open Sans",Arial,sans-serif`;
        while (artistSize > 15 && ctx.measureText(artist).width > maxTextWidth) {
            artistSize -= 1;
            ctx.font = `600 ${artistSize}px "Open Sans",Arial,sans-serif`;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText(artist, 0, cursorY);
        cursorY += Math.max(30, artistSize * 1.45);
    }
    if (album) {
        let albumSize = Math.max(15, Math.round(unit * 0.019));
        ctx.font = `500 ${albumSize}px "Open Sans",Arial,sans-serif`;
        while (albumSize > 13 && ctx.measureText(album).width > maxTextWidth) {
            albumSize -= 1;
            ctx.font = `500 ${albumSize}px "Open Sans",Arial,sans-serif`;
        }
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        ctx.fillText(album, 0, cursorY);
    }
    ctx.restore();
    return true;
}

function renderTitleCardSpotlight(ctx, w, h, phase, info) {
    const { alpha, enter, toLyrics = 0 } = phase;
    const unit = Math.min(w, h);
    const glow = ctx.createRadialGradient(w / 2, h * 0.42, unit * 0.08, w / 2, h * 0.42, unit * 0.85);
    glow.addColorStop(0, 'rgba(255,255,255,0.16)');
    glow.addColorStop(0.45, 'rgba(0,0,0,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0.62)');

    ctx.save();
    ctx.globalAlpha = alpha;
    if (toLyrics < 0.999) {
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
    }

    const centerY = h * 0.50 + (1 - enter) * unit * 0.03;
    const topY = Math.max(unit * 0.09, h * 0.10);
    const cy = centerY + (topY - centerY) * toLyrics;
    const maxWidth = w * 0.78;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const artSize = linaClamp(unit * (0.34 - 0.24 * toLyrics), 72, 460);
    const artCenterY = cy - artSize * 0.34;
    let cursorY = cy;

    if (drawTitleArtwork(ctx, info.artwork, w / 2, artCenterY, artSize, Math.max(12, artSize * 0.06))) {
        cursorY = artCenterY + artSize / 2 + unit * (0.075 - 0.045 * toLyrics);
    }

    const titleSize = fitTitleText(
        ctx,
        info.title,
        800,
        '-apple-system, "SF Pro Display", sans-serif',
        Math.max(24, Math.round(unit * (0.062 - 0.024 * toLyrics))),
        maxWidth,
        18
    );
    ctx.font = `800 ${titleSize}px -apple-system, "SF Pro Display", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = Math.max(5, unit * 0.012);
    ctx.fillText(info.title, w / 2, cursorY);

    let below = cursorY + titleSize * 0.72;
    if (info.artist) {
        const artistSize = fitTitleText(
            ctx,
            info.artist,
            600,
            '-apple-system, "SF Pro Display", sans-serif',
            Math.max(16, Math.round(unit * (0.028 - 0.010 * toLyrics))),
            w * 0.70,
            14
        );
        ctx.font = `600 ${artistSize}px -apple-system, "SF Pro Display", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.shadowBlur = Math.max(3, unit * 0.006);
        ctx.fillText(info.artist, w / 2, below + artistSize);
        below += artistSize * 2.0;
    }

    if (info.album) {
        const albumSize = fitTitleText(
            ctx,
            info.album,
            500,
            '-apple-system, "SF Pro Display", sans-serif',
            Math.max(13, Math.round(unit * (0.019 - 0.006 * toLyrics))),
            w * 0.60,
            12
        );
        ctx.font = `500 ${albumSize}px -apple-system, "SF Pro Display", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.52)';
        ctx.fillText(info.album, w / 2, below + albumSize);
    }

    ctx.restore();
    return true;
}

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
    if (info.artist) {
        const kickerSize = Math.max(18, Math.round(unit * 0.026));
        ctx.font = `700 ${kickerSize}px ${theme.family}, Arial, sans-serif`;
        ctx.fillStyle = theme.muted;
        ctx.fillText(info.artist.toUpperCase(), marginX, unit * 0.13 + slide * 0.4);
    }
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
