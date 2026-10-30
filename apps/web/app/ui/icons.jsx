import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Activity, AudioLines, AudioWaveform, ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudUpload, Copy,
  Download, Edit3, Eye, FileAudio, FileText, Folder, Github, Grip, Image,
  Layers, ListMusic, Lock, LockOpen, Maximize, Minimize, MoreHorizontal, Move, Type, Frame, Circle,
  Music2, Pause, Play, Plus, Redo2, RotateCcw, Search, Settings, SlidersHorizontal,
  Sparkles, Sun, Moon, Trash2, Undo2, Upload, Volume2, VolumeX, X, Zap,
} from "lucide-react";

const icons = {
  activity: Activity, "audio-lines": AudioLines, "audio-waveform": AudioWaveform,
  "arrow-down": ArrowDown, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up": ArrowUp, check: Check, "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft, "chevron-right": ChevronRight,
  help: CircleHelp, "cloud-upload": CloudUpload, copy: Copy, download: Download,
  edit: Edit3, eye: Eye, "file-audio": FileAudio, "file-text": FileText,
  folder: Folder, github: Github, grip: Grip, image: Image, layers: Layers,
  "list-music": ListMusic, lock: Lock, unlock: LockOpen, move: Move, type: Type, frame: Frame, circle: Circle, maximize: Maximize,
  minimize: Minimize, more: MoreHorizontal, music: Music2, pause: Pause,
  play: Play, plus: Plus, redo: Redo2, reset: RotateCcw, search: Search,
  settings: Settings, sliders: SlidersHorizontal, sparkles: Sparkles, sun: Sun,
  moon: Moon, trash: Trash2, undo: Undo2, upload: Upload, volume: Volume2,
  mute: VolumeX, close: X, zap: Zap,
};

function markup(name, className = "", size = 18) {
  const Icon = icons[name];
  if (!Icon) return "";
  return renderToStaticMarkup(createElement(Icon, {
    size, strokeWidth: 1.8, className, "aria-hidden": true, focusable: false,
  }));
}

function hydrate(root = document) {
  root.querySelectorAll("[data-kefe-icon]").forEach((node) => {
    const name = node.getAttribute("data-kefe-icon");
    const size = Number(node.getAttribute("data-icon-size")) || 18;
    const className = node.getAttribute("data-icon-class") || "";
    const svg = markup(name, className, size);
    if (svg) node.outerHTML = svg;
  });
}

window.kefeIcon = (name, className = "", size = 18) =>
  markup(name, className, size) || '<span aria-hidden="true"></span>';
window.kefeHydrateIcons = hydrate;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => hydrate(), { once: true });
} else {
  hydrate();
}
