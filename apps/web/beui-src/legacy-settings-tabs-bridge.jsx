import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  FolderOpen,
  Image as ImageIcon,
  ListMusic,
  Sparkles,
  Upload,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./legacy-bridge.css";

/**
 * Compact, grouped settings switcher.
 *
 * The integrated editor keeps the settings sections in two side columns. Each
 * column now carries a shadcn/Radix Tabs row that groups its three sections
 * behind one-line, icon-labelled tabs. Selecting a tab opens the matching
 * section in place (the preview never unmounts and the URL never changes); the
 * active tab also follows the section cards when they are expanded by hand.
 *
 * The native `.kefe-section[data-panel]` buttons stay in the DOM, hidden, and
 * are the single source of truth for section selection, so the existing
 * settings adapter keeps ownership of expansion, selected-section state and
 * visualiser syncing.
 */

const GROUP_META = {
  input: { label: "Source", caption: "Media and lyrics sections" },
  output: { label: "Style & export", caption: "Look, visualiser and export sections" },
};

const SECTION_META = {
  media: { nav: "media", label: "Media", icon: FolderOpen },
  "lyric-sync": { nav: "lyrics", label: "Lyrics", icon: ListMusic },
  "lyric-effects": { nav: "effects", label: "Effects", icon: Sparkles },
  background: { nav: "background-effects", label: "Background", icon: ImageIcon },
  visualisers: { nav: "visualiser", label: "Visuals", icon: Activity },
  export: { nav: "export", label: "Export", icon: Upload },
};

const NAV_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_META).map(([sectionId, meta]) => [meta.nav, sectionId]),
);

function activeSectionId(group) {
  const expanded = group.querySelector('.section[data-expanded="true"][data-section-id]');
  if (expanded && SECTION_META[expanded.dataset.sectionId]) return expanded.dataset.sectionId;
  const selected = document.querySelector(".kefe-editing")?.dataset.selectedSection || "";
  if (NAV_TO_SECTION[selected]) return NAV_TO_SECTION[selected];
  return [...group.querySelectorAll(".section[data-section-id]")]
    .map((section) => section.dataset.sectionId)
    .find((sectionId) => SECTION_META[sectionId]) || "";
}

function openSection(sectionId) {
  const nav = SECTION_META[sectionId]?.nav;
  if (!nav) return;
  const backing = document.querySelector(`.kefe-section[data-panel="${nav}"]`);
  if (backing) {
    backing.click();
    return;
  }
  // Fallback for hosts without the hidden legacy tab row: expand the card and
  // mirror the adapter's selected-section contract.
  const section = document.querySelector(`#kefe-settings-panel .section[data-section-id="${sectionId}"]`);
  const trigger = section?.querySelector(".expand-button");
  if (!section || !trigger) return;
  if (section.dataset.expanded !== "true") trigger.click();
  const editing = document.querySelector(".kefe-editing");
  if (editing) {
    editing.setAttribute("data-active-panel", nav);
    editing.setAttribute("data-selected-section", nav);
  }
}

function SettingsSectionTabs({ group, sectionIds }) {
  const [value, setValue] = useState(() => {
    const initial = activeSectionId(group);
    return SECTION_META[initial]?.nav || SECTION_META[sectionIds[0]].nav;
  });
  const tabs = useMemo(
    () => sectionIds.map((sectionId) => ({ sectionId, ...SECTION_META[sectionId] })).filter((tab) => tab.nav),
    [sectionIds],
  );
  const meta = GROUP_META[group.dataset.group] || GROUP_META.input;
  const [modified, setModified] = useState(() => new Set(
    [...group.querySelectorAll(':scope > .section[data-modified="true"][data-section-id]')]
      .map((section) => section.dataset.sectionId),
  ));

  useEffect(() => {
    const refresh = () => setModified(new Set(
      [...group.querySelectorAll(':scope > .section[data-modified="true"][data-section-id]')]
        .map((section) => section.dataset.sectionId),
    ));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(group, { subtree: true, attributes: true, attributeFilter: ["data-modified"] });
    return () => observer.disconnect();
  }, [group]);

  useEffect(() => {
    const editing = document.querySelector(".kefe-editing");
    if (!editing) return undefined;
    const sync = () => {
      const selected = editing.dataset.selectedSection || "";
      if (tabs.some((tab) => tab.nav === selected)) setValue(selected);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(editing, { attributes: true, attributeFilter: ["data-selected-section"] });
    return () => observer.disconnect();
  }, [tabs]);

  // Keep the selection honest when a section card is opened from elsewhere in
  // the shell (dock, command palette, mobile sidebar) without a tab click.
  useEffect(() => {
    const onDocumentClick = (event) => {
      const trigger = event.target instanceof Element
        ? event.target.closest('.section[data-section-id] .expand-button')
        : null;
      const section = trigger?.closest(".section[data-section-id]");
      if (!section || !group.contains(section)) return;
      if (section.dataset.expanded === "true" && SECTION_META[section.dataset.sectionId]) {
        setValue(SECTION_META[section.dataset.sectionId].nav);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [group]);

  const select = (next) => {
    const tab = tabs.find((item) => item.nav === next);
    if (!tab) return;
    setValue(next);
    // Radix activates on both mousedown and focus; only forward the first call
    // unless the section was collapsed while its tab stayed selected.
    const editing = document.querySelector(".kefe-editing");
    const section = document.querySelector(`#kefe-settings-panel .section[data-section-id="${tab.sectionId}"]`);
    const alreadyOpen = editing?.dataset.selectedSection === next && section?.dataset.expanded === "true";
    if (!alreadyOpen) openSection(tab.sectionId);
  };

  return (
    <div className="kefe-section-tabs-host" data-settings-tabs={group.dataset.group}>
      <Tabs value={value} onValueChange={select} className="kefe-section-tabs">
        <TabsList
          aria-label={`${meta.label} settings sections`}
          title={meta.caption}
          className="kefe-section-tabs-list"
        >
          {tabs.map(({ sectionId, nav, label, icon: Icon }) => (
            <TabsTrigger
              key={nav}
              value={nav}
              className="kefe-section-tabs-trigger"
              title={`${label} settings${modified.has(sectionId) ? " · modified" : ""}`}
              aria-controls={`settings-panel-${sectionId}`}
            >
              <Icon aria-hidden="true" />
              <span className="kefe-section-tabs-label">{label}</span>
              {modified.has(sectionId) ? <span className="kefe-section-tabs-dot" aria-hidden="true" /> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

function mountGroup(group) {
  if (group.dataset.settingsTabsReady === "true") return;
  const sectionIds = [...group.querySelectorAll(":scope > .section[data-section-id]")]
    .map((section) => section.dataset.sectionId)
    .filter((sectionId) => SECTION_META[sectionId]);
  if (sectionIds.length < 2) return;

  group.dataset.settingsTabsReady = "true";
  const host = document.createElement("div");
  host.className = "kefe-section-tabs-mount";
  const label = group.querySelector(":scope > .kefe-panel-label");
  if (label) label.insertAdjacentElement("afterend", host);
  else group.prepend(host);
  createRoot(host).render(<SettingsSectionTabs group={group} sectionIds={sectionIds} />);
}

function mountAll() {
  const root = document.querySelector("#kefe-settings-panel");
  if (!root) return false;
  root.querySelectorAll(":scope .kefe-panel[data-group]").forEach(mountGroup);
  return true;
}

function start() {
  if (mountAll()) return;
  let attempts = 0;
  const retry = () => {
    attempts += 1;
    if (mountAll() || attempts > 40) return;
    window.setTimeout(retry, 100);
  };
  window.setTimeout(retry, 50);
}

if (document.readyState === "complete") {
  start();
} else {
  window.addEventListener("load", start, { once: true });
}

// The settings panel is mounted asynchronously by the adapter; watch for it
// until every group carries its switcher, then stop observing page mutations.
let pendingFrame = 0;
const observer = new MutationObserver(() => {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = 0;
    mountAll();
    const groups = [...document.querySelectorAll("#kefe-settings-panel .kefe-panel[data-group]")];
    if (groups.length && groups.every((group) => group.dataset.settingsTabsReady === "true")) {
      observer.disconnect();
    }
  });
});
observer.observe(document.documentElement, { childList: true, subtree: true });
