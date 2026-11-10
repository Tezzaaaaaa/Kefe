// Adapted from shadcn/ui's New York ToggleGroup (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

const h = React.createElement;

export function ToggleGroup({ className = "", variant = "outline", size = "default", ...props }) {
  return h(ToggleGroupPrimitive.Root, {
    "data-slot": "toggle-group",
    "data-variant": variant,
    "data-size": size,
    className: `shad-toggle-group shad-toggle-group--${variant} ${className}`.trim(),
    ...props,
  });
}

export function ToggleGroupItem({ className = "", variant = "outline", size = "default", ...props }) {
  return h(ToggleGroupPrimitive.Item, {
    "data-slot": "toggle-group-item",
    "data-variant": variant,
    "data-size": size,
    className: `shad-toggle-group-item ${className}`.trim(),
    ...props,
  });
}
