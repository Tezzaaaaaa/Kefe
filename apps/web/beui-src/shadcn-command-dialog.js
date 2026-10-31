/* KEFE — Pure JavaScript + CSS shadcn.io CommandDialog enhancer.
   Replaces the React/beUI command-dialog bridge with a native cmdk-style CommandDialog:
   grouped sections, leading Lucide icons, keyboard ArrowUp/ArrowDown/Enter selection,
   shortcut kbd badges, and an empty state — with zero React or cloned buttons. */

import { renderKefeIcon } from "../app/ui/icons.js";

const COMMAND_META = {
  "panel:media": { icon: "music", group: "Sections" },
  "panel:lyrics": { icon: "list-music", group: "Sections" },
  "panel:effects": { icon: "sparkles", group: "Sections" },
  "panel:background-effects": { icon: "layers", group: "Sections" },
  "panel:visualiser": { icon: "audio-waveform", group: "Sections" },
  "panel:export": { icon: "download", group: "Sections" },
  settings: { icon: "sliders", group: "Workspace" },
  theme: { icon: "sun", group: "Workspace" },
  fullscreen: { icon: "maximize", group: "Workspace" },
};

function enhanceCommandDialog() {
  const overlay = document.getElementById("kefeCommandPalette");
  const dialog = overlay?.querySelector(".kefe-command-dialog");
  const input = document.getElementById("kefeCommandInput");
  const list = document.getElementById("kefeCommandList");
  if (!overlay || !dialog || !input || !list || dialog.dataset.shadEnhanced === "true") return;

  dialog.dataset.shadEnhanced = "true";
  dialog.classList.add("shad-command-dialog", "beui-command-dialog");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Commands");

  // Add Workspace Settings command if not already present.
  if (!list.querySelector('[data-command="settings"]')) {
    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.dataset.command = "settings";
    settingsBtn.innerHTML = "<span>Open Workspace Settings</span>";
    settingsBtn.addEventListener("click", () => {
      document.querySelector('[data-top-panel="settings"]')?.click();
    });
    const themeBtn = list.querySelector('[data-command="theme"]');
    if (themeBtn) list.insertBefore(settingsBtn, themeBtn);
    else list.appendChild(settingsBtn);
  }

  const rawButtons = [...list.querySelectorAll("button[data-command]")];
  list.textContent = "";

  const groups = new Map();
  rawButtons.forEach((button) => {
    const cmd = button.dataset.command || "";
    const meta = COMMAND_META[cmd] || { icon: "sparkles", group: "Commands" };
    if (!groups.has(meta.group)) groups.set(meta.group, []);
    groups.get(meta.group).push({ button, meta });
  });

  const allItems = [];
  let groupIndex = 0;

  groups.forEach((entries, groupName) => {
    if (groupIndex > 0) {
      const sep = document.createElement("div");
      sep.className = "shad-command-separator";
      sep.setAttribute("role", "separator");
      list.appendChild(sep);
    }
    groupIndex += 1;

    const groupEl = document.createElement("div");
    groupEl.className = "shad-command-group";
    groupEl.dataset.commandGroup = groupName;

    const heading = document.createElement("div");
    heading.className = "shad-command-group-heading";
    heading.textContent = groupName;
    groupEl.appendChild(heading);

    entries.forEach(({ button, meta }) => {
      button.classList.add("shad-command-item");
      button.setAttribute("role", "option");

      if (!button.querySelector(".shad-command-item-icon")) {
        const iconSpan = document.createElement("span");
        iconSpan.className = "shad-command-item-icon";
        iconSpan.setAttribute("aria-hidden", "true");
        iconSpan.innerHTML = renderKefeIcon(meta.icon, "", 15, 1.9);
        button.insertBefore(iconSpan, button.firstChild);
      }

      const host = document.createElement("span");
      host.className = "beui-command-button-host shad-command-item-host";
      host.appendChild(button);
      groupEl.appendChild(host);
      allItems.push({ button, host, groupEl });
    });

    list.appendChild(groupEl);
  });

  const empty = document.createElement("div");
  empty.className = "shad-command-empty";
  empty.hidden = true;
  empty.textContent = "No matching commands found.";
  list.appendChild(empty);

  let activeIndex = 0;

  function visibleItems() {
    return allItems.filter(({ button }) => !button.hidden);
  }

  function syncSelection() {
    const visible = visibleItems();
    if (!visible.length) {
      activeIndex = -1;
    } else if (activeIndex < 0 || activeIndex >= visible.length) {
      activeIndex = 0;
    }

    allItems.forEach(({ button, host }) => {
      host.hidden = button.hidden;
      button.dataset.selected = "false";
      button.setAttribute("aria-selected", "false");
    });

    groups.forEach((_, groupName) => {
      const groupEl = list.querySelector(`[data-command-group="${groupName}"]`);
      if (!groupEl) return;
      const hasVisible = [...groupEl.querySelectorAll("button[data-command]")].some((b) => !b.hidden);
      groupEl.hidden = !hasVisible;
    });

    list.querySelectorAll(".shad-command-separator").forEach((sep) => {
      const prev = sep.previousElementSibling;
      const next = sep.nextElementSibling;
      sep.hidden = Boolean(prev?.hidden || next?.hidden);
    });

    empty.hidden = visible.length > 0;

    if (activeIndex >= 0 && visible[activeIndex]) {
      const target = visible[activeIndex].button;
      target.dataset.selected = "true";
      target.setAttribute("aria-selected", "true");
      target.scrollIntoView({ block: "nearest" });
    }
  }

  input.addEventListener("input", () => {
    activeIndex = 0;
    requestAnimationFrame(syncSelection);
  });

  input.addEventListener("keydown", (event) => {
    const visible = visibleItems();
    if (!visible.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % visible.length;
      syncSelection();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + visible.length) % visible.length;
      syncSelection();
    } else if (event.key === "Home") {
      event.preventDefault();
      activeIndex = 0;
      syncSelection();
    } else if (event.key === "End") {
      event.preventDefault();
      activeIndex = visible.length - 1;
      syncSelection();
    } else if (event.key === "Enter" && activeIndex >= 0 && visible[activeIndex]) {
      event.preventDefault();
      visible[activeIndex].button.click();
    }
  });

  list.addEventListener("pointermove", (event) => {
    const btn = event.target instanceof Element ? event.target.closest("button[data-command]") : null;
    if (!btn) return;
    const visible = visibleItems();
    const idx = visible.findIndex((item) => item.button === btn);
    if (idx >= 0 && idx !== activeIndex) {
      activeIndex = idx;
      syncSelection();
    }
  });

  const overlayObserver = new MutationObserver(() => {
    if (!overlay.hidden) {
      activeIndex = 0;
      requestAnimationFrame(syncSelection);
    }
  });
  overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });

  syncSelection();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceCommandDialog, { once: true });
  } else {
    enhanceCommandDialog();
  }
}
