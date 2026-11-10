// Adapted from shadcn.io Dropzone (MIT), using KEFE CSS tokens.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

const h = React.createElement;

export function Dropzone({ asChild = false, className = "", ...props }) {
  const Comp = asChild ? Slot : "label";
  return h(Comp, {
    "data-slot": "dropzone",
    className: `shad-dropzone ${className}`.trim(),
    ...props,
  });
}

export function DropzoneEmptyState({ className = "", ...props }) {
  return h("span", {
    "data-slot": "dropzone-empty",
    className: `shad-dropzone-empty ${className}`.trim(),
    ...props,
  });
}

export function DropzoneContent({ className = "", ...props }) {
  return h("span", {
    "data-slot": "dropzone-content",
    className: `shad-dropzone-content ${className}`.trim(),
    ...props,
  });
}
