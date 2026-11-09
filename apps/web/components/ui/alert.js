// Adapted from shadcn/ui's New York Alert (MIT), using KEFE CSS tokens.
import * as React from 'react';
export function Alert({ className = '', variant = 'default', ...props }) {
  return React.createElement('div', {
    'data-slot': 'alert', role: 'alert', className: `shad-alert shad-alert--${variant} ${className}`.trim(), ...props,
  });
}
export function AlertTitle({ className = '', ...props }) {
  return React.createElement('div', { 'data-slot': 'alert-title', className: `shad-alert-title ${className}`.trim(), ...props });
}
export function AlertDescription({ className = '', ...props }) {
  return React.createElement('div', { 'data-slot': 'alert-description', className: `shad-alert-description ${className}`.trim(), ...props });
}
