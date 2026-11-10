// Adapted from shadcn/ui's New York Label (MIT), using KEFE CSS tokens.
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

export function Label({ className = '', ...props }) {
  return React.createElement(LabelPrimitive.Root, {
    'data-slot': 'label',
    className: `shad-label ${className}`.trim(),
    ...props,
  });
}
