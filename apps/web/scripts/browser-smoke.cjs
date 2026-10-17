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

(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("http://127.0.0.1:4173/editor.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".beui-sidebar-nav-host button", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".beui-range-host", { state: "attached", timeout: 20000 });
    await page.waitForSelector("#beui-songTitle", { state: "attached", timeout: 20000 });
    await page.waitForSelector(".beui-textarea-host #beui-lyricsInput", { state: "attached", timeout: 20000 });
    assert.equal(await page.locator(".beui-textarea-host #beui-lyricsInput").count(), 1, "textarea bridge must not recursively mount its own component");
    await page.waitForFunction(() => {
      const panels = [...document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]")];
      return panels.length >= 5 && panels.every((panel) => panel.querySelector(".beui-editor-panel-card"));
    }, null, { timeout: 20000 });
    await page.waitForSelector("#kefeUploadZone .beui-upload-card", { state: "attached", timeout: 20000 });
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
    assert.ok(panelCardCount >= 5, `expected beUI Card surfaces for editor panels, found ${panelCardCount}`);

    const sidebarCount = await page.locator(".beui-sidebar-nav-host button").count();
    assert.ok(sidebarCount >= 7, `expected sidebar actions, found ${sidebarCount}`);

    await page.locator(".beui-sidebar-settings-host button").click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    assert.ok(await dialog.locator('[role="slider"]').count() > 0, "settings should use beUI sliders");
    assert.ok(await dialog.getByRole("switch").count() > 0, "settings should use the beUI switch");
    const switchControl = dialog.getByRole("switch").first();
    const beforeSwitch = await switchControl.getAttribute("aria-checked");
    await switchControl.click();
    assert.notEqual(await switchControl.getAttribute("aria-checked"), beforeSwitch, "beUI Switch should toggle");
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

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Lyrics" }).click();
    await page.waitForFunction(() => document.querySelector(".kefe-section.active")?.dataset.panel === "lyrics", null, { timeout: 5000 });
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

    await page.locator(".beui-sidebar-nav-host button").filter({ hasText: "Export" }).click();
    const reviewCheckbox = page.locator("#beui-kefeReview0[role=checkbox]");
    await reviewCheckbox.waitFor({ state: "visible", timeout: 10000 });
    await reviewCheckbox.click();
    assert.equal(await page.locator("#kefeReview0").evaluate((input) => input.checked), true, "beUI Checkbox should preserve the legacy checklist value");

    const firstCount = await page.locator(".beui-panel-button-host").count();
    await page.waitForTimeout(300);
    const secondCount = await page.locator(".beui-panel-button-host").count();
    assert.equal(secondCount, firstCount, "panel bridge must not recursively mount its own buttons");
    assert.deepEqual(pageErrors, [], `browser runtime errors: ${pageErrors.join("; ")}`);
    console.log("beUI browser smoke passed: built entry, controls, Settings dialog, Select, sidebar navigation, command palette, and panel bridge.");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
