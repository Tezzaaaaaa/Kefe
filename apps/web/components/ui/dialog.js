// Adapted from shadcn/ui's New York Dialog (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
const h = React.createElement;
export const Dialog = Primitive.Root;
export function DialogClose(props) { return h(Primitive.Close, { "data-slot": "dialog-close", ...props }); }
export function DialogContent({ children, container, ...props }) {
  return h(Primitive.Portal, { container },
    h(Primitive.Overlay, { "data-slot": "dialog-overlay", className: "shad-dialog-backdrop" }),
    h(Primitive.Content, { "data-slot": "dialog-content", className: "shad-dialog-content", ...props }, children));
}
export function DialogTitle(props) { return h(Primitive.Title, { "data-slot": "dialog-title", className: "shad-dialog-title", ...props }); }
export function DialogDescription(props) { return h(Primitive.Description, { "data-slot": "dialog-description", className: "shad-dialog-description", ...props }); }
