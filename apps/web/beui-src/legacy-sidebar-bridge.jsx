import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/motion/button";
import "./legacy-bridge.css";

function SidebarItems({ items, trackActive = true }) {
  const [activePanel, setActivePanel] = useState(
    document.querySelector(".kefe-section.active")?.dataset.panel || "media",
  );

  useEffect(() => {
    if (!trackActive) return;
    const sync = (event) => {
      const button = event.target?.closest?.(".kefe-section[data-panel]");
      if (button) setActivePanel(button.dataset.panel);
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, [trackActive]);

  return (
    <div className="beui-sidebar-nav">
      {items.map((item) => {
        const active = trackActive && item.panel === activePanel;
        const icon = item.backing.querySelector("span")?.innerHTML || "";
        return (
          <Button
            key={item.key}
            variant={active ? "secondary" : "ghost"}
            size="md"
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`kefe-sidebar-link justify-start gap-2 rounded-xl px-2 text-left text-xs ${active ? "is-current" : ""}`}
            onClick={() => item.backing.click()}
          >
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
            <span className="kefe-sidebar-link-label">{item.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function hostAfterLabel(group, selectors, items) {
  if (!group) return;
  const label = group.querySelector(".kefe-sidebar-label");
  if (!label) return;
  const controls = selectors.map((selector) => group.querySelector(selector)).filter(Boolean);
  if (!controls.length) return;
  const host = document.createElement("div");
  host.className = "beui-sidebar-nav-host";
  label.insertAdjacentElement("afterend", host);
  controls.forEach((control) => control.classList.add("beui-native-sidebar-control"));
  const resolved = items.map((item) => ({
    ...item,
    backing: controls.find((control) => item.selector && control.matches(item.selector)),
  })).filter((item) => item.backing);
  createRoot(host).render(<SidebarItems items={resolved} />);
}

function start() {
  const groups = [...document.querySelectorAll(".kefe-sidebar-group")];
  const first = groups[0];
  const create = groups[1];
  hostAfterLabel(first, [
    'a.kefe-sidebar-link[href="./editor.html"]',
    'button[data-shell-panel="media"]',
  ], [
    { key: "editor", label: "Editor", selector: 'a.kefe-sidebar-link[href="./editor.html"]' },
    { key: "media", label: "Media", selector: 'button[data-shell-panel="media"]', panel: "media" },
  ]);
  hostAfterLabel(create, [
    'button[data-shell-panel="lyrics"]',
    'button[data-shell-panel="effects"]',
    'button[data-shell-panel="background-effects"]',
    'button[data-shell-panel="visualiser"]',
    'button[data-shell-panel="export"]',
  ], [
    { key: "lyrics", label: "Lyrics", selector: 'button[data-shell-panel="lyrics"]', panel: "lyrics" },
    { key: "effects", label: "Effects", selector: 'button[data-shell-panel="effects"]', panel: "effects" },
    { key: "background-effects", label: "Background Effects", selector: 'button[data-shell-panel="background-effects"]', panel: "background-effects" },
    { key: "visualiser", label: "Visualisers", selector: 'button[data-shell-panel="visualiser"]', panel: "visualiser" },
    { key: "export", label: "Export", selector: 'button[data-shell-panel="export"]', panel: "export" },
  ]);

  const bottom = document.querySelector(".kefe-sidebar-bottom");
  const settings = bottom?.querySelector('[data-top-panel="settings"]');
  if (bottom && settings && !bottom.querySelector(".beui-sidebar-settings-host")) {
    const host = document.createElement("div");
    host.className = "beui-sidebar-nav-host beui-sidebar-settings-host";
    settings.insertAdjacentElement("beforebegin", host);
    settings.classList.add("beui-native-sidebar-control");
    createRoot(host).render(
      <SidebarItems
        trackActive={false}
        items={[{ key: "settings", label: "Settings", backing: settings }]}
      />,
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
