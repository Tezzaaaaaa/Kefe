/* Export section: aspect-ratio picker plus an output summary.
   The preview aspect ratio lives in one place, the native #kefeAspect select, which the editor,
   the floating toolbar, settings and the exporter already read. This control only drives that
   select (setting .value and firing "change", exactly like the toolbar does) and mirrors it back,
   so it cannot drift from the canvas, lyrics layout or export size. */

const RATIOS = [
  ["16:9", "Landscape", "YouTube · Landscape"],
  ["9:16", "Portrait", "TikTok · Reels · Shorts"],
  ["1:1", "Square", "Instagram · Square"],
];

/* Same arithmetic as the exporter's dimsForRes() in editor.js. */
function outputDims(res, aspect) {
  const even = n => Math.round(n / 2) * 2;
  const long = even((res * 16) / 9);
  return aspect === "9:16" ? [res, long] : aspect === "1:1" ? [res, res] : [long, res];
}

/* Every picker drives the one native #kefeAspect select, so they all stay in step with the toolbar,
   Settings, the canvas and the exporter. Platform names tell people which ratio suits where they will post. */
const pickers = [];
function refreshAll() { pickers.forEach(fn => fn()); }

function buildPicker({ id, labelId, labelText, select, resolution, format, withSummary, hint }) {
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.className = "kefe-export-aspect";
  wrap.innerHTML =
    `<label class="kefe-label shad-label" data-slot="label" id="${labelId}">${labelText}</label>` +
    `<div class="kefe-export-aspect-options" role="group" aria-labelledby="${labelId}"></div>` +
    (hint ? `<p class="kefe-meta" id="${id}Hint">${hint}</p>` : "") +
    (withSummary ? `<p class="kefe-meta kefe-export-summary" id="kefeExportSummary" role="status" aria-live="polite"></p>` : "");
  const options = wrap.querySelector(".kefe-export-aspect-options");
  const summary = wrap.querySelector("#kefeExportSummary");

  for (const [value, name, platforms] of RATIOS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shad-btn shad-btn--outline kefe-export-aspect-option";
    button.dataset.slot = "button";
    button.dataset.variant = "outline";
    button.dataset.aspect = value;
    button.setAttribute("aria-pressed", "false");
    button.title = `${name} ${value} · ${platforms}`;
    button.innerHTML = `<span class="kefe-export-aspect-ratio">${value}</span><span class="kefe-export-aspect-name">${platforms}</span>`;
    button.addEventListener("click", () => {
      if (select.value === value) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    options.appendChild(button);
  }

  function refresh() {
    if (!wrap.isConnected) return;
    const aspect = select.value || "16:9";
    options.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.aspect === aspect)));
    if (summary) {
      const res = Number(resolution?.value) || 720;
      const [w, h] = outputDims(res, aspect);
      const fmt = format ? format.options[format.selectedIndex]?.text.split(" ")[0] : "";
      summary.textContent = `Exports at ${w} × ${h} px · ${aspect} · ${res}p${fmt ? " · " + fmt : ""}. Matches the preview canvas; change it here or from the toolbar.`;
    }
  }
  pickers.push(refresh);
  return { wrap, refresh };
}

function mountExport(select, resolution, format) {
  const panel = document.querySelector('.kefe-panel[data-panel-view="export"]');
  if (!panel || !resolution || panel.querySelector("#kefeExportAspect")) return;
  const form = panel.querySelector(".kefe-form");
  if (!form) return;
  const { wrap, refresh } = buildPicker({ id: "kefeExportAspect", labelId: "kefeExportAspectLabel", labelText: "Aspect ratio", select, resolution, format, withSummary: true });
  /* shadcn wraps the native selects in host elements, so anchor on the form's direct child. */
  let anchor = resolution;
  while (anchor.parentElement && anchor.parentElement !== form) anchor = anchor.parentElement;
  anchor.after(wrap);
  [resolution, format].forEach(el => el && el.addEventListener("change", refresh));
  refresh();
}

/* First thing in the first editor section, so the canvas shape is chosen before anything else. */
function mountStart(select) {
  const panel = document.querySelector('.kefe-panel[data-panel-view="media"]');
  if (!panel || panel.querySelector("#kefeStartAspect")) return;
  const form = panel.querySelector(".kefe-form");
  if (!form) return;
  const { wrap, refresh } = buildPicker({
    id: "kefeStartAspect", labelId: "kefeStartAspectLabel", labelText: "Canvas ratio",
    select, hint: "Pick the shape for where you will post it. You can change it any time.",
  });
  form.prepend(wrap);
  refresh();
}

function mount() {
  const select = document.getElementById("kefeAspect");
  if (!select) return;
  if (!select.dataset.aspectPickersBound) {
    select.dataset.aspectPickersBound = "true";
    /* Settings and project load set the select programmatically and dispatch "change"; the
       toolbar also emits resize after an aspect change, so refresh on both. */
    select.addEventListener("change", refreshAll);
    window.addEventListener("resize", refreshAll, { passive: true });
  }
  mountExport(select, document.getElementById("exportResolution"), document.getElementById("exportFormat"));
  mountStart(select);
}

if (typeof window !== "undefined") {
  const run = () => {
    mount();
    /* The settings shell can rebuild panels after load; remount if a picker went missing. */
    let tries = 0;
    const timer = setInterval(() => { mount(); if (++tries > 20) clearInterval(timer); }, 500);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}
