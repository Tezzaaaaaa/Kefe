// Adapted from shadcn/ui's New York Badge (MIT), using KEFE CSS tokens.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export function Badge({ asChild = false, variant = 'default', className = '', ...props }) {
  const Comp = asChild ? Slot : 'span';
  return React.createElement(Comp, {
    'data-slot': 'badge',
    'data-variant': variant,
    className: `shad-badge shad-badge--${variant} ${className}`.trim(),
    ...props,
  });
}
