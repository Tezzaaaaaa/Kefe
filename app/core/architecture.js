/* KEFE Architecture Layer
 * Design-pattern infrastructure inspired by proven software architecture patterns.
 * Strategy, Observer/Event Bus, Command, Factory/Registry, Adapter, Pipeline and Facade.
 * This layer is deliberately dependency-free and wraps existing KEFE modules without
 * replacing the renderer/exporter.
 */
(() => {
    'use strict';

    class EventBus {
        constructor() { this.listeners = new Map(); }
        on(type, handler) {
            if (typeof handler !== 'function') return () => {};
            const set = this.listeners.get(type) || new Set();
            set.add(handler); this.listeners.set(type, set);
            return () => set.delete(handler);
        }
        once(type, handler) {
            const off = this.on(type, (...args) => { off(); handler(...args); });
            return off;
        }
        emit(type, detail) {
            (this.listeners.get(type) || []).forEach(handler => {
                try { handler(detail); } catch (error) { console.error(`[KEFE EventBus] ${type}`, error); }
            });
        }
        clear(type) { type ? this.listeners.delete(type) : this.listeners.clear(); }
    }

    class Registry {
        constructor(name = 'registry') { this.name = name; this.items = new Map(); }
        register(key, value) {
            if (!key || !value) throw new Error(`${this.name}: key and value are required`);
            this.items.set(String(key), value); return value;
        }
        get(key) { return this.items.get(String(key)); }
        has(key) { return this.items.has(String(key)); }
        remove(key) { return this.items.delete(String(key)); }
        list() { return [...this.items.keys()]; }
        values() { return [...this.items.values()]; }
        resolve(key, fallback) { return this.get(key) || fallback; }
    }

    class CommandManager {
        constructor(limit = 100) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
        execute(command) {
            if (!command || typeof command.execute !== 'function') return false;
            command.execute();
            this.undoStack.push(command);
            if (this.undoStack.length > this.limit) this.undoStack.shift();
            this.redoStack.length = 0;
            return true;
        }
        undo() {
            const command = this.undoStack.pop();
            if (!command || typeof command.undo !== 'function') return false;
            command.undo(); this.redoStack.push(command); return true;
        }
        redo() {
            const command = this.redoStack.pop();
            if (!command || typeof command.execute !== 'function') return false;
            command.execute(); this.undoStack.push(command); return true;
        }
        clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
        get canUndo() { return this.undoStack.length > 0; }
        get canRedo() { return this.redoStack.length > 0; }
    }

    class Pipeline {
        constructor(stages = []) { this.stages = stages.filter(Boolean); }
        use(stage) { if (typeof stage === 'function') this.stages.push(stage); return this; }
        async run(input, context = {}) {
            let value = input;
            for (const stage of this.stages) value = await stage(value, context);
            return value;
        }
    }

    class Adapter {
        constructor(adapt) { this.adapt = adapt; }
        static from(adapt) { return new Adapter(adapt); }
        apply(value, context) { return this.adapt(value, context); }
    }

    const bus = new EventBus();
    const effects = new Registry('effects');
    const lyricProviders = new Registry('lyric-providers');
    const renderers = new Registry('renderers');
    const commands = new CommandManager();

    /* Strategy adapters: existing KEFE effects can opt in without changing their files. */
    document.addEventListener('click', event => {
        const target = event.target.closest('[data-effect]');
        if (!target) return;
        bus.emit('effect:requested', { key: target.dataset.effect, element: target });
    }, true);

    /* Observer bridge: mirror important DOM events into one application event stream. */
    ['kefe:audio-analysis-ready','kefe:project-saved','kefe:project-recovered','kefe:renderer-ready']
        .forEach(type => window.addEventListener(type, event => bus.emit(type, event.detail)));

    /* Canonical lyric adapter. Every provider may return LRC text or a timeline. */
    const lyricAdapter = Adapter.from(value => {
        if (!value) return null;
        if (value.version === 2 && Array.isArray(value.lines)) return value;
        if (typeof value === 'string' && window.kefeAnalysis?.parseLrc) return window.kefeAnalysis.parseLrc(value);
        if (value.syncedLyrics && window.kefeAnalysis?.parseLrc) return window.kefeAnalysis.parseLrc(value.syncedLyrics);
        return value;
    });

    const analysisStage = async (input, context) => {
        bus.emit('pipeline:stage', { stage: 'analysis', input, context });
        return input;
    };
    const timelineStage = async (input, context) => {
        const timeline = lyricAdapter.apply(input, context);
        bus.emit('pipeline:stage', { stage: 'timeline', input: timeline, context });
        return timeline;
    };
    const renderStage = async (input, context) => {
        bus.emit('pipeline:stage', { stage: 'render', input, context });
        return input;
    };

    const pipeline = new Pipeline([analysisStage, timelineStage, renderStage]);

    const api = {
        version: 1,
        bus,
        effects,
        lyricProviders,
        renderers,
        commands,
        pipeline,
        adapters: { lyric: lyricAdapter },
        registerEffect(key, strategy) { return effects.register(key, strategy); },
        registerLyricProvider(key, provider) { return lyricProviders.register(key, provider); },
        registerRenderer(key, renderer) { return renderers.register(key, renderer); },
        command(command) { return commands.execute(command); },
        undo() { return commands.undo(); },
        redo() { return commands.redo(); },
        async runPipeline(input, context) { return pipeline.run(input, context); },
        emit(type, detail) { bus.emit(type, detail); },
        on(type, handler) { return bus.on(type, handler); }
    };

    /* Register existing subsystems as strategies when they are available. */
    if (window.kefeRenderer) api.registerRenderer('frame', window.kefeRenderer);
    if (window.kefeAnalysis) api.registerLyricProvider('lrclib', window.kefeAnalysis);
    window.kefe = api;
    window.dispatchEvent(new CustomEvent('kefe:architecture-ready', { detail: api }));
})();
