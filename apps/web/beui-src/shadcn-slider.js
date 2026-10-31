/* KEFE — Pure JavaScript + CSS shadcn.io Slider primitive and range input enhancer.
   Replaces the React/Framer-Motion beUI RangeSlider with an accessible WAI-ARIA slider. */

import "./legacy-bridge.css";

const MOUNT_ATTR = "data-beui-range-mounted";

function stepDecimals(step) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : Math.min(6, text.length - dot - 1);
}

function clampAndSnap(raw, min, max, step) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 100;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const clamped = Math.min(safeMax, Math.max(safeMin, raw));
  const steps = Math.round((clamped - safeMin) / safeStep);
  const decimals = stepDecimals(safeStep);
  const snapped = Number((safeMin + steps * safeStep).toFixed(decimals));
  return Math.min(safeMax, Math.max(safeMin, snapped));
}

function percentOf(value, min, max) {
  if (!Number.isFinite(max) || max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function createShadcnSlider(options = {}) {
  let min = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
  let max = Number.isFinite(Number(options.max)) ? Number(options.max) : 100;
  let step = Number.isFinite(Number(options.step)) && Number(options.step) > 0 ? Number(options.step) : 1;
  let disabled = Boolean(options.disabled);
  let value = clampAndSnap(Number.isFinite(Number(options.value)) ? Number(options.value) : min, min, max, step);

  const root = document.createElement("div");
  root.className = "shad-slider";
  if (disabled) root.dataset.disabled = "true";

  const track = document.createElement("span");
  track.className = "shad-slider-track";
  track.setAttribute("aria-hidden", "true");

  const range = document.createElement("span");
  range.className = "shad-slider-range";
  track.appendChild(range);

  const thumb = document.createElement("span");
  thumb.className = "shad-slider-thumb";
  thumb.setAttribute("role", "slider");
  thumb.tabIndex = disabled ? -1 : 0;
  if (options.ariaLabel) thumb.setAttribute("aria-label", options.ariaLabel);
  if (options.ariaLabelledBy) thumb.setAttribute("aria-labelledby", options.ariaLabelledBy);

  root.append(track, thumb);

  function render() {
    const pct = percentOf(value, min, max);
    root.style.setProperty("--shad-slider-pct", `${pct}%`);
    root.dataset.disabled = disabled ? "true" : "false";
    thumb.tabIndex = disabled ? -1 : 0;
    thumb.setAttribute("aria-valuemin", String(min));
    thumb.setAttribute("aria-valuemax", String(max));
    thumb.setAttribute("aria-valuenow", String(value));
    if (disabled) thumb.setAttribute("aria-disabled", "true");
    else thumb.removeAttribute("aria-disabled");
  }

  function commit(nextRaw, emitChange = false) {
    const next = clampAndSnap(nextRaw, min, max, step);
    const changed = next !== value;
    value = next;
    render();
    if (changed) options.onInput?.(value);
    if (emitChange) options.onChange?.(value);
  }

  function valueFromClientX(clientX) {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return value;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return min + ratio * (max - min);
  }

  let activePointer = null;

  root.addEventListener("pointerdown", (event) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    activePointer = event.pointerId;
    root.dataset.dragging = "true";
    try {
      root.setPointerCapture(event.pointerId);
    } catch (_) {}
    thumb.focus({ preventScroll: true });
    commit(valueFromClientX(event.clientX), false);
  });

  root.addEventListener("pointermove", (event) => {
    if (activePointer === null || event.pointerId !== activePointer || disabled) return;
    commit(valueFromClientX(event.clientX), false);
  });

  const endDrag = (event) => {
    if (activePointer === null || (event && event.pointerId !== activePointer)) return;
    activePointer = null;
    delete root.dataset.dragging;
    options.onChange?.(value);
  };

  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);
  root.addEventListener("lostpointercapture", () => {
    if (activePointer !== null) {
      activePointer = null;
      delete root.dataset.dragging;
    }
  });

  thumb.addEventListener("keydown", (event) => {
    if (disabled) return;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - step;
    else if (event.key === "PageUp") next = value + step * 10;
    else if (event.key === "PageDown") next = value - step * 10;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    if (next === null) return;
    event.preventDefault();
    commit(next, true);
  });

  render();

  return {
    el: root,
    thumb,
    update(nextProps = {}) {
      if (nextProps.min !== undefined && Number.isFinite(Number(nextProps.min))) min = Number(nextProps.min);
      if (nextProps.max !== undefined && Number.isFinite(Number(nextProps.max))) max = Number(nextProps.max);
      if (nextProps.step !== undefined && Number.isFinite(Number(nextProps.step)) && Number(nextProps.step) > 0) {
        step = Number(nextProps.step);
      }
      if (nextProps.disabled !== undefined) disabled = Boolean(nextProps.disabled);
      if (nextProps.ariaLabel !== undefined) {
        if (nextProps.ariaLabel) thumb.setAttribute("aria-label", nextProps.ariaLabel);
        else thumb.removeAttribute("aria-label");
      }
      if (nextProps.value !== undefined && Number.isFinite(Number(nextProps.value))) {
        value = clampAndSnap(Number(nextProps.value), min, max, step);
      } else {
        value = clampAndSnap(value, min, max, step);
      }
      render();
    },
    getValue() {
      return value;
    },
  };
}

const mountedInputs = new Set();

function shouldConvert(input) {
  return (
    input instanceof HTMLInputElement &&
    input.isConnected &&
    input.type === "range" &&
    input.id !== "kefeTime" &&
    !input.hasAttribute(MOUNT_ATTR)
  );
}

function resolveAriaLabel(input) {
  const direct = input.getAttribute("aria-label");
  if (direct) return direct;
  if (input.id) {
    try {
      const explicit = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (explicit && explicit.textContent.trim()) return explicit.textContent.trim();
    } catch (_) {}
  }
  const wrapping = input.closest("label");
  if (wrapping) {
    const title = wrapping.querySelector("b, .kefe-label");
    if (title && title.textContent.trim()) return title.textContent.trim();
    if (wrapping.textContent.trim()) return wrapping.textContent.trim();
  }
  return input.name || input.id || "Value";
}

function readInputState(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const rawStep = input.step && input.step !== "any" ? Number(input.step) : (max - min) / 100;
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
  const current = Number(input.value);
  return {
    min,
    max: max > min ? max : min + 1,
    step,
    value: Number.isFinite(current) ? current : min,
    disabled: input.disabled,
    ariaLabel: resolveAriaLabel(input),
  };
}

function mountSlider(input) {
  input.setAttribute(MOUNT_ATTR, "true");
  input.classList.add("beui-native-range");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");

  const host = document.createElement("div");
  host.className = "beui-range-host shad-slider-host";
  host.dataset.beuiRangeFor = input.id || input.getAttribute("aria-label") || "range";
  if (input.className) {
    input.className
      .split(/\s+/)
      .filter((name) => name && name !== "beui-native-range" && name !== "kefe-slider" && name !== "beui-slider")
      .forEach((name) => host.classList.add(name));
  }
  input.insertAdjacentElement("afterend", host);
  mountedInputs.add(input);

  let internalWrite = false;
  const initial = readInputState(input);

  const writeNative = (nextValue, eventName) => {
    internalWrite = true;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, String(nextValue));
    else input.value = String(nextValue);
    input.dispatchEvent(new Event(eventName, { bubbles: true }));
    internalWrite = false;
  };

  const slider = createShadcnSlider({
    ...initial,
    onInput(nextValue) {
      writeNative(nextValue, "input");
    },
    onChange(nextValue) {
      writeNative(nextValue, "change");
    },
  });

  host.appendChild(slider.el);

  const syncFromInput = () => {
    if (internalWrite) return;
    slider.update(readInputState(input));
  };

  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.get && descriptor?.set && !Object.prototype.hasOwnProperty.call(input, "value")) {
    Object.defineProperty(input, "value", {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() {
        return descriptor.get.call(this);
      },
      set(next) {
        descriptor.set.call(this, next);
        syncFromInput();
      },
    });
  }

  input.addEventListener("input", syncFromInput);
  input.addEventListener("change", syncFromInput);
  input.addEventListener("beui-sync", syncFromInput);

  const attrObserver = new MutationObserver(syncFromInput);
  attrObserver.observe(input, { attributes: true, attributeFilter: ["min", "max", "step", "disabled", "value", "aria-label"] });
}

function syncMountedValues() {
  for (const input of [...mountedInputs]) {
    if (!input.isConnected) {
      mountedInputs.delete(input);
      continue;
    }
    input.dispatchEvent(new Event("beui-sync"));
  }
}

function scan(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  if (shouldConvert(root)) mountSlider(root);
  root.querySelectorAll('input[type="range"]').forEach((input) => {
    if (shouldConvert(input)) mountSlider(input);
  });
}

if (typeof window !== "undefined") {
  const start = () => {
    scan(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    window.kefeSettings?.onChange?.(() => requestAnimationFrame(syncMountedValues));
    window.addEventListener("kefe:beui-sync-ranges", syncMountedValues);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
