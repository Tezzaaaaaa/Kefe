// Adapted from shadcn/ui's New York Card (MIT); KEFE styles replace Tailwind.
import * as React from 'react';
export function Card(props) {
  return React.createElement('div', { 'data-slot': 'card', ...props });
}
export function CardFooter(props) {
  return React.createElement('div', { 'data-slot': 'card-footer', ...props });
}
