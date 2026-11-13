/* Visualiser settings: every engine shows its controls in the same structure, a stack of
   collapsible groups (shadcn Collapsible look): title row with chevron, first group open, the
   rest folded. Only classes and aria attributes change; the sliders, checkboxes and their
   listeners keep their exact nodes, so each engine's own wiring is untouched. Views with a
   single group stay open and show no chevron. */

const GROUP = ".kefe-visualiser-control-group";

function enhance(group, open) {
  if (group.dataset.shadcnGroup) return;
  const title = group.querySelector(":scope > .kefe-label");
  if (!title) return;
  group.dataset.shadcnGroup = "true";
  group.classList.add("shad-collapsible");
  group.dataset.slot = "collapsible";
  title.setAttribute("role", "button");
  title.setAttribute("tabindex", "0");
  title.classList.add("shad-collapsible-trigger");
  const set = value => {
    group.classList.toggle("is-collapsed", !value);
    title.setAttribute("aria-expanded", String(value));
  };
  set(open);
  const toggle = () => set(group.classList.contains("is-collapsed"));
  title.addEventListener("click", toggle);
  title.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
  });
}

function run() {
  document.querySelectorAll(".kefe-visualiser-form .kefe-vis-view").forEach(view => {
    const groups = [...view.querySelectorAll(`:scope > ${GROUP}`)];
    groups.forEach((group, index) => {
      enhance(group, index === 0);
      group.classList.toggle("is-single", groups.length === 1);
      if (groups.length === 1) {
        group.classList.remove("is-collapsed");
        group.querySelector(":scope > .kefe-label")?.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function start() {
  run();
  const form = document.querySelector(".kefe-visualiser-form");
  if (!form || typeof MutationObserver === "undefined") return;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; run(); });
  }).observe(form, { childList: true, subtree: true });
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
