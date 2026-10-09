/* KEFE — lyric studio UI.
   Everything about how timed lyrics are shown, edited and exported, built on app/lyrics/lyric-model.js:
     • Display mode (Line / Word / Karaoke / Chunk) and text case — Effects panel
     • Line and word timing editor with undo — Lyrics panel
     • LRC / SRT / timed-JSON downloads and the pre-export review checklist — Lyrics and Export panels
   The editor (editor.js) owns the canvas and exposes window.kefeLyrics; this file never draws. */
(function () {
  'use strict';
  var M = window.kefeLyricModel;
  var API = function () { return window.kefeLyrics; };
  if (!M) { console.error('[KEFE lyric studio] lyric-model.js must load first'); return; }

  var KEY = 'kefe.lyricStudio.v1';
  var DEFAULT = { mode: 'line', chunk: 3, caseMode: 'asis' };
  var MODES = [
    ['line', 'Line', 'Whole line at a time.'],
    ['word', 'Word', 'One word at a time. Suits slower songs.'],
    ['karaoke', 'Karaoke', 'Whole line with the active word highlighted. Uses the Karaoke effect.'],
    ['chunk', 'Chunk', 'Short phrases. Suits quick, dense lyrics.']
  ];
  var CASES = [['asis', 'As written'], ['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case'], ['sentence', 'Sentence case']];
  var S = Object.assign({}, DEFAULT);
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if (MODES.some(function (m) { return m[0] === saved.mode; })) S.mode = saved.mode;
      if (CASES.some(function (c) { return c[0] === saved.caseMode; })) S.caseMode = saved.caseMode;
      if (Number.isFinite(saved.chunk)) S.chunk = Math.max(1, Math.min(12, Math.round(saved.chunk)));
    }
  } catch (e) { /* storage unavailable */ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  /* ---------- shaping for the effects ---------- */
  var memo = { src: null, key: '', out: null };
  function shape(lines, effect) {
    var mode = effect === 'apple' ? 'line' : S.mode; /* Apple keeps its own line-by-line behaviour */
    if (mode === 'line' && S.caseMode === 'asis') return lines;
    var key = mode + '|' + S.chunk + '|' + S.caseMode;
    if (memo.src === lines && memo.key === key) return memo.out;
    var out = M.displayLines(lines, { mode: mode, chunk: S.chunk, caseMode: S.caseMode });
    memo = { src: lines, key: key, out: out };
    return out;
  }

  /* ---------- small DOM helpers ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, title, cls) {
    var b = el('button', 'kefe-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } return b;
  }
  function stamp(t) { return M.fmtStamp(t, 2); }
  function audio() { return document.getElementById('kefeAudio'); }
  function now() { var a = audio(); return a && Number.isFinite(a.currentTime) ? a.currentTime : 0; }
  function redraw() { if (API()) API().redraw(); }

  /* ---------- Effects panel: display mode + case ---------- */
  function buildDisplayUi() {
    var host = document.querySelector('[data-panel-view="effects"] .kefe-form');
    var effectRow = document.getElementById('lyricEffect');
    if (!host || !effectRow || document.getElementById('kefeDisplayGroup')) return;
    var wrap = el('div'); wrap.id = 'kefeDisplayGroup'; wrap.style.display = 'grid'; wrap.style.gap = '12px';

    var modeBox = el('div');
    modeBox.appendChild(el('label', 'kefe-label', 'Lyric display'));
    var seg = el('div', 'kefe-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Lyric display mode');
    var hint = el('div', 'kefe-meta'); hint.style.marginTop = '6px';
    var chunkBox = el('label', 'kefe-visualiser-field');
    var chunkHead = el('span'), chunkOut = el('output'); chunkHead.append(el('b', null, 'Words per chunk'), chunkOut);
    var chunk = document.createElement('input'); chunk.type = 'range'; chunk.min = 2; chunk.max = 8; chunk.step = 1;
    chunkBox.append(chunkHead, chunk);
    var buttons = {};
    MODES.forEach(function (m) {
      var b = el('button', 'kefe-seg-btn', m[1]); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.mode = m[0];
      b.addEventListener('click', function () { setMode(m[0]); });
      buttons[m[0]] = b; seg.appendChild(b);
    });
    function sync() {
      MODES.forEach(function (m) { var on = S.mode === m[0]; buttons[m[0]].setAttribute('aria-checked', on ? 'true' : 'false'); buttons[m[0]].classList.toggle('active', on); });
      hint.textContent = MODES.filter(function (m) { return m[0] === S.mode; })[0][2];
      chunkBox.hidden = S.mode !== 'chunk';
      chunk.value = S.chunk; chunkOut.textContent = S.chunk;
    }
    function setMode(mode) {
      S.mode = mode; persist(); sync();
      if (mode === 'karaoke') {
        var sel = document.getElementById('lyricEffect');
        if (sel && sel.value !== 'karaoke' && sel.querySelector('option[value="karaoke"]')) { sel.value = 'karaoke'; sel.dispatchEvent(new Event('change')); }
      }
      redraw();
    }
    chunk.addEventListener('input', function () { S.chunk = Number(chunk.value); persist(); sync(); redraw(); });
    modeBox.append(seg, hint, chunkBox);

    var caseBox = el('div'); caseBox.appendChild(el('label', 'kefe-label', 'Text case'));
    var caseSel = el('select', 'kefe-select'); caseSel.id = 'lyricCase';
    CASES.forEach(function (c) { var o = el('option', null, c[1]); o.value = c[0]; caseSel.appendChild(o); });
    caseSel.value = S.caseMode;
    caseSel.addEventListener('change', function () { S.caseMode = caseSel.value; persist(); redraw(); });
    caseBox.appendChild(caseSel);

    wrap.append(modeBox, caseBox);
    var effectBlock = effectRow.parentNode;
    effectBlock.parentNode.insertBefore(wrap, effectBlock.nextSibling);
    sync();
  }

  /* ---------- Lyrics panel: timing editor ---------- */
  var history = [], listEl, statusEl, undoBtn, followBox, openWords = new Set(), renderTimer = null;

  function lines() { return API() ? API().lines() : []; }
  function commit(next, opts) {
    var cur = lines();
    history.push(M.cloneLines(cur)); if (history.length > 60) history.shift();
    if (!(opts && opts.keepOpen)) openWords = new Set(openWords);
    API().set(next, 'studio');
    render();
  }
  function undo() {
    if (!history.length) return;
    var prev = history.pop();
    API().set(prev, 'studio'); render();
  }
  function setLineEnd(i, t) {
    var out = M.cloneLines(lines());
    if (!out[i] || !Number.isFinite(t)) return;
    out[i].endTime = t; out[i].manualEnd = true;
    commit(M.finalize(out));
  }
  function seekTo(t) { if (API()) API().seek(Math.max(0, t)); }

  function timeInput(value, onCommit, label) {
    var input = el('input', 'kefe-input kefe-time-input'); input.type = 'text'; input.value = stamp(value);
    input.setAttribute('aria-label', label); input.inputMode = 'decimal'; input.spellcheck = false;
    input.addEventListener('change', function () {
      var t = M.parseStamp(input.value);
      if (!Number.isFinite(t)) { input.value = stamp(value); return; }
      onCommit(t);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    return input;
  }

  function lineRow(line, i, all) {
    var row = el('div', 'kefe-line'); row.dataset.index = String(i);
    var main = el('div', 'kefe-line-main');
    var num = el('span', 'kefe-line-num', String(i + 1));
    var start = timeInput(line.time, function (t) { commit(M.setLineStart(all, i, t)); }, 'Line ' + (i + 1) + ' start');
    var minus = btn('−', 'Start 0.1 seconds earlier (pickup)', 'kefe-nudge'), plus = btn('+', 'Start 0.1 seconds later', 'kefe-nudge');
    minus.addEventListener('click', function () { commit(M.setLineStart(all, i, line.time - 0.1)); });
    plus.addEventListener('click', function () { commit(M.setLineStart(all, i, line.time + 0.1)); });
    var text = el('input', 'kefe-input kefe-line-text'); text.type = 'text'; text.value = line.text; text.spellcheck = true;
    text.setAttribute('aria-label', 'Line ' + (i + 1) + ' text');
    text.addEventListener('change', function () { commit(M.setLineText(all, i, text.value)); });
    text.addEventListener('keydown', function (e) { if (e.key === 'Enter') text.blur(); });
    main.append(num, start, minus, plus, text);

    var tools = el('div', 'kefe-line-tools');
    var play = btn('Play', 'Play from this line', 'kefe-mini'); play.addEventListener('click', function () {
      seekTo(line.time - 0.4); var a = audio(); if (a && a.src && a.paused) a.play().catch(function () { /* autoplay blocked */ });
    });
    var nowBtn = btn('Set to now', 'Move this line’s start to the playhead', 'kefe-mini');
    nowBtn.addEventListener('click', function () { commit(M.setLineStart(all, i, now())); });
    var endLabel = el('span', 'kefe-meta', 'Ends');
    var end = timeInput(line.endTime, function (t) { setLineEnd(i, t); }, 'Line ' + (i + 1) + ' end');
    var hold = btn('Hold +0.25s', 'Extend a held word or sustained vowel', 'kefe-mini');
    hold.addEventListener('click', function () { setLineEnd(i, line.endTime + 0.25); });
    var words = btn(openWords.has(i) ? 'Hide words' : 'Words', 'Edit word timing', 'kefe-mini');
    words.addEventListener('click', function () { if (openWords.has(i)) openWords.delete(i); else openWords.add(i); render(); });
    var add = btn('Add line', 'Insert a line after this one', 'kefe-mini');
    add.addEventListener('click', function () { openWords = new Set(); commit(M.insertLine(all, i, 'New line')); });
    var merge = btn('Merge ↓', 'Merge with the next line', 'kefe-mini'); merge.disabled = i >= all.length - 1;
    merge.addEventListener('click', function () { openWords = new Set(); commit(M.mergeWithNext(all, i)); });
    var del = btn('Delete', 'Delete this line', 'kefe-mini');
    del.addEventListener('click', function () { openWords = new Set(); commit(M.removeLine(all, i)); });
    tools.append(play, nowBtn, endLabel, end, hold, words, add, merge, del);
    row.append(main, tools);

    if (openWords.has(i)) {
      var panel = el('div', 'kefe-words');
      var real = M.hasRealWords(line);
      var head = el('div', 'kefe-words-head');
      head.appendChild(el('span', 'kefe-meta', real ? 'Word timing from the source or your edits.' : 'Estimated from line timing. Edit any word to fix it.'));
      var est = btn('Re-estimate', 'Spread the words evenly across the line', 'kefe-mini');
      est.addEventListener('click', function () { commit(M.estimateLineWords(all, i), { keepOpen: true }); });
      head.appendChild(est);
      if (real) {
        var clr = btn('Clear word timing', 'Go back to estimated word timing', 'kefe-mini');
        clr.addEventListener('click', function () { commit(M.clearLineWords(all, i), { keepOpen: true }); });
        head.appendChild(clr);
      }
      panel.appendChild(head);
      var list = el('div', 'kefe-word-list');
      var next = all[i + 1];
      M.wordsOf(line, next ? next.time : NaN).forEach(function (w, k, arr) {
        var chip = el('div', 'kefe-word');
        chip.appendChild(el('span', 'kefe-word-text', w.text));
        chip.appendChild(timeInput(w.time, function (t) { commit(M.setWordStart(all, i, k, t), { keepOpen: true }); }, 'Word ' + w.text + ' start'));
        var tap = btn('Now', 'Set this word’s start to the playhead', 'kefe-mini');
        tap.addEventListener('click', function () { commit(M.setWordStart(all, i, k, now()), { keepOpen: true }); });
        chip.appendChild(tap);
        if (k > 0) {
          var split = btn('Split', 'Start a new line at this word', 'kefe-mini');
          split.addEventListener('click', function () { openWords = new Set(); commit(M.splitAtWord(all, i, k)); });
          chip.appendChild(split);
        }
        list.appendChild(chip);
      });
      panel.appendChild(list);
      row.appendChild(panel);
    }
    return row;
  }

  function render() {
    if (!listEl) return;
    var all = lines(), top = listEl.scrollTop;
    listEl.textContent = '';
    if (!all.length) {
      listEl.appendChild(el('div', 'kefe-empty-panel', 'No timed lyrics yet. Upload audio to fetch them, paste LRC above, or upload an .lrc file.'));
    } else {
      var frag = document.createDocumentFragment();
      all.forEach(function (l, i) { frag.appendChild(lineRow(l, i, all)); });
      listEl.appendChild(frag);
    }
    listEl.scrollTop = top;
    if (undoBtn) undoBtn.disabled = !history.length;
    if (statusEl) statusEl.textContent = all.length ? all.length + ' lines' : '';
    markActive(true);
  }
  function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 160); }

  var lastActive = -2;
  function markActive(force) {
    if (!listEl) return;
    var all = lines(), t = now() + (window.kefeSettings ? -(Number(window.kefeSettings.get('lyricOffset')) || 0) : 0), idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].time <= t) idx = i; else break; }
    if (!force && idx === lastActive) return;
    lastActive = idx;
    var rows = listEl.children;
    for (var r = 0; r < rows.length; r++) rows[r].classList.toggle('is-active', Number(rows[r].dataset.index) === idx);
    var a = audio();
    if (followBox && followBox.checked && a && !a.paused && idx >= 0) {
      var row = listEl.querySelector('[data-index="' + idx + '"]');
      if (row && !listEl.contains(document.activeElement)) {
        var top = row.offsetTop - listEl.clientHeight / 3;
        listEl.scrollTop = Math.max(0, top);
      }
    }
  }

  /* ---------- downloads ---------- */
  function baseName() {
    var a = (document.getElementById('songArtist') || {}).value || '', t = (document.getElementById('songTitle') || {}).value || '';
    return [a, t].map(function (v) { return v.trim(); }).filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '') || 'kefe-lyrics';
  }
  function offset() { return window.kefeSettings ? Number(window.kefeSettings.get('lyricOffset')) || 0 : 0; }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ';charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }
  function meta() {
    var v = function (id) { return ((document.getElementById(id) || {}).value || '').trim(); };
    var a = audio();
    return { title: v('songTitle'), artist: v('songArtist'), album: v('songAlbum'), duration: a && Number.isFinite(a.duration) ? a.duration : null };
  }
  function exportLines(applyOffset) {
    var all = lines();
    return applyOffset && offset() ? M.shiftAll(all, offset()) : all;
  }
  var exporters = {
    lrc: function () { return { text: M.toLrc(exportLines(true), { meta: meta(), words: M.displayLines(lines(), {}).some(M.hasRealWords) }), ext: 'lrc', type: 'text/plain' }; },
    srt: function () { return { text: M.toSrt(exportLines(true), { mode: S.mode === 'karaoke' ? 'line' : S.mode, chunk: S.chunk, caseMode: S.caseMode }), ext: 'srt', type: 'application/x-subrip' }; },
    json: function () { var m = meta(); m.offset = offset(); return { text: M.toTimedJson(lines(), m), ext: 'json', type: 'application/json' }; }
  };
  function downloadAs(kind, statusNode) {
    if (!lines().length) { if (statusNode) statusNode.textContent = 'There are no timed lyrics to download yet.'; return; }
    var r = exporters[kind]();
    download(baseName() + '.' + r.ext, r.text, r.type);
    if (statusNode) statusNode.textContent = 'Downloaded ' + baseName() + '.' + r.ext;
  }
  function downloadRow(statusNode) {
    var row = el('div', 'kefe-download-row');
    [['lrc', 'Lyrics (.lrc)'], ['srt', 'Subtitles (.srt)'], ['json', 'Timed JSON']].forEach(function (d) {
      var b = btn(d[1], 'Download ' + d[1]); b.addEventListener('click', function () { downloadAs(d[0], statusNode); }); row.appendChild(b);
    });
    return row;
  }

  function buildLyricsUi() {
    var host = document.querySelector('[data-panel-view="lyrics"] .kefe-form');
    if (!host || document.getElementById('kefeTimingEditor')) return;
    var box = el('div', 'kefe-timing-editor'); box.id = 'kefeTimingEditor';
    var head = el('div', 'kefe-timing-editor-head');
    var titleBox = el('div'); titleBox.append(el('div', 'kefe-label', 'Timing editor'), el('div', 'kefe-meta', 'Fix words, move line starts (pickups), extend held words, split or merge lines.'));
    var controls = el('div', 'kefe-timing-editor-actions');
    undoBtn = btn('Undo', 'Undo the last timing edit'); undoBtn.disabled = true; undoBtn.addEventListener('click', undo);
    var follow = el('label', 'kefe-follow'); followBox = document.createElement('input'); followBox.type = 'checkbox'; followBox.checked = true;
    follow.append(followBox, document.createTextNode(' Follow playback'));
    statusEl = el('span', 'kefe-meta');
    controls.append(statusEl, follow, undoBtn);
    head.append(titleBox, controls);
    listEl = el('div', 'kefe-line-list'); listEl.setAttribute('role', 'list');
    var dlStatus = el('div', 'kefe-meta'); dlStatus.setAttribute('role', 'status');
    box.append(head, listEl, downloadRow(dlStatus), dlStatus);
    host.appendChild(box);
    render();
  }

  /* ---------- Export panel: downloads + review checklist ---------- */
  function buildExportUi() {
    var host = document.querySelector('[data-panel-view="export"] .kefe-form');
    if (!host || document.getElementById('kefeExportExtras')) return;
    var wrap = el('div'); wrap.id = 'kefeExportExtras'; wrap.style.display = 'grid'; wrap.style.gap = '12px';

    var dl = el('div'); var dlStatus = el('div', 'kefe-meta'); dlStatus.setAttribute('role', 'status');
    dl.append(el('div', 'kefe-label', 'Lyric files'), downloadRow(dlStatus), dlStatus);

    var review = el('div', 'kefe-review');
    review.appendChild(el('div', 'kefe-label', 'Before you export'));
    [
      'Read the lyrics silently: spelling, punctuation, line breaks.',
      'Listen once without editing: do the lines land with the vocal, especially chorus entrances?',
      'Check the preview at phone size: is the text still readable?'
    ].forEach(function (t, i) {
      var l = el('label', 'kefe-review-item'), c = document.createElement('input'); c.type = 'checkbox'; c.id = 'kefeReview' + i;
      l.append(c, document.createTextNode(' ' + t)); review.appendChild(l);
    });
    var phone = btn('Phone-size preview', 'Shrink the preview to roughly phone size'); phone.setAttribute('aria-pressed', 'false');
    phone.addEventListener('click', function () {
      var on = document.documentElement.classList.toggle('kefe-phone-check');
      phone.setAttribute('aria-pressed', on ? 'true' : 'false'); phone.textContent = on ? 'Back to full size' : 'Phone-size preview';
    });
    review.appendChild(phone);
    wrap.append(dl, review);
    var status = document.getElementById('exportStatus');
    host.insertBefore(wrap, status || null);
  }

  /* ---------- wiring ---------- */
  function init() {
    buildDisplayUi(); buildLyricsUi(); buildExportUi();
    window.addEventListener('kefe-lyrics-changed', function (e) {
      if (e.detail && e.detail.source === 'studio') return;
      if (!(e.detail && e.detail.source === 'text')) history = [];
      scheduleRender();
    });
    var a = audio();
    if (a) ['timeupdate', 'seeked', 'play', 'pause'].forEach(function (ev) { a.addEventListener(ev, function () { markActive(false); }); });
    (function tick() { if (a && !a.paused) markActive(false); requestAnimationFrame(tick); })();
    if (window.kefeSettings) window.kefeSettings.onChange(function (k) { if (k === 'lyricOffset') markActive(true); });
    redraw();
  }

  window.kefeLyricStudio = {
    shape: shape,
    settings: function () { return Object.assign({}, S); },
    download: function (kind) { downloadAs(kind); },
    exportText: function (kind) { return exporters[kind]().text; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
