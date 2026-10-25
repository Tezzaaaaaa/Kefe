/* ═══════════════════════════════════════════════════════════════
   KEFE SETTINGS PANEL
   ───────────────────────────────────────────────────────────────
   README — Integration guide
   ───────────────────────────────────────────────────────────────
   MOUNT
     const panel = new KefeSettingsPanel('#kefe-settings-panel', {
       storageKey: 'kefe:editor:settings:v1', // namespace per host
       storage: localStorage,                 // or null to disable
       autoPersist: true,                     // write-through live
       debounceMs: 80,
       exclusive: false,                      // multi-open accordion
     });

   LIVE PREVIEW
     panel.onChange(({ key, value, values }) => updateCanvas(values));
     // `key === null` fires after mount and after reset() — treat it
     // as "re-read all values" rather than a specific control change.

   PROGRAMMATIC UPDATES
     panel.applyValues(values);                     // silent by default
     panel.applyValues(values, { silent: false }); // fires kefe:change
     // Use the non-silent form when switching projects — otherwise
     // the preview will not sync.

   KEYBOARD
     Ctrl/Cmd+S is intercepted by the panel. In autoPersist mode it
     calls panel.save(); in explicit mode it clicks the Save button.
     If the editor has its own Ctrl+S handler, remove it or delegate
     to panel.save() — do not bind both.

   SAVE (autoPersist: false only)
     panel.onSave(values => api.save(values));
     panel.onReset(values => resetCanvas());

   SLOTS — inject editor UI into panel sections
     // Slots exist for: media, lyric-sync, background,
     //                  lyric-effects, visualisers, export
     const mediaSlot = panel.getSlot('media');
     mediaSlot.appendChild(editorMediaBrowser);

   EVENTS (dispatched on the panel root)
     kefe:change  detail: { key, value, values }
     kefe:save    detail: { values }
     kefe:reset   detail: { values }

   PUBLIC API
     panel.getValues()        → { key: value, ... }
     panel.getDefaults()      → { key: default, ... }
     panel.applyValues(v)     → push values programmatically
     panel.reset({ persist }) → reset to defaults
     panel.save()             → trigger save
     panel.getSlot(name)      → HTMLElement | null
     panel.destroy()          → teardown

   STORAGE KEY
     Default key is 'kefe-settings-v1'. If the host already uses that
     key, pass a different one (e.g. 'kefe:editor:settings:v1') to
     avoid silently clobbering saved settings.

   ACCESSIBILITY
     - h2 > button pattern; no heading-in-button.
     - Info buttons use aria-describedby to their tooltip.
     - Popover API used when supported; fallback layer otherwise.
     - Restored values fire one kefe:change after mount so the
       editor preview syncs without polling.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const DEFAULT_DEBOUNCE_MS = 80;
  const POPOVER_SUPPORTED =
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.showPopover === 'function';

  class KefeSettingsPanel {
    constructor(rootOrSelector, options = {}) {
      this.root = typeof rootOrSelector === 'string'
        ? document.querySelector(rootOrSelector)
        : rootOrSelector;
      if (!this.root) throw new Error('KefeSettingsPanel: root not found');

      this.options = Object.assign({
        storageKey: 'kefe-settings-v1',
        storage: (typeof localStorage !== 'undefined' ? localStorage : null),
        autoPersist: true,
        debounceMs: DEFAULT_DEBOUNCE_MS,
        exclusive: false,
        bindShortcuts: true,
      }, options);

      this._saveCb = null;
      this._resetCb = null;
      this._changeCb = null;
      this._debounceTimer = null;
      this._savedTimer = null;
      this._destroyed = false;
      this._openTooltip = null;
      this._outsideHandlers = [];

      this._cacheEls();
      this._bindAccordion();
      this._bindControls();
      this._bindTopbar();
      this._bindPopovers();
      this._bindKeyboard();
      this._observeCollapseForFocus();
      this._bindSlotObservation();

      this._restore();
      this._updateAll();
      this._emitInitialChange();
    }

    /* ── DOM refs ─────────────────────────────────────────── */
    _cacheEls() {
      const $ = (sel, root = this.root) => root.querySelector(sel);
      const $$ = (sel, root = this.root) => [...root.querySelectorAll(sel)];

      this.$sections  = $$('.section');
      this.$toggles   = $$('.toggle-switch');
      this.$selects   = $$('.kefe-select');
      this.$ranges    = $$('.kefe-range');
      this.$colors    = $$('.kefe-color');
      this.$texts     = $$('.kefe-text');
      this.$inputs    = [...this.$selects, ...this.$ranges, ...this.$colors, ...this.$texts];
      this.$infos     = $$('.info-button');
      this.$save      = $('#kefe-save');
      this.$saved     = $('#kefe-saved');
      this.$reset     = $('#kefe-reset');
      this.$status    = $('#kefe-status-text');
      this.$panels    = $('.kefe-settings-columns');
      this._exclusive = this.$panels?.dataset.accordion === 'single' || this.options.exclusive;
    }

    /* ── Values ───────────────────────────────────────────── */

    _readControl(el) {
      if (el.classList.contains('toggle-switch')) {
        return el.getAttribute('aria-checked') === 'true';
      }
      if (el.classList.contains('kefe-range')) return Number(el.value);
      return el.value;
    }

    _writeControl(el, value) {
      if (el.classList.contains('toggle-switch')) {
        el.setAttribute('aria-checked', value ? 'true' : 'false');
      } else if (el.classList.contains('kefe-range')) {
        el.value = String(value);
      } else if (el.classList.contains('kefe-color') || el.classList.contains('kefe-text')) {
        el.value = String(value);
      } else if (el.classList.contains('kefe-select')) {
        const opt = [...el.options].find(o => o.value === String(value));
        if (opt) el.value = String(value);
      }
    }

    _parseDefault(el) {
      if (el.classList.contains('toggle-switch')) return el.dataset.default === 'true';
      if (el.classList.contains('kefe-range')) return Number(el.dataset.default);
      return el.dataset.default;
    }

    getDefaults() {
      const out = {};
      [...this.$toggles, ...this.$inputs].forEach(el => {
        const key = el.dataset.setting;
        if (key) out[key] = this._parseDefault(el);
      });
      return out;
    }

    getValues() {
      const out = {};
      [...this.$toggles, ...this.$inputs].forEach(el => {
        const key = el.dataset.setting;
        if (key) out[key] = this._readControl(el);
      });
      return out;
    }

    applyValues(values, { silent = true } = {}) {
      if (!values || typeof values !== 'object') return;
      [...this.$toggles, ...this.$inputs].forEach(el => {
        const key = el.dataset.setting;
        if (key && Object.prototype.hasOwnProperty.call(values, key)) {
          this._writeControl(el, values[key]);
        }
      });
      this._updateAll();
      if (!silent) this._emitChange(null, null);
    }

    /* ── Modified / status ────────────────────────────────── */

    _isModified(el) {
      const def = this._parseDefault(el);
      const cur = this._readControl(el);
      if (typeof def === 'number' || typeof cur === 'number') {
        return Number(cur) !== Number(def);
      }
      return String(cur) !== String(def);
    }

    _updateModifiedStates() {
      this.$sections.forEach(section => {
        const controls = [
          ...section.querySelectorAll('.toggle-switch'),
          ...section.querySelectorAll('.kefe-select, .kefe-range, .kefe-color, .kefe-text'),
        ];
        const modified = controls.some(el => el.dataset.setting && this._isModified(el));
        section.setAttribute('data-modified', modified ? 'true' : 'false');
      });
    }

    _updateStatus() {
      if (!this.$status) return;
      const values = this.getValues();
      const defaults = this.getDefaults();
      let changed = 0, active = 0;
      for (const key in values) {
        if (String(values[key]) !== String(defaults[key])) changed++;
        const v = values[key];
        if (v === true || (typeof v === 'number' && v !== 0) ||
            (typeof v === 'string' && v && v !== '0' && v !== 'off' && v !== 'false')) {
          active++;
        }
      }
      if (changed === 0) {
        this.$status.innerHTML = 'All settings at <strong>defaults</strong>';
      } else if (active === 0) {
        this.$status.innerHTML = `<strong>${changed}</strong> setting${changed === 1 ? '' : 's'} modified · none active`;
      } else {
        this.$status.innerHTML = `<strong>${active}</strong> active · <strong>${changed}</strong> modified`;
      }
    }

    _updateAll() {
      this._updateModifiedStates();
      this._updateStatus();
      this._syncSaveVisibility();
    }

    /* ── Save visibility ──────────────────────────────────── */

    _isDirty() {
      const values = this.getValues();
      const defaults = this.getDefaults();
      return Object.keys(values).some(k => String(values[k]) !== String(defaults[k]));
    }

    _syncSaveVisibility() {
      if (!this.$save) return;
      if (this.options.autoPersist) {
        this.$save.classList.add('kefe-btn--hidden');
        return;
      }
      if (this._isDirty()) this._showDirty(); else this._hideDirty();
    }

    _showDirty() {
      if (this.options.autoPersist || !this.$save || !this.$saved) return;
      this.$save.classList.remove('kefe-btn--hidden');
      this.$saved.classList.add('kefe-btn--hidden');
      clearTimeout(this._savedTimer);
    }

    _hideDirty() {
      this.$save?.classList.add('kefe-btn--hidden');
    }

    _flashSaved() {
      if (!this.$saved) return;
      this.$saved.classList.remove('kefe-btn--hidden');
      clearTimeout(this._savedTimer);
      this._savedTimer = setTimeout(() => {
        this.$saved.classList.add('kefe-btn--hidden');
      }, 1600);
    }

    /* ── Persistence ──────────────────────────────────────── */

    _persist() {
      if (!this.options.storage) return;
      try {
        this.options.storage.setItem(
          this.options.storageKey,
          JSON.stringify(this.getValues())
        );
      } catch (_) { /* storage may be unavailable */ }
    }

    _restore() {
      if (!this.options.storage) return;
      let saved = null;
      try {
        saved = JSON.parse(
          this.options.storage.getItem(this.options.storageKey) || 'null'
        );
      } catch (_) { /* corrupt data */ }
      if (saved && typeof saved === 'object') {
        this.applyValues(saved, { silent: true });
      }
    }

    /* ── Accordion ────────────────────────────────────────── */

    _setExpanded(section, expanded, exclusive = this._exclusive) {
      if (exclusive && expanded) {
        this.$sections.forEach(other => {
          if (other !== section && other.getAttribute('data-expanded') === 'true') {
            other.setAttribute('data-expanded', 'false');
            other.querySelector('.expand-button')
                 ?.setAttribute('aria-expanded', 'false');
          }
        });
      }
      section.setAttribute('data-expanded', expanded ? 'true' : 'false');
      section.querySelector('.expand-button')
             ?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    _bindAccordion() {
      this.$sections.forEach(section => {
        const btn = section.querySelector('.expand-button');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const anyCollapsed = this.$sections.some(
              s => s.getAttribute('data-expanded') !== 'true'
            );
            this.$sections.forEach(s => this._setExpanded(s, anyCollapsed, false));
            return;
          }
          const expanded = section.getAttribute('data-expanded') === 'true';
          this._setExpanded(section, !expanded);
        });
      });
    }

    _observeCollapseForFocus() {
      this._focusObserver = new MutationObserver((mutations) => {
        mutations.forEach(m => {
          const section = m.target;
          if (section.getAttribute('data-expanded') !== 'false') return;
          const content = section.querySelector('.section-content');
          if (!content || !content.contains(document.activeElement)) return;
          section.querySelector('.expand-button')?.focus();
        });
      });
      this.$sections.forEach(s => {
        this._focusObserver.observe(s, {
          attributes: true,
          attributeFilter: ['data-expanded'],
        });
      });
    }

    /* ── Controls ─────────────────────────────────────────── */

    _bindControls() {
      const commit = (el) => {
        this._updateAll();
        this._scheduleChange(el);
        if (this.options.autoPersist) {
          this._persist();
          this._flashSaved();
        } else {
          this._showDirty();
        }
      };

      this.$toggles.forEach(t => {
        t.addEventListener('click', () => {
          const next = t.getAttribute('aria-checked') !== 'true';
          t.setAttribute('aria-checked', next ? 'true' : 'false');
          commit(t);
        });
      });

      this.$inputs.forEach(el => {
        el.addEventListener('input', () => commit(el));
        if (el.classList.contains('kefe-color') || el.classList.contains('kefe-select')) {
          el.addEventListener('change', () => commit(el));
        }
      });
    }

    _scheduleChange(el) {
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        const key = el?.dataset?.setting || null;
        const value = el ? this._readControl(el) : null;
        this._emitChange(key, value);
      }, this.options.debounceMs);
    }

    _emitChange(key, value) {
      const detail = { key, value, values: this.getValues() };
      this.root.dispatchEvent(new CustomEvent('kefe:change', { detail }));
      if (typeof this._changeCb === 'function') this._changeCb(detail);
    }

    _emitInitialChange() {
      queueMicrotask(() => {
        if (this._destroyed) return;
        this._emitChange(null, null);
      });
    }

    /* ── Top bar ──────────────────────────────────────────── */

    _bindTopbar() {
      this.$save?.addEventListener('click', () => {
        this._persist();
        this._flashSaved();
        this._hideDirty();
        const values = this.getValues();
        if (typeof this._saveCb === 'function') this._saveCb(values);
        this.root.dispatchEvent(new CustomEvent('kefe:save', { detail: { values } }));
      });

      this.$reset?.addEventListener('click', () => {
        this.reset({ persist: true, confirm: true });
      });
    }

    reset({ persist = true, confirm = false } = {}) {
      if (confirm && !window.confirm('Reset all settings to their defaults?')) return;
      this.applyValues(this.getDefaults(), { silent: true });
      if (persist) this._persist();
      if (this.options.autoPersist) this._flashSaved(); else this._hideDirty();
      const values = this.getValues();
      if (typeof this._resetCb === 'function') this._resetCb(values);
      this.root.dispatchEvent(new CustomEvent('kefe:reset', { detail: { values } }));
      this._scheduleChange(null);
    }

    save() {
      if (this.options.autoPersist) {
        this._persist();
        this._flashSaved();
        const values = this.getValues();
        if (typeof this._saveCb === 'function') this._saveCb(values);
        this.root.dispatchEvent(new CustomEvent('kefe:save', { detail: { values } }));
        return this;
      }
      this.$save?.click();
      return this;
    }

    /* ── Slots ────────────────────────────────────────────── */

    getSlot(name) {
      return this.root.querySelector(`.kefe-slot[data-kefe-slot="${CSS.escape(name)}"]`);
    }

    _bindSlotObservation() {
      const fallbacks = this.root.querySelectorAll('[data-kefe-fallback]');
      const applyFallback = () => {
        fallbacks.forEach(fb => {
          const name = fb.dataset.kefeFallback;
          const slot = this.getSlot(name);
          const filled = slot && slot.childElementCount > 0;
          fb.style.display = filled ? 'none' : '';
        });
      };
      applyFallback();
      const obs = new MutationObserver(applyFallback);
      this.root.querySelectorAll('.kefe-slot').forEach(slot => {
        obs.observe(slot, { childList: true });
      });
      this._slotObserver = obs;
    }

    /* ── Popovers ─────────────────────────────────────────── */

    _bindPopovers() {
      this.$infos.forEach(btn => {
        const popId = btn.getAttribute('popovertarget');
        const pop = popId
          ? this.root.querySelector('#' + CSS.escape(popId))
          : null;
        if (!pop) return;

        if (POPOVER_SUPPORTED) {
          const sync = () => {
            const open = pop.matches(':popover-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          };
          btn.addEventListener('click', () => queueMicrotask(sync));
          pop.addEventListener('toggle', sync);
          pop.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') pop.hidePopover();
          });
          this._addOutsideClose(btn, pop, () => pop.hidePopover(), () => pop.matches(':popover-open'));
        } else {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = pop.getAttribute('data-open') === 'true';
            this._closeAllFallbackTooltips(btn);
            if (isOpen) {
              this._closeFallbackTooltip(btn, pop);
            } else {
              this._openFallbackTooltip(btn, pop);
            }
          });
          this._addOutsideClose(btn, pop, () => this._closeFallbackTooltip(btn, pop), () => pop.getAttribute('data-open') === 'true');
        }
      });
    }

    _addOutsideClose(btn, pop, close, isOpen) {
      const handler = (e) => {
        if (!isOpen()) return;
        if (pop.contains(e.target) || btn.contains(e.target)) return;
        close();
      };
      document.addEventListener('click', handler);
      this._outsideHandlers.push(handler);
    }

    _openFallbackTooltip(btn, pop) {
      const rect = btn.getBoundingClientRect();
      pop.setAttribute('data-open', 'true');
      btn.setAttribute('aria-expanded', 'true');
      // Tooltip is position: fixed, so coordinates are viewport-relative
      // and must NOT include scroll offsets.
      const tipRect = pop.getBoundingClientRect();
      let left = rect.right - tipRect.width;
      let top = rect.bottom + 10;
      left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));
      top  = Math.min(top, window.innerHeight - tipRect.height - 12);
      pop.style.left = `${left}px`;
      pop.style.top  = `${top}px`;
      this._openTooltip = { btn, pop };
    }

    _closeFallbackTooltip(btn, pop) {
      pop.setAttribute('data-open', 'false');
      btn.setAttribute('aria-expanded', 'false');
      if (this._openTooltip && this._openTooltip.pop === pop) {
        this._openTooltip = null;
      }
    }

    _closeAllFallbackTooltips(exceptBtn = null) {
      if (!this._openTooltip) return;
      if (this._openTooltip.btn === exceptBtn) return;
      const { btn, pop } = this._openTooltip;
      this._closeFallbackTooltip(btn, pop);
    }

    /* ── Keyboard ─────────────────────────────────────────── */

    _bindKeyboard() {
      this._onKeyDown = (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (this.options.bindShortcuts !== false && mod && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          if (!this.options.autoPersist && this.$save &&
              !this.$save.classList.contains('kefe-btn--hidden')) {
            this.$save.click();
          } else if (this.options.autoPersist) {
            this.save();
          }
          return;
        }
        if (e.key === 'Escape') {
          this._closeAllFallbackTooltips();
        }
      };
      document.addEventListener('keydown', this._onKeyDown);
    }

    /* ── Public API ───────────────────────────────────────── */

    onChange(fn) { this._changeCb = fn; return this; }
    onSave(fn)   { this._saveCb = fn;   return this; }
    onReset(fn)  { this._resetCb = fn;  return this; }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      clearTimeout(this._debounceTimer);
      clearTimeout(this._savedTimer);
      this._focusObserver?.disconnect();
      this._slotObserver?.disconnect();
      if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
      this._outsideHandlers.forEach(h => document.removeEventListener('click', h));
      this._outsideHandlers = [];
    }
  }

  global.KefeSettingsPanel = KefeSettingsPanel;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KefeSettingsPanel };
  }
})(typeof window !== 'undefined' ? window : globalThis);
