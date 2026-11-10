/* KEFE shared resilience layer: error boundaries, lifecycle scopes,
   visibility-gated rAF render loops, and monotonic async cancellation gates. */
(() => {
  'use strict';

  const PANEL_SELECTORS = Object.freeze({
    media: '[data-panel-view="media"] .kefe-form, [data-panel-view="media"]',
    lyrics: '[data-panel-view="lyrics"] .kefe-form, [data-panel-view="lyrics"]',
    effects: '[data-panel-view="effects"] .kefe-form, [data-panel-view="effects"]',
    'background-effects': '[data-panel-view="background-effects"] .kefe-form, [data-panel-view="background-effects"]',
    visualiser: '[data-panel-view="visualiser"] .kefe-visualiser-form, [data-panel-view="visualiser"] .kefe-form, [data-panel-view="visualiser"]',
    export: '[data-panel-view="export"] .kefe-form, [data-panel-view="export"]',
  });

  function resolveHost(target) {
    if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) return target;
    const selector = PANEL_SELECTORS[target];
    return selector ? document.querySelector(selector) : null;
  }

  function clearPanelError(target, id) {
    const host = resolveHost(target);
    if (!host) return;
    const hasId = id !== undefined && id !== null && id !== '';
    const matchId = hasId ? String(id) : null;
    host.querySelectorAll('[data-kefe-err]').forEach(node => {
      if (!hasId || node.dataset.kefeErr === matchId) node.remove();
    });
  }

  function panelError(target, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const id = String(options.id || 'default');
    const title = String(options.title || 'Something went wrong');
    const message = String(options.message || 'This feature could not be completed in this browser.');
    const variant = options.variant || 'warning';

    const host = resolveHost(target);
    if (!host) {
      window.kefeAlert?.(message, { title, variant, duration: 0 });
      return null;
    }

    clearPanelError(host, id);

    const box = document.createElement('section');
    box.className = 'kefe-resilience-banner shad-alert is-' + variant;
    box.dataset.kefeErr = id;
    box.dataset.slot = 'alert';
    box.setAttribute('role', 'alert');
    box.setAttribute('aria-live', 'polite');

    const head = document.createElement('div');
    head.className = 'kefe-resilience-head';
    const titleEl = document.createElement('strong');
    titleEl.className = 'shad-alert-title';
    titleEl.dataset.slot = 'alert-title';
    titleEl.textContent = title;
    head.appendChild(titleEl);

    if (options.dismissible !== false) {
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'kefe-btn shad-btn shad-btn--ghost shad-btn--icon-sm kefe-resilience-close';
      closeBtn.dataset.slot = 'button';
      closeBtn.dataset.variant = 'ghost';
      closeBtn.dataset.size = 'icon-sm';
      closeBtn.setAttribute('aria-label', 'Dismiss notice');
      closeBtn.innerHTML = typeof window !== 'undefined' && window.kefeIcon ? window.kefeIcon('close') : '×';
      closeBtn.addEventListener('click', () => {
        box.remove();
        try { options.onDismiss?.(); } catch (_) {}
      });
      head.appendChild(closeBtn);
    }

    const body = document.createElement('p');
    body.className = 'kefe-meta kefe-resilience-message shad-alert-description';
    body.dataset.slot = 'alert-description';
    body.textContent = message;

    box.append(head, body);

    const hasRetry = typeof options.onRetry === 'function';
    const hasContinue = typeof options.onContinue === 'function';
    if (hasRetry || hasContinue) {
      const actions = document.createElement('div');
      actions.className = 'kefe-resilience-actions';
      if (hasRetry) {
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'kefe-btn primary shad-btn shad-btn--primary shad-btn--sm kefe-resilience-retry';
        retryBtn.dataset.slot = 'button';
        retryBtn.dataset.variant = 'default';
        retryBtn.dataset.size = 'sm';
        retryBtn.textContent = options.retryLabel || 'Retry';
        retryBtn.addEventListener('click', () => {
          clearPanelError(host, id);
          Promise.resolve()
            .then(() => options.onRetry())
            .catch(err => {
              panelError(host, {
                ...options,
                message: err?.message || message,
              });
            });
        });
        actions.appendChild(retryBtn);
      }
      if (hasContinue) {
        const contBtn = document.createElement('button');
        contBtn.type = 'button';
        contBtn.className = 'kefe-btn shad-btn shad-btn--outline shad-btn--sm kefe-resilience-continue';
        contBtn.dataset.slot = 'button';
        contBtn.dataset.variant = 'outline';
        contBtn.dataset.size = 'sm';
        contBtn.textContent = options.continueLabel || 'Continue without this feature';
        contBtn.addEventListener('click', () => {
          clearPanelError(host, id);
          try { options.onContinue(); } catch (err) { console.warn('[KEFE resilience continue]', err); }
        });
        actions.appendChild(contBtn);
      }
      box.appendChild(actions);
    }

    host.prepend(box);
    return box;
  }

  function guard(label, fn, onError) {
    return function guarded(...args) {
      try {
        const result = fn.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.catch(err => {
            console.error('[KEFE ' + label + ']', err);
            try { onError?.(err); } catch (_) {}
          });
        }
        return result;
      } catch (err) {
        console.error('[KEFE ' + label + ']', err);
        try { onError?.(err); } catch (_) {}
        return undefined;
      }
    };
  }

  function createScope() {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const signal = controller ? controller.signal : undefined;
    const timers = new Set();
    const intervals = new Set();
    const rafs = new Set();
    const urls = new Set();
    const cleanups = new Set();

    return {
      signal,
      on(target, type, fn, opts) {
        if (!target || typeof target.addEventListener !== 'function') return;
        let merged = opts;
        if (signal) {
          merged = typeof opts === 'boolean'
            ? { capture: opts, signal }
            : Object.assign({}, opts || {}, { signal });
        }
        target.addEventListener(type, fn, merged);
      },
      setTimeout(fn, ms) {
        const id = window.setTimeout(() => {
          timers.delete(id);
          fn();
        }, ms);
        timers.add(id);
        return id;
      },
      clearTimeout(id) {
        if (!id) return;
        timers.delete(id);
        window.clearTimeout(id);
      },
      setInterval(fn, ms) {
        const id = window.setInterval(fn, ms);
        intervals.add(id);
        return id;
      },
      clearInterval(id) {
        if (!id) return;
        intervals.delete(id);
        window.clearInterval(id);
      },
      raf(fn) {
        const id = window.requestAnimationFrame(now => {
          rafs.delete(id);
          fn(now);
        });
        rafs.add(id);
        return id;
      },
      cancelRaf(id) {
        if (!id) return;
        rafs.delete(id);
        window.cancelAnimationFrame(id);
      },
      trackUrl(blobOrFile) {
        const url = URL.createObjectURL(blobOrFile);
        urls.add(url);
        return url;
      },
      revokeUrl(url) {
        if (!url) return;
        urls.delete(url);
        try { URL.revokeObjectURL(url); } catch (_) {}
      },
      add(fn) {
        if (typeof fn === 'function') cleanups.add(fn);
      },
      dispose() {
        try { controller?.abort(); } catch (_) {}
        timers.forEach(id => window.clearTimeout(id));
        timers.clear();
        intervals.forEach(id => window.clearInterval(id));
        intervals.clear();
        rafs.forEach(id => window.cancelAnimationFrame(id));
        rafs.clear();
        urls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
        urls.clear();
        cleanups.forEach(fn => { try { fn(); } catch (_) {} });
        cleanups.clear();
      },
    };
  }

  function createRenderLoop(step, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    let raf = 0;
    let running = false;
    let crashed = false;
    let gen = 0;
    let disposed = false;

    function tick(now, token) {
      raf = 0;
      if (disposed || !running || crashed || token !== gen || document.hidden) return;
      try {
        const keepGoing = step(now);
        if (keepGoing === false) {
          running = false;
          return;
        }
        if (!disposed && running && token === gen && !document.hidden) {
          raf = window.requestAnimationFrame(t => tick(t, token));
        }
      } catch (err) {
        crashed = true;
        running = false;
        console.error('[KEFE render loop]', err);
        try { options.onError?.(err); } catch (_) {}
      }
    }

    function schedule() {
      if (disposed || !running || crashed || raf || document.hidden) return;
      const token = gen;
      raf = window.requestAnimationFrame(t => tick(t, token));
    }

    function onVisibility() {
      if (document.hidden) {
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
      } else {
        schedule();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);

    return {
      start() {
        if (disposed || crashed) return;
        if (!running) {
          running = true;
          gen++;
        }
        schedule();
      },
      stop() {
        running = false;
        gen++;
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      resetError() {
        crashed = false;
      },
      isRunning: () => running && !crashed && !disposed,
      hasCrashed: () => crashed,
      dispose() {
        disposed = true;
        running = false;
        gen++;
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        document.removeEventListener('visibilitychange', onVisibility);
      },
    };
  }

  function createAsyncGate() {
    let currentId = 0;
    let controller = null;

    return {
      next() {
        if (controller) {
          try { controller.abort(new DOMException('Superseded by newer request', 'AbortError')); } catch (_) {}
        }
        controller = typeof AbortController === 'function' ? new AbortController() : null;
        const id = ++currentId;
        const signal = controller ? controller.signal : undefined;
        return {
          id,
          signal,
          isCurrent: () => id === currentId && (!signal || !signal.aborted),
        };
      },
      cancel(reason) {
        currentId++;
        if (controller) {
          try { controller.abort(reason || new DOMException('Cancelled', 'AbortError')); } catch (_) {}
          controller = null;
        }
      },
      currentId: () => currentId,
    };
  }

  const rootScope = createScope();
  window.addEventListener('pagehide', () => rootScope.dispose(), { once: true });

  window.kefeResilience = {
    panelError,
    clearPanelError,
    guard,
    createScope,
    createRenderLoop,
    createAsyncGate,
    rootScope,
    hasUsableSize(node) {
      if (!node) return false;
      const r = node.getBoundingClientRect ? node.getBoundingClientRect() : node;
      return !!(r && r.width >= 2 && r.height >= 2);
    },
    isImageCorsSafe(img) {
      if (!img || !img.src) return true;
      if (/^(?:data:|blob:)/i.test(img.src)) return true;
      try {
        const base = typeof location !== 'undefined' && location.href ? location.href : undefined;
        const url = new URL(img.src, base);
        if (base && url.origin === new URL(base).origin) return true;
        return img.crossOrigin === 'anonymous' || img.crossOrigin === 'use-credentials';
      } catch (_) {
        return false;
      }
    },
  };
})();
