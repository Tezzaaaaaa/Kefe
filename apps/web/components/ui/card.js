// Adapted from shadcn/ui's New York Card (MIT); KEFE styles replace Tailwind.
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

export function Card({ asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'div';
  return React.createElement(Comp, { 'data-slot': 'card', ...props });
}
export function CardHeader(props) {
  return React.createElement('div', { 'data-slot': 'card-header', ...props });
}
export function CardTitle(props) {
  return React.createElement('h3', { 'data-slot': 'card-title', ...props });
}
export function CardDescription(props) {
  return React.createElement('p', { 'data-slot': 'card-description', ...props });
}
export function CardContent(props) {
  return React.createElement('div', { 'data-slot': 'card-content', ...props });
}
export function CardFooter(props) {
  return React.createElement('div', { 'data-slot': 'card-footer', ...props });
}
