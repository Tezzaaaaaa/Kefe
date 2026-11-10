/* Bridge the editor's native range inputs to the shadcn/ui Radix Slider.
   Native inputs remain the source of truth for the legacy editor. */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Slider } from "../components/ui/slider.js";

const MOUNT_ATTR = "data-shad-slider-mounted";

export function createShadcnSlider(options = {}) {
  const el = document.createElement("div");
  el.className = "shad-slider-container";
  const reactRoot = createRoot(el);
  let state = { min: 0, max: 100, step: 1, value: 0, ...options };
  let disposed = false;

  function render() {
    if (disposed) return;
    reactRoot.render(React.createElement(Slider, {
      min: state.min, max: state.max, step: state.step, value: state.value,
      disabled: state.disabled, label: state.ariaLabel, labelledBy: state.ariaLabelledBy, valueText: state.ariaValueText,
      onValueChange: ([value]) => {
        state.value = value;
        render();
        options.onInput?.(value);
      },
      onValueCommit: ([value]) => options.onChange?.(value),
    }));
  }
  // Initial DOM must be present synchronously for the existing editor boot gate.
  flushSync(render);
  return {
    el,
    update(next) { state = { ...state, ...next }; render(); },
    setValue(value) { state.value = value; render(); },
    getValue() { return state.value; },
    destroy() { if (!disposed) { disposed = true; reactRoot.unmount(); } },
  };
}

const mountedInputs = new Map();

function shouldConvert(input) {
  return (
    input instanceof HTMLInputElement &&
    input.isConnected &&
    input.type === "range" &&
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
    ariaValueText: input.getAttribute("aria-valuetext"),
  };
}

function mountSlider(input) {
  const originalTabindex = input.getAttribute("tabindex");
  const originalAriaHidden = input.getAttribute("aria-hidden");
  input.setAttribute(MOUNT_ATTR, "true");
  input.classList.add("shad-native-range");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");

  const host = document.createElement("div");
  host.className = "shad-slider-host";
  if (input.id === "kefeTime") host.classList.add("kefe-timebar-slider");
  host.dataset.shadSliderFor = input.id || input.getAttribute("aria-label") || "range";
  if (input.className) {
    input.className
      .split(/\s+/)
      .filter((name) => name && name !== "shad-native-range" && name !== "kefe-slider" && name !== "kefe-slider-backing")
      .forEach((name) => host.classList.add(name));
  }
  input.insertAdjacentElement("afterend", host);

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
  const ownsValue = descriptor?.get && descriptor?.set && !Object.prototype.hasOwnProperty.call(input, "value");
  if (ownsValue) {
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
  input.addEventListener("shad-sync", syncFromInput);

  const attrObserver = new MutationObserver(syncFromInput);
  attrObserver.observe(input, { attributes: true, attributeFilter: ["min", "max", "step", "disabled", "value", "aria-label", "aria-valuetext"] });
  mountedInputs.set(input, { destroy() {
    attrObserver.disconnect();
    for (const event of ["input", "change", "shad-sync"]) input.removeEventListener(event, syncFromInput);
    if (ownsValue) delete input.value;
    input.removeAttribute(MOUNT_ATTR);
    input.classList.remove("shad-native-range");
    if (originalTabindex === null) input.removeAttribute("tabindex"); else input.setAttribute("tabindex", originalTabindex);
    if (originalAriaHidden === null) input.removeAttribute("aria-hidden"); else input.setAttribute("aria-hidden", originalAriaHidden);
    slider.destroy();
    host.remove();
  } });
}

function syncMountedValues() {
  for (const [input, mounted] of mountedInputs) {
    if (!input.isConnected) {
      mounted.destroy();
      mountedInputs.delete(input);
      continue;
    }
    input.dispatchEvent(new Event("shad-sync"));
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
      // Moves between the desktop and mobile panels must not destroy a live slider.
      queueMicrotask(() => {
        for (const [input, mounted] of mountedInputs) {
          if (!input.isConnected) {
            mounted.destroy();
            mountedInputs.delete(input);
          }
        }
      });
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    window.kefeSettings?.onChange?.(() => requestAnimationFrame(syncMountedValues));
    window.addEventListener("kefe:shad-sync-ranges", syncMountedValues);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
