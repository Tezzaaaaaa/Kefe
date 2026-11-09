// Adapted from shadcn/ui's New York Input (MIT), using KEFE CSS tokens.
import * as React from 'react';
export function Input({ className = '', type, ...props }) {
  return React.createElement('input', { type, 'data-slot': 'input', className: `shad-input ${className}`.trim(), ...props });
}
