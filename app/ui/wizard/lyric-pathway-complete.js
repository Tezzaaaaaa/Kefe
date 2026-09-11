/* KEFE Lyric Video pathway — final workflow integration layer.
 * Keeps the existing editor/renderer as the source of truth and only fixes
 * pathway ordering, ownership, state hand-off and user-facing controls.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STYLE_COPY = {
    apple: ['Apple', 'Clean, restrained lyric presentation'],
    brat: ['Brat', 'Bold, oversized kinetic type'],
    eternal: ['Eternal Sunshine', 'Soft handwritten movement'],
    aurora: ['Aurora', 'Glowing colour movement'],
    pulse: ['Pulse', 'Rhythmic scale and emphasis'],
    typewriter: ['Typewriter', 'Character-by-character reveal'],
    instagram: ['Instagram', 'Bold social lyric treatment'],
    fadeup: ['Fade Up', 'Soft upward lyric entrance'],
    decrypt: ['Decrypt', 'Characters resolve into lyrics'],
    blur: ['Blur In', 'Lyrics sharpen into focus'],
    shiny: ['Shiny', 'Moving highlight across text']
  };

  let lastStep = '';
  let styleBuiltFor = '';
  let previewBuilt = false;

  function metadataBlock() { return document.querySelector('.music-details'); }

  function moveMetadataToLyrics() {
    const panel = $('lyricsPanel');
    const details = metadataBlock();
    const heading = document.querySelector('.music-details-heading');
    const hint = $('musicSyncHint');
    if (!panel || !details) return;
    if (!panel.contains(details)) {
      const anchor = $('lyricsStatus') || panel.firstChild;
      const fragment = document.createDocumentFragment();
      if (heading && !panel.contains(heading)) fragment.appendChild(heading);
      fragment.appendChild(details);
      if (hint && !panel.contains(hint)) fragment.appendChild(hint);
      panel.insertBefore(fragment, anchor || null);
    }
    [$('metaArtist'), $('metaTitle'), $('metaAlbum')].forEach(input => input?.setAttribute('autocomplete', 'off'));
  }

  function removeMetadataFromSource() {
    const source = $('wizardSection');
    const details = metadataBlock();
    if (!source || !details || !source.contains(details)) return;
    moveMetadataToLyrics();
  }

  function syncLrcSource() {
    const textarea = $('lyricsText');
    const lines = window.state?.lyrics?.lines;
    if (!textarea || !Array.isArray(lines)) return;
    const format = value => {
      const t = Math.max(0, Number(value) || 0);
      const m = Math.floor(t / 60);
      const s = (t % 60).toFixed(2).padStart(5, '0');
      return `${String(m).padStart(2, '0')}:${s}`;
    };
    textarea.value = lines.map(line => `[${format(line.time)}]${String(line.text || '')}`).join('\n');
  }

  function wireSaveBridge() {
    const save = $('saveLyrics');
    if (!save || save.dataset.kefePathwayBridge === 'true') return;
    save.dataset.kefePathwayBridge = 'true';
    save.addEventListener('click', syncLrcSource, true);
  }

  function buildStyleControls() {
    if (document.body.dataset.wizardStep !== 'style') return;
    const host = $('wizardStyleMount');
    const source = $('lyricStyleBlock');
    if (!host || !source) return;

    source.querySelector('.effect-buttons')?.setAttribute('hidden', '');
    source.querySelector('.effect-label')?.setAttribute('hidden', '');
    source.querySelector('.sub-heading')?.setAttribute('hidden', '');

    let grid = $('kefeFinalStyleGrid');
    if (!grid) {
      grid = document.createElement('div');
      grid.id = 'kefeFinalStyleGrid';
      grid.className = 'kefe-final-style-grid';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', 'Lyric styles');
      host.appendChild(grid);
    }

    const buttons = qa('[data-effect]', source).filter(button => STYLE_COPY[button.dataset.effect]);
    const signature = buttons.map(button => button.dataset.effect).join('|');
    if (styleBuiltFor === signature && grid.children.length === buttons.length) {
      syncStyleSelection(grid);
      return;
    }
    styleBuiltFor = signature;
    grid.replaceChildren();

    buttons.forEach(sourceButton => {
      const key = sourceButton.dataset.effect;
      const [name, description] = STYLE_COPY[key];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kefe-final-style-card';
      card.dataset.effect = key;
      card.setAttribute('aria-pressed', 'false');
      const demo = document.createElement('span');
      demo.className = `kefe-final-style-demo effect-${key}`;
      demo.textContent = 'LYRICS';
      const copy = document.createElement('span');
      copy.className = 'kefe-final-style-copy';
      const title = document.createElement('strong');
      title.textContent = name;
      const hint = document.createElement('small');
      hint.textContent = description;
      copy.append(title, hint);
      card.append(demo, copy);
      card.addEventListener('click', () => {
        sourceButton.click();
        syncStyleSelection(grid);
        window.redrawCurrentPreviewFrame?.();
      });
      grid.appendChild(card);
    });
    syncStyleSelection(grid);
  }

  function syncStyleSelection(grid = $('kefeFinalStyleGrid')) {
    if (!grid) return;
    const current = window.state?.style?.effect || 'apple';
    qa('[data-effect]', grid).forEach(card => {
      const active = card.dataset.effect === current;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
  }

  function separateStyleFromBackground() {
    const styleHost = $('wizardStyleMount');
    const background = $('backgroundSection');
    if (!styleHost || !background) return;
    const titleBlock = [...background.querySelectorAll('.sub-block')].find(block => /title card/i.test(block.querySelector('.sub-heading')?.textContent || ''));
    if (!titleBlock) return;
    if (document.body.dataset.wizardStep === 'style') {
      if (!styleHost.contains(titleBlock)) styleHost.appendChild(titleBlock);
    } else if (document.body.dataset.wizardStep === 'background') {
      if (!background.contains(titleBlock)) background.appendChild(titleBlock);
    }
  }

  function cleanStylePreview() {
    if (document.body.dataset.wizardStep !== 'style') return;
    const preview = q('.wizard-style-preview');
    if (!preview) return;
    const media = q('.wizard-style-preview-media-wrap', preview);
    const shade = q('.wizard-style-preview-shade', preview);
    if (media) { media.replaceChildren(); media.setAttribute('aria-hidden', 'true'); }
    if (shade) shade.style.display = 'none';
    preview.style.background = 'var(--surface-3)';
    preview.style.backgroundImage = 'none';
    const content = q('.wizard-style-preview-content', preview);
    if (content) {
      content.style.color = 'var(--text)';
      q('.wizard-style-preview-eyebrow', content)?.replaceChildren(document.createTextNode('LYRIC STYLE'));
      const effect = q('.wizard-style-preview-effect', content);
      if (effect) effect.style.borderColor = 'var(--line-strong)';
    }
  }

  function improveBackgroundStep() {
    if (document.body.dataset.wizardStep !== 'background') return;
    const section = $('backgroundSection');
    if (!section) return;
    section.classList.add('kefe-background-step');
    q('.background-choice-grid', section)?.setAttribute('aria-label', 'Background choices');
    const upload = $('backgroundInput');
    const status = $('backgroundStatus');
    if (upload && !upload.dataset.kefeBackgroundHint) {
      upload.dataset.kefeBackgroundHint = 'true';
      if (status && !status.textContent.trim()) status.textContent = 'No custom background selected';
    }
  }

  function improvePreviewStep() {
    if (document.body.dataset.wizardStep !== 'preview') return;
    const panel = $('wizardSection');
    if (!panel || previewBuilt) return;
    previewBuilt = true;
    const checks = document.createElement('div');
    checks.id = 'kefeFinalPreviewChecks';
    checks.className = 'kefe-final-preview-checks';
    const refresh = () => {
      const state = window.state || {};
      const audio = Boolean(state.audio?.file && state.audio?.ready && Number(state.audio?.duration) > 0);
      const metadata = Boolean($('metaArtist')?.value.trim() && $('metaTitle')?.value.trim());
      const lyrics = Array.isArray(state.lyrics?.lines) && state.lyrics.lines.length > 0;
      const rows = [['Audio', audio, audio ? 'Ready' : 'Missing'], ['Song details', metadata, metadata ? 'Ready' : 'Artist + Title required'], ['Synced lyrics', lyrics, lyrics ? `${state.lyrics.lines.length} lines` : 'Missing'], ['Background', true, 'Ready to review']];
      checks.replaceChildren(...rows.map(([label, ok, text]) => {
        const row = document.createElement('div');
        row.className = `kefe-final-preview-check ${ok ? 'ok' : 'warn'}`;
        row.innerHTML = `<span>${label}</span><strong>${text}</strong>`;
        return row;
      }));
    };
    panel.appendChild(checks);
    refresh();
    window.addEventListener('kefe:lyrics-resolved', refresh);
    document.addEventListener('input', event => {
      if (['metaArtist', 'metaTitle', 'metaAlbum'].includes(event.target?.id)) refresh();
    });
  }

  function stepChanged() {
    const step = document.body.dataset.wizardStep || '';
    if (step === lastStep) return;
    lastStep = step;
    if (step === 'lyrics') { moveMetadataToLyrics(); wireSaveBridge(); }
    if (step === 'source') removeMetadataFromSource();
    if (step === 'style') {
      previewBuilt = false;
      cleanStylePreview();
      buildStyleControls();
      separateStyleFromBackground();
    }
    if (step === 'background') improveBackgroundStep();
    if (step === 'preview') improvePreviewStep();
  }

  function refresh() {
    stepChanged();
    wireSaveBridge();
    if (document.body.dataset.wizardStep === 'lyrics') moveMetadataToLyrics();
    if (document.body.dataset.wizardStep === 'style') { cleanStylePreview(); buildStyleControls(); separateStyleFromBackground(); }
    if (document.body.dataset.wizardStep === 'background') improveBackgroundStep();
  }

  function start() {
    const style = document.createElement('style');
    style.id = 'kefeFinalLyricPathwayCSS';
    style.textContent = `
      .kefe-final-style-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
      .kefe-final-style-card{display:grid;grid-template-columns:1fr;gap:9px;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--text);text-align:left;cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
      .kefe-final-style-card:hover{transform:translateY(-1px);border-color:var(--line-strong)}
      .kefe-final-style-card.selected{border-color:var(--red);box-shadow:0 0 0 1px var(--red);background:var(--surface-2)}
      .kefe-final-style-demo{display:grid;place-items:center;min-height:86px;border-radius:10px;border:1px solid var(--line);background:var(--surface-3);color:var(--text);font-size:18px;font-weight:800;letter-spacing:.08em;overflow:hidden}
      .kefe-final-style-demo.effect-brat{font-size:25px;letter-spacing:-.08em;transform:rotate(-1deg)}
      .kefe-final-style-demo.effect-eternal{font-style:italic;filter:blur(.25px)}
      .kefe-final-style-demo.effect-aurora{letter-spacing:.18em;text-shadow:0 0 16px currentColor}
      .kefe-final-style-demo.effect-pulse{animation:kefeStylePulse 1.1s ease-in-out infinite}
      .kefe-final-style-demo.effect-typewriter{overflow:hidden;justify-content:flex-start;padding-left:16px;white-space:nowrap;animation:kefeStyleType 1.7s steps(7,end) infinite}
      .kefe-final-style-demo.effect-instagram{font-style:italic;font-weight:900}
      .kefe-final-style-demo.effect-fadeup{animation:kefeStyleRise 1s ease-in-out infinite}
      .kefe-final-style-demo.effect-decrypt{letter-spacing:.2em}
      .kefe-final-style-demo.effect-blur{filter:blur(2px);animation:kefeStyleBlur 1.6s ease-in-out infinite}
      .kefe-final-style-demo.effect-shiny{background:linear-gradient(110deg,var(--surface-3) 35%,var(--surface) 50%,var(--surface-3) 65%);background-size:220% 100%;animation:kefeStyleShine 1.8s linear infinite}
      .kefe-final-style-copy{display:grid;gap:3px}.kefe-final-style-copy strong{font-size:13px}.kefe-final-style-copy small{font-size:11px;color:var(--text-3);line-height:1.35}
      .kefe-final-preview-checks{display:grid;gap:7px;margin-top:16px}.kefe-final-preview-check{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:12px}.kefe-final-preview-check.ok strong{color:#2f9e5b}.kefe-final-preview-check.warn strong{color:#b36b00}
      .kefe-background-step{padding-bottom:24px}
      body.wizard-mode[data-wizard-step="style"] .wizard-style-preview-media-wrap,body.wizard-mode[data-wizard-step="style"] .wizard-style-preview-shade{display:none!important}
      @keyframes kefeStylePulse{50%{transform:scale(1.06)}}@keyframes kefeStyleRise{50%{transform:translateY(-5px)}}@keyframes kefeStyleType{from{max-width:0}to{max-width:100%}}@keyframes kefeStyleBlur{50%{filter:blur(0)}}@keyframes kefeStyleShine{to{background-position:-220% 0}}
      @media(max-width:700px){.kefe-final-style-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wizard-step', 'class'] });
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
