// Adapted from shadcn/ui's New York Accordion (MIT); styling is in shadcn-kefe.css.
import * as React from "react";
import * as Primitive from "@radix-ui/react-accordion";
import { renderKefeIcon } from "../../app/ui/icons.js";
const h = React.createElement;
export function Accordion(props) { return h(Primitive.Root, { "data-slot": "accordion", className: "shad-accordion", ...props }); }
export function AccordionItem(props) { return h(Primitive.Item, { "data-slot": "accordion-item", className: "shad-accordion-item", ...props }); }
export function AccordionTrigger({ children, ...props }) {
  return h(Primitive.Header, { className: "shad-accordion-header" },
    h(Primitive.Trigger, { "data-slot": "accordion-trigger", className: "shad-accordion-trigger", ...props }, children,
      h("span", { className: "shad-accordion-chevron", "aria-hidden": true, dangerouslySetInnerHTML: { __html: renderKefeIcon("chevron-down", "", 15, 2) } })));
}
export function AccordionContent({ children, ...props }) {
  return h(Primitive.Content, { "data-slot": "accordion-content", className: "shad-accordion-content", ...props },
    h("div", { className: "shad-accordion-body" }, children));
}
