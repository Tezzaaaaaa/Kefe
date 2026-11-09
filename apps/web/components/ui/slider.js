// Adapted from shadcn/ui's New York Slider (MIT):
// https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/slider.tsx
// KEFE uses plain CSS in place of Tailwind and a single thumb for its controls.
import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

export function Slider({ value, min = 0, max = 100, label, labelledBy, valueText, disabled, ...props }) {
  return React.createElement(SliderPrimitive.Root, {
    "data-slot": "slider", className: "shad-slider", value: [value], min, max, disabled, ...props,
  },
  React.createElement(SliderPrimitive.Track, { "data-slot": "slider-track", className: "shad-slider-track" },
    React.createElement(SliderPrimitive.Range, { "data-slot": "slider-range", className: "shad-slider-range" })),
  React.createElement(SliderPrimitive.Thumb, {
    "data-slot": "slider-thumb", className: "shad-slider-thumb",
    "aria-label": labelledBy ? undefined : label, "aria-labelledby": labelledBy || undefined,
    "aria-disabled": disabled || undefined, "aria-valuetext": valueText || undefined,
  }));
}
