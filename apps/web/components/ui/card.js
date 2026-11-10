// Adapted from shadcn/ui's New York Card (MIT); KEFE styles replace Tailwind.
import * as React from 'react';
const h = React.createElement;
export function Card({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card', className: `shad-card ${className}`.trim(), ...props });
}
export function CardHeader({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-header', className: `shad-card-header ${className}`.trim(), ...props });
}
export function CardTitle({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-title', className: `shad-card-title ${className}`.trim(), ...props });
}
export function CardDescription({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-description', className: `shad-card-description ${className}`.trim(), ...props });
}
export function CardAction({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-action', className: `shad-card-action ${className}`.trim(), ...props });
}
export function CardContent({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-content', className: `shad-card-content ${className}`.trim(), ...props });
}
export function CardFooter({ className = '', ...props }) {
  return h('div', { 'data-slot': 'card-footer', className: `shad-card-footer ${className}`.trim(), ...props });
}
