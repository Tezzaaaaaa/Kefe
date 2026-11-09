// Adapted from shadcn/ui's New York Progress (MIT); KEFE CSS replaces Tailwind.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-progress';
export function Progress({ value, className = '', ...props }) {
  return React.createElement(Primitive.Root, { 'data-slot': 'progress', value, className: `shad-progress ${className}`.trim(), ...props },
    React.createElement(Primitive.Indicator, { 'data-slot': 'progress-indicator', className: 'shad-progress-indicator', style: { transform: `translateX(-${100 - (value || 0)}%)` } }));
}
