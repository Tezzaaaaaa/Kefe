/* Editor sections as shadcn: each section root, its labels, its card surfaces and its
   leftover native buttons carry shadcn Card / Label / Button semantics in place
   (data-slot + shad-* classes), the same way shadcn-media.js treats its card surfaces.
   Nothing is wrapped or re-rendered, so state owned by the lyric studio, media carousel
   and visualiser keeps its exact DOM nodes. One handler per section, keyed by the
   section's data-panel-view; handlers are idempotent because sections rebuild parts of
   their markup at runtime (e.g. the media carousel is built after load). */

const MARK = "shadcnSurface";

function once(el) {
  if (!(el instanceof HTMLElement) || el.dataset[MARK]) return false;
  el.dataset[MARK] = "true";
  return true;
}
function asCard(el) {
  if (!once(el)) return;
  el.classList.add("shad-card");
  el.dataset.slot = "card";
}
function asLabel(el) {
  if (!once(el)) return;
  el.classList.add("shad-label");
  el.dataset.slot = "label";
}
function asButton(el, variant = "ghost", size = "icon") {
  if (!once(el)) return;
  el.classList.add("shad-btn", `shad-btn--${variant}`, ...(size === "icon" ? ["shad-btn--icon"] : []));
  el.dataset.slot = "button";
  el.dataset.variant = variant;
  el.dataset.size = size;
}

const sections = {
  media(root) {
    asCard(root);
    asCard(root.querySelector("#kefeResultCard"));
    root.querySelectorAll("#kefeCarPrev, #kefeCarNext").forEach(button => asButton(button, "ghost", "icon"));
  },
  lyrics(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
  effects(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
  "background-effects"(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
  visualiser(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
};

function run() {
  for (const [name, handler] of Object.entries(sections)) {
    const root = document.querySelector(`.kefe-panel[data-panel-view="${name}"]`);
    if (root) handler(root);
  }
}

function start() {
  run();
  if (typeof MutationObserver === "undefined") return;
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; run(); });
  });
  document.querySelectorAll(".kefe-panel[data-panel-view]").forEach(root => observer.observe(root, { childList: true, subtree: true }));
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
