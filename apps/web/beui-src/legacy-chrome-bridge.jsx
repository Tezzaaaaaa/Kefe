import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/motion/button";
import "./legacy-bridge.css";

function SidebarToggle({ backing }) {
  const [attrs, setAttrs] = useState({
    label: backing.getAttribute("aria-label") || "Toggle sidebar",
    title: backing.title || "Toggle sidebar",
  });
  useEffect(() => {
    const observer = new MutationObserver(() => setAttrs({
      label: backing.getAttribute("aria-label") || "Toggle sidebar",
      title: backing.title || "Toggle sidebar",
    }));
    observer.observe(backing, { attributes: true, attributeFilter: ["aria-label", "title"] });
    return () => observer.disconnect();
  }, [backing]);
  const icon = backing.querySelector("span")?.innerHTML || "";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="kefe-sidebar-toggle"
      aria-label={attrs.label}
      title={attrs.title}
      onClick={() => backing.click()}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
    </Button>
  );
}

function AccentSwatches({ backingButtons }) {
  const [active, setActive] = useState(
    backingButtons.find((button) => button.getAttribute("aria-pressed") === "true")?.dataset.accent || "#ef4444",
  );
  useEffect(() => {
    const sync = (event) => {
      const button = event.target?.closest?.("[data-accent]");
      if (button) setActive(button.dataset.accent);
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, []);

  return (
    <div className="beui-accent-swatches">
      {backingButtons.map((backing) => {
        const color = backing.dataset.accent;
        const selected = active.toLowerCase() === color.toLowerCase();
        return (
          <Button
            key={color}
            variant="outline"
            size="icon"
            aria-label={backing.getAttribute("aria-label") || "Accent colour"}
            aria-pressed={selected}
            title={backing.title || backing.getAttribute("aria-label") || "Accent colour"}
            className="beui-accent-swatch h-7 w-7 rounded-full border-2 p-0"
            style={{ backgroundColor: color, borderColor: selected ? "var(--shell-text, #fff)" : "transparent" }}
            onClick={() => backing.click()}
          />
        );
      })}
    </div>
  );
}


function DockButton({ backing }) {
  const [attrs, setAttrs] = useState({
    label: backing.getAttribute("aria-label") || "Workspace action",
    title: backing.title || backing.getAttribute("aria-label") || "Workspace action",
    pressed: backing.getAttribute("aria-pressed"),
  });
  useEffect(() => {
    const observer = new MutationObserver(() => setAttrs({
      label: backing.getAttribute("aria-label") || "Workspace action",
      title: backing.title || backing.getAttribute("aria-label") || "Workspace action",
      pressed: backing.getAttribute("aria-pressed"),
    }));
    observer.observe(backing, { attributes: true, attributeFilter: ["aria-label", "title", "aria-pressed"] });
    return () => observer.disconnect();
  }, [backing]);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="beui-dock-button"
      aria-label={attrs.label}
      title={attrs.title}
      aria-pressed={attrs.pressed === null ? undefined : attrs.pressed === "true"}
      onClick={() => backing.click()}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: backing.innerHTML }} />
    </Button>
  );
}

function start() {
  const dock = document.querySelector(".kefe-workspace-dock");
  dock?.querySelectorAll("[data-dock-panel], [data-dock-export], [data-command-open]").forEach((backing) => {
    if (backing.dataset.beuiMounted) return;
    const host = document.createElement("div");
    host.className = "beui-dock-host";
    backing.insertAdjacentElement("beforebegin", host);
    backing.classList.add("beui-native-sidebar-control");
    backing.dataset.beuiMounted = "true";
    createRoot(host).render(<DockButton backing={backing} />);
  });

  const toggle = document.querySelector("[data-sidebar-toggle]");
  if (toggle && !toggle.dataset.beuiMounted) {
    const host = document.createElement("div");
    host.className = "beui-sidebar-toggle-host";
    toggle.insertAdjacentElement("beforebegin", host);
    toggle.classList.add("beui-native-sidebar-control");
    toggle.dataset.beuiMounted = "true";
    createRoot(host).render(<SidebarToggle backing={toggle} />);
  }

  const swatches = document.querySelector(".kefe-theme-swatches");
  if (swatches && !swatches.dataset.beuiMounted) {
    const backingButtons = [...swatches.querySelectorAll("[data-accent]")];
    if (backingButtons.length) {
      backingButtons.forEach((button) => button.classList.add("beui-native-sidebar-control"));
      const host = document.createElement("div");
      host.className = "beui-accent-host";
      swatches.appendChild(host);
      swatches.dataset.beuiMounted = "true";
      createRoot(host).render(<AccentSwatches backingButtons={backingButtons} />);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
