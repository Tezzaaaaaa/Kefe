// Adapted from shadcn/ui's New York Switch (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

export function Switch(props) {
  return React.createElement(SwitchPrimitive.Root, { "data-slot": "switch", className: "shad-switch", ...props },
    React.createElement(SwitchPrimitive.Thumb, { "data-slot": "switch-thumb", className: "shad-switch-thumb" }));
}
