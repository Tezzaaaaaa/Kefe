// Adapted from shadcn/ui's New York Button (MIT). CSS replaces Tailwind classes.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

export function Button({ asChild = false, variant = "default", size = "default", className = "", ...props }) {
  const Comp = asChild ? Slot : "button";
  return React.createElement(Comp, {
    "data-slot": "button", "data-variant": variant, "data-size": size,
    className: `shad-btn ${variant === "outline" ? "shad-btn--outline" : variant === "ghost" ? "shad-btn--ghost" : "shad-btn--primary"} ${className}`.trim(),
    ...props,
  });
}
