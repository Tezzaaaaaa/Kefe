// Adapted from shadcn/ui's New York Separator (MIT), using KEFE CSS tokens.
import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';

export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }) {
  return React.createElement(SeparatorPrimitive.Root, {
    'data-slot': 'separator',
    decorative,
    orientation,
    className: `shad-separator shad-separator--${orientation} ${className}`.trim(),
    ...props,
  });
}
