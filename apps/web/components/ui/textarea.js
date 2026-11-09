// Adapted from shadcn/ui's New York Textarea (MIT), using KEFE CSS tokens.
import * as React from 'react';
export function Textarea({ className = '', ...props }) {
  return React.createElement('textarea', { 'data-slot': 'textarea', className: `shad-textarea ${className}`.trim(), ...props });
}
