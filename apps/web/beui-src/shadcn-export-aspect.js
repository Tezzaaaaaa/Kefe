/* Export section: aspect-ratio picker plus an output summary.
   The preview aspect ratio lives in one place, the native #kefeAspect select, which the editor,
   the floating toolbar, settings and the exporter already read. This control only drives that
   select (setting .value and firing "change", exactly like the toolbar does) and mirrors it back,
   so it cannot drift from the canvas, lyrics layout or export size. */

const RATIOS = [
  ["16:9", "Landscape"],
  ["9:16", "Portrait"],
  ["1:1", "Square"],
];

/* Same arithmetic as the exporter's dimsForRes() in editor.js. */
function outputDims(res, aspect) {
  const even = n => Math.round(n / 2) * 2;
  const long = even((res * 16) / 9);
  return aspect === "9:16" ? [res, long] : aspect === "1:1" ? [res, res] : [long, res];
}

function mount() {
  const panel = document.querySelector('.kefe-panel[data-panel-view="export"]');
  const select = document.getElementById("kefeAspect");
  const resolution = document.getElementById("exportResolution");
  const format = document.getElementById("exportFormat");
  if (!panel || !select || !resolution || panel.querySelector("#kefeExportAspect")) return;
  const form = panel.querySelector(".kefe-form");
  if (!form) return;

  const wrap = document.createElement("div");
  wrap.id = "kefeExportAspect";
  wrap.className = "kefe-export-aspect";
  wrap.innerHTML =
    '<label class="kefe-label shad-label" data-slot="label" id="kefeExportAspectLabel">Aspect ratio</label>' +
    '<div class="kefe-export-aspect-options" role="group" aria-labelledby="kefeExportAspectLabel"></div>' +
    '<p class="kefe-meta kefe-export-summary" id="kefeExportSummary" role="status" aria-live="polite"></p>';
  const options = wrap.querySelector(".kefe-export-aspect-options");
  const summary = wrap.querySelector("#kefeExportSummary");

  for (const [value, name] of RATIOS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shad-btn shad-btn--outline kefe-export-aspect-option";
    button.dataset.slot = "button";
    button.dataset.variant = "outline";
    button.dataset.aspect = value;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<span class="kefe-export-aspect-ratio">${value}</span><span class="kefe-export-aspect-name">${name}</span>`;
    button.addEventListener("click", () => {
      if (select.value === value) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    options.appendChild(button);
  }

  function refresh() {
    const aspect = select.value || "16:9";
    options.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.aspect === aspect)));
    const res = Number(resolution.value) || 720;
    const [w, h] = outputDims(res, aspect);
    const fmt = format ? format.options[format.selectedIndex]?.text.split(" ")[0] : "";
    summary.textContent = `Exports at ${w} × ${h} px · ${aspect} · ${res}p${fmt ? " · " + fmt : ""}. Matches the preview canvas; change it here or from the toolbar.`;
  }

  /* shadcn wraps the native selects in host elements, so anchor on the form's direct child. */
  let anchor = resolution;
  while (anchor.parentElement && anchor.parentElement !== form) anchor = anchor.parentElement;
  anchor.after(wrap);
  [select, resolution, format].forEach(el => el && el.addEventListener("change", refresh));
  /* Settings and project load set the select programmatically and dispatch "change"; the
     toolbar also emits resize after an aspect change, so refresh on both. */
  window.addEventListener("resize", refresh, { passive: true });
  refresh();
}

if (typeof window !== "undefined") {
  if (document.readyState === "complete") mount();
  else window.addEventListener("load", mount, { once: true });
}
