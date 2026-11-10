// Adapted from shadcn/ui's New York Popover (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

const h = React.createElement;

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({ className = "", align = "center", sideOffset = 6, portal = true, container, ...props }) {
  const content = h(PopoverPrimitive.Content, {
    "data-slot": "popover-content",
    align,
    sideOffset,
    className: `shad-popover-content ${className}`.trim(),
    ...props,
  });
  return portal ? h(PopoverPrimitive.Portal, { container }, content) : content;
}
