/* KEFE Project Engine
 * Local-first project persistence, autosave, recovery and lightweight history.
 * Intentionally independent from the renderer so it can be adopted incrementally.
 */
(() => {
    'use strict';

    const DB_NAME = 'kefe-projects-v1';
    const DB_VERSION = 1;
    const STORE = 'projects';
    const ACTIVE_ID = 'active';
    const HISTORY_LIMIT = 40;
    const AUTOSAVE_MS = 1200;

    const q = id => document.getElementById(id);
    const safe = (fn, fallback = null) => { try { return fn(); } catch (_) { return fallback; } };

    const FIELD_IDS = [
        'metaTitle','metaArtist','metaAlbum','lyricsOffset','syncLive','captionColor',
        'captionOpacity','captionShadow','backgroundColor','bgDim','bgBlur',
        'titleCardEnabled','titleCardDuration','titleCardStyle','exportPreset','aspectSelect',
        'themeSelect'
    ];

    const SELECTORS = [
        '#lyricStyleBlock [data-effect].active',
        '#lyricStyleBlock [data-effect][aria-pressed="true"]',
        '[data-background-preset].active',
        '[data-caption-pos].active',
        '[data-text-mode].active'
    ];

    const memory = {
        revision: 0,
        dirty: false,
        saveTimer: null,
        history: [],
        historyIndex: -1,
        restoring: false,
        lastSavedAt: 0
    };

    function openDB() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open project database'));
        });
    }

    async function dbPut(project) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(project);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    }

    async function dbGet(id = ACTIVE_ID) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const request = tx.objectStore(STORE).get(id);
            request.onsuccess = () => { db.close(); resolve(request.result || null); };
            request.onerror = () => { db.close(); reject(request.error); };
        });
    }

    function readField(id) {
        const el = q(id);
        if (!el) return undefined;
        if (el.type === 'checkbox') return Boolean(el.checked);
        return el.value;
    }

    function writeField(id, value) {
        const el = q(id);
        if (!el || value === undefined || value === null) return;
        if (el.type === 'checkbox') el.checked = Boolean(value);
        else el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function activeChoice(selector) {
        const el = document.querySelector(selector);
        return el ? (el.dataset.effect || el.dataset.backgroundPreset || el.dataset.captionPos || el.dataset.textMode || null) : null;
    }

    function getLyricsText() {
        return safe(() => q('lyricsText')?.value || '', '');
    }

    function collectFormState() {
        const fields = {};
        FIELD_IDS.forEach(id => { const value = readField(id); if (value !== undefined) fields[id] = value; });
        return {
            fields,
            choices: {
                effect: activeChoice('#lyricStyleBlock [data-effect].active') || activeChoice('#lyricStyleBlock [data-effect][aria-pressed="true"]'),
                background: activeChoice('[data-background-preset].active'),
                captionPosition: activeChoice('[data-caption-pos].active'),
                textMode: activeChoice('[data-text-mode].active')
            },
            lyricsText: getLyricsText(),
            projectType: safe(() => window.state?.projectType, null),
            aspect: safe(() => window.state?.aspect, null),
            capturedAt: Date.now()
        };
    }

    async function collectFiles() {
        const files = {};
        for (const [key, id] of [['audio','audioInput'], ['background','backgroundInput'], ['lrc','lrcFileInput']]) {
            const file = safe(() => q(id)?.files?.[0], null);
            if (file) files[key] = file;
        }
        return files;
    }

    async function snapshot() {
        return { schema: 1, id: ACTIVE_ID, form: collectFormState(), files: await collectFiles() };
    }

    function setStatus(text, kind = '') {
        const el = q('previewStatus');
        if (!el) return;
        el.textContent = text;
        el.dataset.projectEngineStatus = kind;
        clearTimeout(setStatus.timer);
        setStatus.timer = setTimeout(() => {
            if (el.dataset.projectEngineStatus === kind) el.textContent = 'Ready';
        }, 1800);
    }

    async function persist(reason = 'autosave') {
        if (memory.restoring) return;
        const project = await snapshot();
        project.reason = reason;
        project.revision = ++memory.revision;
        project.savedAt = Date.now();
        try {
            await dbPut(project);
            memory.dirty = false;
            memory.lastSavedAt = project.savedAt;
            setStatus(reason === 'manual' ? 'Project saved' : 'Saved', 'saved');
            window.dispatchEvent(new CustomEvent('kefe:project-saved', { detail: project }));
        } catch (error) {
            console.warn('[KEFE Project Engine] save failed', error);
            setStatus('Local save unavailable', 'error');
        }
        return project;
    }

    function scheduleSave(reason = 'autosave') {
        memory.dirty = true;
        clearTimeout(memory.saveTimer);
        memory.saveTimer = setTimeout(() => persist(reason), AUTOSAVE_MS);
    }

    function serialiseForHistory() {
        const form = collectFormState();
        return JSON.stringify(form);
    }

    function pushHistory() {
        if (memory.restoring) return;
        const value = serialiseForHistory();
        const current = memory.history[memory.historyIndex];
        if (current === value) return;
        memory.history = memory.history.slice(0, memory.historyIndex + 1);
        memory.history.push(value);
        if (memory.history.length > HISTORY_LIMIT) memory.history.shift();
        memory.historyIndex = memory.history.length - 1;
        window.dispatchEvent(new CustomEvent('kefe:history', { detail: { canUndo: canUndo(), canRedo: canRedo() } }));
    }

    function applyChoice(kind, value) {
        if (!value) return;
        let selector = null;
        if (kind === 'effect') selector = `#lyricStyleBlock [data-effect="${CSS.escape(value)}"]`;
        if (kind === 'background') selector = `[data-background-preset="${CSS.escape(value)}"]`;
        if (kind === 'captionPosition') selector = `[data-caption-pos="${CSS.escape(value)}"]`;
        if (kind === 'textMode') selector = `[data-text-mode="${CSS.escape(value)}"]`;
        document.querySelector(selector)?.click();
    }

    function applyForm(form) {
        if (!form) return;
        memory.restoring = true;
        try {
            Object.entries(form.fields || {}).forEach(([id, value]) => writeField(id, value));
            if (form.lyricsText !== undefined && q('lyricsText')) q('lyricsText').value = form.lyricsText;
            const c = form.choices || {};
            applyChoice('textMode', c.textMode);
            applyChoice('effect', c.effect);
            applyChoice('background', c.background);
            applyChoice('captionPosition', c.captionPosition);
            if (q('lyricsText') && form.lyricsText) q('lyricsText').dispatchEvent(new Event('input', { bubbles: true }));
        } finally {
            setTimeout(() => { memory.restoring = false; }, 0);
        }
    }

    async function restoreFiles(files) {
        if (!files) return;
        for (const [key, id] of [['audio','audioInput'], ['background','backgroundInput']]) {
            const file = files[key];
            const input = q(id);
            if (!file || !input || typeof DataTransfer === 'undefined') continue;
            try {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (error) {
                console.warn('[KEFE Project Engine] file restore skipped', key, error);
            }
        }
    }

    async function recover() {
        try {
            const project = await dbGet();
            if (!project || !project.form) return null;
            const age = Date.now() - Number(project.savedAt || 0);
            if (age > 1000 * 60 * 60 * 24 * 30) return null;
            const shouldRecover = safe(() => sessionStorage.getItem('kefe-recovery-dismissed') !== String(project.revision), true);
            if (!shouldRecover) return null;
            const hasUsefulData = project.form.lyricsText || project.form.fields?.metaTitle || project.files?.audio || project.files?.background;
            if (!hasUsefulData) return null;
            const accepted = window.confirm('KEFE found a saved project from your last session. Restore it?');
            if (!accepted) {
                safe(() => sessionStorage.setItem('kefe-recovery-dismissed', String(project.revision)));
                return null;
            }
            memory.restoring = true;
            applyForm(project.form);
            await restoreFiles(project.files);
            memory.restoring = false;
            setStatus('Project recovered', 'saved');
            window.dispatchEvent(new CustomEvent('kefe:project-recovered', { detail: project }));
            return project;
        } catch (error) {
            console.warn('[KEFE Project Engine] recovery failed', error);
            memory.restoring = false;
            return null;
        }
    }

    function canUndo() { return memory.historyIndex > 0; }
    function canRedo() { return memory.historyIndex >= 0 && memory.historyIndex < memory.history.length - 1; }

    function moveHistory(direction) {
        const next = memory.historyIndex + direction;
        if (next < 0 || next >= memory.history.length) return false;
        memory.historyIndex = next;
        try { applyForm(JSON.parse(memory.history[next])); } catch (_) { return false; }
        scheduleSave('history');
        window.dispatchEvent(new CustomEvent('kefe:history', { detail: { canUndo: canUndo(), canRedo: canRedo() } }));
        return true;
    }

    function undo() { return moveHistory(-1); }
    function redo() { return moveHistory(1); }

    function installHistoryUI() {
        document.addEventListener('input', () => {
            if (!memory.restoring) scheduleSave();
        }, true);
        document.addEventListener('change', () => {
            if (!memory.restoring) {
                pushHistory();
                scheduleSave();
            }
        }, true);
        document.addEventListener('click', event => {
            if (memory.restoring) return;
            const target = event.target.closest('button,[role="button"]');
            if (!target) return;
            if (target.id === 'saveProject' || target.id === 'loadProject') return;
            if (target.matches('[data-effect],[data-background-preset],[data-caption-pos],[data-text-mode]')) {
                setTimeout(() => { pushHistory(); scheduleSave(); }, 0);
            }
        }, true);

        window.addEventListener('beforeunload', () => {
            if (memory.dirty) safe(() => persist('unload'));
        });

        window.addEventListener('keydown', event => {
            const mod = event.metaKey || event.ctrlKey;
            if (!mod || event.altKey) return;
            const key = event.key.toLowerCase();
            if (key === 'z') {
                event.preventDefault();
                event.shiftKey ? redo() : undo();
            } else if (key === 'y') {
                event.preventDefault();
                redo();
            } else if (key === 's') {
                event.preventDefault();
                persist('manual');
            }
        });
    }

    async function init() {
        if (!window.indexedDB) return;
        installHistoryUI();
        setTimeout(() => {
            pushHistory();
            recover();
        }, 900);
        window.kefeProject = {
            version: 1,
            save: () => persist('manual'),
            autosave: () => persist('autosave'),
            recover,
            undo,
            redo,
            canUndo,
            canRedo,
            snapshot,
            get dirty() { return memory.dirty; },
            get lastSavedAt() { return memory.lastSavedAt; }
        };
        window.dispatchEvent(new CustomEvent('kefe:project-engine-ready', { detail: window.kefeProject }));
    }

    init();
})();
