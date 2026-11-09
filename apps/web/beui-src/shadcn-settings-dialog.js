/* Settings UI built with shadcn/ui components; window.kefeSettings remains the store. */
import "./legacy-bridge.css";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { renderKefeIcon } from "../app/ui/icons.js";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion.js";
import { Button } from "../components/ui/button.js";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select.js";
import { Slider } from "../components/ui/slider.js";
import { Switch } from "../components/ui/switch.js";

const h = React.createElement;
const GROUP_ICONS = { "title-card": "disc", lyrics: "list-music", engine: "gauge", defaults: "sliders", playback: "play", visuals: "sparkles", export: "download" };
const slugify = value => String(value || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function icon(name, className) {
  return h("span", { className, "aria-hidden": true, dangerouslySetInnerHTML: { __html: renderKefeIcon(name, "", 15, 1.9) } });
}
function formatValue(item, value) {
  if (typeof item.fmt === "function") return item.fmt(Number(value));
  if (item.key === "fftPower") return String(Math.pow(2, Number(value) || 11));
  if (typeof item.format === "function") return item.format(value);
  return `${value}${item.unit || ""}`;
}
function normalizeOptions(options) {
  return (options || []).map(opt => Array.isArray(opt)
    ? { value: String(opt[0]), label: String(opt[1] ?? opt[0]) }
    : opt && typeof opt === "object"
      ? { value: String(opt.value), label: String(opt.label ?? opt.value) }
      : { value: String(opt), label: String(opt) });
}

function SettingsRow({ item, api, container }) {
  const value = api.get(item.key);
  const hint = item.hint || item.description;
  const copy = h("div", { className: "shad-setting-copy" },
    h("div", { className: "shad-setting-label" }, item.label),
    hint && h("div", { className: "shad-setting-hint" }, hint));
  let control;
  if (item.type === "range") {
    control = h(React.Fragment, null,
      h("div", { className: "shad-setting-slider-top" }, copy,
        h("output", { className: "shad-setting-value" }, formatValue(item, value))),
      h(Slider, { min: item.min, max: item.max, step: item.step, value: Number(value), label: item.label,
        onValueChange: ([next]) => api.set(item.key, next) }));
  } else if (item.type === "toggle" || item.type === "boolean") {
    control = h(React.Fragment, null, copy, h(Switch, { checked: Boolean(value), "aria-label": item.label,
      onCheckedChange: next => api.set(item.key, next) }));
  } else if (item.type === "select") {
    const options = normalizeOptions(item.options);
    control = h(React.Fragment, null, copy, h("div", { className: "shad-select-wrap" },
      h(Select, { value: String(value ?? ""), onValueChange: next => api.set(item.key, next) },
        h(SelectTrigger, { "aria-label": item.label }, h(SelectValue)),
        h(SelectContent, { container }, options.map(option => h(SelectItem, { key: option.value, value: option.value }, option.label))))));
  }
  return h("div", { className: `shad-setting-row shad-setting-row--${item.type}${item.type === "range" ? " shad-setting-row--slider" : ""}` }, control);
}

function SettingsDialog({ api, host }) {
  const [open, setOpen] = React.useState(false);
  const [container, setContainer] = React.useState(null);
  const [, rerender] = React.useReducer(n => n + 1, 0);
  const previousFocus = React.useRef(null);
  const groups = api.schema().map((group, index) => {
    const title = group.title || group.group || group.label || `Group ${index + 1}`;
    return { id: group.id || slugify(title), title, items: group.items || [] };
  });
  React.useEffect(() => {
    // The legacy settings API has no unsubscribe; this app mounts only once.
    api.onChange?.(() => rerender());
    const onClick = event => {
      const target = event.target instanceof Element ? event.target.closest('[data-top-panel="settings"]') : null;
      if (!target) return;
      event.preventDefault();
      previousFocus.current = document.activeElement;
      host.hidden = false;
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [api, host]);
  React.useLayoutEffect(() => {
    host.hidden = !open;
    host.dataset.state = open ? "open" : "closed";
    document.documentElement.classList.toggle("shad-dialog-open", open);
    return () => document.documentElement.classList.remove("shad-dialog-open");
  }, [host, open]);
  return h(Dialog, { open, onOpenChange: setOpen }, h(DialogContent, {
    container: host, ref: setContainer,
    onCloseAutoFocus: event => {
      if (previousFocus.current?.isConnected) {
        event.preventDefault();
        previousFocus.current.focus({ preventScroll: true });
      }
    },
  },
    h("div", { className: "shad-dialog-header" },
      h("div", { className: "shad-dialog-header-text" },
        h(DialogTitle, null, "Settings"),
        h(DialogDescription, null, "Configure playback timing, visual engine limits, title card, and default export preferences.")),
      h(DialogClose, { className: "shad-icon-btn shad-dialog-close", "aria-label": "Close settings" }, icon("close"))),
    h("div", { className: "shad-dialog-body" },
      h(Accordion, { type: "single", collapsible: true, defaultValue: groups.find(g => g.id === "lyrics")?.id || groups[0]?.id },
        groups.map(group => h(AccordionItem, { value: group.id, key: group.id },
          h(AccordionTrigger, { id: `kefe-settings-${group.id}-trigger`, "aria-controls": `kefe-settings-${group.id}-content` },
            h("span", { className: "shad-accordion-title-wrap" }, icon(GROUP_ICONS[group.id] || "sliders", "shad-accordion-icon"), group.title)),
          h(AccordionContent, { id: `kefe-settings-${group.id}-content`, "aria-labelledby": `kefe-settings-${group.id}-trigger` },
            group.items.map(item => h(SettingsRow, { key: item.key, item, api, container }))))))),
    h("div", { className: "shad-dialog-footer" },
      h(Button, { type: "button", variant: "outline", onClick: () => api.reset() }, "Reset to defaults"),
      h(DialogClose, { asChild: true }, h(Button, { type: "button" }, "Done")))));
}

function mountSettingsDialog() {
  const api = window.kefeSettings;
  if (!api || typeof api.schema !== "function" || document.querySelector(".beui-settings-root")) return;
  const host = document.createElement("div");
  host.className = "beui-settings-root shad-dialog-root";
  host.hidden = true;
  document.body.append(host);
  createRoot(host).render(h(SettingsDialog, { api, host }));
}
if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountSettingsDialog, { once: true });
  else mountSettingsDialog();
}
