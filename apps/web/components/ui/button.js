// Adapted from shadcn/ui's New York Button (MIT). CSS replaces Tailwind classes.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

const VARIANT_CLASSES = {
  default: "shad-btn--primary",
  primary: "shad-btn--primary",
  outline: "shad-btn--outline",
  secondary: "shad-btn--secondary",
  ghost: "shad-btn--ghost",
  destructive: "shad-btn--destructive",
  link: "shad-btn--link",
};

const SIZE_CLASSES = {
  default: "",
  sm: "shad-btn--sm",
  lg: "shad-btn--lg",
  icon: "shad-btn--icon",
  "icon-sm": "shad-btn--icon-sm",
};

export function Button({ asChild = false, variant = "default", size = "default", className = "", ...props }) {
  const Comp = asChild ? Slot : "button";
  const variantClass = VARIANT_CLASSES[variant] || "shad-btn--primary";
  const sizeClass = SIZE_CLASSES[size] || "";
  return React.createElement(Comp, {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: `shad-btn ${variantClass} ${sizeClass} ${className}`.trim().replace(/\s+/g, " "),
    ...props,
  });
}
