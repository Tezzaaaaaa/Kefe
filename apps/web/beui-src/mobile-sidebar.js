/* KEFE — Pure JavaScript + CSS shadcn.io Mobile Editor Sidebar (Sheet + Sidebar Rail + Tabs + Menu).
   Hosts the live native .kefe-panel[data-panel-view] elements below 1024px without cloning controls,
   and restores each panel to its original .kefe-slot when switched or closed. */

import "./mobile-sidebar.css";
import { renderKefeIcon } from "../app/ui/icons.js";
import { SECTION_BY_ID, SECTIONS, resolveGroups } from "./mobile-sidebar-sections.js";

const MOBILE_QUERY = "(max-width: 1023px)";

const SECTION_ICONS = {
  media: "music",
  lyrics: "list-music",
  effects: "sparkles",
  "background-effects": "layers",
  visualiser: "audio-waveform",
  export: "download",
};

function readActiveSection() {
  const editing = document.querySelector(".kefe-editing");
  const fromData = editing?.dataset?.selectedSection;
  if (fromData && SECTION_BY_ID.has(fromData)) return fromData;
  const activeBtn = document.querySelector(".kefe-tabs .kefe-section.active");
  const fromBtn = activeBtn?.getAttribute("data-panel");
  if (fromBtn && SECTION_BY_ID.has(fromBtn)) return fromBtn;
  return "media";
}

const MIGRATED_SLOTS = {
  media: "media",
  lyrics: "lyric-sync",
  effects: "lyric-effects",
  "background-effects": "background",
  visualiser: "visualisers",
  export: "export",
};

function selectNativeSection(sectionId) {
  const navBtn = document.querySelector(`.kefe-tabs .kefe-section[data-panel="${sectionId}"]`);
  if (navBtn) navBtn.click();
  const editing = document.querySelector(".kefe-editing");
  if (editing) {
    editing.setAttribute("data-active-panel", sectionId);
    editing.setAttribute("data-selected-section", sectionId);
    editing.querySelectorAll(".kefe-panel[data-panel-view]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panelView === sectionId);
    });
  }
  const settingsSection = document.querySelector(
    `#kefe-settings-panel .section[data-section-id="${MIGRATED_SLOTS[sectionId]}"]`,
  );
  if (settingsSection) {
    document.querySelectorAll("#kefe-settings-panel .section[data-section-id]").forEach((item) => {
      const selected = item === settingsSection;
      item.dataset.expanded = String(selected);
      item.querySelector(".expand-button")?.setAttribute("aria-expanded", String(selected));
    });
  }
}

function readTrackSummary() {
  const title = document.getElementById("songTitle")?.value?.trim();
  const artist = document.getElementById("songArtist")?.value?.trim();
  if (title && artist) return `${title} — ${artist}`;
  if (title) return title;
  const cardTitle = document.getElementById("kefeMediaTrackTitle")?.textContent?.trim();
  if (cardTitle && cardTitle !== "Untitled") return cardTitle;
  return "No track loaded";
}

function clearGroupAttributes(panel) {
  if (!panel) return;
  panel.querySelectorAll("[data-kefe-ms-group]").forEach((el) => {
    el.removeAttribute("data-kefe-ms-group");
    el.classList.remove("kefe-ms-group-off");
  });
}

function wireCollapsibleGroups(panel) {
  const cleanups = [];
  const groups = [...panel.querySelectorAll(".kefe-visualiser-control-group")].filter((group) =>
    group.querySelector(":scope > div.kefe-label"),
  );
  groups.forEach((group, index) => {
    const heading = group.querySelector(":scope > div.kefe-label");
    if (!heading) return;
    const defaultCollapsed = index > 0;
    group.classList.toggle("is-collapsed", defaultCollapsed);
    heading.setAttribute("role", "button");
    heading.setAttribute("tabindex", "0");
    heading.setAttribute("aria-expanded", String(!defaultCollapsed));

    const toggle = (event) => {
      if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
      if (event.type === "keydown") event.preventDefault();
      const collapsed = group.classList.toggle("is-collapsed");
      heading.setAttribute("aria-expanded", String(!collapsed));
    };

    heading.addEventListener("click", toggle);
    heading.addEventListener("keydown", toggle);
    cleanups.push(() => {
      heading.removeEventListener("click", toggle);
      heading.removeEventListener("keydown", toggle);
      heading.removeAttribute("role");
      heading.removeAttribute("tabindex");
      heading.removeAttribute("aria-expanded");
      group.classList.remove("is-collapsed");
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

function initMobileSidebar() {
  if (document.getElementById("kefe-mobile-sidebar-root")) return;

  const root = document.createElement("div");
  root.id = "kefe-mobile-sidebar-root";
  document.body.appendChild(root);

  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  let isMobile = mediaQuery.matches;
  let isOpen = false;
  let toolsOpen = false;
  let activeSection = readActiveSection();
  const groupMemory = { media: "source" };
  let activeGroups = [];
  let borrowed = null;
  let panelMutationObserver = null;
  let lastFocusedBeforeOpen = null;

  const dock = document.createElement("nav");
  dock.className = "kefe-ms-dock";
  dock.setAttribute("aria-label", "Editor sections");

  const dockRow = document.createElement("div");
  dockRow.className = "kefe-ms-dock-row";
  dock.appendChild(dockRow);

  const dockButtons = new Map();
  SECTIONS.forEach((sec) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kefe-ms-dock-item";
    btn.setAttribute("aria-label", `Edit ${sec.label}`);
    btn.innerHTML = `${renderKefeIcon(SECTION_ICONS[sec.id] || "sliders", "", 17, 1.9)}<span>${sec.shortLabel}</span>`;
    btn.addEventListener("click", () => {
      if (isOpen && activeSection === sec.id) {
        closeSidebar();
      } else {
        openSectionInSidebar(sec.id, btn);
      }
    });
    dockRow.appendChild(btn);
    dockButtons.set(sec.id, btn);
  });
  root.appendChild(dock);

  let scrimEl = null;
  let drawerEl = null;
  let hostEl = null;
  let tabsEl = null;
  let titleEl = null;
  let stepEl = null;
  let blurbEl = null;
  let statusEl = null;
  let toolsWrapEl = null;
  let toolsMenuEl = null;
  let toolsBtnEl = null;
  const railButtons = new Map();

  function restoreBorrowedPanel() {
    if (panelMutationObserver) {
      panelMutationObserver.disconnect();
      panelMutationObserver = null;
    }
    if (!borrowed) return;
    const { panel, parent, placeholder, wasActive, cleanupCollapsible } = borrowed;
    borrowed = null;
    cleanupCollapsible?.();
    clearGroupAttributes(panel);
    panel.classList.remove("kefe-ms-live-panel");
    if (!wasActive) panel.classList.remove("active");
    if (placeholder.parentNode) {
      placeholder.parentNode.replaceChild(panel, placeholder);
    } else if (parent?.isConnected) {
      parent.appendChild(panel);
    }
  }

  function syncDockState() {
    dockButtons.forEach((btn, id) => {
      const selected = isOpen && activeSection === id;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-pressed", String(selected));
    });
  }

  function applyGroupVisibility(panel, section) {
    if (!panel || !section) return;
    activeGroups = resolveGroups(panel, section);
    const chosen =
      groupMemory[section.id] && activeGroups.some((g) => g.id === groupMemory[section.id])
        ? groupMemory[section.id]
        : activeGroups[0]?.id || "";
    groupMemory[section.id] = chosen;

    if (hostEl) {
      hostEl.setAttribute("data-kefe-ms-active-group", chosen);
    }

    clearGroupAttributes(panel);
    if (activeGroups.length > 1) {
      activeGroups.forEach((group) => {
        const off = group.id !== chosen;
        group.elements.forEach((el) => {
          el.setAttribute("data-kefe-ms-group", group.id);
          el.classList.toggle("kefe-ms-group-off", off);
        });
      });
    }

    renderGroupTabs(section, chosen);
  }

  function renderGroupTabs(section, chosenId) {
    if (!tabsEl) return;
    tabsEl.textContent = "";
    tabsEl.setAttribute("aria-label", `${section.label} control groups`);
    if (activeGroups.length <= 1) {
      tabsEl.hidden = true;
      return;
    }
    tabsEl.hidden = false;
    activeGroups.forEach((group) => {
      const selected = group.id === chosenId;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.className = `kefe-ms-tab${selected ? " is-active" : ""}`;
      tab.dataset.kefeMsGroupId = group.id;
      tab.setAttribute("aria-selected", String(selected));
      tab.textContent = group.label;
      tab.addEventListener("click", () => {
        groupMemory[section.id] = group.id;
        if (borrowed?.panel) {
          applyGroupVisibility(borrowed.panel, section);
        }
        if (hostEl) hostEl.scrollTop = 0;
      });
      tabsEl.appendChild(tab);
    });
  }

  function mountPanelIntoHost() {
    if (!hostEl || !isOpen || !isMobile) return;
    restoreBorrowedPanel();

    const section = SECTION_BY_ID.get(activeSection) || SECTIONS[0];
    const panel = document.querySelector(`.kefe-panel[data-panel-view="${section.id}"]`);
    if (!panel || !panel.parentNode) return;

    const parent = panel.parentNode;
    const placeholder = document.createElement("span");
    placeholder.hidden = true;
    placeholder.setAttribute("data-kefe-ms-placeholder", section.id);
    const wasActive = panel.classList.contains("active");

    parent.replaceChild(placeholder, panel);
    panel.classList.add("active", "kefe-ms-live-panel");
    hostEl.appendChild(panel);
    hostEl.scrollTop = 0;

    if (section.id === "visualiser") {
      const visTabs = panel.querySelector(".kefe-vis-tabs");
      if (visTabs) visTabs.hidden = false;
    }

    const cleanupCollapsible = wireCollapsibleGroups(panel);
    borrowed = { panel, parent, placeholder, wasActive, cleanupCollapsible };
    applyGroupVisibility(panel, section);

    const form = panel.querySelector(".kefe-form");
    if (form) {
      panelMutationObserver = new MutationObserver(() => {
        if (borrowed?.panel === panel) applyGroupVisibility(panel, section);
      });
      panelMutationObserver.observe(form, { childList: true });
    }
  }

  function renderToolsMenu() {
    if (!toolsMenuEl) return;
    const isNight = (document.documentElement.dataset.theme || "night") !== "day";
    toolsMenuEl.hidden = !toolsOpen;
    if (toolsBtnEl) {
      toolsBtnEl.setAttribute("aria-expanded", String(toolsOpen));
      const chev = toolsBtnEl.querySelector(".kefe-ms-tools-chevron");
      if (chev) chev.classList.toggle("is-flipped", toolsOpen);
    }
    if (!toolsOpen) return;

    toolsMenuEl.textContent = "";
    const actions = [
      {
        icon: "sliders",
        label: "Workspace settings",
        run: () => document.querySelector('[data-top-panel="settings"]')?.click(),
      },
      {
        icon: "search",
        label: "Search & commands",
        run: () => document.querySelector("[data-command-open]")?.click(),
      },
      {
        icon: isNight ? "sun" : "moon",
        label: isNight ? "Switch to day mode" : "Switch to night mode",
        run: () => document.getElementById("kefeThemeToggle")?.click(),
      },
      {
        icon: "maximize",
        label: "Fullscreen preview",
        run: () => {
          closeSidebar();
          requestAnimationFrame(() => document.getElementById("previewFullscreen")?.click());
        },
      },
    ];

    actions.forEach((action) => {
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.className = "kefe-ms-tool";
      item.innerHTML = `${renderKefeIcon(action.icon, "", 15, 1.9)}<span>${action.label}</span>`;
      item.addEventListener("click", () => {
        toolsOpen = false;
        renderToolsMenu();
        action.run();
      });
      toolsMenuEl.appendChild(item);
    });
  }

  function ensureDrawerMounted() {
    if (drawerEl) return;

    scrimEl = document.createElement("div");
    scrimEl.className = "kefe-ms-scrim";
    scrimEl.setAttribute("aria-hidden", "true");
    scrimEl.addEventListener("click", closeSidebar);

    drawerEl = document.createElement("aside");
    drawerEl.className = "kefe-ms-drawer";
    drawerEl.setAttribute("role", "dialog");
    drawerEl.setAttribute("aria-modal", "false");
    drawerEl.setAttribute("aria-labelledby", "kefe-ms-title");

    drawerEl.innerHTML = `
      <header class="kefe-ms-head">
        <div class="kefe-ms-head-copy">
          <span class="kefe-ms-brand">KEFE</span>
          <span class="kefe-ms-head-sub"></span>
          <h2 id="kefe-ms-title" class="kefe-ms-title"></h2>
        </div>
        <button type="button" class="kefe-ms-close" aria-label="Close editor sidebar">
          ${renderKefeIcon("close", "", 17, 2)}
        </button>
      </header>
      <div class="kefe-ms-body">
        <nav class="kefe-ms-rail" aria-label="Editor sections">
          <div class="kefe-ms-rail-group"></div>
        </nav>
        <div class="kefe-ms-surface">
          <div class="kefe-ms-surface-head">
            <p class="kefe-ms-blurb"></p>
            <div class="kefe-ms-tabs" role="tablist"></div>
          </div>
          <div class="kefe-ms-host"></div>
        </div>
      </div>
      <footer class="kefe-ms-foot">
        <span class="kefe-ms-status" title="Current track"></span>
        <div class="kefe-ms-tools-wrap">
          <div class="kefe-ms-tools" role="menu" aria-label="Editor tools" hidden></div>
          <button type="button" class="kefe-ms-foot-button" aria-haspopup="menu" aria-expanded="false">
            ${renderKefeIcon("sliders", "", 14, 2)}
            <span>Tools</span>
            <span class="kefe-ms-tools-chevron" aria-hidden="true">${renderKefeIcon("chevron-up", "", 13, 2)}</span>
          </button>
        </div>
        <button type="button" class="kefe-ms-done">
          ${renderKefeIcon("check", "", 14, 2.2)}
          <span>Done</span>
        </button>
      </footer>
    `;

    titleEl = drawerEl.querySelector("#kefe-ms-title");
    stepEl = drawerEl.querySelector(".kefe-ms-head-sub");
    blurbEl = drawerEl.querySelector(".kefe-ms-blurb");
    tabsEl = drawerEl.querySelector(".kefe-ms-tabs");
    hostEl = drawerEl.querySelector(".kefe-ms-host");
    statusEl = drawerEl.querySelector(".kefe-ms-status");
    toolsWrapEl = drawerEl.querySelector(".kefe-ms-tools-wrap");
    toolsMenuEl = drawerEl.querySelector(".kefe-ms-tools");
    toolsBtnEl = drawerEl.querySelector(".kefe-ms-foot-button");

    const railGroup = drawerEl.querySelector(".kefe-ms-rail-group");
    railButtons.clear();
    SECTIONS.forEach((sec) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kefe-ms-rail-item";
      btn.title = sec.label;
      btn.innerHTML = `
        <span aria-hidden="true">${renderKefeIcon(SECTION_ICONS[sec.id] || "sliders", "", 17, 1.9)}</span>
        <span class="kefe-ms-rail-label">${sec.shortLabel}</span>
      `;
      btn.addEventListener("click", () => openSectionInSidebar(sec.id));
      railGroup.appendChild(btn);
      railButtons.set(sec.id, btn);
    });

    drawerEl.querySelector(".kefe-ms-close")?.addEventListener("click", closeSidebar);
    drawerEl.querySelector(".kefe-ms-done")?.addEventListener("click", closeSidebar);
    toolsBtnEl?.addEventListener("click", (event) => {
      event.stopPropagation();
      toolsOpen = !toolsOpen;
      renderToolsMenu();
    });

    root.append(scrimEl, drawerEl);
  }

  function unmountDrawer() {
    restoreBorrowedPanel();
    scrimEl?.remove();
    drawerEl?.remove();
    scrimEl = null;
    drawerEl = null;
    hostEl = null;
    tabsEl = null;
    titleEl = null;
    stepEl = null;
    blurbEl = null;
    statusEl = null;
    toolsWrapEl = null;
    toolsMenuEl = null;
    toolsBtnEl = null;
    railButtons.clear();
  }

  function syncDrawerContent() {
    if (!drawerEl) return;
    const section = SECTION_BY_ID.get(activeSection) || SECTIONS[0];
    const index = SECTIONS.findIndex((s) => s.id === section.id);
    if (titleEl) titleEl.textContent = section.label;
    if (stepEl) stepEl.textContent = `Step ${index + 1} of ${SECTIONS.length}`;
    if (blurbEl) blurbEl.textContent = section.blurb;
    if (statusEl) statusEl.textContent = readTrackSummary();

    railButtons.forEach((btn, id) => {
      const current = id === section.id;
      btn.classList.toggle("is-active", current);
      if (current) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });

    renderToolsMenu();
  }

  function placeBottomSheet() {
    const tl = document.querySelector(".kefe-timeline")?.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const bottom = dockRect.height ? Math.max(0, window.innerHeight - dockRect.top) + 6 : 86;
    const wanted = tl ? tl.bottom + 8 : window.innerHeight * 0.5;
    const top = Math.min(Math.max(wanted, 120), window.innerHeight - bottom - 220);
    document.documentElement.style.setProperty("--kefe-ms-top", `${Math.round(top)}px`);
    document.documentElement.style.setProperty("--kefe-ms-bottom", `${Math.round(bottom)}px`);
  }

  function openSectionInSidebar(sectionId, trigger = null) {
    if (!SECTION_BY_ID.has(sectionId)) return;
    if (!isOpen) {
      lastFocusedBeforeOpen = trigger instanceof HTMLElement ? trigger : document.activeElement;
    }
    activeSection = sectionId;
    toolsOpen = false;
    selectNativeSection(sectionId);
    if (!isMobile) return;

    if (!isOpen) {
      window.scrollTo(0, 0);
      placeBottomSheet();
      requestAnimationFrame(placeBottomSheet);
      window.addEventListener("resize", placeBottomSheet);
    }
    isOpen = true;
    document.documentElement.classList.add("kefe-ms-locked", "kefe-ms-sheet-open");
    ensureDrawerMounted();
    syncDrawerContent();
    mountPanelIntoHost();
    syncDockState();
  }

  function closeSidebar() {
    if (!isOpen) return;
    isOpen = false;
    toolsOpen = false;
    window.removeEventListener("resize", placeBottomSheet);
    document.documentElement.classList.remove("kefe-ms-locked", "kefe-ms-sheet-open");
    document.documentElement.style.removeProperty("--kefe-ms-top");
    document.documentElement.style.removeProperty("--kefe-ms-bottom");
    unmountDrawer();
    syncDockState();
    if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === "function") {
      lastFocusedBeforeOpen.focus({ preventScroll: true });
    }
  }

  function syncViewportMode() {
    const wasMobile = isMobile;
    isMobile = mediaQuery.matches;
    document.documentElement.classList.toggle("kefe-ms-enabled", isMobile);
    if (!isMobile && isOpen) {
      closeSidebar();
    } else if (isMobile && !wasMobile) {
      openSectionInSidebar(readActiveSection());
    } else {
      syncDockState();
    }
  }

  mediaQuery.addEventListener("change", syncViewportMode);
  syncViewportMode();

  const editing = document.querySelector(".kefe-editing");
  if (editing) {
    const editingObserver = new MutationObserver(() => {
      const next = readActiveSection();
      if (next !== activeSection) {
        activeSection = next;
        syncDockState();
        if (isOpen) {
          syncDrawerContent();
          mountPanelIntoHost();
        }
      }
    });
    editingObserver.observe(editing, { attributes: true, attributeFilter: ["data-selected-section"] });
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (toolsOpen && toolsWrapEl && !toolsWrapEl.contains(target)) {
      toolsOpen = false;
      renderToolsMenu();
    }
    if (!isMobile) return;
    const dockTrigger = target.closest("[data-dock-panel]");
    if (dockTrigger) {
      const id = dockTrigger.getAttribute("data-dock-panel");
      if (id && SECTION_BY_ID.has(id)) openSectionInSidebar(id, dockTrigger);
      return;
    }
    if (target.closest("[data-dock-export]")) {
      openSectionInSidebar("export");
      return;
    }
    const headerTab = target.closest("[data-editor-tab]");
    if (headerTab) {
      event.preventDefault();
      openSectionInSidebar(activeSection || "media", headerTab);
    }
  });

  document.addEventListener("input", () => {
    if (isOpen && statusEl) statusEl.textContent = readTrackSummary();
  });

  window.addEventListener("keydown", (event) => {
    if (!isOpen || event.key !== "Escape") return;
    if (document.querySelector(".beui-settings-root:not([hidden]), #kefeCommandPalette:not([hidden])")) {
      return;
    }
    if (toolsOpen) {
      event.preventDefault();
      toolsOpen = false;
      renderToolsMenu();
      return;
    }
    event.preventDefault();
    closeSidebar();
  });
}

if (typeof window !== "undefined") {
  const boot = () => {
    if (document.querySelector(".kefe-editing")) {
      initMobileSidebar();
      return;
    }
    window.addEventListener("kefe-shell-ready", initMobileSidebar, { once: true });
    window.addEventListener("load", initMobileSidebar, { once: true });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
