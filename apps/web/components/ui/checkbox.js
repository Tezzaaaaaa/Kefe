// Adapted from shadcn/ui's New York Checkbox (MIT); styles use KEFE CSS tokens.
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/checkbox.tsx
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { renderKefeIcon } from "../../app/ui/icons.js";
const h = React.createElement;
export function Checkbox(props) {
  return h(CheckboxPrimitive.Root, { "data-slot": "checkbox", className: "shad-checkbox", ...props },
    h(CheckboxPrimitive.Indicator, { "data-slot": "checkbox-indicator", className: "shad-checkbox-indicator" },
      h("span", { "aria-hidden": true, dangerouslySetInnerHTML: { __html: renderKefeIcon("check", "", 14, 3) } })));
}
