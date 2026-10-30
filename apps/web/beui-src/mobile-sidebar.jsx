/* KEFE mobile editor sidebar.
   ────────────────────────────────────────────────────────────────
   Phones and small tablets used to receive the six editor sections as one long
   stacked accordion underneath the preview, so every edit started with a scroll.
   This module replaces that surface below 1024px with a shadcn-style sidebar:

     • a bottom section dock (one tap to any section, no page scrolling)
     • a sliding sidebar with an icon rail (tabs), a section header and a
       live control surface that hosts the real KEFE panel for that section
     • grouped control tabs inside each section (source / details / timing …)
     • collapsible control groups inside those tabs (group accordion)
     • an expanding Tools menu for editor-wide actions

   The panels are never re-implemented: the existing native panel element is
   moved into the drawer while it is open and returned to its settings slot on
   close, so every native handler, preset and slider keeps working. All range
   inputs stay on the beUI RangeSlider bridge that `legacy-range-bridge.jsx`
   mounts for every `input[type="range"]` in the document.
   ──────────────────────────────────────────────────────────────── */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  ListMusic,
  Maximize,
  MoreHorizontal,
  Moon,
  Music2,
  Palette,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  Upload,
  Video,
  X,
} from "lucide-react";

import {
  MIGRATED_SLOTS,
  SECTION_BY_ID,
  SECTIONS,
  resolveGroups,
} from "./mobile-sidebar-sections.js";

import "./mobile-sidebar.css";

const MOBILE_QUERY = "(max-width: 1023px)";
const SECTION_KEY = "kefe.mobileSidebar.section";

/* Icon keys from the section map resolve to lucide icons here. */
const ICONS = {
  activity: Activity,
  clock: Clock,
  download: Download,
  file: FileText,
  folder: FolderOpen,
  image: ImageIcon,
  list: ListMusic,
  moon: Moon,
  music: Music2,
  palette: Palette,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  type: Type,
  upload: Upload,
  video: Video,
};

const iconFor = (key) => ICONS[key] || SlidersHorizontal;

function clearGroupMarkers(panel) {
  if (!panel) return;
  panel.querySelectorAll("[data-kefe-ms-group]").forEach((element) => {
    element.removeAttribute("data-kefe-ms-group");
    element.classList.remove("kefe-ms-group-off");
  });
}

/** The visualiser tabs are hidden by the desktop shell until its section opens. */
function ensureVisualiserControls(panel) {
  if (!panel || panel.dataset.panelView !== "visualiser") return;
  panel.querySelectorAll(".kefe-vis-tabs, .kefe-visualiser-preset-row").forEach((element) => {
    element.hidden = false;
  });
}

function useMobileLayout() {
  const [enabled, setEnabled] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
  );
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return enabled;
}

/* ── Small building blocks ───────────────────────────────────── */

function SectionRail({ activeId, onSelect }) {
  const move = (event) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const ids = SECTIONS.map((entry) => entry.id);
    const index = ids.indexOf(activeId);
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % ids.length;
    if (event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = ids.length - 1;
    onSelect(ids[next]);
    requestAnimationFrame(() => {
      event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
    });
  };
  return (
    <nav className="kefe-ms-rail" aria-label="Editor sections">
      <div className="kefe-ms-rail-group" role="tablist" aria-orientation="vertical" onKeyDown={move}>
        {SECTIONS.map((section) => {
          const Icon = iconFor(section.icon);
          const active = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="kefe-ms-surface"
              tabIndex={active ? 0 : -1}
              className={`kefe-ms-rail-item${active ? " is-active" : ""}`}
              onClick={() => onSelect(section.id)}
              title={section.label}
            >
              <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              <span className="kefe-ms-rail-label">{section.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function GroupTabs({ groups, activeId, onSelect }) {
  if (groups.length < 2) return null;
  const move = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = groups.findIndex((group) => group.id === activeId);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + delta + groups.length) % groups.length;
    onSelect(groups[next].id);
    requestAnimationFrame(() => {
      event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
    });
  };
  return (
    <div className="kefe-ms-tabs" role="tablist" aria-label="Control groups" onKeyDown={move}>
      {groups.map((group) => {
        const Icon = iconFor(group.icon);
        const active = group.id === activeId;
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`kefe-ms-tab${active ? " is-active" : ""}`}
            onClick={() => onSelect(group.id)}
          >
            {Icon ? <Icon size={14} strokeWidth={1.8} aria-hidden="true" /> : null}
            <span>{group.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToolMenu({ onClose, onReset }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [open]);

  const tools = [
    {
      id: "theme",
      label: "Switch day / night",
      icon: Sun,
      run: () => {
        const shellToggle = document.getElementById("kefeThemeToggle");
        if (shellToggle) {
          shellToggle.click();
          return;
        }
        const root = document.documentElement;
        const next = root.dataset.theme === "night" ? "day" : "night";
        root.dataset.theme = next;
        try {
          localStorage.setItem("kefe.theme", next);
        } catch (_) {}
      },
    },
    {
      id: "search",
      label: "Search KEFE",
      icon: Search,
      run: () => document.querySelector("[data-command-open]")?.click(),
    },
    {
      id: "fullscreen",
      label: "Fullscreen preview",
      icon: Maximize,
      run: () => document.getElementById("previewFullscreen")?.click(),
    },
    {
      id: "reset",
      label: "Reset all settings",
      icon: RotateCcw,
      run: onReset,
    },
    {
      id: "desktop",
      label: "Close editor sidebar",
      icon: X,
      run: onClose,
    },
  ];

  return (
    <div className="kefe-ms-tools-wrap" ref={wrap}>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="kefe-ms-tools"
            role="menu"
            aria-label="Editor tools"
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
          >
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  role="menuitem"
                  className="kefe-ms-tool"
                  onClick={() => {
                    setOpen(false);
                    tool.run();
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        className="kefe-ms-foot-button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Tools</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={open ? "is-flipped" : undefined} />
      </button>
    </div>
  );
}

function SectionDock({ activeId, onSelect }) {
  return (
    <nav className="kefe-ms-dock" aria-label="Edit sections">
      <span className="kefe-ms-dock-grip" aria-hidden="true" />
      <div className="kefe-ms-dock-row">
        {SECTIONS.map((section) => {
          const Icon = iconFor(section.icon);
          const active = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              className={`kefe-ms-dock-item${active ? " is-active" : ""}`}
              aria-label={`Edit ${section.label}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(section.id)}
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{section.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ── The sidebar ─────────────────────────────────────────────── */

function MobileSidebar() {
  const enabled = useMobileLayout();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(readStoredSection);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState("");
  const [status, setStatus] = useState("");

  const drawerRef = useRef(null);
  const hostRef = useRef(null);

  const section = SECTION_BY_ID.get(activeId) || SECTIONS[0];

  const openSection = useCallback((id) => {
    const next = SECTION_BY_ID.has(id) ? id : "media";
    setActiveId(next);
    setOpen(true);
    try {
      localStorage.setItem(SECTION_KEY, next);
    } catch (_) {}
    /* Mirror the selection the native shell would have made, so the workspace
       navigation, the command palette and the settings adapter stay in sync. */
    document.querySelectorAll("[data-shell-panel]").forEach((button) => {
      button.classList.toggle("is-current", button.dataset.shellPanel === next);
    });
    document.querySelectorAll(".kefe-section[data-panel]").forEach((button) => {
      button.classList.toggle("active", button.dataset.panel === next);
    });
    document.querySelectorAll("[data-dock-panel]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.dockPanel === next));
    });
    const editing = document.querySelector(".kefe-editing");
    editing?.setAttribute("data-active-panel", next);
    editing?.setAttribute("data-selected-section", next);
    const settingsSection = document.querySelector(
      `#kefe-settings-panel .section[data-section-id="${MIGRATED_SLOTS[next]}"]`,
    );
    if (settingsSection) {
      settingsSection.dataset.expanded = "true";
      settingsSection.querySelector(".expand-button")?.setAttribute("aria-expanded", "true");
    }
  }, []);

  const close = useCallback(() => setOpen(false), []);

  /* Header navigation, the command palette and any dock button all route here
     on small screens instead of scrolling to the (now hidden) legacy stack. */
  useEffect(() => {
    if (!enabled) return;
    const intercept = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const shell = target.closest("[data-shell-panel], [data-dock-panel], [data-dock-export], .kefe-section[data-panel]");
      if (!shell) return;
      const id = shell.dataset.shellPanel
        || shell.dataset.dockPanel
        || (shell.dataset.dockExport !== undefined ? "export" : null)
        || shell.dataset.panel;
      if (!id || !SECTION_BY_ID.has(id)) return;
      event.preventDefault();
      event.stopPropagation();
      openSection(id);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [enabled, openSection]);

  useEffect(() => {
    document.documentElement.classList.toggle("kefe-ms-enabled", enabled);
    if (!enabled) setOpen(false);
    return () => document.documentElement.classList.remove("kefe-ms-enabled");
  }, [enabled]);

  /* Move the live panel into the drawer while open; put it back on close or on
     a section change so the desktop shell and the settings adapter keep their
     original DOM contract. Layout effects keep this ahead of the group pass. */
  useLayoutEffect(() => {
    if (!open) {
      setGroups([]);
      return undefined;
    }
    const panel = document.querySelector(`.kefe-panel[data-panel-view="${activeId}"]`);
    const host = hostRef.current;
    if (!panel || !host) return undefined;

    const parent = panel.parentNode;
    const nextSibling = panel.nextSibling;
    panel.classList.add("kefe-ms-live-panel");
    host.appendChild(panel);
    ensureVisualiserControls(panel);

    return () => {
      panel.classList.remove("kefe-ms-live-panel");
      clearGroupMarkers(panel);
      if (parent && parent.isConnected) {
        parent.insertBefore(panel, nextSibling && nextSibling.parentNode === parent ? nextSibling : null);
      } else {
        panel.remove();
      }
    };
  }, [open, activeId]);

  /* Assign control groups + marker attributes for the mounted panel. */
  const refreshGroups = useCallback((reset = false) => {
    const host = hostRef.current;
    const panel = host?.querySelector(".kefe-panel[data-panel-view]");
    if (!panel) {
      setGroups([]);
      return;
    }
    const liveSection = SECTION_BY_ID.get(panel.dataset.panelView) || section;
    const resolved = resolveGroups(panel, liveSection);
    const current = reset ? "" : host.getAttribute("data-kefe-ms-active-group") || "";
    const nextActive = resolved.some((group) => group.id === current) ? current : resolved[0]?.id || "";
    clearGroupMarkers(panel);
    resolved.forEach((group) => {
      group.elements.forEach((element) => {
        element.setAttribute("data-kefe-ms-group", group.id);
        element.classList.toggle("kefe-ms-group-off", group.id !== nextActive);
      });
    });
    setGroups(resolved.map(({ id, label, icon, count }) => ({ id, label, icon, count })));
    setActiveGroup(nextActive);
  }, [section]);

  useLayoutEffect(() => {
    if (!open) return;
    setActiveGroup("");
    refreshGroups(true);
  }, [open, activeId, refreshGroups]);

  /* Panels grow as lyrics load, effects render and visualisers mount; regroup
     after those mutations so new controls land in the right tab. */
  useEffect(() => {
    if (!open) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => refreshGroups(), 220);
    });
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [open, activeId, refreshGroups]);

  /* Only the selected control group is shown; everything else stays mounted
     (so its native handlers and slider bridges survive) but out of the flow. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll("[data-kefe-ms-group]").forEach((element) => {
      element.classList.toggle(
        "kefe-ms-group-off",
        Boolean(activeGroup) && element.getAttribute("data-kefe-ms-group") !== activeGroup,
      );
    });
  }, [activeGroup, groups, open]);

  /* Group accordion + keyboard support for the collapsible control groups. */
  useEffect(() => {
    if (!open) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;

    const labelFor = (target) => (target instanceof Element
      ? target.closest(".kefe-visualiser-control-group > div.kefe-label")
      : null);

    const prepare = () => {
      host.querySelectorAll(".kefe-visualiser-control-group > div.kefe-label").forEach((label) => {
        if (label.dataset.kefeMsToggle === "true") return;
        label.dataset.kefeMsToggle = "true";
        label.setAttribute("role", "button");
        label.setAttribute("tabindex", "0");
        const group = label.parentElement;
        label.setAttribute("aria-expanded", String(!group.classList.contains("is-collapsed")));
      });
    };
    prepare();

    const toggle = (label) => {
      const group = label.parentElement;
      const collapsed = group.classList.toggle("is-collapsed");
      group.setAttribute("data-kefe-ms-collapsed", String(collapsed));
      label.setAttribute("aria-expanded", String(!collapsed));
    };

    const onClick = (event) => {
      const label = labelFor(event.target);
      if (!label || !host.contains(label)) return;
      toggle(label);
    };

    const onKeyDown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const label = labelFor(event.target);
      if (!label || !host.contains(label)) return;
      event.preventDefault();
      toggle(label);
    };

    const observer = new MutationObserver(prepare);
    observer.observe(host, { childList: true, subtree: true });
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKeyDown);
    };
  }, [open, activeId]);

  /* Dialog behaviour: focus, Escape, tab trap and scroll lock. */
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = drawerRef.current;
    const scrollY = window.scrollY;
    document.documentElement.classList.add("kefe-ms-locked");
    const frame = requestAnimationFrame(() => node?.focus({ preventScroll: true }));

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.documentElement.classList.remove("kefe-ms-locked");
      window.scrollTo(0, scrollY);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  const resetSettings = useCallback(() => {
    const reset = document.querySelector("#kefe-settings-panel #kefe-reset");
    if (!reset) return;
    if (!window.confirm("Reset every KEFE setting to its default?")) return;
    reset.click();
    setStatus("All settings reset to defaults");
    window.setTimeout(() => setStatus(""), 2400);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {!open ? (
        <SectionDock activeId={activeId} onSelect={openSection} />
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className="kefe-ms-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={close}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
              key="drawer"
              ref={drawerRef}
              className="kefe-ms-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kefe-ms-title"
              tabIndex={-1}
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            >
              <header className="kefe-ms-head">
                <div className="kefe-ms-head-copy">
                  <span className="kefe-ms-brand">KEFE</span>
                  <span className="kefe-ms-head-sub">Editor sidebar</span>
                  <h2 id="kefe-ms-title" className="kefe-ms-title">{section.label}</h2>
                </div>
                <button type="button" className="kefe-ms-close" onClick={close} aria-label="Close editor sidebar" title="Close">
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </header>

              <div className="kefe-ms-body">
                <SectionRail activeId={activeId} onSelect={openSection} />

                <div className="kefe-ms-surface" id="kefe-ms-surface" role="tabpanel" aria-label={section.label}>
                  <div className="kefe-ms-surface-head">
                    <p className="kefe-ms-blurb">{section.blurb}</p>
                    <GroupTabs
                      groups={groups}
                      activeId={activeGroup}
                      onSelect={setActiveGroup}
                    />
                  </div>
                  <div
                    ref={hostRef}
                    className="kefe-ms-host"
                    data-kefe-ms-active-group={activeGroup}
                    data-kefe-ms-section={activeId}
                  />
                </div>
              </div>

              <footer className="kefe-ms-foot">
                <span className="kefe-ms-status" role="status" aria-live="polite">{status}</span>
                <ToolMenu onClose={close} onReset={resetSettings} />
                <button type="button" className="kefe-ms-done" onClick={close}>
                  <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                  <span>Done</span>
                </button>
              </footer>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ── Mount ───────────────────────────────────────────────────────
   Wait for the settings adapter to place the six native panels in their
   slots, so the drawer can host the real panels rather than a copy. */
function panelsReady() {
  const views = SECTIONS.map((section) => section.id);
  return views.every((view) => document.querySelector(`.kefe-panel[data-panel-view="${view}"]`));
}

function slotsReady() {
  return Boolean(
    document.getElementById("kefe-settings-panel") &&
    document.querySelectorAll(".kefe-slot[data-kefe-slot] .kefe-panel[data-panel-view]").length >= 6,
  );
}

function mount() {
  if (document.getElementById("kefe-mobile-sidebar-root")) return;
  const host = document.createElement("div");
  host.id = "kefe-mobile-sidebar-root";
  // Stay inside `.kefe-editor` so the editor's own panel styles keep applying
  // to the live panel while it is hosted by the drawer.
  const shell = document.querySelector(".kefe-editor") || document.body;
  shell.appendChild(host);
  createRoot(host).render(<MobileSidebar />);
}

function start() {
  const deadline = Date.now() + 5000;
  const mobile = window.matchMedia(MOBILE_QUERY);
  /* Retire the stacked mobile editing surface immediately so it is never
     painted before the sidebar takes over. Restored below if mounting fails. */
  if (mobile.matches) document.documentElement.classList.add("kefe-ms-enabled");

  const tick = () => {
    if (slotsReady() || (panelsReady() && Date.now() > deadline)) {
      mount();
      return;
    }
    if (Date.now() > deadline) {
      if (panelsReady()) {
        mount();
      } else {
        /* No panels to host: fall back to the native stacked editor. */
        document.documentElement.classList.remove("kefe-ms-enabled");
      }
      return;
    }
    window.setTimeout(tick, 160);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick, { once: true });
  } else {
    tick();
  }
}

start();
