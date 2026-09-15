/* KEFE Auto Lyrics Sync — minimal, no DOM manipulation.
   Just listens for resolved lyrics and triggers the DTW aligner.
   The metadata fields stay where they belong in index.html. */
(function(){
    'use strict';
    if (window.__kefeAutoLyricsSync) return;
    window.__kefeAutoLyricsSync = true;

    // ---- Trigger the aligner when lyrics are resolved ----
    document.addEventListener('kefe:lyrics-resolved', function(event) {
        alignResolvedLyrics(event);
    });

    async function alignResolvedLyrics(event) {
        var st = window.state;
        var aligner = window.kefeLyricAligner;
        var captionGen = window.kefeCaptionGen;
        if (!st || !aligner || !captionGen || typeof captionGen.transcribeSource !== 'function') return;
        if (st.lyrics && st.lyrics.alignment && st.lyrics.alignment.method === 'media-audio') return;

        var status = document.getElementById('lyricsStatus');
        if (status) status.textContent = 'Aligning lyrics to the actual audio…';

        var maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++) {
            if (st.lyrics && st.lyrics.alignment && st.lyrics.alignment.method === 'media-audio') return;
            try {
                var transcription = await captionGen.transcribeSource({
                    onStatus: function(message) {
                        if (status) status.textContent = 'Aligning lyrics… ' + message;
                    }
                });
                if (!transcription || !transcription.words) throw new Error('No transcript');

                var result = await aligner.align(
                    st.lyrics && st.lyrics.lines ? st.lyrics.lines : [],
                    transcription.words,
                    Number(st.audio && st.audio.duration) || 0
                );

                if (result && result.aligned) {
                    st.lyrics.lines = result.lines;
                    st.lyrics.alignment = {
                        method: 'media-audio',
                        confidence: result.confidence,
                        anchors: result.anchors
                    };
                    if (typeof window.redrawCurrentPreviewFrame === 'function') {
                        window.redrawCurrentPreviewFrame();
                    }
                    if (status) status.textContent = 'Lyrics synced to media audio — ' + result.anchors + ' anchors matched.';
                    return;
                }
                if (status) status.textContent = 'Alignment needs another pass — ' + (result ? result.anchors : 0) + ' anchors.';
            } catch (error) {
                console.warn('[KEFE auto-lyrics-sync] attempt ' + attempt + ' failed:', error);
                if (status) status.textContent = 'Alignment attempt ' + attempt + ' failed.';
            }
            if (attempt < maxAttempts) await new Promise(function(r){ setTimeout(r, 1500 * attempt); });
        }
        if (status) status.textContent = 'Automatic alignment could not lock on. You can adjust manually with the Lyric sync slider.';
    }

    console.log('[KEFE] auto-lyrics-sync loaded (minimal)');
})();
