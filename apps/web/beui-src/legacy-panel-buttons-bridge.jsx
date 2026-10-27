import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/motion/button";
import "./legacy-bridge.css";

const SKIP_ANCESTORS = [
  '[role="dialog"]',
  ".kefe-command-overlay",
  "#beui-settings-root",
  ".beui-button-host",
  ".beui-panel-button-host",
  ".kefe-section-info",
  ".beui-command-button-host",
  ".beui-upload-card-root",
  ".kefe-vis-tabs",
  ".kefe-visualiser-power-slot",
  ".beui-vis-tabs-host",
  ".beui-tabs-host",
  ".beui-transport-host",
  ".beui-dock-host",
  ".beui-accent-host",
  ".beui-sidebar-nav-host",
  ".beui-sidebar-toggle-host",
  ".beui-tabs-host",
  ".beui-select-host",
  ".beui-range-host",
  ".beui-settings-root",
].join(",");

function readStyle(backing) {
  const style = {};
  for (const property of backing.style) {
    const key = property.startsWith("--")
      ? property
      : property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    style[key] = backing.style.getPropertyValue(property);
  }
  return style;
}

function readButton(backing) {
  const aria = {};
  for (const attribute of backing.attributes) {
    if (attribute.name.startsWith("aria-") && attribute.name !== "aria-hidden") {
      aria[attribute.name] = attribute.value;
    }
  }
  return {
    aria,
    className: [...backing.classList].filter((name) => name !== "beui-native-panel-button").join(" "),
    content: backing.innerHTML,
    disabled: backing.disabled,
    hidden: backing.hidden,
    role: backing.getAttribute("role") || undefined,
    tabIndex: backing.hasAttribute("tabindex") ? backing.tabIndex : undefined,
    title: backing.title || undefined,
    style: readStyle(backing),
  };
}

function PanelButton({ backing }) {
  const [attrs, setAttrs] = useState(() => readButton(backing));
  useEffect(() => {
    const observer = new MutationObserver(() => setAttrs(readButton(backing)));
    observer.observe(backing, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [backing]);

  useEffect(() => {
    const host = backing.previousElementSibling;
    if (host?.classList.contains("beui-panel-button-host")) host.hidden = attrs.hidden;
  }, [attrs.hidden, backing]);

  return (
    <Button
      variant="ghost"
      className={`${attrs.className} beui-panel-action`}
      title={attrs.title}
      role={attrs.role}
      tabIndex={attrs.tabIndex}
      disabled={attrs.disabled}
      style={attrs.style}
      {...attrs.aria}
      onClick={(event) => {
        event.stopPropagation();
        backing.click();
      }}
    >
      <span dangerouslySetInnerHTML={{ __html: attrs.content }} />
    </Button>
  );
}

function canBridge(button) {
  return button instanceof HTMLButtonElement
    && button.closest(".kefe-panel")
    && !button.hidden
    && !button.classList.contains("beui-native-panel-button")
    && !button.classList.contains("beui-native-sidebar-control")
    && !button.classList.contains("beui-native-transport")
    && !button.classList.contains("beui-native-tab")
    && !button.classList.contains("kefe-background-effect-card")
    && !button.classList.contains("kefe-lyric-effect-option")
    && !button.classList.contains("kefe-lyric-effect-carousel-nav")
    && !button.closest(SKIP_ANCESTORS);
}

function mount(button) {
  if (!canBridge(button) || button.dataset.beuiPanelMounted) return;
  const host = document.createElement("div");
  host.className = "beui-panel-button-host";
  button.insertAdjacentElement("beforebegin", host);
  button.classList.add("beui-native-panel-button");
  button.dataset.beuiPanelMounted = "true";
  createRoot(host).render(<PanelButton backing={button} />);
}

function scan(root = document) {
  if (root instanceof HTMLButtonElement) mount(root);
  root.querySelectorAll?.(".kefe-panel button").forEach(mount);
}

function start() {
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLButtonElement) {
        if (record.target.dataset.beuiPanelMounted) {
          const host = record.target.previousElementSibling;
          if (host?.classList.contains("beui-panel-button-host")) host.hidden = record.target.hidden;
        } else if (!record.target.hidden) {
          mount(record.target);
        }
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          scan(node);
        }
      });
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"],
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
