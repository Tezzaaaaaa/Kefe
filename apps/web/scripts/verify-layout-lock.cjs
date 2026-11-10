/* KEFE layout lock verification.

   Loads the built editor at fixed desktop, tablet and phone viewports, walks every settings
   section, and asserts that the layout is locked to one spacing and sizing system:
     - nothing overflows the page horizontally or pokes out of its parent
     - top-level blocks never overlap and share identical left/right edges
     - the gap between stacked blocks is always one token (--lk-gap)
     - sibling blocks inside a section use the same gap and the same edges
     - controls of the same kind have identical sizes on every screen

   Run after `pnpm --filter @kefe/web build`:
     NODE_PATH=/tmp/kefe-browser/node_modules node apps/web/scripts/verify-layout-lock.cjs
   Set KEFE_LOCK_SHOTS=<dir> to also save a screenshot per state. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "dist-beui");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const GAP = 12; // --lk-gap
const TOL = 1;
const VIEWPORTS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 640]];
const SECTIONS = [
  ["content", "media"], ["content", "lyric-sync"],
  ["design", "lyric-effects"], ["design", "background"],
  ["audio-visuals", "visualisers"], ["export", "export"],
];
const shotDir = process.env.KEFE_LOCK_SHOTS;

async function measure(page) {
  return page.evaluate(() => {
    const vis = n => {
      const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      return r.width > 1 && r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
    };
    const rect = n => { const r = n.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY, w: r.width, h: r.height }; };
    const name = n => n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    const q = s => [...document.querySelectorAll(s)].find(vis);
    const out = { problems: [] };
    const problem = msg => out.problems.push(msg);

    out.docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    out.docVOverflow = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (out.docVOverflow > 2) problem(`document overflows viewport vertically by ${out.docVOverflow}px`);

    /* Top-level stacked blocks, in reading order. */
    const toolbar = document.querySelector("#kefeFloatingToolbar");
    const stripOpen = toolbar && toolbar.classList.contains("is-open") && !toolbar.classList.contains("is-floating");
    const strip = stripOpen ? q("#kftStrip") : null;
    const stack = [
      ["preview", q(".kefe-preview")],
      ["toolbar", strip],
      ["timeline", q(".kefe-timeline")],
      ["tabs", q(".kefe-workspace-tabs")],
      ["title", q(".kefe-workspace-title")],
      ["workspace", q(".kefe-workspace:not([hidden]) > .kefe-workspace-stack") || q(".kefe-workspace-stack")],
    ].filter(([, n]) => n);
    out.stack = stack.map(([k, n]) => [k, rect(n)]);

    const frameL = Math.min(...out.stack.filter(([k]) => k !== "toolbar").map(([, r]) => r.l));
    const frameR = Math.max(...out.stack.filter(([k]) => k !== "toolbar").map(([, r]) => r.r));
    out.frame = [frameL, frameR];
    for (const [k, r] of out.stack) {
      if (k === "toolbar") { if (r.r > frameR + 1 || r.l < frameL - 1) problem(`toolbar strip leaves the content frame (${Math.round(r.l)}..${Math.round(r.r)} vs ${Math.round(frameL)}..${Math.round(frameR)})`); continue; }
      if (Math.abs(r.l - frameL) > 1) problem(`${k} left edge ${Math.round(r.l)} != frame ${Math.round(frameL)}`);
      if (Math.abs(r.r - frameR) > 1) problem(`${k} right edge ${Math.round(r.r)} != frame ${Math.round(frameR)}`);
    }
    for (let i = 1; i < out.stack.length; i++) {
      const [ka, a] = out.stack[i - 1], [kb, b] = out.stack[i];
      const gap = b.t - a.b;
      if (gap < -0.5) problem(`${ka} and ${kb} overlap by ${Math.round(-gap)}px`);
      else if (Math.abs(gap - 12) > 1) problem(`gap ${ka}->${kb} is ${Math.round(gap * 10) / 10}px, expected 12`);
    }
    const header = q(".kefe-sidebar");
    if (header) {
      const hb = header.getBoundingClientRect().bottom + scrollY;
      const first = out.stack[0][1];
      if (first.t < hb - 0.5) problem(`header overlaps ${out.stack[0][0]} by ${Math.round(hb - first.t)}px`);
      else if (Math.abs(first.t - hb - 12) > 1) problem(`gap header->${out.stack[0][0]} is ${Math.round((first.t - hb) * 10) / 10}px, expected 12`);
      out.header = rect(header);
    }

    /* Content inside the active section: same gap, same edges (unwrapping display:contents mounts). */
    const ws = stack.find(([k]) => k === "workspace")?.[1];
    if (ws) {
      const wr = ws.getBoundingClientRect();
      const unwrap = el => getComputedStyle(el).display === "contents" ? [...el.children].flatMap(unwrap) : [el];
      const kids = [...ws.children].flatMap(unwrap).filter(vis);
      kids.forEach((k, i) => {
        const r = k.getBoundingClientRect();
        if (Math.abs(r.left - wr.left) > 1 || Math.abs(r.right - wr.right) > 1) problem(`section child ${name(k)} edges ${Math.round(r.left)}..${Math.round(r.right)} != ${Math.round(wr.left)}..${Math.round(wr.right)}`);
        if (i) {
          const p = kids[i - 1].getBoundingClientRect();
          const gap = r.top - p.bottom;
          if (gap < -0.5) problem(`section children ${name(kids[i - 1])} / ${name(k)} overlap by ${Math.round(-gap)}px`);
          else if (Math.abs(gap - 12) > 1) problem(`section child gap ${name(kids[i - 1])} -> ${name(k)} is ${Math.round(gap * 10) / 10}px, expected 12`);
        }
      });
    }

    /* Nothing pokes out of its parent horizontally (unless the parent scrolls or clips on purpose). */
    const scope = [...document.querySelectorAll(".kefe-work *, #kefe-settings-panel *, .kefe-sidebar *")];
    let reported = 0;
    for (const n of scope) {
      if (reported >= 6 || !vis(n)) continue;
      const cs = getComputedStyle(n);
      if (["absolute", "fixed"].includes(cs.position) || /^(svg|path|circle|rect|line|polygon|canvas|g|use)$/i.test(n.tagName)) continue;
      const p = n.parentElement;
      if (!p || n.closest("[hidden], [aria-hidden='true'], :is(.shad-slider-host, .beui-range-host), .kefe-carousel, [data-kefe-carousel], .kefe-ms-host, .kft-bar")) continue;
      const pcs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(pcs.overflowX)) continue;
      const r = n.getBoundingClientRect(), pr = p.getBoundingClientRect();
      if (pr.width < 1 || pcs.display === "contents") continue;
      if (r.right > pr.right + 1.5 || r.left < pr.left - 1.5) { problem(`${name(n)} (${Math.round(r.left)}..${Math.round(r.right)}) pokes out of ${name(p)} (${Math.round(pr.left)}..${Math.round(pr.right)})`); reported++; }
    }

    /* Card grids: equal inner space on the left and right edge. */
    for (const grid of document.querySelectorAll("#kefe-settings-panel [class*='-grid'], #kefe-settings-panel [id$='Options']")) {
      if (!vis(grid) || getComputedStyle(grid).display !== "grid") continue;
      const cards = [...grid.children].filter(vis);
      if (cards.length < 2) continue;
      const gr = grid.getBoundingClientRect();
      const inner = gr.left + grid.clientLeft;
      const left = Math.min(...cards.map(c => c.getBoundingClientRect().left)) - inner;
      const right = inner + grid.clientWidth - Math.max(...cards.map(c => c.getBoundingClientRect().right));
      if (Math.abs(left - right) > 2) problem(`${name(grid)} cards are off-centre: ${Math.round(left)}px left vs ${Math.round(right)}px right`);
    }

    /* Control sizes, collected so the caller can compare them across viewports. */
    const heights = sel => [...new Set([...document.querySelectorAll(sel)].filter(vis).map(n => Math.round(n.getBoundingClientRect().height)))];
    out.sizes = {
      workspaceTab: heights(".kefe-workspace-tab"),
      subtab: heights(".kefe-subtab"),
      headerAction: heights(".kefe-sidebar-bottom .kefe-sidebar-link"),
      headerNav: heights(".kefe-sidebar-group .kefe-sidebar-link"),
      transport: heights(".kefe-timeline .kefe-transport button"),
      timeline: heights(".kefe-timeline"),
    };
    for (const [k, v] of Object.entries(out.sizes)) if (v.length > 1) problem(`${k} controls have mixed heights: ${v.join(", ")}`);

    /* Single-row invariants for workspace tabs, subtabs and header links. */
    for (const [label, sel] of [["workspaceTab", ".kefe-workspace-tab"], ["subtab", ".kefe-subtab"], ["headerLink", ".kefe-sidebar-link"]]) {
      const tops = [...document.querySelectorAll(sel)].filter(vis).map(n => Math.round(n.getBoundingClientRect().top));
      if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 2) problem(`${label} wrapped onto multiple rows (tops: ${tops.join(",")})`);
    }

    /* Sticky bars must sit below the sticky header, never under it. */
    const sticky = q(".kefe-workspace-tabs");
    if (header && sticky) {
      const top = parseFloat(getComputedStyle(sticky).top);
      const hh = header.getBoundingClientRect().height;
      let scroller = sticky.parentElement;
      while (scroller && scroller !== document.documentElement && !/(auto|scroll|hidden)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      const pageScrolls = !scroller || scroller === document.documentElement;
      if (getComputedStyle(sticky).position === "sticky" && pageScrolls && !(top >= hh - 0.5)) problem(`sticky tab bar top:${top} would slide under the ${hh}px header`);
    }
    return out;
  });
}

(async () => {
  await new Promise(resolve => server.listen(4196, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const sizeBook = {};
  try {
    for (const [w, h] of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4196/editor.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#songTitle", { state: "visible", timeout: 20000 });
      await page.waitForSelector(".kft-launch", { state: "attached", timeout: 10000 });
      await page.waitForTimeout(600);
      for (const [workspace, sub] of SECTIONS) {
        await page.evaluate(t => document.querySelector('[role="tab"][data-workspace-tab="' + t + '"]')?.click(), workspace);
        await page.waitForTimeout(250);
        await page.evaluate(s => document.querySelector("#kefe-subtab-" + s)?.click(), sub);
        await page.waitForTimeout(350);
        await page.evaluate(() => scrollTo(0, 0));
        const result = await measure(page);
        const label = `${w}x${h} ${workspace}/${sub}`;
        if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${w}-${sub}.png`), fullPage: false }); }
        if (result.docOverflow > 1) result.problems.push(`page scrolls horizontally by ${result.docOverflow}px`);
        for (const p of result.problems) failures.push(`${label}: ${p}`);
        for (const [k, v] of Object.entries(result.sizes)) (sizeBook[k] ||= new Map()).set(label, v.join(","));
      }
      await context.close();
    }
    /* Same control, same size, on every screen. */
    for (const [k, byState] of Object.entries(sizeBook)) {
      const values = new Set([...byState.values()].filter(Boolean));
      if (values.size > 1) failures.push(`${k} height differs between screens: ${[...values].join(" | ")}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures.length) {
    const shown = failures.slice(0, 60);
    console.error(shown.join("\n") + (failures.length > shown.length ? `\n... and ${failures.length - shown.length} more` : ""));
    console.error(`\nLayout lock FAILED: ${failures.length} problem(s)`);
    process.exit(1);
  }
  console.log(`Layout lock verified: ${VIEWPORTS.length} viewports x ${SECTIONS.length} sections, no overlap, one gap, aligned edges, consistent control sizes.`);
})().catch(error => { console.error(error); process.exit(1); });
