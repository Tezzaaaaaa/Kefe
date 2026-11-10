// Adapted from shadcn/ui's New York Tooltip (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

const h = React.createElement;

export function TooltipProvider({ delayDuration = 200, ...props }) {
  return h(TooltipPrimitive.Provider, { "data-slot": "tooltip-provider", delayDuration, ...props });
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className = "", sideOffset = 6, container, children, ...props }) {
  return h(TooltipPrimitive.Portal, { container },
    h(TooltipPrimitive.Content, {
      "data-slot": "tooltip-content",
      sideOffset,
      className: `shad-tooltip-content ${className}`.trim(),
      ...props,
    }, children));
}
