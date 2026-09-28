import { togglePlayback, seekPreview, stopPlayback, getMasterTime, getMasterDuration } from '../core/playback.js';
import { openExportPreflight } from './export-preflight.js';

export function wireKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        switch (e.key) {
            case ' ':          e.preventDefault(); togglePlayback(); break;
            case 'ArrowLeft':  e.preventDefault(); seekPreview(Math.max(0, getMasterTime() - 5)); break;
            case 'ArrowRight': e.preventDefault(); seekPreview(Math.min(getMasterDuration(), getMasterTime() + 5)); break;
            case '1': document.querySelector('[data-effect="apple"]')?.click(); break;
            case '2': document.querySelector('[data-effect="brat"]')?.click(); break;
            case '3': document.querySelector('[data-effect="eternal"]')?.click(); break;
            case 'e': case 'E': openExportPreflight(); break;
            case 'f': case 'F':
                if (document.fullscreenElement) document.exitFullscreen();
                else document.querySelector('.preview')?.requestFullscreen().catch(() => {});
                break;
            case '0': stopPlayback(); break;
        }
    });
}