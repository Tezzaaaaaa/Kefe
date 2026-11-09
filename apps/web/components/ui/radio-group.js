// Adapted from shadcn/ui's New York RadioGroup (MIT), using KEFE CSS tokens.
import * as React from 'react';
import * as Primitive from '@radix-ui/react-radio-group';
const h = React.createElement;
export function RadioGroup({ className = '', ...props }) {
  return h(Primitive.Root, { 'data-slot': 'radio-group', className: `shad-radio-group ${className}`.trim(), ...props });
}
export function RadioGroupItem({ className = '', children, ...props }) {
  return h(Primitive.Item, { 'data-slot': 'radio-group-item', className: `shad-radio ${className}`.trim(), ...props },
    children, h(Primitive.Indicator, { 'data-slot': 'radio-group-indicator', className: 'shad-radio-indicator' }, h('span', { className: 'shad-radio-dot' })));
}
