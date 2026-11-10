// Adapted from shadcn/ui's New York Collapsible (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { renderKefeIcon } from "../../app/ui/icons.js";

const h = React.createElement;

export function Collapsible({ className = "", ...props }) {
  return h(CollapsiblePrimitive.Root, {
    "data-slot": "collapsible",
    className: `shad-collapsible ${className}`.trim(),
    ...props,
  });
}

export function CollapsibleTrigger({ className = "", chevron = true, children, asChild = false, ...props }) {
  if (asChild) {
    return h(CollapsiblePrimitive.Trigger, {
      asChild: true,
      "data-slot": "collapsible-trigger",
      className: `shad-collapsible-trigger ${className}`.trim(),
      ...props,
    }, children);
  }
  return h(CollapsiblePrimitive.Trigger, {
    type: "button",
    "data-slot": "collapsible-trigger",
    className: `shad-collapsible-trigger ${className}`.trim(),
    ...props,
  },
  h("span", { className: "shad-collapsible-label" }, children),
  chevron && h("span", {
    className: "shad-collapsible-chevron",
    "aria-hidden": true,
    dangerouslySetInnerHTML: { __html: renderKefeIcon("chevron-down", "", 15, 2) },
  }));
}

export function CollapsibleContent({ className = "", ...props }) {
  return h(CollapsiblePrimitive.Content, {
    "data-slot": "collapsible-content",
    className: `shad-collapsible-content ${className}`.trim(),
    ...props,
  });
}
