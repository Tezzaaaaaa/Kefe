/* Export presentation only: the legacy editor retains its recorder and timing. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog.js';
import { Progress } from '../components/ui/progress.js';
import { Button } from '../components/ui/button.js';

const h = React.createElement;
function ExportDialog({ state, close, cancel, host, previousFocus }) {
  const dismiss = next => { if (!next && state.done) close(); };
  return h(Dialog, { open: state.open, onOpenChange: dismiss }, h(DialogContent, {
    container: host, id: 'kefeExportProgress', className: 'shad-export-content',
    onEscapeKeyDown: event => { if (!state.done) event.preventDefault(); },
    onPointerDownOutside: event => { if (!state.done) event.preventDefault(); },
    onCloseAutoFocus: event => {
      if (previousFocus?.isConnected && !previousFocus.disabled) {
        event.preventDefault(); previousFocus.focus({ preventScroll: true });
      }
    },
  },
    h('div', { className: 'shad-export-eyebrow' }, 'KEFE · EXPORT'),
    h(DialogTitle, { className: 'shad-export-title' }, h('span', { id: 'kefeExportTitle' }, state.title)),
    h(DialogDescription, { className: 'shad-export-description' }, 'Keep this tab open while KEFE renders and packages your video.'),
    h('div', { className: 'shad-export-summary' },
      h('div', { className: 'shad-export-summary-head' }, h('span', null, 'Export summary'), h('span', { id: 'kefeExportState' }, state.status)),
      h('div', { className: 'shad-export-track' }, h('strong', { id: 'kefeExportTrackTitle' }, state.projectTitle), h('span', { id: 'kefeExportTrackArtist' }, state.artist)),
      h('div', { className: 'shad-export-details' }, [
        ['Format', state.format, 'kefeExportFormat'], ['Resolution', state.resolution, 'kefeExportResolution'],
        ['Aspect ratio', state.aspect, 'kefeExportAspect'], ['Duration', state.duration, 'kefeExportDuration'],
        ['Frame rate', `${state.fps || 60} FPS`], ['Audio', state.audio, 'kefeExportAudio'],
      ].map(([label, value, id]) => h('div', { key: label }, h('span', null, label), h('strong', { id }, value))))),
    h('div', { className: 'shad-export-progress-label' }, h('span', { id: 'kefeExportStage' }, state.stage), h('strong', { id: 'kefeExportPercent' }, `${state.percent}%`)),
    h(Progress, { value: state.percent, max: 100, 'aria-label': 'Video export progress' }),
    h('p', { className: 'shad-export-footnote', id: 'kefeExportFootnote' }, state.message),
    !state.done && typeof state.onCancel === 'function' && h(Button, {
      type: 'button',
      id: 'kefeExportCancel',
      variant: 'outline',
      disabled: !!state.cancelling,
      onClick: cancel,
      className: 'shad-export-cancel',
    }, state.cancelling ? 'Cancelling…' : 'Cancel export'),
    state.done && h(Button, { type: 'button', id: 'kefeExportClose', onClick: close, className: 'shad-export-close' }, 'Close')));
}
function mountExportDialog() {
  if (window.kefeExportDialog) return;
  const host = document.createElement('div');
  host.className = 'shad-export-dialog-host'; host.hidden = true;
  document.body.append(host);
  const root = createRoot(host);
  let previousFocus = null;
  let state = { open: false, done: false, cancelling: false, percent: 1, stage: 'Preparing export', onCancel: null };
  const render = () => { host.hidden = !state.open; root.render(h(ExportDialog, { state, close, cancel, host, previousFocus })); };
  function close() { if (state.done) { state = { ...state, open: false, onCancel: null, cancelling: false }; render(); } }
  function cancel() {
    if (state.done || state.cancelling || typeof state.onCancel !== 'function') return;
    const handler = state.onCancel;
    state = { ...state, cancelling: true, status: 'Cancelling', stage: 'Stopping export…' };
    render();
    try { handler(); } catch (_) {}
  }
  window.kefeExportDialog = Object.freeze({
    open({ title, artist, format, resolution, aspect, duration, fps, onCancel, note }) {
      previousFocus = document.activeElement === document.body ? document.getElementById('exportButton') : document.activeElement;
      state = {
        open: true, done: false, cancelling: false, percent: 1, stage: 'Preparing export',
        title: 'Rendering your video', status: 'In progress',
        projectTitle: title || 'Untitled project', artist: artist || 'Unknown artist',
        format: String(format).toUpperCase(), resolution, aspect, duration, fps, audio: 'Audio track included',
        message: note || 'Keep this tab open. The download will start automatically when rendering finishes.',
        onCancel: typeof onCancel === 'function' ? onCancel : null,
      };
      render();
    },
    progress(value, stage) {
      state = { ...state, percent: Math.max(1, Math.min(100, Math.round(Number(value) || 1))), stage: stage || 'Rendering video' };
      render();
    },
    audio(included) {
      state = { ...state, audio: included ? 'Audio track included' : 'Video only' };
      render();
    },
    finish(success, message) {
      if (!state.open) return;
      state = {
        ...state, done: true, cancelling: false, onCancel: null,
        title: success ? 'Export complete' : (state.cancelling ? 'Export cancelled' : 'Export failed'),
        status: success ? 'Ready to download' : (state.cancelling ? 'Cancelled' : 'Needs attention'),
        stage: success ? 'Export complete' : 'Export stopped',
        percent: success ? 100 : state.percent,
        message,
      };
      render();
    },
  });
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountExportDialog, { once: true });
  else mountExportDialog();
}
