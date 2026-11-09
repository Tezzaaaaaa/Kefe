// Adapted from shadcn/ui's New York Select (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as Primitive from "@radix-ui/react-select";
import { renderKefeIcon } from "../../app/ui/icons.js";
const h = React.createElement;
function Icon({ name, className }) {
  return h("span", { className, "aria-hidden": true, dangerouslySetInnerHTML: { __html: renderKefeIcon(name, "", 14, 2) } });
}
export const Select = Primitive.Root;
export function SelectTrigger({ children, ...props }) {
  return h(Primitive.Trigger, { "data-slot": "select-trigger", "aria-haspopup": "listbox", className: "shad-select-trigger", ...props }, children,
    h(Primitive.Icon, { className: "shad-select-chevron" }, h(Icon, { name: "chevron-down" })));
}
export function SelectValue(props) { return h(Primitive.Value, { "data-slot": "select-value", ...props }); }
export function SelectContent({ children, container, className = "" }) {
  return h(Primitive.Portal, { container }, h(Primitive.Content, {
    "data-slot": "select-content", className: `shad-select-listbox ${className}`.trim(), position: "popper", sideOffset: 4,
  }, h(Primitive.Viewport, null, children)));
}
export function SelectItem({ children, ...props }) {
  return h(Primitive.Item, { "data-slot": "select-item", className: "shad-select-option", ...props },
    h(Primitive.ItemText, null, children),
    h(Primitive.ItemIndicator, { className: "shad-select-option-check" }, h(Icon, { name: "check" })));
}
