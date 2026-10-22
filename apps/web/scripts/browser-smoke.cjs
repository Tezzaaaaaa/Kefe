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

(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push({ type: "pageerror", name: error.name, message: error.message, stack: error.stack || null }));
    page.on("console", (message) => {
      if (message.type() === "error" && /SyntaxError|Invalid or unexpected token/.test(message.text())) {
        pageErrors.push({ type: "console", message: message.text(), location: message.location() });
      }
    });

    await page.goto("http://127.0.0.1:4173/editor.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".beui-sidebar-nav-host button", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".beui-range-host", { state: "attached", timeout: 20000 });
    await page.waitForSelector("#beui-songTitle", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".kefe-panels-left", { state: "attached", timeout: 10000 });
    await page.waitForSelector(".kefe-vis-tabs", { state: "attached", timeout: 10000 });
    assert.equal(await page.locator(".kefe-section.active").getAttribute("data-panel"), "media",
      "the editor must start in Media, not switch itself to Visualisers");
    assert.equal(await page.locator(".kefe-vis-tabs").isVisible(), false,
      "visualiser tabs must stay hidden until the Visualisers section is opened");
    assert.equal(await page.locator("#kefeVisualiserHeading").textContent(), "Visualisers",
      "initialisation must not select Fluid Ink or change the visualiser heading");
    assert.equal(await page.locator(".beui-vis-backing-controls [data-visualiser='gradient']").getAttribute("aria-selected"), "false",
      "Fluid Ink must not be selected automatically on startup");
    assert.equal(await page.locator(".beui-vis-backing-controls [data-visualiser='gradient']").evaluate(tab => tab.classList.contains("primary")), false,
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
      const left = document.querySelector(".kefe-panels-left").getBoundingClientRect();
      const centre = document.querySelector(".kefe-work").getBoundingClientRect();
      const right = document.querySelector(".kefe-editing > .kefe-panels:not(.kefe-panels-left)").getBoundingClientRect();
      return { leftRight: left.right, centreLeft: centre.left, centreRight: centre.right, rightLeft: right.left };
    });
    assert.ok(desktopColumns.leftRight <= desktopColumns.centreLeft + 1,
      "left editor panel must stay left of the central preview");
    assert.ok(desktopColumns.centreRight <= desktopColumns.rightLeft + 1,
      "right editor panel must stay right of the central preview");
    await page.waitForSelector(".beui-textarea-host #beui-lyricsInput", { state: "attached", timeout: 20000 });
    assert.equal(await page.locator(".beui-textarea-host #beui-lyricsInput").count(), 1, "textarea bridge must not recursively mount its own component");
    await page.waitForFunction(() => {
      const expected = ["media", "lyrics", "effects", "background-effects", "visualiser", "export"];
      const panels = [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")];
      return panels.length === expected.length
        && expected.every((name) => panels.some((panel) => panel.dataset.panelView === name && panel.querySelector(".beui-editor-panel-card")));
    }, null, { timeout: 20000 });
    await page.waitForSelector("#kefeUploadZone .beui-upload-card", { state: "attached", timeout: 20000 });
    await page.waitForSelector("#kefeBgVideoZone", { state: "attached", timeout: 20000 });
    assert.equal(await page.locator("#kefeUploadZone").count(), 1, "there must be exactly one primary audio/video uploader");
    assert.equal(await page.locator("#kefeBgVideoZone").count(), 1, "there must be exactly one separate optional background-video uploader");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-card").count(), 1, "the primary uploader must not render duplicate Card shells");
    assert.equal(await page.locator("#kefeUploadZone .kefe-upload-title").textContent(), "Audio or video", "the primary uploader label must remain distinct");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-symbol").count(), 1, "the primary uploader must have one upload icon");
    assert.equal(await page.locator("#kefeUploadZone .kefe-upload-help").count(), 1, "the primary uploader must explain what the source media is used for");
    assert.equal(await page.locator("#kefeUploadZone .beui-upload-browse").count(), 1, "the primary uploader must have a visible Browse files affordance");
    assert.match(await page.locator("#kefeBgVideoZone .kefe-upload-title").textContent(), /Optional background video/, "the second uploader must be clearly identified as optional background footage");
    const mediaUploadGeometry = await page.evaluate(() => {
      const primaryHost = document.querySelector("#kefeUploadZone");
      const primaryCard = primaryHost && primaryHost.querySelector(".beui-upload-card");
      const backgroundCard = document.querySelector("#kefeBgVideoZone");
      if (!primaryHost || !primaryCard || !backgroundCard) return null;
      const hostStyle = getComputedStyle(primaryHost);
      const row = primaryHost.parentElement;
      const wrap = backgroundCard.parentElement;
      const primary = primaryCard.getBoundingClientRect();
      const background = backgroundCard.getBoundingClientRect();
      const rect = node => { const r = node.getBoundingClientRect(); const s = getComputedStyle(node); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,display:s.display,position:s.position,gridColumn:s.gridColumn,gridRow:s.gridRow,heightCss:s.height,minHeight:s.minHeight,marginTop:s.marginTop,transform:s.transform}; };
      const overlapX = Math.max(0, Math.min(primary.right, background.right) - Math.max(primary.left, background.left));
      const overlapY = Math.max(0, Math.min(primary.bottom, background.bottom) - Math.max(primary.top, background.top));
      return {
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
        row: rect(row), primaryHost: rect(primaryHost), primaryCard: rect(primaryCard), backgroundWrap: rect(wrap), backgroundCard: rect(backgroundCard)
      };
    });
    assert.ok(mediaUploadGeometry, "both Media upload cards must be mounted");
    assert.equal(mediaUploadGeometry.hostBorderWidth, "0px", "the primary uploader host must not add a duplicate outer border around the beUI Card");
    assert.equal(mediaUploadGeometry.hostPadding, "0px", "the primary uploader host must not add a second layer of padding around the beUI Card");
    assert.equal(mediaUploadGeometry.primaryGridRow, "auto", "the primary uploader must not span rows from the legacy Media grid");
    assert.equal(mediaUploadGeometry.backgroundGridRow, "auto", "the optional uploader wrapper must not span rows from the legacy Media grid");
    assert.equal(mediaUploadGeometry.overlapArea, 0, `the primary and background upload cards must never overlap: ${JSON.stringify(mediaUploadGeometry)}`);
    if (mediaUploadGeometry.rowWidth <= 500) {
      assert.equal(mediaUploadGeometry.rowColumnCount, 1, `narrow Media panels must stack upload cards instead of compressing them: ${JSON.stringify(mediaUploadGeometry)}`);
    }
    assert.ok(Math.abs(mediaUploadGeometry.primaryHeight - mediaUploadGeometry.backgroundHeight) <= 2,
      `the two Media upload cards must have matching heights: ${JSON.stringify(mediaUploadGeometry)}`);
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

    await page.locator("#beui-songTitle").fill("beUI smoke track");
    assert.equal(await page.locator("#songTitle").inputValue(), "beUI smoke track", "beUI Input should preserve the legacy metadata value and events");

    const panelCardCount = await page.locator(".kefe-editor .kefe-panel[data-panel-view] .beui-editor-panel-card").count();
    assert.equal(panelCardCount, 6, `all six editor sections must use beUI Card surfaces, found ${panelCardCount}`);

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
    const mediaPanel = page.locator(".kefe-panels-left .kefe-panel[data-panel-view='media']");
    const mediaHeading = mediaPanel.getByRole("heading", { name: "Media" });
    const mediaAccordion = mediaPanel.locator(".beui-accordion-trigger:not(.beui-native-panel-button)");
    await mediaHeading.waitFor({ state: "visible", timeout: 10000 });
    await mediaAccordion.waitFor({ state: "visible", timeout: 10000 });
    await mediaAccordion.click();
    assert.equal(await mediaAccordion.getAttribute("aria-expanded"), "false", "section accordion should enter collapsed state");
    const headingState = await mediaPanel.evaluate((panel) => {
      const heading = panel.querySelector(".kefe-panel-head");
      const title = heading?.querySelector("h2");
      const rect = (node) => {
        const box = node?.getBoundingClientRect();
        return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
      };
      return {
        panelClass: panel.className,
        panelDisplay: getComputedStyle(panel).display,
        panelRect: rect(panel),
        parentClass: panel.parentElement?.className,
        parentDisplay: panel.parentElement ? getComputedStyle(panel.parentElement).display : null,
        headingExists: Boolean(heading),
        headingHidden: heading?.hidden,
        headingDisplay: heading ? getComputedStyle(heading).display : null,
        headingVisibility: heading ? getComputedStyle(heading).visibility : null,
        headingRect: rect(heading),
        titleText: title?.textContent,
        titleDisplay: title ? getComputedStyle(title).display : null,
        titleVisibility: title ? getComputedStyle(title).visibility : null,
        titleRect: rect(title),
      };
    });
    assert.ok(await mediaHeading.isVisible(), `Media heading must remain visible in the desktop panel: ${JSON.stringify(headingState)}`);
    await mediaPanel.locator(".beui-editor-panel-card > .kefe-form").waitFor({ state: "hidden", timeout: 5000 });
    await mediaAccordion.click();
    assert.equal(await mediaAccordion.getAttribute("aria-expanded"), "true", "section accordion should expand again");
    await mediaPanel.locator(".beui-editor-panel-card > .kefe-form").waitFor({ state: "visible", timeout: 5000 });

    const sectionHeaderAudit = await page.evaluate(() => {
      const panels = [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")];
      return panels.map((panel) => {
        const row = panel.querySelector(".kefe-panel-head .kefe-section-heading-row");
        const info = row?.querySelector(".kefe-section-info");
        const accordion = row?.querySelector(".beui-accordion-trigger:not(.beui-native-panel-button)");
        const featureSwitch = row?.querySelector(".kefe-switch");
        return {
          section: panel.dataset.panelView,
          title: row?.querySelector("h2")?.textContent.trim(),
          info: Boolean(info),
          description: Boolean(row?.querySelector(".kefe-section-description")),
          tooltip: info?.dataset.tooltip || "",
          accordion: Boolean(accordion),
          featureSwitchInline: !featureSwitch || featureSwitch.closest(".kefe-section-heading-row") === row,
        };
      });
    });
    assert.equal(sectionHeaderAudit.length, 6, "all six sections should retain their own heading row");
    assert.ok(sectionHeaderAudit.every((item) => item.title && item.info && item.description && item.accordion),
      `every section must have a clean title, info tooltip and accordion control: ${JSON.stringify(sectionHeaderAudit)}`);
    assert.ok(sectionHeaderAudit.every((item) => item.featureSwitchInline),
      "section on/off switches must remain inside their heading row");
    assert.match(sectionHeaderAudit.find((item) => item.section === "media").tooltip, /Import audio or video/,
      "the Media instructions should be available through the info tooltip");

    const uniformHeaderGeometry = await page.evaluate(() => [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")].map(panel => {
      const head = panel.querySelector(".kefe-panel-head");
      const row = head?.querySelector(".kefe-section-heading-row");
      const title = row?.querySelector("h2");
      const info = row?.querySelector(".kefe-section-info");
      const accordion = row?.querySelector(".beui-accordion-trigger:not(.beui-native-panel-button)");
      const titleStyle = title && getComputedStyle(title);
      const rowRect = row?.getBoundingClientRect();
      const infoSize = info ? [info.offsetWidth, info.offsetHeight] : null;
      const accordionSize = accordion ? [accordion.offsetWidth, accordion.offsetHeight] : null;
      return {
        section: panel.dataset.panelView,
        titleSize: titleStyle?.fontSize,
        titleWeight: titleStyle?.fontWeight,
        titleLineHeight: titleStyle?.lineHeight,
        rowHeight: Math.round(rowRect?.height || 0),
        infoSize,
        accordionSize,
      };
    }));
    assert.equal(new Set(uniformHeaderGeometry.map(x => [x.titleSize,x.titleWeight,x.titleLineHeight,x.rowHeight,JSON.stringify(x.infoSize),JSON.stringify(x.accordionSize)].join("|"))).size, 1,
      `all six section headers must have identical typography and control geometry: ${JSON.stringify(uniformHeaderGeometry)}`);

    const sectionAccordions = page.locator(".kefe-panel[data-panel-view] .kefe-section-heading-row .beui-accordion-trigger:not(.beui-native-panel-button)");
    assert.equal(await sectionAccordions.count(), 6, "each section should have one visible accordion control");
    for (const accordion of await sectionAccordions.all()) {
      if (await accordion.getAttribute("aria-expanded") === "true") await accordion.click();
    }
    await page.waitForFunction(() => [...document.querySelectorAll(".kefe-panel[data-panel-view]")].every((panel) => !panel.style.height), null, { timeout: 5000 });
    const collapsedHeights = await page.evaluate(() => [...document.querySelectorAll(".kefe-panel[data-panel-view]")].map((panel) => panel.getBoundingClientRect().height));
    assert.ok(Math.max(...collapsedHeights) - Math.min(...collapsedHeights) <= 1,
      `all collapsed section cards should have the same height: ${JSON.stringify(collapsedHeights)}`);
    for (const accordion of await sectionAccordions.all()) {
      if (await accordion.getAttribute("aria-expanded") === "false") await accordion.click();
    }
    await page.waitForFunction(() => [...document.querySelectorAll(".kefe-panel[data-panel-view]")].every((panel) => !panel.style.height), null, { timeout: 5000 });
    await mediaPanel.locator(".beui-editor-panel-card > .kefe-form").waitFor({ state: "visible", timeout: 5000 });

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
    assert.equal(await volumePopover.locator(".beui-volume-card").count(), 1, "volume popover should use the beUI Card shell");
    await volumePopover.getByRole("slider", { name: "Audio volume" }).waitFor({ state: "visible", timeout: 5000 });
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

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Visualisers" }).click();
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
    const lyricsNavButton = page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Lyrics" });
    await lyricsNavButton.evaluate((button) => button.scrollIntoView({ block: "center", inline: "nearest" }));
    await lyricsNavButton.evaluate((button) => button.click());
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "lyrics", null, { timeout: 5000 });
    assert.equal(await page.locator(".beui-vis-tabs-host").isVisible(), false,
      "visualiser tabs must not appear on the Lyrics section");
    await assertSectionFits("lyrics");
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
    await page.locator(".beui-textarea-host #beui-lyricsInput").fill("beUI lyric smoke");
    assert.equal(await page.locator("#lyricsInput").inputValue(), "beUI lyric smoke", "beUI Textarea should preserve the legacy lyrics value and events");

    await page.keyboard.press("Control+k");
    const commandPalette = page.locator("#kefeCommandPalette");
    await commandPalette.waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await commandPalette.locator(".beui-command-dialog").count(), 1, "command palette should use the beUI Card shell");
    await page.locator("#kefeCommandInput").fill("Open Effects");
    const commandButton = page.locator(".beui-command-button-host button").filter({ hasText: "Open Effects" });
    await commandButton.waitFor({ state: "visible", timeout: 5000 });
    await commandButton.click();
    await commandPalette.waitFor({ state: "hidden", timeout: 5000 });
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "effects", null, { timeout: 5000 });
    await assertSectionFits("effects");

    assert.equal(await page.locator(".beui-vis-tabs-host").isVisible(), false,
      "visualiser tabs must not appear on the Effects section");

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Export" }).click();
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "export", null, { timeout: 5000 });
    await assertSectionFits("export");
    const exportLayout = await page.locator('.kefe-panel[data-panel-view="export"] .kefe-form').evaluate(form => ({
      width: form.getBoundingClientRect().width,
      columns: getComputedStyle(form).gridTemplateColumns.split(" ").length
    }));
    if (exportLayout.width <= 500) assert.equal(exportLayout.columns, 1,
      `export options must stack in a narrow panel: ${JSON.stringify(exportLayout)}`);

    const reviewCheckbox = page.locator("#beui-kefeReview0[role=checkbox]");
    await reviewCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await reviewCheckbox.click();
    assert.equal(await page.locator("#kefeReview0").evaluate((input) => input.checked), true, "beUI Checkbox should preserve the legacy checklist value");

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
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
