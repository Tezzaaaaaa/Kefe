/* Hydrate the existing lyrics textarea rather than replacing the editor's
   stateful input. Its native value, selection, event listeners, and label
   association remain authoritative. This module does not touch song search. */
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Textarea } from '../components/ui/textarea.js';

function mountLyricsTextarea() {
  const input = document.getElementById('lyricsInput');
  if (!input || !input.parentNode || input.dataset.shadcnHydrated) return;
  const className = input.className.replace(/\s+/g, ' ').trim();
  const host = document.createElement('div');
  host.className = 'shad-lyrics-textarea-host';
  input.parentNode.insertBefore(host, input);
  host.appendChild(input);
  input.className = `shad-textarea ${className}`.replace(/\s+/g, ' ').trim();
  input.dataset.slot = 'textarea';
  // Match React's serialized style exactly to avoid a development hydration
  // mismatch (the lyric studio sets this property before load).
  const alignment = input.style.textAlign;
  if (alignment && input.style.length === 1) input.setAttribute('style', `text-align:${alignment}`);
  const props = {
    id: input.id, className, placeholder: input.placeholder,
    defaultValue: input.defaultValue,
    style: alignment ? { textAlign: alignment } : undefined,
  };
  if (input.hasAttribute('spellcheck')) props.spellCheck = input.getAttribute('spellcheck') !== 'false';
  flushSync(() => hydrateRoot(host, React.createElement(Textarea, props)));
  input.dataset.shadcnHydrated = 'true';
}
if (typeof window !== 'undefined') {
  // Other lyric tools insert siblings next to this textarea during boot.
  if (document.readyState === 'complete') mountLyricsTextarea();
  else window.addEventListener('load', mountLyricsTextarea, { once: true });
}
