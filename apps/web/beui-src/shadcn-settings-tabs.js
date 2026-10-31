/* KEFE — Pure JavaScript + CSS shadcn.io Tabs primitive & grouped settings tabs.
   Replaces the React/@radix-ui/react-tabs bridge while keeping the exact shadcn Tabs
   DOM structure, WAI-ARIA tablist keyboard navigation, and KEFE column docking. */

import { renderKefeIcon } from "../app/ui/icons.js";

const SECTIONS = {
  media: { nav: "media", label: "Media", icon: "music" },
  "lyric-sync": { nav: "lyrics", label: "Lyrics", icon: "list-music" },
  "lyric-effects": { nav: "effects", label: "Effects", icon: "sparkles" },
  background: { nav: "background-effects", label: "Background", icon: "layers" },
  visualisers: { nav: "visualiser", label: "Visuals", icon: "audio-waveform" },
  export: { nav: "export", label: "Export", icon: "download" },
};

const NAV_TO_SECTION = Object.fromEntries(
  Object.entries(SECTIONS).map(([sectionId, meta]) => [meta.nav, sectionId]),
);

const GROUP_LABELS = {
  input: "Input settings sections",
  output: "Visual and output settings sections",
};

export function createShadcnTabs({
  value = "",
  ariaLabel = "",
  items = [],
  classNames = {},
  attrs = {},
  onValueChange,
} = {}) {
  let activeValue = value;
  const host = document.createElement("div");
  host.className = ["shad-tabs", classNames.root].filter(Boolean).join(" ");
  Object.entries(attrs).forEach(([key, val]) => {
    if (val != null) host.setAttribute(key, String(val));
  });

  const list = document.createElement("div");
  list.className = ["shad-tabs-list", classNames.list].filter(Boolean).join(" ");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-orientation", "horizontal");
  if (ariaLabel) list.setAttribute("aria-label", ariaLabel);

  let triggers = [];

  function selectValue(nextValue, focusTrigger = false) {
    if (!nextValue) return;
    const changed = nextValue !== activeValue;
    activeValue = nextValue;
    syncTriggers(focusTrigger);
    if (changed) onValueChange?.(nextValue);
  }

  function syncTriggers(focusActive = false) {
    triggers.forEach(({ id, btn }) => {
      const isSelected = id === activeValue;
      btn.dataset.state = isSelected ? "active" : "inactive";
      btn.setAttribute("aria-selected", String(isSelected));
      btn.tabIndex = isSelected ? 0 : -1;
      if (focusActive && isSelected) btn.focus({ preventScroll: true });
    });
  }

  function renderItems(nextItems, nextActive) {
    if (nextActive !== undefined) activeValue = nextActive;
    list.textContent = "";
    triggers = nextItems.map((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.className = ["shad-tabs-trigger", classNames.trigger].filter(Boolean).join(" ");
      btn.dataset.tabValue = item.id;
      if (item.title) btn.title = item.title;

      if (item.icon) {
        const iconHolder = document.createElement("span");
        iconHolder.style.display = "contents";
        iconHolder.setAttribute("aria-hidden", "true");
        iconHolder.innerHTML = renderKefeIcon(item.icon, "", 12, 2.1);
        const svg = iconHolder.firstElementChild;
        if (svg) btn.appendChild(svg);
      }

      const labelSpan = document.createElement("span");
      labelSpan.className = classNames.label || "shad-tabs-label";
      labelSpan.textContent = item.label;
      btn.appendChild(labelSpan);

      if (item.modified) {
        const dot = document.createElement("span");
        dot.className = classNames.dot || "shad-tabs-dot";
        dot.setAttribute("aria-hidden", "true");
        btn.appendChild(dot);
      }

      btn.addEventListener("click", () => {
        if (item.id === activeValue) {
          onValueChange?.(item.id);
          return;
        }
        selectValue(item.id, false);
      });

      list.appendChild(btn);
      return { id: item.id, btn };
    });
    syncTriggers(false);
  }

  list.addEventListener("keydown", (event) => {
    if (!triggers.length) return;
    const currentIdx = triggers.findIndex(({ btn }) => btn === document.activeElement);
    let nextIdx = -1;
    if (event.key === "ArrowRight") {
      nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % triggers.length;
    } else if (event.key === "ArrowLeft") {
      nextIdx = currentIdx < 0 ? triggers.length - 1 : (currentIdx - 1 + triggers.length) % triggers.length;
    } else if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = triggers.length - 1;
    }
    if (nextIdx >= 0) {
      event.preventDefault();
      const target = triggers[nextIdx];
      selectValue(target.id, true);
    }
  });

  host.appendChild(list);
  renderItems(items, activeValue);

  return {
    el: host,
    list,
    update(nextItems, nextActive) {
      renderItems(nextItems, nextActive);
    },
    setValue(nextActive) {
      activeValue = nextActive;
      syncTriggers(false);
    },
  };
}

function readSectionItems(group) {
  return [...group.querySelectorAll(":scope > .section[data-section-id]")]
    .map((section) => {
      const id = section.dataset.sectionId;
      const meta = id && SECTIONS[id];
      if (!meta) return null;
      return {
        id,
        nav: meta.nav,
        label: meta.label,
        icon: meta.icon,
        title: `${meta.label}${section.getAttribute("data-modified") === "true" ? " (modified)" : ""}`,
        expanded: section.dataset.expanded !== "false",
        modified: section.getAttribute("data-modified") === "true",
      };
    })
    .filter(Boolean);
}

function resolveActiveSection(group, items) {
  const editing = document.querySelector(".kefe-editing");
  const selectedNav = editing?.dataset.selectedSection || "";
  const selectedId = NAV_TO_SECTION[selectedNav];
  if (selectedId && items.some((item) => item.id === selectedId && item.expanded)) {
    return selectedId;
  }
  const expanded = items.find((item) => item.expanded);
  if (expanded) return expanded.id;
  if (selectedId && items.some((item) => item.id === selectedId)) return selectedId;
  return items[0]?.id || "";
}

function openSection(group, sectionId) {
  const meta = SECTIONS[sectionId];
  if (!meta) return;

  for (const sibling of group.querySelectorAll(":scope > .section[data-section-id]")) {
    if (sibling.dataset.sectionId !== sectionId && sibling.dataset.expanded === "true") {
      sibling.querySelector(".expand-button")?.click();
    }
  }

  const navButton = document.querySelector(`.kefe-section[data-panel="${meta.nav}"]`);
  if (navButton) navButton.click();

  const target = group.querySelector(`:scope > .section[data-section-id="${sectionId}"]`);
  if (target && target.dataset.expanded === "false") {
    target.querySelector(".expand-button")?.click();
  }

  const editing = document.querySelector(".kefe-editing");
  if (editing) editing.dataset.selectedSection = meta.nav;

  group.scrollTop = 0;
}

const mounts = new Map();

function syncGroupMount(group) {
  const groupName = group.dataset.group || "settings";
  const items = readSectionItems(group);
  if (!items.length) return;
  const active = resolveActiveSection(group, items);
  const signature = items.map((i) => `${i.id}:${i.modified ? 1 : 0}`).join("|");

  let entry = mounts.get(group);
  if (!entry || !entry.mount.isConnected) {
    let mount = group.querySelector(":scope > .kefe-section-tabs-mount");
    if (!mount) {
      mount = document.createElement("div");
      mount.className = "kefe-section-tabs-mount";
      mount.dataset.groupMount = groupName;
      const firstSection = group.querySelector(":scope > .section[data-section-id]");
      group.insertBefore(mount, firstSection || group.firstChild);
    }
    mount.textContent = "";
    const tabs = createShadcnTabs({
      value: active,
      ariaLabel: GROUP_LABELS[groupName] || `${groupName} settings sections`,
      items,
      attrs: { "data-settings-tabs": groupName },
      classNames: {
        root: "kefe-section-tabs-host",
        list: "kefe-section-tabs-list",
        trigger: "kefe-section-tabs-trigger",
        label: "kefe-section-tabs-label",
        dot: "kefe-section-tabs-dot",
      },
      onValueChange(nextId) {
        openSection(group, nextId);
      },
    });
    mount.appendChild(tabs.el);
    entry = { mount, tabs, signature };
    mounts.set(group, entry);
    return;
  }

  if (entry.signature !== signature) {
    entry.signature = signature;
    entry.tabs.update(items, active);
  } else {
    entry.tabs.setValue(active);
  }
}

function mountAll() {
  const panel = document.getElementById("kefe-settings-panel");
  if (!panel) return false;
  const groups = panel.querySelectorAll(":scope > .kefe-settings-columns > .kefe-panel[data-group]");
  if (!groups.length) return false;
  groups.forEach(syncGroupMount);
  return true;
}

function initSettingsTabs() {
  let observersBound = false;
  let rafQueued = false;

  const scheduleSync = () => {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => {
      rafQueued = false;
      mountAll();
    });
  };

  const tryBind = () => {
    if (!mountAll()) return false;
    if (!observersBound) {
      observersBound = true;
      const panel = document.getElementById("kefe-settings-panel");
      const editing = document.querySelector(".kefe-editing");
      const observer = new MutationObserver(scheduleSync);
      if (panel) {
        observer.observe(panel, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-expanded", "data-modified"],
        });
      }
      if (editing) {
        observer.observe(editing, {
          attributes: true,
          attributeFilter: ["data-selected-section"],
        });
      }
    }
    return true;
  };

  if (tryBind()) return;

  const bootObserver = new MutationObserver(() => {
    if (tryBind()) bootObserver.disconnect();
  });
  if (document.body) {
    bootObserver.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener("kefe-settings-panel-ready", () => tryBind(), { once: true });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsTabs, { once: true });
  } else {
    initSettingsTabs();
  }
}
