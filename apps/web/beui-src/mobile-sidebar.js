/* KEFE — Pure JavaScript + CSS shadcn.io Mobile Editor Sidebar (Inline Section Panel + Bottom Dock + shadcn Tabs).
   Hosts the live native .kefe-panel[data-panel-view] elements below 1024px without cloning controls,
   and restores each panel to its original .kefe-slot when switched or closed. */

import "./mobile-sidebar.css";
import { renderKefeIcon } from "../app/ui/icons.js";
import { MIGRATED_SLOTS, SECTION_BY_ID, SECTIONS, resolveGroups } from "./mobile-sidebar-sections.js";

const MOBILE_QUERY = "(max-width: 1023px)";
const SECTION_KEY = "kefe.mobileSidebar.section";

const ICON_MAP = {
  activity: "activity",
  clock: "clock",
  download: "download",
  file: "file",
  folder: "folder-open",
  image: "image",
  list: "list-music",
  moon: "moon",
  music: "music-2",
  palette: "palette",
  sliders: "sliders",
  sparkles: "sparkles",
  type: "type",
  upload: "upload",
  video: "video",
};

function iconSvg(key, size, strokeWidth) {
  const mapped = ICON_MAP[key] || key || "sliders";
  return renderKefeIcon(mapped, "", size, strokeWidth);
}

function readStoredSection() {
  try {
    const saved = localStorage.getItem(SECTION_KEY);
    if (saved && SECTION_BY_ID.has(saved)) return saved;
  } catch (_) {
    /* storage unavailable */
  }
  return "media";
}

function readActiveSection() {
  const editing = document.querySelector(".kefe-editing");
  const fromData = editing?.dataset?.selectedSection;
  if (fromData && SECTION_BY_ID.has(fromData)) return fromData;
  const activeBtn = document.querySelector(".kefe-tabs .kefe-section.active");
  const fromBtn = activeBtn?.getAttribute("data-panel");
  if (fromBtn && SECTION_BY_ID.has(fromBtn)) return fromBtn;
  return readStoredSection();
}

function selectNativeSection(sectionId) {
  try {
    localStorage.setItem(SECTION_KEY, sectionId);
  } catch (_) {
    /* storage unavailable */
  }
  document.querySelectorAll("[data-shell-panel]").forEach((button) => {
    button.classList.toggle("is-current", button.dataset.shellPanel === sectionId);
  });
  document.querySelectorAll(".kefe-section[data-panel]").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === sectionId);
  });
  document.querySelectorAll("[data-dock-panel]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.dockPanel === sectionId));
  });
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
  let activeSection = readStoredSection();
  const groupMemory = { media: "source" };
  let activeGroups = [];
  let borrowed = null;
  let panelMutationObserver = null;
  let lastFocusedBeforeOpen = null;

  const dock = document.createElement("nav");
  dock.className = "kefe-ms-dock";
  dock.setAttribute("aria-label", "Edit sections");

  const dockGrip = document.createElement("span");
  dockGrip.className = "kefe-ms-dock-grip";
  dockGrip.setAttribute("aria-hidden", "true");
  dock.appendChild(dockGrip);

  const dockRow = document.createElement("div");
  dockRow.className = "kefe-ms-dock-row";
  dock.appendChild(dockRow);

  const dockButtons = new Map();
  SECTIONS.forEach((sec) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kefe-ms-dock-item";
    btn.setAttribute("aria-label", `Edit ${sec.label}`);
    btn.innerHTML = `${iconSvg(sec.icon, 18, 1.7)}<span>${sec.short}</span>`;
    btn.addEventListener("click", () => openSectionInSidebar(sec.id, btn));
    dockRow.appendChild(btn);
    dockButtons.set(sec.id, btn);
  });
  root.appendChild(dock);

  let drawerEl = null;
  let hostEl = null;
  let tabsRootEl = null;
  let tabsListEl = null;
  let titleEl = null;
  let blurbEl = null;

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
      const selected = activeSection === id;
      btn.classList.toggle("is-active", selected);
      if (selected) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
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
      hostEl.setAttribute("data-kefe-ms-section", section.id);
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

  /* Group switcher: pure-JS shadcn.io Tabs (`[data-slot="tabs"]`, `[data-slot="tabs-list"]`,
     `[data-slot="tabs-trigger"]`). Native panels stay in place; the active tab decides which
     marked control group is visible. */
  function renderGroupTabs(section, chosenId) {
    if (!tabsRootEl || !tabsListEl) return;
    tabsListEl.textContent = "";
    if (activeGroups.length < 2) {
      tabsRootEl.hidden = true;
      return;
    }
    tabsRootEl.hidden = false;
    activeGroups.forEach((group) => {
      const selected = group.id === chosenId;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.setAttribute("data-slot", "tabs-trigger");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("data-state", selected ? "active" : "inactive");
      tab.setAttribute("tabindex", selected ? "0" : "-1");
      tab.dataset.kefeMsGroupId = group.id;
      tab.className = `kefe-ms-tab${selected ? " is-active" : ""}`;
      tab.innerHTML = `${iconSvg(group.icon, 14, 1.8)}<span>${group.label}</span>`;
      tab.addEventListener("click", () => {
        groupMemory[section.id] = group.id;
        if (borrowed?.panel) {
          applyGroupVisibility(borrowed.panel, section);
        }
        if (hostEl) hostEl.scrollTop = 0;
      });
      tabsListEl.appendChild(tab);
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

  function ensureDrawerMounted() {
    if (drawerEl) return;

    drawerEl = document.createElement("aside");
    drawerEl.className = "kefe-ms-drawer";
    drawerEl.setAttribute("role", "dialog");
    drawerEl.setAttribute("aria-modal", "false");
    drawerEl.setAttribute("aria-labelledby", "kefe-ms-title");
    drawerEl.setAttribute("tabindex", "-1");

    drawerEl.innerHTML = `
      <header class="kefe-ms-head">
        <div class="kefe-ms-head-copy">
          <span class="kefe-ms-brand">KEFE</span>
          <span class="kefe-ms-head-sub">Editor sidebar</span>
          <h2 id="kefe-ms-title" class="kefe-ms-title"></h2>
        </div>
        <button type="button" class="kefe-ms-close" aria-label="Close editor sidebar" title="Close">
          ${renderKefeIcon("close", "", 18, 2)}
        </button>
      </header>
      <div class="kefe-ms-body">
        <div class="kefe-ms-surface" id="kefe-ms-surface" role="tabpanel">
          <div class="kefe-ms-surface-head">
            <p class="kefe-ms-blurb"></p>
            <div data-slot="tabs" class="kefe-ms-tabs-root">
              <div data-slot="tabs-list" class="kefe-ms-tabs" role="tablist" aria-label="Control groups"></div>
            </div>
          </div>
          <div class="kefe-ms-host"></div>
        </div>
      </div>
    `;

    titleEl = drawerEl.querySelector("#kefe-ms-title");
    blurbEl = drawerEl.querySelector(".kefe-ms-blurb");
    tabsRootEl = drawerEl.querySelector('[data-slot="tabs"]');
    tabsListEl = drawerEl.querySelector('[data-slot="tabs-list"]');
    hostEl = drawerEl.querySelector(".kefe-ms-host");

    tabsListEl?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      if (activeGroups.length < 2) return;
      event.preventDefault();
      const section = SECTION_BY_ID.get(activeSection) || SECTIONS[0];
      const current = groupMemory[section.id] || activeGroups[0]?.id;
      const idx = Math.max(0, activeGroups.findIndex((g) => g.id === current));
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (idx + delta + activeGroups.length) % activeGroups.length;
      const nextGroup = activeGroups[nextIndex];
      if (!nextGroup) return;
      groupMemory[section.id] = nextGroup.id;
      if (borrowed?.panel) {
        applyGroupVisibility(borrowed.panel, section);
      }
      if (hostEl) hostEl.scrollTop = 0;
      tabsListEl?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    });

    drawerEl.querySelector(".kefe-ms-close")?.addEventListener("click", closeSidebar);
    root.appendChild(drawerEl);
  }

  function unmountDrawer() {
    restoreBorrowedPanel();
    drawerEl?.remove();
    drawerEl = null;
    hostEl = null;
    tabsRootEl = null;
    tabsListEl = null;
    titleEl = null;
    blurbEl = null;
  }

  function syncDrawerContent() {
    if (!drawerEl) return;
    const section = SECTION_BY_ID.get(activeSection) || SECTIONS[0];
    if (titleEl) titleEl.textContent = section.label;
    if (blurbEl) blurbEl.textContent = section.blurb;
    drawerEl.querySelector("#kefe-ms-surface")?.setAttribute("aria-label", section.label);
  }

  function placeBottomSheet() {
    const root = document.documentElement;
    const work = document.querySelector(".kefe-work")?.getBoundingClientRect();
    const tl = document.querySelector(".kefe-timeline")?.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const bottom = dockRect.height ? Math.max(0, window.innerHeight - dockRect.top) + 6 : 86;
    /* Reserve a usable panel (300px) and shrink the preview area to fit above it, so the section panel
       can never sit on top of the preview or the timeline bar. */
    const workTop = work ? work.top : 60;
    const workMax = Math.max(150, window.innerHeight - bottom - 300 - workTop - 8);
    const top = Math.max(120, (tl ? tl.bottom : window.innerHeight * 0.5) + 8);
    root.style.setProperty("--kefe-ms-work-max", `${Math.round(workMax)}px`);
    root.style.setProperty("--kefe-ms-top", `${Math.round(top)}px`);
    root.style.setProperty("--kefe-ms-bottom", `${Math.round(bottom)}px`);
  }

  /* The stage refits after the height cap applies; follow it so the panel always starts under the timeline. */
  let placeObserver = null;
  function watchPlacement() {
    if (placeObserver || typeof ResizeObserver === "undefined") return;
    placeObserver = new ResizeObserver(placeBottomSheet);
    document.querySelectorAll(".kefe-work, .kefe-preview, .kefe-timeline").forEach((el) => placeObserver.observe(el));
    placeObserver.observe(dock);
  }

  let viewportOpenFrame = 0;

  function cancelPendingViewportOpen() {
    if (!viewportOpenFrame) return;
    cancelAnimationFrame(viewportOpenFrame);
    viewportOpenFrame = 0;
  }

  function openSectionInSidebar(sectionId, trigger = null) {
    if (!SECTION_BY_ID.has(sectionId)) return;
    cancelPendingViewportOpen();
    if (!isOpen) {
      lastFocusedBeforeOpen = trigger instanceof HTMLElement ? trigger : document.activeElement;
    }
    activeSection = sectionId;
    selectNativeSection(sectionId);
    if (!isMobile) {
      syncDockState();
      return;
    }

    if (!isOpen) {
      window.scrollTo(0, 0);
      placeBottomSheet();
      requestAnimationFrame(placeBottomSheet);
      window.addEventListener("resize", placeBottomSheet);
      watchPlacement();
    }
    isOpen = true;
    document.documentElement.classList.add("kefe-ms-locked", "kefe-ms-sheet-open");
    ensureDrawerMounted();
    syncDrawerContent();
    mountPanelIntoHost();
    syncDockState();
  }

  function closeSidebar() {
    cancelPendingViewportOpen();
    if (!isOpen) return;
    isOpen = false;
    window.removeEventListener("resize", placeBottomSheet);
    placeObserver?.disconnect();
    placeObserver = null;
    document.documentElement.style.removeProperty("--kefe-ms-work-max");
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
    if (!isMobile) {
      cancelPendingViewportOpen();
      if (isOpen) closeSidebar();
      else syncDockState();
    } else if (!wasMobile) {
      syncDockState();
      cancelPendingViewportOpen();
      viewportOpenFrame = requestAnimationFrame(() => {
        viewportOpenFrame = 0;
        if (isMobile && !isOpen) {
          openSectionInSidebar(activeSection || readActiveSection());
        }
      });
    } else {
      syncDockState();
    }
  }

  mediaQuery.addEventListener("change", syncViewportMode);
  if (isMobile) {
    document.documentElement.classList.add("kefe-ms-enabled");
    syncDockState();
    viewportOpenFrame = requestAnimationFrame(() => {
      viewportOpenFrame = 0;
      if (isMobile && !isOpen) {
        openSectionInSidebar(activeSection || readActiveSection());
      }
    });
  } else {
    syncDockState();
  }

  const editing = document.querySelector(".kefe-editing");
  if (editing) {
    const editingObserver = new MutationObserver(() => {
      if (!isMobile) return;
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
    if (!target || !isMobile) return;
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

  window.addEventListener("keydown", (event) => {
    if (!isOpen || event.key !== "Escape") return;
    if (document.querySelector(".beui-settings-root:not([hidden]), #kefeCommandPalette:not([hidden])")) {
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
