// Adapted from shadcn/ui's New York Tabs (MIT), using KEFE CSS instead of Tailwind.
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export function Tabs(props) {
  return React.createElement(TabsPrimitive.Root, { 'data-slot': 'tabs', ...props });
}
export function TabsList(props) {
  return React.createElement(TabsPrimitive.List, { 'data-slot': 'tabs-list', ...props });
}
export function TabsTrigger(props) {
  return React.createElement(TabsPrimitive.Trigger, { 'data-slot': 'tabs-trigger', ...props });
}
export function TabsContent(props) {
  return React.createElement(TabsPrimitive.Content, { 'data-slot': 'tabs-content', ...props });
}
