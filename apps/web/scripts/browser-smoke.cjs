const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "dist-beui");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.resolve(root, `.${pathname}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let failureContext = { pageErrors: [] };

function makeWavBuffer(durationSeconds = 5, sampleRate = 8000) {
  const samples = Math.floor(durationSeconds * sampleRate);
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.2 * 32767);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  return buffer;
}

async function captureEditorLayout(page) {
  return page.evaluate(() => {
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    const describe = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const section = node.closest(".section[data-section-id]");
      const panel = node.closest(".kefe-panel[data-panel-view]");
      const chain = [];
      for (let current = node; current && current !== document.body && chain.length < 6; current = current.parentElement) {
        const id = current.id ? `#${current.id}` : "";
        const classes = [...current.classList].slice(0, 4).map(name => `.${name}`).join("");
        chain.push(`${current.tagName.toLowerCase()}${id}${classes}`);
      }
      return {
        path: chain.join(" < "), tag: node.tagName.toLowerCase(), id: node.id || "", classes: [...node.classList].join(" "),
        section: section?.dataset.sectionId || "", panel: panel?.dataset.panelView || "",
        text: (node.innerText || node.getAttribute("aria-label") || node.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 100),
        childCount: node.children.length, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        display: style.display, visibility: style.visibility, position: style.position, boxSizing: style.boxSizing,
        color: style.color, background: style.backgroundColor, boxShadow: style.boxShadow, opacity: style.opacity,
        font: style.font, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
        textTransform: style.textTransform, alignItems: style.alignItems, justifyContent: style.justifyContent,
        overflow: `${style.overflowX}/${style.overflowY}`, gridTemplateColumns: style.gridTemplateColumns,
        border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`, radius: style.borderTopLeftRadius,
        padding: style.padding, margin: style.margin, gap: style.gap,
        minWidth: style.minWidth, minHeight: style.minHeight, maxWidth: style.maxWidth, maxHeight: style.maxHeight,
      };
    };
    return [...document.querySelectorAll(".kefe-editor, .kefe-editor *")].map(describe).filter(item =>
      item.width > 0 && item.height > 0 && item.display !== "none" && item.visibility !== "hidden"
      && item.x < viewport.width && item.y < viewport.height && item.x + item.width > 0 && item.y + item.height > 0
    );
  });
}

async function normalizeEditorScrollState(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const node of document.querySelectorAll(".kefe-editor, .kefe-editor *")) {
      node.scrollTop = 0;
      node.scrollLeft = 0;
    }
  });
}

async function captureEditorScreenState(page) {
  return page.evaluate(() => {
    const describe = node => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(), id: node.id || "", classes: [...node.classList].join(" "),
        section: node.dataset.sectionId || node.closest(".section[data-section-id]")?.dataset.sectionId || "",
        group: node.dataset.group || "", panel: node.dataset.panelView || "",
        text: (node.innerText || node.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80),
        x: rect.x, y: rect.y, width: rect.width, height: rect.height, scrollTop: node.scrollTop,
        scrollLeft: node.scrollLeft, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
      };
    };
    return {
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      windowScroll: { x: window.scrollX, y: window.scrollY },
      documentScroll: { x: document.documentElement.scrollLeft, y: document.documentElement.scrollTop },
      activeSection: document.querySelector(".kefe-section.active")?.dataset.panel || "",
      expandedSettings: [...document.querySelectorAll(".section[data-section-id]")].filter(section => section.dataset.expanded !== "false").map(section => section.dataset.sectionId),
      scrollables: [...document.querySelectorAll(".kefe-editor, .kefe-editor *")].filter(node =>
        node.scrollHeight > node.clientHeight + 2 && node.getBoundingClientRect().width > 0
      ).map(describe),
      keyBounds: [...document.querySelectorAll(".kefe-settings-mount, #kefe-settings-panel, .kefe-settings-columns > .kefe-panel[data-group], .kefe-panel-label, .section[data-section-id], .kefe-panel[data-panel-view], .kefe-form")]
        .filter(node => node.getBoundingClientRect().width > 0).map(describe),
    };
  });
}

(async () => {
  let browser;
  let page;
  let pageErrors = [];
  try {
    await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    page = await context.newPage();
    failureContext = { page, pageErrors };
    page.on("pageerror", (error) => pageErrors.push({ type: "pageerror", name: error.name, message: error.message, stack: error.stack || null }));
    page.on("console", (message) => {
      if (message.type() === "error" && /SyntaxError|Invalid or unexpected token/.test(message.text())) {
        pageErrors.push({ type: "console", message: message.text(), location: message.location() });
      }
    });

    await page.goto("http://127.0.0.1:4173/editor.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".beui-sidebar-nav-host button", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".beui-range-host", { state: "attached", timeout: 20000 });
    await page.waitForSelector("#songTitle", { state: "visible", timeout: 20000 });
    await page.waitForSelector(".kefe-panels-left", { state: "attached", timeout: 10000 });
    await page.waitForSelector(".kefe-vis-tabs", { state: "attached", timeout: 10000 });
    try {
      await page.waitForFunction(() => {
        const root = document.querySelector("#kefe-settings-panel");
        const slots = root && [...root.querySelectorAll(".kefe-slot")];
        return root && root.closest(".kefe-editing.kefe-settings-layout") &&
          slots.length === 6 && slots.every(slot => slot.querySelector(".kefe-panel"));
      }, null, { timeout: 10000 });
    } catch (error) {
      const diagnostics = await page.evaluate(() => ({
        readyState: document.readyState,
        hasEditor: !!document.querySelector(".kefe-editing"),
        panelViews: [...document.querySelectorAll(".kefe-panel[data-panel-view]")].map(panel => panel.dataset.panelView),
        settingsApi: typeof window.kefeSettings,
        panelComponent: typeof window.KefeSettingsPanel,
        settingsScripts: [...document.scripts].filter(script => script.src.includes("/app/settings/")).map(script => script.src)
      }));
      throw new Error("Settings panel did not mount: " + JSON.stringify({ diagnostics, pageErrors, error: error.message }));
    }
    const timingNudge = page.locator('[data-setting="lyric-nudge"]');
    await timingNudge.evaluate(input => {
      input.value = "0.65";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => Math.abs(window.kefeSettings.get("lyricOffset") - 0.65) < 0.001, null, { timeout: 5000 });
    await timingNudge.evaluate(input => {
      input.value = "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => Math.abs(window.kefeSettings.get("lyricOffset")) < 0.001, null, { timeout: 5000 });

    // Exercise the editor toolbar against the real editor controls.
    const quickToolbar = page.locator("#kefeFloatingToolbar");
    assert.equal(await quickToolbar.count(), 1, "there must be exactly one editor toolbar");
    const initialToolbarPlacement = await page.evaluate(() => {
      const stage = document.querySelector(".kefe-stage").getBoundingClientRect();
      const toolbar = document.querySelector("#kefeFloatingToolbar").getBoundingClientRect();
      return { stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom }, toolbar: { left: toolbar.left, right: toolbar.right, top: toolbar.top, bottom: toolbar.bottom }, vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight };
    });
    const stageCentre = (initialToolbarPlacement.stage.left + initialToolbarPlacement.stage.right) / 2;
    const toolbarCentre = (initialToolbarPlacement.toolbar.left + initialToolbarPlacement.toolbar.right) / 2;
    assert.ok(Math.abs(stageCentre - toolbarCentre) <= 2 || initialToolbarPlacement.toolbar.left <= 9 || initialToolbarPlacement.toolbar.right >= initialToolbarPlacement.vw - 9,
      `toolbar should dock centred under the preview: ${JSON.stringify(initialToolbarPlacement)}`);
    assert.ok(initialToolbarPlacement.toolbar.top >= 0 && initialToolbarPlacement.toolbar.bottom <= initialToolbarPlacement.vh + 1,
      `toolbar must start fully on screen: ${JSON.stringify(initialToolbarPlacement)}`);
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const mobileToolbarBounds = await quickToolbar.evaluate(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, viewportWidth: document.documentElement.clientWidth };
    });
    assert.ok(mobileToolbarBounds.left >= 0 && mobileToolbarBounds.right <= mobileToolbarBounds.viewportWidth + 1,
      `mobile toolbar must remain inside the viewport: ${JSON.stringify(mobileToolbarBounds)}`);
    await quickToolbar.getByRole("button", { name: "Lyric text colour", exact: true }).click();
    const mobileColourPopover = page.locator(".kft-colour");
    await mobileColourPopover.waitFor({ state: "visible", timeout: 5000 });
    const mobilePopoverBounds = await mobileColourPopover.evaluate(node => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, viewportWidth: document.documentElement.clientWidth, viewportHeight: document.documentElement.clientHeight };
    });
    assert.ok(mobilePopoverBounds.left >= 0 && mobilePopoverBounds.right <= mobilePopoverBounds.viewportWidth + 1
      && mobilePopoverBounds.top >= 0 && mobilePopoverBounds.bottom <= mobilePopoverBounds.viewportHeight + 1,
      `mobile colour popover must stay inside the viewport: ${JSON.stringify(mobilePopoverBounds)}`);
    await page.keyboard.press("Escape");
    await page.setViewportSize(desktopViewport);
    await page.waitForTimeout(150);
    await page.waitForSelector("#kefeStyleGroup input[type=color]", { state: "attached", timeout: 10000 });

    await quickToolbar.getByRole("button", { name: "Lyric text colour", exact: true }).click();
    const colourMenu = page.locator(".kft-colour");
    await colourMenu.waitFor({ state: "visible", timeout: 5000 });
    await colourMenu.getByRole("button", { name: "#EF4444" }).click();
    assert.equal((await page.evaluate(() => window.kefeStyle.state().textColor)).toLowerCase(), "#ef4444",
      "colour swatches must update the canonical lyric text colour");
    const hex = colourMenu.locator(".kft-hex");
    await hex.fill("#A7E7FF");
    assert.equal((await page.evaluate(() => window.kefeStyle.state().textColor)).toLowerCase(), "#a7e7ff",
      "valid hex entry must update the canonical lyric text colour");
    await hex.fill("not-a-colour");
    await hex.evaluate(input => input.blur());
    assert.equal(await hex.inputValue(), "#A7E7FF", "invalid hex input must preserve the last valid colour");
    await page.keyboard.press("Escape");

    const trayToggle = quickToolbar.locator('button[aria-controls="kefeToolbarTray"]');
    await trayToggle.click();
    assert.equal(await quickToolbar.locator("#kefeToolbarTray").isVisible(), true, "More tools must reveal the grouped tray");
    assert.deepEqual(await quickToolbar.locator(".kft-group > .kft-label").allTextContents(), ["Lyrics", "Layer", "Canvas & background", "Preview & toolbar"],
      "the tray must group lyrics, layer and canvas/background controls");
    const quickSize = quickToolbar.locator('.kft-scrub[aria-label="Text size"]');
    await quickSize.focus();
    await page.keyboard.press("End");
    assert.equal(await page.evaluate(() => window.kefeStyle.state().scale), 160,
      "toolbar text-size control must update the canonical lyric-style setting");
    assert.equal(await page.locator("[data-layout-target]").count(), 1, "the editor must expose one canonical layer selector");
    assert.equal(await page.locator("[data-layout-scale]").count(), 1, "the editor must expose one canonical layer scale control");
    const layerScaleControl = quickToolbar.locator('.kft-scrub[aria-label="Layer scale"]');
    await layerScaleControl.focus();
    await page.keyboard.press("End");
    assert.equal(await page.locator("[data-layout-scale]").inputValue(), await page.locator("[data-layout-scale]").getAttribute("max"),
      "layer scale control must drive the canonical layer scale");
    const moveLayer = page.locator("[data-layout-move]");
    const moveTool = quickToolbar.locator("button.kft-btn--toggle").first();
    await moveTool.click();
    assert.equal(await moveLayer.getAttribute("aria-pressed"), "true", "Move must enter its active state");
    await moveTool.click();
    assert.equal(await moveLayer.getAttribute("aria-pressed"), "false", "Move must return to its inactive state");

    const lockToolbar = quickToolbar.getByRole("button", { name: /Lock position/ });
    await lockToolbar.click();
    assert.equal(await quickToolbar.evaluate(node => node.classList.contains("is-locked")), true, "toolbar position lock must engage");
    await quickToolbar.getByRole("button", { name: /Position locked/ }).click();
    assert.equal(await quickToolbar.evaluate(node => node.classList.contains("is-locked")), false, "toolbar position lock must disengage");
    await trayToggle.click();
    assert.equal(await quickToolbar.locator("#kefeToolbarTray").isVisible(), false, "the tray must collapse again");
    await quickToolbar.getByRole("button", { name: /^Lyric effect/ }).click();
    assert.ok(await page.locator('.kft-popover [role="option"]').count() > 1,
      "effect menu must be populated from the existing lyric effect gallery");
    assert.match(await page.locator('#lyricEffectOptions .kefe-lyric-effect-option[data-effect="premium"]').textContent(), /Devotion/,
      "the former Premium Circuit effect must be named Devotion");
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext("2d");
      if (typeof window.kefeEffects?.premium !== "function") throw new Error("Devotion renderer is not registered");
      window.kefeEffects.premium(ctx, 320, 180, {}, [{ text: "Devotion smoke", time: 0, endTime: 3 }], 1);
      if (ctx.getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error("Devotion did not render its background");
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".kefe-section.active").getAttribute("data-panel"), "media",
      "the editor must start in Media, not switch itself to Visualisers");
    assert.equal(await page.locator(".kefe-vis-tabs").isVisible(), false,
      "visualiser tabs must stay hidden until the Visualisers section is opened");
    assert.equal(await page.locator("#kefeVisualiserHeading").textContent(), "Visualisers",
      "initialisation must not select Fluid Ink or change the visualiser heading");
    assert.equal(await page.locator(".kefe-vis-tabs [data-visualiser='gradient'][aria-label='Fluid Ink visualiser']").getAttribute("aria-selected"), "false",
      "Fluid Ink must not be selected automatically on startup");
    assert.equal(await page.locator(".kefe-vis-tabs [data-visualiser='gradient'][aria-label='Fluid Ink visualiser']").evaluate(tab => tab.classList.contains("primary")), false,
      "Fluid Ink must not have the selected visual style on startup");
    const desktopLayout = await page.evaluate(() => {
      const nav = document.querySelector(".kefe-sidebar").getBoundingClientRect();
      const workspace = document.querySelector(".kefe-work").getBoundingClientRect();
      return {
        navBottom: nav.bottom,
        workspaceTop: workspace.top,
        navWidth: nav.width,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    assert.ok(desktopLayout.navBottom <= desktopLayout.workspaceTop + 1,
      `desktop navigation must sit above the workspace, got nav bottom ${desktopLayout.navBottom} and workspace top ${desktopLayout.workspaceTop}`);
    assert.ok(desktopLayout.navWidth >= desktopLayout.viewportWidth * 0.8,
      `desktop navigation should span the workspace width, got ${desktopLayout.navWidth}/${desktopLayout.viewportWidth}`);
    const headerNavigation = await page.evaluate(() => {
      const header = document.querySelector(".kefe-sidebar");
      const headerRect = header.getBoundingClientRect();
      const navs = [...header.querySelectorAll(".beui-sidebar-nav")];
      const links = [...header.querySelectorAll(".beui-sidebar-nav .kefe-sidebar-link")];
      return {
        navDisplays: navs.map((nav) => getComputedStyle(nav).display),
        linksWithinHeader: links.every((link) => {
          const rect = link.getBoundingClientRect();
          return rect.left >= headerRect.left - 1 && rect.right <= headerRect.right + 1;
        }),
      };
    });
    assert.ok(headerNavigation.navDisplays.length >= 2 && headerNavigation.navDisplays.every((display) => display === "flex"),
      `desktop beUI navigation groups must be horizontal flex rows: ${JSON.stringify(headerNavigation.navDisplays)}`);
    assert.ok(headerNavigation.linksWithinHeader, "desktop navigation links must not be clipped outside the header");
    const desktopColumns = await page.evaluate(() => {
      const left = document.querySelector('.kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group="input"]').getBoundingClientRect();
      const centre = document.querySelector(".kefe-work").getBoundingClientRect();
      const right = document.querySelector('.kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group="output"]').getBoundingClientRect();
      return { leftRight: left.right, centreLeft: centre.left, centreRight: centre.right, rightLeft: right.left, leftWidth: left.width, rightWidth: right.width };
    });
    assert.ok(desktopColumns.leftWidth > 0 && desktopColumns.rightWidth > 0,
      "both integrated settings panels must be visible");
    assert.ok(desktopColumns.leftRight <= desktopColumns.centreLeft + 1,
      "KEFE input panel must stay left of the central preview");
    assert.ok(desktopColumns.centreRight <= desktopColumns.rightLeft + 1,
      "Visual & Output panel must stay right of the central preview");
    await page.waitForSelector("#lyricsInput", { state: "visible", timeout: 20000 });
    assert.equal(await page.locator('label[for="lyricsInput"]').count(), 1, "native lyrics label association must remain in the DOM");
    await page.waitForFunction(() => {
      const expected = ["media", "lyrics", "effects", "background-effects", "visualiser", "export"];
      const panels = [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")];
      return panels.length === expected.length
        && expected.every((name) => panels.some((panel) => panel.dataset.panelView === name
          && panel.querySelector(":scope > .kefe-panel-head")
          && panel.querySelector(":scope > .kefe-form")))
        && panels.every((panel) => !panel.querySelector(".beui-editor-panel-card"));
    }, null, { timeout: 20000 });
    await page.waitForSelector("#kefeUploadZone.beui-upload-dropzone", { state: "visible", timeout: 20000 });
    await page.waitForSelector("#kefeBgVideoZone", { state: "attached", timeout: 20000 });
    assert.equal(await page.locator("#kefeUploadZone").count(), 1, "there must be exactly one primary audio/video uploader");
    assert.equal(await page.locator("#kefeBgVideoZone").count(), 1, "there must be exactly one separate optional background-video uploader");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-card").count(), 0, "the primary uploader must not wrap itself in a React Card");
    assert.equal(await page.locator("#kefeUploadZone.beui-upload-card-hosted").count(), 0, "the native upload label must not have a mirrored Card host");
    assert.equal(await page.locator("#kefeUploadZone .kefe-upload-title").textContent(), "Audio or video", "the primary uploader label must remain distinct");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-symbol").count(), 1, "the primary uploader must have one upload icon");
    assert.equal(await page.locator("#kefeUploadZone .kefe-upload-help").count(), 1, "the primary uploader must explain what the source media is used for");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-browse").count(), 1, "the primary uploader must have a visible Browse files affordance");
    assert.match(await page.locator("#kefeBgVideoZone .kefe-upload-title").textContent(), /Optional background video/, "the second uploader must be clearly identified as optional background footage");
    const mediaUploadGeometry = await page.evaluate(() => {
      const primaryHost = document.querySelector("#kefeUploadZone");
      const primaryInput = document.getElementById("mediaInput");
      const backgroundCard = document.querySelector("#kefeBgVideoZone");
      if (!primaryHost || !primaryInput || !backgroundCard) return null;
      const hostStyle = getComputedStyle(primaryHost);
      const row = primaryHost.parentElement;
      const wrap = backgroundCard.parentElement;
      const primary = primaryHost.getBoundingClientRect();
      const background = backgroundCard.getBoundingClientRect();
      const rect = node => { const r = node.getBoundingClientRect(); const s = getComputedStyle(node); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,display:s.display,position:s.position,gridColumn:s.gridColumn,gridRow:s.gridRow,heightCss:s.height,minHeight:s.minHeight,marginTop:s.marginTop,transform:s.transform}; };
      const overlapX = Math.max(0, Math.min(primary.right, background.right) - Math.max(primary.left, background.left));
      const overlapY = Math.max(0, Math.min(primary.bottom, background.bottom) - Math.max(primary.top, background.top));
      return {
        isLabel: primaryHost.tagName === "LABEL",
        inputRemainsAssociated: primaryInput.closest("label") === primaryHost,
        hasBridgeCard: !!primaryHost.querySelector(".beui-upload-card, .beui-upload-card-root"),
        hostBorderWidth: hostStyle.borderTopWidth,
        hostPadding: hostStyle.paddingTop,
        primaryGridRow: hostStyle.gridRow,
        backgroundGridRow: getComputedStyle(wrap).gridRow,
        primaryHeight: primary.height,
        backgroundHeight: background.height,
        overlapArea: overlapX * overlapY,
        rowWidth: row.getBoundingClientRect().width,
        rowColumns: getComputedStyle(row).gridTemplateColumns,
        rowColumnCount: getComputedStyle(row).gridTemplateColumns.split(" ").length,
        row: rect(row), primaryZone: rect(primaryHost), backgroundWrap: rect(wrap), backgroundZone: rect(backgroundCard)
      };
    });
    assert.ok(mediaUploadGeometry, "both native Media upload zones must be mounted");
    assert.equal(mediaUploadGeometry.isLabel, true, "the original upload label remains the visible drop target");
    assert.equal(mediaUploadGeometry.inputRemainsAssociated, true, "the native file input remains associated with the upload label");
    assert.equal(mediaUploadGeometry.hasBridgeCard, false, "the native upload zone must not contain a React Card wrapper");
    assert.ok(Number.parseFloat(mediaUploadGeometry.hostBorderWidth) > 0, "the visible native upload zone must own its dashed border");
    assert.ok(Number.parseFloat(mediaUploadGeometry.hostPadding) > 0, "the visible native upload zone must own its content spacing");
    assert.equal(mediaUploadGeometry.primaryGridRow, "auto", "the primary uploader must not span rows from the legacy Media grid");
    assert.equal(mediaUploadGeometry.backgroundGridRow, "auto", "the optional uploader wrapper must not span rows from the legacy Media grid");
    assert.equal(mediaUploadGeometry.overlapArea, 0, `the primary and background upload zones must never overlap: ${JSON.stringify(mediaUploadGeometry)}`);
    if (mediaUploadGeometry.rowWidth <= 500) {
      assert.equal(mediaUploadGeometry.rowColumnCount, 1, `narrow Media panels must stack upload zones instead of compressing them: ${JSON.stringify(mediaUploadGeometry)}`);
    }
    if (mediaUploadGeometry.rowColumnCount > 1) {
      assert.ok(Math.abs(mediaUploadGeometry.primaryHeight - mediaUploadGeometry.backgroundHeight) <= 2,
        `side-by-side Media upload zones must have matching heights: ${JSON.stringify(mediaUploadGeometry)}`);
    }
    const nativeUploadZone = page.locator("#kefeUploadZone");
    await nativeUploadZone.dispatchEvent("dragover");
    assert.equal(await nativeUploadZone.evaluate(zone => zone.classList.contains("is-dragging")), true,
      "native upload drop target should show drag-over state");
    await nativeUploadZone.dispatchEvent("dragleave");
    assert.equal(await nativeUploadZone.evaluate(zone => zone.classList.contains("is-dragging")), false,
      "native upload drop target should clear drag-over state");
    const dropHandoff = await page.evaluate((bytes) => {
      const input = document.getElementById("mediaInput");
      const zone = document.getElementById("kefeUploadZone");
      const file = new File([new Uint8Array(bytes)], "drop-smoke.wav", { type: "audio/wav" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      let changes = 0;
      const observeChange = () => { changes += 1; };
      input.addEventListener("change", observeChange);
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      input.removeEventListener("change", observeChange);
      return { changes, name: input.files[0]?.name, selected: zone.classList.contains("has-selected-file"), size: input.files[0]?.size, type: input.files[0]?.type };
    }, Array.from(makeWavBuffer(1)));
    assert.equal(dropHandoff.changes, 1, `native drop should forward a file change to KEFE: ${JSON.stringify(dropHandoff)}`);
    assert.equal(dropHandoff.name, "drop-smoke.wav", "native drop should preserve the dropped file in the original input");
    assert.equal(dropHandoff.size, makeWavBuffer(1).length, "native drop should preserve the dropped file bytes in the original input");
    assert.equal(dropHandoff.type, "audio/wav", "native drop should preserve the dropped file MIME type");
    assert.equal(dropHandoff.selected, true, "native drop should update the original upload surface state");
    await assertSectionFits("media");
    const mediaMetadataColumns = await page.locator(".kefe-details-grid").evaluate(grid => ({
      width: grid.getBoundingClientRect().width,
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length
    }));
    if (mediaMetadataColumns.width <= 500) assert.equal(mediaMetadataColumns.columns, 1,
      `metadata fields must stack inside a narrow Media panel: ${JSON.stringify(mediaMetadataColumns)}`);

    const initialVisualiserTabs = page.locator(".beui-vis-tabs-host");
    assert.ok((await initialVisualiserTabs.count()) === 0 || !(await initialVisualiserTabs.isVisible()),
      "visualiser tabs must not appear on the initial Media section");
    assert.equal(await page.locator("#mediaInput").getAttribute("type"), "file", "upload Card must preserve the native file input");
    await page.waitForFunction(() => {
      const ranges = [...document.querySelectorAll('input[type="range"]')].filter((input) => input.id !== "kefeTime");
      const selects = [...document.querySelectorAll("select")];
      return ranges.every((input) => input.nextElementSibling?.classList.contains("beui-range-host"))
        && selects.every((input) => input.nextElementSibling?.classList.contains("beui-select-host"));
    }, null, { timeout: 20000 });

    const nativeSongTitle = page.locator("#songTitle");
    assert.equal(await nativeSongTitle.getAttribute("aria-hidden"), null, "native metadata input must remain exposed to assistive technology");
    assert.equal(await nativeSongTitle.getAttribute("tabindex"), null, "native metadata input must remain in the normal keyboard sequence");
    assert.equal(await page.locator("#beui-songTitle").count(), 0, "metadata input must not have a mirrored React clone");
    await nativeSongTitle.fill("beUI smoke track");
    await page.waitForFunction(() => document.getElementById("kefeMediaTrackTitle")?.textContent === "beUI smoke track", null, { timeout: 5000 });
    assert.equal(await nativeSongTitle.inputValue(), "beUI smoke track", "native metadata input should update the live track card");

    const nativePanelSurfaceCount = await page.locator("#kefe-settings-panel .section[data-section-id]").evaluateAll(sections => sections.filter(section => {
      const style = getComputedStyle(section);
      return style.display !== "none" && style.borderRadius !== "0px" && style.borderTopWidth !== "0px";
    }).length);
    assert.equal(nativePanelSurfaceCount, 6, "all six native settings sections must retain their designed panel surfaces");
    const embeddedPanelStyle = await page.locator("#kefe-settings-panel .kefe-slot > .kefe-panel[data-panel-view]").evaluateAll(panels =>
      panels.map(panel => {
        const style = getComputedStyle(panel);
        return { position: style.position, display: style.display, flexDirection: style.flexDirection, gap: style.gap, padding: style.padding, borderWidth: style.borderTopWidth, borderColor: style.borderTopColor, borderRadius: style.borderTopLeftRadius };
      })
    );
    assert.equal(embeddedPanelStyle.length, 6, "all six editor panels should remain embedded once in their native settings slots");
    assert.ok(embeddedPanelStyle.every(style => style.position === "relative" && style.display === "flex" && style.flexDirection === "column" && style.gap === "0px"
      && style.padding === "10px" && style.borderWidth === "1px" && style.borderColor === "rgba(0, 0, 0, 0)" && style.borderRadius === "8px"),
      `embedded native panels must retain the former Card's vertical flex layout, zero gap, 10px inset, transparent border and 8px radius: ${JSON.stringify(embeddedPanelStyle)}`);
    assert.equal(await page.locator(".kefe-editor .kefe-panel[data-panel-view] .beui-editor-panel-card").count(), 0,
      "editor panels must not create parallel React Card wrappers");

    async function assertSectionFits(section) {
      const geometry = await page.locator(`.kefe-panel[data-panel-view="${section}"]`).evaluate(panel => {
        const form = panel.querySelector(".kefe-visualiser-form") || panel.querySelector(".kefe-form");
        const formRect = form.getBoundingClientRect();
        const children = [...form.children].filter(child => {
          const style = getComputedStyle(child);
          return !child.hidden && style.display !== "none" && style.display !== "contents";
        });
        const overflow = children.map(child => {
          const rect = child.getBoundingClientRect();
          return {className: child.className, left: rect.left, right: rect.right, width: rect.width};
        }).filter(item => item.left < formRect.left - 1 || item.right > formRect.right + 1);
        return {formWidth: formRect.width, clientWidth: form.clientWidth, scrollWidth: form.scrollWidth, overflow};
      });
      assert.equal(geometry.overflow.length, 0, `${section} controls must stay inside their form: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${section} form must not overflow horizontally: ${JSON.stringify(geometry)}`);
    }

    assert.equal(await page.locator('.kefe-panel[data-panel-view="effects"] .kefe-effects-background-group').count(), 0,
      "Effects must not retain the empty duplicate Background treatment container; background controls belong to Background Effects");
    assert.equal(await page.locator('#visualiserBackground').evaluate(el => el.closest('.kefe-panel[data-panel-view]')?.dataset.panelView), "background-effects",
      "the background selector must remain in Background Effects after removing the empty Effects container");
    assert.equal(await page.locator('#backgroundTransparency').evaluate(el => el.closest('.kefe-panel[data-panel-view]')?.dataset.panelView), "background-effects",
      "background darkness control must remain in Background Effects after cleanup");
    assert.equal(await page.locator('#lyricEffectOptions .kefe-lyric-effect-option').count() > 0, true,
      "Effects must retain its lyric-effect gallery after background-treatment cleanup");
    const mediaSection = page.locator('#kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group="input"] > .section[data-section-id="media"]');
    const mediaHeading = mediaSection.locator(".section-heading").first();
    const mediaAccordion = mediaSection.locator(".expand-button").first();
    await mediaHeading.waitFor({ state: "visible", timeout: 10000 });
    await mediaAccordion.waitFor({ state: "visible", timeout: 10000 });
    await mediaAccordion.click();
    assert.equal(await mediaAccordion.getAttribute("aria-expanded"), "false", "Media section should collapse");
    await page.waitForFunction(() => {
      const section = document.querySelector('#kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group="input"] > .section[data-section-id="media"]');
      return section?.dataset.expanded === "false" &&
        section.querySelector(".section-content").getBoundingClientRect().height < 1;
    }, null, { timeout: 5000 });
    await mediaAccordion.click();
    assert.equal(await mediaAccordion.getAttribute("aria-expanded"), "true", "Media section should expand again");
    await page.waitForFunction(() => {
      const section = document.querySelector('#kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group="input"] > .section[data-section-id="media"]');
      return section?.dataset.expanded === "true" &&
        section.querySelector(".section-content").getBoundingClientRect().height > 1;
    }, null, { timeout: 5000 });

    const sectionHeaderAudit = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("#kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group] > .section[data-section-id]")];
      return sections.map(section => {
        const header = section.querySelector(".section-header");
        const title = section.querySelector(".section-heading");
        const info = header?.querySelector(".info-button");
        const description = header?.querySelector(".kefe-tooltip .kefe-tooltip-body");
        const accordion = header?.querySelector(".expand-button");
        return {
          section: section.dataset.sectionId,
          title: title?.textContent.trim(),
          info: Boolean(info),
          description: Boolean(description),
          tooltip: description?.textContent.trim() || "",
          accordion: Boolean(accordion)
        };
      });
    });
    assert.equal(sectionHeaderAudit.length, 6, "all six settings sections should be present");
    assert.ok(sectionHeaderAudit.every(item => item.title && item.info && item.description && item.accordion),
      `every settings section needs a title, info tooltip and accordion: ${JSON.stringify(sectionHeaderAudit)}`);
    assert.match(sectionHeaderAudit.find(item => item.section === "media").tooltip, /Import, replace, or remove files/,
      "Media instructions should be available through the info tooltip");

    const featureSwitchAudit = await page.evaluate(() => [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")].map(panel => {
      const row = panel.querySelector(".kefe-panel-head .kefe-section-heading-row");
      const featureSwitch = row?.querySelector(".kefe-switch");
      return {
        section: panel.dataset.panelView,
        featureSwitchInline: !featureSwitch || featureSwitch.closest(".kefe-section-heading-row") === row
      };
    }));
    assert.ok(featureSwitchAudit.every(item => item.featureSwitchInline),
      "existing feature switches must remain beside their section controls");

    const uniformHeaderGeometry = await page.evaluate(() => [...document.querySelectorAll("#kefe-settings-panel > .kefe-settings-columns > .kefe-panel[data-group] > .section[data-section-id]")].map(section => {
      const title = section.querySelector(".section-heading");
      const info = section.querySelector(".info-button");
      const accordion = section.querySelector(".expand-button");
      const titleStyle = title && getComputedStyle(title);
      return {
        section: section.dataset.sectionId,
        titleSize: titleStyle?.fontSize,
        titleWeight: titleStyle?.fontWeight,
        titleLineHeight: titleStyle?.lineHeight,
        infoSize: info ? [info.offsetWidth, info.offsetHeight] : null,
        accordionHeight: accordion ? accordion.offsetHeight : null
      };
    }));
    assert.equal(new Set(uniformHeaderGeometry.map(item =>
      [item.titleSize, item.titleWeight, item.titleLineHeight, JSON.stringify(item.infoSize)].join("|")
    )).size, 1, `settings section headings and controls must be consistent: ${JSON.stringify(uniformHeaderGeometry)}`);

    const sidebarCount = await page.locator(".beui-sidebar-nav-host button").count();
    assert.ok(sidebarCount >= 7, `expected sidebar actions, found ${sidebarCount}`);

    await page.locator(".beui-sidebar-settings-host button").click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    const settingAccordions = dialog.locator('button[aria-controls$="-content"]');
    assert.ok(await settingAccordions.count() >= 4, "settings groups should use the beUI Bouncy Accordion");
    await settingAccordions.filter({ hasText: "Engine" }).click();
    assert.equal(await settingAccordions.filter({ hasText: "Engine" }).getAttribute("aria-expanded"), "true", "settings accordion should open the selected group");
    assert.ok(await dialog.locator('[role="slider"]').count() > 0, "settings should use beUI sliders");
    await settingAccordions.filter({ hasText: "Title card" }).click();
    assert.equal(await settingAccordions.filter({ hasText: "Title card" }).getAttribute("aria-expanded"), "true", "the toggle-bearing settings group should open");
    assert.ok(await dialog.getByRole("switch").count() > 0, "settings should use the beUI switch");
    const switchControl = dialog.getByRole("switch").first();
    const beforeSwitch = await switchControl.getAttribute("aria-checked");
    await switchControl.click();
    assert.notEqual(await switchControl.getAttribute("aria-checked"), beforeSwitch, "beUI Switch should toggle");
    await settingAccordions.filter({ hasText: "Defaults" }).click();
    assert.equal(await settingAccordions.filter({ hasText: "Defaults" }).getAttribute("aria-expanded"), "true", "the select-bearing settings group should open");
    const selectTrigger = dialog.locator('button[aria-haspopup="listbox"]').first();
    await selectTrigger.click();
    const options = page.getByRole("option");
    assert.ok(await options.count() > 0, "beUI Select should expose its options");
    await options.first().click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 5000 });

    await page.locator(".beui-transport-host button[aria-controls=\"kefeVolumePopover\"]").click();
    const volumePopover = page.locator("#kefeVolumePopover");
    await volumePopover.waitFor({ state: "visible", timeout: 5000 });
    const volumeCardGeometry = await page.evaluate(() => {
      const popover = document.getElementById("kefeVolumePopover");
      const legacyPopover = document.createElement("div");
      legacyPopover.className = "kefe-volume-popover beui-volume-popover-native";
      legacyPopover.style.cssText = "position:fixed;left:-10000px;top:0;right:auto;bottom:auto;z-index:-1;display:flex;align-items:center;gap:10px;width:min(220px,calc(100vw - 24px));padding:0;border:0;border-radius:12px;background:transparent;color:inherit;box-shadow:none;visibility:hidden";
      const legacyCard = document.createElement("div");
      legacyCard.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:normal;width:100%;gap:7px;padding:10.5px;border:1px solid var(--shell-line,currentColor);border-radius:12px;background:var(--shell-panel,transparent);color:var(--shell-text,var(--text));box-shadow:0 16px 40px rgba(0,0,0,.28)";
      [...popover.childNodes].forEach((node) => legacyCard.append(node.cloneNode(true)));
      legacyPopover.appendChild(legacyCard);
      document.body.appendChild(legacyPopover);
      const measure = (node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          width: rect.width,
          height: rect.height,
          boxSizing: style.boxSizing,
          gap: style.gap,
          padding: style.padding,
          borderWidth: style.borderTopWidth,
          display: style.display,
          flexDirection: style.flexDirection,
          alignItems: style.alignItems,
          lineHeight: style.lineHeight,
          minHeight: style.minHeight,
        };
      };
      const legacy = {
        popover: measure(legacyPopover),
        card: measure(legacyCard),
        label: measure(legacyCard.querySelector("label")),
        slider: measure(legacyCard.querySelector("input[type=range]")),
        output: measure(legacyCard.querySelector("output")),
      };
      const native = {
        popover: measure(popover),
        label: measure(popover.querySelector("label")),
        slider: measure(popover.querySelector("input[type=range]")),
        output: measure(popover.querySelector("output")),
      };
      legacyPopover.remove();
      return { native, legacy };
    });
    console.log("Volume Card native/reference geometry:", JSON.stringify(volumeCardGeometry));
    assert.equal(volumeCardGeometry.native.popover.width, volumeCardGeometry.legacy.card.width,
      `native Card width should match the previous Card wrapper: ${JSON.stringify(volumeCardGeometry)}`);
    assert.equal(volumeCardGeometry.native.popover.height, volumeCardGeometry.legacy.card.height,
      `native Card height should match the previous Card wrapper: ${JSON.stringify(volumeCardGeometry)}`);
    assert.equal(await volumePopover.locator(".beui-volume-card, .beui-volume-card-root").count(), 0,
      "the native volume popover must not mount a duplicate React Card wrapper");
    assert.equal(await volumePopover.getAttribute("data-beui-mounted"), null,
      "the native volume popover must not retain a React bridge mount marker");
    const volumeCardStyle = await volumePopover.evaluate((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        theme: document.documentElement.dataset.theme || "night",
        display: style.display,
        flexDirection: style.flexDirection,
        alignItems: style.alignItems,
        gap: style.gap,
        padding: style.padding,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        borderRadius: style.borderTopLeftRadius,
        background: style.backgroundColor,
        color: style.color,
        boxShadow: style.boxShadow,
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    });
    assert.equal(volumeCardStyle.display, "flex", "native volume Card surface should use KEFE flex layout");
    assert.equal(volumeCardStyle.flexDirection, "column", "volume label, slider and output should retain Card column layout");
    assert.equal(volumeCardStyle.alignItems, "normal", "native volume Card should preserve the Card's default cross-axis alignment");
    assert.equal(volumeCardStyle.gap, "7px", "volume Card should retain the beUI gap-2 spacing at KEFE's 14px root size");
    assert.equal(volumeCardStyle.padding, "10.5px", "volume Card should retain the beUI p-3 spacing at KEFE's 14px root size");
    assert.equal(volumeCardStyle.borderWidth, "1px", "volume Card should retain its outline");
    assert.equal(volumeCardStyle.borderStyle, "solid", "volume Card should retain its outline style");
    assert.equal(volumeCardStyle.borderRadius, "12px", "volume Card should retain its rounded-xl corners");
    if (volumeCardStyle.theme === "day") {
      assert.notEqual(volumeCardStyle.background, "rgba(0, 0, 0, 0)", "day theme should retain the Card's configured shell surface");
    } else {
      assert.equal(volumeCardStyle.background, "rgba(0, 0, 0, 0)", "night theme should preserve the bridge's transparent fallback when shell surface tokens are absent");
    }
    assert.match(volumeCardStyle.boxShadow, /16px 40px/, "volume Card should retain its soft 16-by-40px shadow");
    const volumeSlider = volumePopover.getByRole("slider", { name: "Audio volume" });
    await volumeSlider.waitFor({ state: "visible", timeout: 5000 });

    // Save repeatable before/after images of the component and its surrounding layout.
    // CI uploads these per-commit so a native translation can be compared to this baseline.
    const screenshotDir = process.env.KEFE_SCREENSHOT_DIR;
    if (screenshotDir) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotLabel = process.env.KEFE_SCREENSHOT_LABEL || process.env.GITHUB_SHA?.slice(0, 12) || "local";
      const originalTheme = await page.locator("html").getAttribute("data-theme") || "night";
      const originalViewport = page.viewportSize();
      const desktopThemeSurfaces = new Map();
      for (const viewport of [originalViewport, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        for (const theme of ["night", "day"]) {
          await page.evaluate((nextTheme) => { document.documentElement.dataset.theme = nextTheme; }, theme);
          await page.waitForTimeout(400);
          const size = viewport.width <= 640 ? "mobile" : "desktop";
          const suffix = `${screenshotLabel}-${size}-${theme}`;
          const geometry = await volumePopover.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return { left: rect.left, right: rect.right, viewportWidth: document.documentElement.clientWidth, background: style.backgroundColor };
          });
          assert.ok(geometry.left >= -1 && geometry.right <= geometry.viewportWidth + 1,
            `volume Card must stay within the ${size} viewport: ${JSON.stringify(geometry)}`);
          if (theme === "day") {
            assert.notEqual(geometry.background, "rgba(0, 0, 0, 0)", "day volume Card must retain the configured shell surface");
          } else {
            assert.equal(geometry.background, "rgba(0, 0, 0, 0)", "night volume Card must preserve the legacy transparent fallback");
          }
          if (size === "desktop") desktopThemeSurfaces.set(theme, geometry.background);
          await normalizeEditorScrollState(page);
          const editorLayout = await captureEditorLayout(page);
          fs.writeFileSync(path.join(screenshotDir, `editor-layout-${size}-${theme}.json`), JSON.stringify(editorLayout));
          const editorScreenState = await captureEditorScreenState(page);
          fs.writeFileSync(path.join(screenshotDir, `editor-screen-state-${size}-${theme}.json`), JSON.stringify(editorScreenState));
          await page.screenshot({ path: path.join(screenshotDir, `editor-${suffix}.png`), animations: "disabled" });
          await volumePopover.screenshot({ path: path.join(screenshotDir, `volume-card-${suffix}.png`), animations: "disabled" });
        }
      }
      assert.notEqual(desktopThemeSurfaces.get("night"), desktopThemeSurfaces.get("day"),
        "volume Card should use the distinct KEFE day and night panel surfaces");
      await page.setViewportSize(originalViewport);
      await page.evaluate((nextTheme) => { document.documentElement.dataset.theme = nextTheme; }, originalTheme);
      await page.waitForTimeout(120);

      await volumeSlider.focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(() => document.getElementById("kefeVolume")?.value === "99", null, { timeout: 3000 });
      assert.equal(await page.locator("#kefeVolumeValue").textContent(), "99%", "volume slider keyboard input should update the native output");
      assert.ok(Math.abs(await page.locator("#kefeAudio").evaluate((audio) => audio.volume) - 0.99) < 0.001,
        "volume slider keyboard input should update native audio volume");
      await page.keyboard.press("End");
      await page.waitForFunction(() => document.getElementById("kefeVolume")?.value === "100", null, { timeout: 3000 });
    }

    await page.keyboard.press("Escape");
    await volumePopover.waitFor({ state: "hidden", timeout: 5000 });

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Background Effects" }).click();
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "background-effects", null, { timeout: 5000 });
    await assertSectionFits("background-effects");
    const backgroundOptionsLayout = await page.locator("#kefeBackgroundEffectOptions").evaluate(grid => ({
      width: grid.getBoundingClientRect().width,
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length
    }));
    if (backgroundOptionsLayout.width <= 360) assert.equal(backgroundOptionsLayout.columns, 1,
      `background effect cards must stack when the panel is narrow: ${JSON.stringify(backgroundOptionsLayout)}`);

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Visualiser" }).click();
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "visualiser", null, { timeout: 5000 });
    await page.waitForSelector(".beui-vis-tabs-host [role='tab']", { state: "attached", timeout: 10000 });
    assert.ok(await page.locator(".beui-vis-tabs-host [role='tab']").count() >= 1, "visualiser navigation should use beUI Tabs");
    assert.equal(await page.locator(".beui-vis-tabs-host [role='tab']").filter({ hasText: "Liquid Glass" }).count(), 1,
      "Liquid Glass must be available in the visualiser tab list");
    assert.equal(await page.locator(".beui-vis-tabs-host").isVisible(), true,
      "visualiser tabs must be visible while the Visualisers section is active");
    const visualiserTabGeometry = await page.locator(".beui-vis-tabs-host [role='tablist']").evaluate(list => {
      const rect = list.getBoundingClientRect();
      const tabs = [...list.querySelectorAll("[role='tab']")].map(tab => {
        const r = tab.getBoundingClientRect();
        return { text: tab.textContent.trim(), left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom };
      });
      const widths = tabs.map(tab => tab.width);
      return { display: getComputedStyle(list).display, width: rect.width, columns: getComputedStyle(list).gridTemplateColumns.split(" ").length, tabs,
        minWidth: Math.min(...widths), maxWidth: Math.max(...widths), viewportWidth: document.documentElement.clientWidth };
    });
    assert.equal(visualiserTabGeometry.display, "grid",
      `visualiser presets must use the shared grid layout: ${JSON.stringify(visualiserTabGeometry)}`);
    if (visualiserTabGeometry.width >= 388) {
      assert.ok(visualiserTabGeometry.columns >= 2,
        `visualiser cards must use multiple columns when two complete cards fit: ${JSON.stringify(visualiserTabGeometry)}`);
    } else {
      assert.equal(visualiserTabGeometry.columns, 1,
        `visualiser cards must keep each name and its toggle together when the panel is narrow: ${JSON.stringify(visualiserTabGeometry)}`);
    }
    assert.ok(visualiserTabGeometry.minWidth > 0 && visualiserTabGeometry.maxWidth - visualiserTabGeometry.minWidth < 8,
      `visualiser preset tabs must have consistent widths rather than bunching on one side: ${JSON.stringify(visualiserTabGeometry)}`);
    assert.ok(visualiserTabGeometry.tabs.every(tab => tab.left >= 0 && tab.right <= visualiserTabGeometry.viewportWidth + 1),
      `visualiser preset tabs must stay inside the viewport: ${JSON.stringify(visualiserTabGeometry)}`);
    assert.equal(await page.locator(".beui-vis-tabs-host [role='tab'][aria-selected='true']").count(), 0,
      "no visualiser tab should appear selected until the user chooses one");
    assert.equal(await page.locator(".beui-vis-backing-controls [data-visualiser='gradient']").getAttribute("aria-selected"), "false",
      "opening the Visualisers section must not automatically activate Fluid Ink");
    await page.locator(".beui-vis-tabs-host [role='tab']").filter({ hasText: "Fluid Ink" }).click();
    await assertSectionFits("visualiser");
    const visualiserParametersLayout = await page.locator(".kefe-fluid-settings").evaluate(grid => ({
      width: grid.getBoundingClientRect().width,
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length
    }));
    if (visualiserParametersLayout.width <= 500) assert.equal(visualiserParametersLayout.columns, 1,
      `visualiser parameters must use one column in a narrow panel: ${JSON.stringify(visualiserParametersLayout)}`);

    assert.equal(await page.locator(".beui-vis-tabs-host [role='tab'][aria-selected='true']").count(), 1,
      "selecting a visualiser should activate exactly one beUI tab");
    assert.equal(await page.locator(".beui-vis-tabs-host [role='tab'][aria-selected='true']").textContent().then((text) => text.includes("Fluid Ink")), true,
      "Fluid Ink should become selected only after an explicit click");
    assert.equal(await page.locator(".beui-vis-backing-controls [data-visualiser='gradient']").getAttribute("aria-selected"), "true",
      "Fluid Ink must activate only after the user selects its tab");
    const visualiserCards = page.locator(".beui-vis-tabs-host .kv-card");
    const visualiserCount = await visualiserCards.count();
    assert.ok(visualiserCount > 0, "the visualiser section must render its visualiser cards");
    assert.equal(await page.locator(".beui-vis-tabs-host [role='switch']").count(), visualiserCount,
      "each visualiser tab must have exactly one independent power toggle");
    for (let index = 0; index < visualiserCount; index += 1) {
      const card = visualiserCards.nth(index);
      const tab = card.locator("[role='tab']");
      const value = await tab.getAttribute("data-visualiser");
      const toggle = card.locator("[role='switch']");
      const nativePower = page.locator(`.beui-vis-backing-controls [data-visualiser="${value}"]`).locator("xpath=..").locator(".kefe-switch");
      assert.equal(await nativePower.count(), 1, `${value} must retain exactly one native power handler`);
      const initial = await nativePower.getAttribute("aria-checked");
      const visibleInitial = await toggle.getAttribute("aria-checked");
      assert.equal(visibleInitial, initial, `${value} toggle must display its real initial state`);
      await toggle.click();
      await page.waitForFunction(({ value, expected }) => {
        const native = document.querySelector(`.beui-vis-backing-controls [data-visualiser="${value}"]`)?.closest(".kefe-vis-option")?.querySelector(".kefe-switch");
        return native && native.getAttribute("aria-checked") !== expected;
      }, { value, expected: initial });
      assert.notEqual(await nativePower.getAttribute("aria-checked"), initial,
        `${value} toggle must change its own visualiser state`);
      await toggle.click();
      await page.waitForFunction(({ value, expected }) => {
        const native = document.querySelector(`.beui-vis-backing-controls [data-visualiser="${value}"]`)?.closest(".kefe-vis-option")?.querySelector(".kefe-switch");
        return native && native.getAttribute("aria-checked") === expected;
      }, { value, expected: initial });
    }
    assert.equal(await page.locator(".beui-vis-tabs-host [role='tab'][aria-selected='true']").count(), 1,
      "power toggles must not change the selected visualiser tab");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".kefe-sidebar").evaluate((sidebar) => { sidebar.scrollTop = 0; sidebar.scrollIntoView({ block: "start" }); });
    const lyricsNavButton = page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Lyric Sync" });
    await lyricsNavButton.evaluate((button) => button.scrollIntoView({ block: "center", inline: "nearest" }));
    await lyricsNavButton.evaluate((button) => button.click());
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "lyrics", null, { timeout: 5000 });
    assert.equal(await page.locator(".beui-vis-tabs-host").isVisible(), false,
      "visualiser tabs must not appear on the Lyrics section");
    await assertSectionFits("lyrics");
    if (await page.locator(".kefe-lyrics-timing").isVisible()) {
      const lyricsTimingLayout = await page.locator(".kefe-lyrics-timing-controls").evaluate(grid => ({
        width: grid.getBoundingClientRect().width,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        sliderRow: getComputedStyle(document.getElementById("lyricsTiming")).gridRow,
        earlierRow: getComputedStyle(document.getElementById("lyricsTimingEarlier")).gridRow,
        laterRow: getComputedStyle(document.getElementById("lyricsTimingLater")).gridRow
      }));
      if (lyricsTimingLayout.width <= 500) {
        assert.equal(lyricsTimingLayout.columns, 2, `lyrics timing must stack slider and step buttons in a narrow panel: ${JSON.stringify(lyricsTimingLayout)}`);
        assert.match(lyricsTimingLayout.sliderRow, /^1/);
        assert.match(lyricsTimingLayout.earlierRow, /^2/);
        assert.match(lyricsTimingLayout.laterRow, /^2/);
      }
    }
    const nativeLyrics = page.locator("#lyricsInput");
    assert.equal(await nativeLyrics.getAttribute("aria-hidden"), null, "native lyric textarea must remain exposed to assistive technology");
    assert.equal(await nativeLyrics.getAttribute("tabindex"), null, "native lyric textarea must remain in the normal keyboard sequence");
    assert.equal(await page.locator("#beui-lyricsInput").count(), 0, "lyrics textarea must not have a mirrored React clone");
    await nativeLyrics.fill("beUI lyric smoke");
    assert.equal(await nativeLyrics.inputValue(), "beUI lyric smoke", "native lyrics textarea should own the value and input events");

    await page.keyboard.press("Control+k");
    const commandPalette = page.locator("#kefeCommandPalette");
    await commandPalette.waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await commandPalette.locator(".beui-command-dialog").count(), 1, "command palette should use the beUI Card shell");
    await page.locator("#kefeCommandInput").fill("Open Lyric Effects");
    const commandButton = page.locator(".beui-command-button-host button").filter({ hasText: "Open Lyric Effects" });
    await commandButton.waitFor({ state: "visible", timeout: 5000 });
    await commandButton.evaluate(button => button.click());
    await commandPalette.waitFor({ state: "hidden", timeout: 5000 });
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "effects", null, { timeout: 5000 });
    await assertSectionFits("effects");

    assert.equal(await page.locator(".beui-vis-tabs-host").isVisible(), false,
      "visualiser tabs must not appear on the Effects section");

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Export" }).evaluate(button => button.click());
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "export", null, { timeout: 5000 });
    await assertSectionFits("export");
    const exportLayout = await page.locator('.kefe-panel[data-panel-view="export"] .kefe-form').evaluate(form => ({
      width: form.getBoundingClientRect().width,
      columns: getComputedStyle(form).gridTemplateColumns.split(" ").length
    }));
    if (exportLayout.width <= 500) assert.equal(exportLayout.columns, 1,
      `export options must stack in a narrow panel: ${JSON.stringify(exportLayout)}`);

    // Verify all six real settings-shell headings and embedded panels at phone widths.
    const panelDesktopViewport = page.viewportSize();
    const shellSectionIds = {
      media: "media",
      lyrics: "lyric-sync",
      effects: "lyric-effects",
      "background-effects": "background",
      visualiser: "visualisers",
      export: "export"
    };
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(100);
      for (const [section, label] of [
        ["media", "Media"], ["lyrics", "Lyric Sync"], ["effects", "Effects"],
        ["background-effects", "Background Effects"], ["visualiser", "Visualiser"], ["export", "Export"]
      ]) {
        const navButton = page.locator(".beui-sidebar-nav-host button").filter({ hasText: label }).first();
        await navButton.evaluate(button => button.click());
        await page.waitForFunction(expected => document.querySelector(".kefe-section.active")?.dataset.panel === expected, section, { timeout: 5000 });
        await assertSectionFits(section);
        const geometry = await page.locator(`.kefe-panel[data-panel-view="${section}"]`).evaluate((panel, shellId) => {
          const viewportWidth = document.documentElement.clientWidth;
          const panelRect = panel.getBoundingClientRect();
          const shellSection = document.querySelector(`#kefe-settings-panel .section[data-section-id="${shellId}"]`);
          const row = shellSection?.querySelector(".section-header");
          const title = shellSection?.querySelector(".section-heading");
          const control = shellSection?.querySelector(".info-button");
          const rect = node => {
            if (!node) return null;
            const r = node.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
          };
          const t = title?.getBoundingClientRect();
          const c = control?.getBoundingClientRect();
          return {
            viewportWidth, panel: rect(panel), panelScrollWidth: panel.scrollWidth, panelClientWidth: panel.clientWidth,
            row: rect(row), title: rect(title), control: rect(control),
            titleControlOverlap: Boolean(t && c && t.right > c.left + 1 && t.left < c.right - 1)
          };
        }, shellSectionIds[section]);
        assert.ok(geometry.panel.left >= -1 && geometry.panel.right <= width + 1,
          `${section} panel must stay within the ${width}px viewport: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.panelScrollWidth <= geometry.panelClientWidth + 1,
          `${section} panel must not overflow horizontally at ${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.row && geometry.title && geometry.title.width > 0,
          `${section} settings heading must render at ${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.row.left >= -1 && geometry.row.right <= width + 1,
          `${section} settings heading row must stay inside the ${width}px viewport: ${JSON.stringify(geometry)}`);
        assert.equal(geometry.titleControlOverlap, false,
          `${section} title and info control must not overlap at ${width}px: ${JSON.stringify(geometry)}`);
      }
    }
    await page.setViewportSize(panelDesktopViewport);
    await page.waitForTimeout(100);

    const reviewCheckbox = page.locator("#kefeReview0");
    await reviewCheckbox.waitFor({ state: "visible", timeout: 10000 });
    assert.equal(await reviewCheckbox.getAttribute("type"), "checkbox", "review checklist must use the original native checkbox");
    assert.equal(await reviewCheckbox.getAttribute("aria-hidden"), null, "native checklist checkbox must remain exposed to assistive technology");
    assert.equal(await page.locator("#beui-kefeReview0[role=checkbox]").count(), 0, "review checklist must not have a mirrored React clone");
    await reviewCheckbox.focus();
    await page.keyboard.press("Space");
    assert.equal(await reviewCheckbox.isChecked(), true, "native checkbox Space activation should update KEFE checklist state");

    const firstCount = await page.locator(".beui-panel-button-host").count();
    await page.waitForTimeout(300);
    const secondCount = await page.locator(".beui-panel-button-host").count();
    assert.equal(secondCount, firstCount, "panel bridge must not recursively mount its own buttons");

    await page.locator("#mediaInput").setInputFiles({
      name: "beui-smoke.wav",
      mimeType: "audio/wav",
      buffer: makeWavBuffer(),
    });
    await page.waitForFunction(() => {
      const audio = document.getElementById("kefeAudio");
      const track = document.getElementById("kefeMediaTrack");
      return audio && audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0 && track && !track.hidden;
    }, null, { timeout: 15000 });
    assert.ok(Number(await page.locator("#kefeTime").getAttribute("max")) >= 4.9, "timeline should use decoded media duration");
    await page.locator(".beui-transport-host button[aria-label=\"Play\"]").click();
    await page.waitForFunction(() => document.getElementById("kefeAudio")?.paused === false, null, { timeout: 5000 });
    await page.locator(".beui-transport-host button[aria-label=\"Pause\"]").click();
    await page.waitForFunction(() => document.getElementById("kefeAudio")?.paused === true, null, { timeout: 5000 });

    await page.locator("#mediaInput").setInputFiles({
      name: "beui-smoke.lrc",
      mimeType: "text/plain",
      buffer: Buffer.from("[00:00.00]Smoke line one\n[00:02.00]Smoke line two\n", "utf8"),
    });
    await page.waitForFunction(() => document.getElementById("kefeLyricsStatus")?.textContent.includes("Loaded lyrics from beui-smoke.lrc"), null, { timeout: 10000 });

    assert.deepEqual(pageErrors, [], `browser runtime errors: ${JSON.stringify(pageErrors)}`);
    console.log("beUI browser smoke passed: component conversion, media loading/playback, and LRC upload.");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch(async (error) => {
  const diagnosticDir = process.env.KEFE_SCREENSHOT_DIR;
  if (diagnosticDir) {
    try {
      fs.mkdirSync(diagnosticDir, { recursive: true });
      const diagnostics = {
        name: error.name,
        message: error.message,
        stack: error.stack || null,
        url: failureContext.page?.url() || null,
        pageErrors: failureContext.pageErrors || [],
      };
      fs.writeFileSync(path.join(diagnosticDir, "browser-smoke-error.json"), JSON.stringify(diagnostics, null, 2));
      if (failureContext.page && !failureContext.page.isClosed()) {
        await failureContext.page.screenshot({ path: path.join(diagnosticDir, "browser-smoke-error.png"), fullPage: true, animations: "disabled" })
          .catch((screenshotError) => console.error("Could not capture failure screenshot:", screenshotError));
      }
    } catch (diagnosticError) {
      console.error("Could not write browser smoke diagnostics:", diagnosticError);
    }
  }
  console.error(error);
  process.exit(1);
});
