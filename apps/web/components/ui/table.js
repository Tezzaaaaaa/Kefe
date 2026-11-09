// Adapted from shadcn/ui's New York Table (MIT), using KEFE CSS tokens.
import * as React from 'react';
const h = React.createElement;
export function Table({ className = '', ...props }) {
  return h('div', { 'data-slot': 'table-container', className: 'shad-table-container' },
    h('table', { 'data-slot': 'table', className: `shad-table ${className}`.trim(), ...props }));
}
const part = (tag, slot, base) => function TablePart({ className = '', ...props }) {
  return h(tag, { 'data-slot': slot, className: `${base} ${className}`.trim(), ...props });
};
export const TableHeader = part('thead', 'table-header', 'shad-table-header');
export const TableBody = part('tbody', 'table-body', 'shad-table-body');
export const TableRow = part('tr', 'table-row', 'shad-table-row');
export const TableHead = part('th', 'table-head', 'shad-table-head');
export const TableCell = part('td', 'table-cell', 'shad-table-cell');
