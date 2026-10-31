/* KEFE — Pure JavaScript + CSS shadcn.io primitive enhancer for editor controls.
   Upgrades ToggleGroups (.kefe-seg-row, .ls-tabs, .kefe-align-group), Dropzones (.kefe-drop),
   Checkboxes, NativeSelects, Cards, Dialogs, Progress bars, and Alert Toasts with shadcn
   data-slot / data-state attributes and keyboard roving focus — without cloning DOM nodes. */

const TOGGLE_GROUP_SELECTOR = ".kefe-seg-row, .ls-tabs, .kefe-align-group";

function isToggleItemActive(btn) {
  return (
    btn.classList.contains("active") ||
    btn.classList.contains("is-active") ||
    btn.getAttribute("aria-pressed") === "true" ||
    btn.getAttribute("aria-selected") === "true"
  );
}

function syncToggleGroup(group) {
  const buttons = [...group.querySelectorAll(":scope > button")];
  buttons.forEach((btn) => {
    btn.dataset.slot = "toggle-group-item";
    btn.dataset.state = isToggleItemActive(btn) ? "on" : "off";
  });
}

function enhanceToggleGroup(group) {
  if (!(group instanceof HTMLElement) || group.dataset.shadToggleGroup === "true") return;
  group.dataset.shadToggleGroup = "true";
  group.dataset.slot = "toggle-group";
  if (!group.hasAttribute("role")) {
    group.setAttribute("role", "group");
  }

  syncToggleGroup(group);

  group.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const buttons = [...group.querySelectorAll(":scope > button:not([disabled]):not([hidden])")];
    if (buttons.length < 2) return;
    const current = event.target instanceof HTMLElement ? event.target.closest("button") : null;
    const idx = buttons.indexOf(current);
    if (idx < 0) return;

    event.preventDefault();
    let nextIdx = idx;
    if (event.key === "ArrowRight") nextIdx = (idx + 1) % buttons.length;
    else if (event.key === "ArrowLeft") nextIdx = (idx - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") nextIdx = 0;
    else if (event.key === "End") nextIdx = buttons.length - 1;

    const target = buttons[nextIdx];
    target?.focus();
    target?.click();
  });

  const observer = new MutationObserver(() => syncToggleGroup(group));
  observer.observe(group, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "aria-pressed", "aria-selected"],
  });
}

function enhanceDropzone(zone) {
  if (!(zone instanceof HTMLElement) || zone.dataset.shadDropzone === "true") return;
  zone.dataset.shadDropzone = "true";
  zone.dataset.slot = "dropzone";

  let depth = 0;
  zone.addEventListener("dragenter", () => {
    depth += 1;
    zone.dataset.dragover = "true";
  });
  zone.addEventListener("dragover", () => {
    zone.dataset.dragover = "true";
  });
  zone.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) delete zone.dataset.dragover;
  });
  zone.addEventListener("drop", () => {
    depth = 0;
    delete zone.dataset.dragover;
  });
}

function tagPrimitives(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;

  root.querySelectorAll(TOGGLE_GROUP_SELECTOR).forEach(enhanceToggleGroup);
  root.querySelectorAll(".kefe-drop").forEach(enhanceDropzone);

  root.querySelectorAll('.kefe-editor input[type="checkbox"]').forEach((checkbox) => {
    if (!checkbox.dataset.slot) checkbox.dataset.slot = "checkbox";
  });

  root.querySelectorAll(".kefe-editor select").forEach((select) => {
    if (!select.dataset.slot) select.dataset.slot = "select";
  });

  root
    .querySelectorAll(
      '.kefe-editor input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="hidden"])',
    )
    .forEach((input) => {
      if (!input.dataset.slot) input.dataset.slot = "input";
    });

  root.querySelectorAll(".kefe-editor textarea").forEach((textarea) => {
    if (!textarea.dataset.slot) textarea.dataset.slot = "textarea";
  });

  root
    .querySelectorAll("#kefeMediaCurrentCard, .kefe-car-card, .ls-root, .kefe-settings-panel .section")
    .forEach((card) => {
      if (!card.dataset.slot) card.dataset.slot = "card";
    });

  root.querySelectorAll("#lsAutoSyncModal .ls-as-card").forEach((dlg) => {
    if (!dlg.dataset.slot) dlg.dataset.slot = "dialog-content";
  });

  root.querySelectorAll("#kefeAlertHost .kefe-alert").forEach((alertEl) => {
    if (!alertEl.dataset.slot) alertEl.dataset.slot = "alert";
  });
}

function bootShadcnControls() {
  tagPrimitives(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches?.(TOGGLE_GROUP_SELECTOR)) enhanceToggleGroup(node);
        if (node.matches?.(".kefe-drop")) enhanceDropzone(node);
        if (node.matches?.(".kefe-alert")) node.dataset.slot = "alert";
        tagPrimitives(node);
      });
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootShadcnControls, { once: true });
  } else {
    bootShadcnControls();
  }
}
