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


/* Lyric effect gallery: a search box above the grid so 60+ effects are findable without
   scrolling. It only toggles `hidden` on the existing option buttons, so selection, preview and
   the effect engine keep their exact nodes; the filter is re-applied after the grid rebuilds. */
let effectQuery = "";
function applyEffectFilter(grid) {
  const q = effectQuery.trim().toLowerCase();
  let shown = 0;
  grid.querySelectorAll(".kefe-lyric-effect-option").forEach(option => {
    const name = (option.querySelector(".kefe-lyric-effect-name")?.textContent || option.textContent || "").toLowerCase();
    const match = !q || name.includes(q);
    option.hidden = !match;
    if (match) shown += 1;
  });
  const status = grid.parentElement?.querySelector(".kefe-effect-search-status");
  /* Only write when the text changes: a same-value textContent still replaces the text node,
     which the panel's MutationObserver sees, which would re-run this and loop forever. */
  const text = q ? `${shown} effect${shown === 1 ? "" : "s"} match` : "";
  if (status && status.textContent !== text) status.textContent = text;
}
function effectSearch(root) {
  const grid = root.querySelector("#lyricEffectOptions");
  if (!grid) return;
  if (!grid.parentElement.querySelector("#kefeEffectSearch")) {
    const wrap = document.createElement("div");
    wrap.className = "kefe-effect-search";
    wrap.innerHTML =
      '<input id="kefeEffectSearch" class="kefe-input shad-input" data-slot="input" type="search" autocomplete="off" placeholder="Search effects" aria-label="Search lyric effects">' +
      '<span class="kefe-effect-search-status kefe-meta" role="status" aria-live="polite"></span>';
    grid.parentElement.insertBefore(wrap, grid);
    wrap.querySelector("input").addEventListener("input", event => { effectQuery = event.target.value; applyEffectFilter(grid); });
  }
  applyEffectFilter(grid);
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
    effectSearch(root);
  },
  "background-effects"(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
  visualiser(root) {
    asCard(root);
    root.querySelectorAll(".kefe-label").forEach(asLabel);
  },
  export(root) {
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
