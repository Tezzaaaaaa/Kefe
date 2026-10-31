/* KEFE — Pure JavaScript + CSS shadcn.io Settings Dialog
   Implements Dialog + Accordion + Slider + Switch + Select over window.kefeSettings. */

import { renderKefeIcon } from "../app/ui/icons.js";
import { createShadcnSlider } from "./shadcn-slider.js";

const GROUP_ICONS = {
  "title-card": "disc",
  lyrics: "list-music",
  engine: "gauge",
  defaults: "sliders",
  playback: "play",
  visuals: "sparkles",
  export: "download",
};

function slugify(value) {
  return String(value || "group")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatSettingValue(item, raw) {
  if (typeof item.fmt === "function") return item.fmt(Number(raw));
  if (item.key === "lyricOffset") {
    const num = Number(raw) || 0;
    return `${num > 0 ? "+" : ""}${num.toFixed(2)}s`;
  }
  if (item.key === "fftPower") {
    const num = Number(raw) || 11;
    return String(Math.pow(2, num));
  }
  if (typeof item.format === "function") return item.format(raw);
  if (item.unit) return `${raw}${item.unit}`;
  return String(raw);
}

function normalizeOptions(options) {
  return (options || []).map((opt) => {
    if (Array.isArray(opt)) {
      return { value: String(opt[0]), label: String(opt[1] ?? opt[0]) };
    }
    if (opt && typeof opt === "object") {
      return { value: String(opt.value), label: String(opt.label ?? opt.value) };
    }
    return { value: String(opt), label: String(opt) };
  });
}

function createShadcnSwitch({ checked = false, label = "", onChange }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shad-switch";
  btn.setAttribute("role", "switch");
  btn.setAttribute("aria-checked", String(Boolean(checked)));
  if (label) btn.setAttribute("aria-label", label);
  btn.dataset.state = checked ? "checked" : "unchecked";

  const thumb = document.createElement("span");
  thumb.className = "shad-switch-thumb";
  thumb.setAttribute("aria-hidden", "true");
  btn.appendChild(thumb);

  let state = Boolean(checked);
  const setChecked = (next, emit = false) => {
    state = Boolean(next);
    btn.setAttribute("aria-checked", String(state));
    btn.dataset.state = state ? "checked" : "unchecked";
    if (emit && typeof onChange === "function") onChange(state);
  };

  btn.addEventListener("click", () => setChecked(!state, true));
  return { root: btn, setChecked };
}

function createShadcnSelect({ value, options = [], label = "", onChange }) {
  const normalized = normalizeOptions(options);
  const wrap = document.createElement("div");
  wrap.className = "shad-select-wrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "shad-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (label) trigger.setAttribute("aria-label", label);

  const valueSpan = document.createElement("span");
  valueSpan.className = "shad-select-value";

  const iconSpan = document.createElement("span");
  iconSpan.className = "shad-select-chevron";
  iconSpan.setAttribute("aria-hidden", "true");
  iconSpan.innerHTML = renderKefeIcon("chevron-down", "", 14, 2);

  trigger.append(valueSpan, iconSpan);

  const listbox = document.createElement("div");
  listbox.className = "shad-select-listbox";
  listbox.setAttribute("role", "listbox");
  listbox.hidden = true;
  if (label) listbox.setAttribute("aria-label", label);

  let current = String(value ?? normalized[0]?.value ?? "");
  let isOpen = false;

  const renderOptions = () => {
    listbox.textContent = "";
    const match = normalized.find((opt) => opt.value === current) || normalized[0];
    valueSpan.textContent = match ? match.label : current;

    normalized.forEach((opt) => {
      const optEl = document.createElement("div");
      optEl.className = "shad-select-option";
      optEl.setAttribute("role", "option");
      const selected = opt.value === current;
      optEl.setAttribute("aria-selected", String(selected));
      optEl.dataset.state = selected ? "checked" : "unchecked";
      optEl.tabIndex = -1;

      const text = document.createElement("span");
      text.textContent = opt.label;

      const check = document.createElement("span");
      check.className = "shad-select-option-check";
      check.setAttribute("aria-hidden", "true");
      check.innerHTML = selected ? renderKefeIcon("check", "", 13, 2.2) : "";

      optEl.append(text, check);
      optEl.addEventListener("click", (event) => {
        event.stopPropagation();
        setValue(opt.value, true);
        setOpen(false);
        trigger.focus({ preventScroll: true });
      });
      listbox.appendChild(optEl);
    });
  };

  const setOpen = (next) => {
    isOpen = Boolean(next);
    listbox.hidden = !isOpen;
    trigger.setAttribute("aria-expanded", String(isOpen));
    wrap.dataset.state = isOpen ? "open" : "closed";
    if (isOpen) {
      const activeOpt =
        listbox.querySelector('[aria-selected="true"]') || listbox.querySelector('[role="option"]');
      activeOpt?.focus({ preventScroll: true });
    }
  };

  const setValue = (next, emit = false) => {
    current = String(next);
    renderOptions();
    if (emit && typeof onChange === "function") onChange(current);
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".shad-select-wrap[data-state='open']").forEach((other) => {
      if (other !== wrap) {
        other.dataset.state = "closed";
        const otherList = other.querySelector(".shad-select-listbox");
        const otherBtn = other.querySelector(".shad-select-trigger");
        if (otherList) otherList.hidden = true;
        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
      }
    });
    setOpen(!isOpen);
  });

  wrap.addEventListener("keydown", (event) => {
    const items = [...listbox.querySelectorAll('[role="option"]')];
    if (!items.length) return;
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.focus({ preventScroll: true });
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isOpen) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!isOpen) return;
    const activeIdx = items.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(activeIdx + 1) % items.length]?.focus({ preventScroll: true });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(activeIdx - 1 + items.length) % items.length]?.focus({ preventScroll: true });
    } else if (event.key === "Enter" || event.key === " ") {
      if (activeIdx >= 0) {
        event.preventDefault();
        items[activeIdx].click();
      }
    }
  });

  renderOptions();
  wrap.append(trigger, listbox);
  return { root: wrap, setValue, close: () => setOpen(false) };
}

function mountSettingsDialog() {
  const api = window.kefeSettings;
  if (!api || typeof api.schema !== "function" || document.querySelector(".beui-settings-root")) {
    return;
  }

  const root = document.createElement("div");
  root.className = "beui-settings-root shad-dialog-root";
  root.hidden = true;

  const backdrop = document.createElement("div");
  backdrop.className = "shad-dialog-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const dialog = document.createElement("div");
  dialog.className = "shad-dialog-content";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "kefe-settings-dialog-title");
  dialog.setAttribute("aria-describedby", "kefe-settings-dialog-desc");
  dialog.tabIndex = -1;

  const header = document.createElement("div");
  header.className = "shad-dialog-header";
  header.innerHTML = `
    <div class="shad-dialog-header-text">
      <h2 id="kefe-settings-dialog-title" class="shad-dialog-title">Settings</h2>
      <p id="kefe-settings-dialog-desc" class="shad-dialog-description">Configure playback timing, visual engine limits, title card, and default export preferences.</p>
    </div>
  `;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "shad-icon-btn shad-dialog-close";
  closeBtn.setAttribute("aria-label", "Close settings");
  closeBtn.innerHTML = renderKefeIcon("close", "", 16, 2);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "shad-dialog-body";

  const accordion = document.createElement("div");
  accordion.className = "shad-accordion";

  const rawSchema = api.schema() || [];
  const normalizedGroups = rawSchema.map((grp, idx) => {
    const title = grp.title || grp.group || grp.label || `Group ${idx + 1}`;
    const id = grp.id || slugify(title);
    return { id, title, items: grp.items || [] };
  });

  const controlSyncers = new Map();
  const selectRefs = [];
  const accordionPanels = new Map();

  // Open "lyrics" initially so Engine, Title card, and Defaults all open cleanly on first click.
  let openGroupId =
    normalizedGroups.find((g) => g.id === "lyrics")?.id || normalizedGroups[0]?.id || "";

  const setOpenGroup = (targetId) => {
    openGroupId = openGroupId === targetId ? "" : targetId;
    accordionPanels.forEach(({ itemEl, triggerEl, contentEl }, id) => {
      const expanded = id === openGroupId;
      itemEl.dataset.state = expanded ? "open" : "closed";
      triggerEl.setAttribute("aria-expanded", String(expanded));
      triggerEl.dataset.state = expanded ? "open" : "closed";
      contentEl.hidden = !expanded;
      contentEl.dataset.state = expanded ? "open" : "closed";
    });
  };

  normalizedGroups.forEach((group) => {
    const groupId = group.id;
    const itemEl = document.createElement("div");
    itemEl.className = "shad-accordion-item";

    const h3 = document.createElement("h3");
    h3.className = "shad-accordion-header";

    const triggerEl = document.createElement("button");
    triggerEl.type = "button";
    triggerEl.className = "shad-accordion-trigger";
    const contentId = `kefe-settings-${groupId}-content`;
    triggerEl.id = `kefe-settings-${groupId}-trigger`;
    triggerEl.setAttribute("aria-controls", contentId);
    triggerEl.setAttribute("aria-expanded", "false");

    const titleWrap = document.createElement("span");
    titleWrap.className = "shad-accordion-title-wrap";
    const iconSpan = document.createElement("span");
    iconSpan.className = "shad-accordion-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.innerHTML = renderKefeIcon(GROUP_ICONS[groupId] || "sliders", "", 15, 1.9);
    const titleText = document.createElement("span");
    titleText.textContent = group.title;
    titleWrap.append(iconSpan, titleText);

    const chevron = document.createElement("span");
    chevron.className = "shad-accordion-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = renderKefeIcon("chevron-down", "", 15, 2);

    triggerEl.append(titleWrap, chevron);
    triggerEl.addEventListener("click", () => setOpenGroup(groupId));
    h3.appendChild(triggerEl);

    const contentEl = document.createElement("div");
    contentEl.id = contentId;
    contentEl.className = "shad-accordion-content";
    contentEl.setAttribute("role", "region");
    contentEl.setAttribute("aria-labelledby", triggerEl.id);
    contentEl.hidden = true;

    const inner = document.createElement("div");
    inner.className = "shad-accordion-body";

    group.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = `shad-setting-row shad-setting-row--${item.type}`;

      const copy = document.createElement("div");
      copy.className = "shad-setting-copy";
      const labelEl = document.createElement("div");
      labelEl.className = "shad-setting-label";
      labelEl.textContent = item.label;
      copy.appendChild(labelEl);

      const descText = item.hint || item.description;
      if (descText) {
        const hintEl = document.createElement("div");
        hintEl.className = "shad-setting-hint";
        hintEl.textContent = descText;
        copy.appendChild(hintEl);
      }

      const currentVal = api.get(item.key);

      if (item.type === "range") {
        row.classList.add("shad-setting-row--slider");
        const topLine = document.createElement("div");
        topLine.className = "shad-setting-slider-top";
        const valOut = document.createElement("output");
        valOut.className = "shad-setting-value";
        valOut.textContent = formatSettingValue(item, currentVal);
        topLine.append(copy, valOut);

        const slider = createShadcnSlider({
          min: item.min,
          max: item.max,
          step: item.step,
          value: Number(currentVal),
          ariaLabel: item.label,
          onInput(val) {
            valOut.textContent = formatSettingValue(item, val);
            api.set(item.key, val);
          },
        });

        row.append(topLine, slider.root);
        controlSyncers.set(item.key, (val) => {
          valOut.textContent = formatSettingValue(item, val);
          slider.setValue(Number(val));
        });
      } else if (item.type === "toggle" || item.type === "boolean") {
        const sw = createShadcnSwitch({
          checked: Boolean(currentVal),
          label: item.label,
          onChange(val) {
            api.set(item.key, val);
          },
        });
        row.append(copy, sw.root);
        controlSyncers.set(item.key, (val) => sw.setChecked(Boolean(val), false));
      } else if (item.type === "select") {
        const sel = createShadcnSelect({
          value: currentVal,
          options: item.options || [],
          label: item.label,
          onChange(val) {
            api.set(item.key, val);
          },
        });
        selectRefs.push(sel);
        row.append(copy, sel.root);
        controlSyncers.set(item.key, (val) => sel.setValue(val, false));
      }

      inner.appendChild(row);
    });

    contentEl.appendChild(inner);
    itemEl.append(h3, contentEl);
    accordion.appendChild(itemEl);
    accordionPanels.set(groupId, { itemEl, triggerEl, contentEl });
  });

  // Activate initial open group
  const initialId = openGroupId;
  openGroupId = "";
  if (initialId) setOpenGroup(initialId);

  body.appendChild(accordion);

  const footer = document.createElement("div");
  footer.className = "shad-dialog-footer";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "shad-btn shad-btn--outline";
  resetBtn.textContent = "Reset to defaults";
  resetBtn.addEventListener("click", () => {
    api.reset();
    syncAllFromStore();
  });

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "shad-btn shad-btn--primary";
  doneBtn.textContent = "Done";

  footer.append(resetBtn, doneBtn);
  dialog.append(header, body, footer);
  root.append(backdrop, dialog);
  document.body.appendChild(root);

  function syncAllFromStore() {
    controlSyncers.forEach((sync, key) => {
      sync(api.get(key));
    });
  }

  if (typeof api.onChange === "function") {
    api.onChange((key, val) => {
      if (key && controlSyncers.has(key)) {
        controlSyncers.get(key)(val);
      } else {
        syncAllFromStore();
      }
    });
  }

  let previousFocus = null;
  const openDialog = () => {
    previousFocus = document.activeElement;
    syncAllFromStore();
    root.hidden = false;
    root.dataset.state = "open";
    document.documentElement.classList.add("shad-dialog-open");
    requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  };

  const closeDialog = () => {
    if (root.hidden) return;
    selectRefs.forEach((s) => s.close());
    root.hidden = true;
    root.dataset.state = "closed";
    document.documentElement.classList.remove("shad-dialog-open");
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    }
  };

  closeBtn.addEventListener("click", closeDialog);
  doneBtn.addEventListener("click", closeDialog);
  backdrop.addEventListener("click", closeDialog);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!root.hidden && !target.closest(".shad-select-wrap")) {
      selectRefs.forEach((s) => s.close());
    }
    const trigger = target.closest('[data-top-panel="settings"]');
    if (trigger) {
      event.preventDefault();
      openDialog();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
    }
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSettingsDialog, { once: true });
  } else {
    mountSettingsDialog();
  }
}
