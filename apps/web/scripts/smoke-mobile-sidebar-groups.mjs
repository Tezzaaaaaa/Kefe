import { SECTION_BY_ID, SECTIONS, resolveGroups } from "../beui-src/mobile-sidebar-sections.js";

/**
 * Unit test for the mobile sidebar's control-group mapping.
 *
 * The sidebar never rewrites a panel: it tags the panel's own direct children
 * with a group id and hides the groups that are not selected. This test pins
 * that distribution — including the fallback behaviour for controls that other
 * KEFE modules append after mount, which must never be hidden or orphaned.
 */

class FakeElement {
  constructor(tag, options = {}) {
    this.tagName = tag.toUpperCase();
    this.id = options.id || "";
    this.classes = new Set(options.classes || []);
    this.children = [];
    this.classList = {
      contains: (name) => this.classes.has(name),
    };
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.classes.has(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  append(...nodes) {
    this.children.push(...nodes);
    return this;
  }
}

const el = (tag, options) => new FakeElement(tag, options);
const panelWithForm = (...controls) => {
  const panel = el("section", { classes: ["kefe-panel"] });
  const head = el("div", { classes: ["kefe-panel-head"] });
  const form = el("div", { classes: ["kefe-form"] });
  form.append(...controls);
  panel.append(head, form);
  return panel;
};

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const groupIds = (panel, sectionId) =>
  resolveGroups(panel, SECTION_BY_ID.get(sectionId)).map((group) => group.id);
const groupCount = (panel, sectionId, groupId) =>
  resolveGroups(panel, SECTION_BY_ID.get(sectionId)).find((group) => group.id === groupId)?.elements.length ?? 0;

/* ── Media: upload source vs. track details ─────────────────── */
{
  const upload = el("label", { id: "kefeUploadZone" });
  const track = el("div", { id: "kefeMediaTrack" });
  const suggestions = el("div", { id: "kefeSuggestions" });
  const uploadRow = el("div", { classes: ["kefe-media-upload-row"] });
  const metadata = [el("div"), el("div"), el("div"), el("div")];
  const panel = panelWithForm(upload, track, suggestions, uploadRow, ...metadata);
  const groups = resolveGroups(panel, SECTION_BY_ID.get("media"));
  expect(groups.map((group) => group.id).join(",") === "source,details",
    `media must expose Source then Details tabs: ${JSON.stringify(groupIds(panel, "media"))}`);
  expect(groups[0].elements.length === 3, "media Source tab must own the upload zone, track card and suggestions");
  expect(groups[1].elements.length === 5, "unmatched media controls must fall into the Details tab");
  expect(!groups.some((group) => group.elements.some((element) => element.classes.has("kefe-panel-head"))),
    "the panel heading must never be tagged as a control group");
}

/* ── Lyric Sync: lyrics vs. timing ──────────────────────────── */
{
  const textareaWrap = el("div").append(el("textarea", { id: "lyricsInput" }));
  const autoSync = el("section", { id: "kefeAutoSync" });
  const timing = el("div", { classes: ["kefe-lyrics-timing"] });
  const timingEditor = el("div", { id: "kefeTimingEditor" });
  const appendedLater = el("div", { classes: ["kefe-new-control"] });
  const panel = panelWithForm(textareaWrap, autoSync, timing, timingEditor, appendedLater);
  const groups = resolveGroups(panel, SECTION_BY_ID.get("lyrics"));
  expect(groups.map((group) => group.id).join(",") === "lyrics,timing,more",
    `lyric sync must expose Lyrics, Timing and a fallback: ${JSON.stringify(groupIds(panel, "lyrics"))}`);
  expect(groupCount(panel, "lyrics", "lyrics") === 2, "the lyrics textarea and auto-sync card belong to Lyrics");
  expect(groupCount(panel, "lyrics", "timing") === 2, "both timing blocks belong to Timing");
  expect(groupCount(panel, "lyrics", "more") === 1, "late-appended controls must land in the More tab");
}

/* ── Lyric Effects: effect, display and style ───────────────── */
{
  const gallery = el("div", { classes: ["kefe-background-effect-control", "kefe-lyric-effects-control"] });
  const font = el("div", { classes: ["kefe-font-selector-control"] });
  const display = el("div", { id: "kefeDisplayGroup", classes: ["kefe-lyric-settings"] });
  const style = el("div", { id: "kefeStyleGroup" });
  const panel = panelWithForm(gallery, font, display, style);
  expect(groupIds(panel, "effects").join(",") === "effect,display,style",
    `effects must expose Effect, Display and Style: ${JSON.stringify(groupIds(panel, "effects"))}`);
  expect(groupCount(panel, "effects", "effect") === 2, "the effect gallery and font selector belong to Effect");
  expect(groupCount(panel, "effects", "style") === 1, "the lyric style group belongs to Style");
}

/* ── Background: video, darkness and look ───────────────────── */
{
  const options = el("div", { id: "kefeBackgroundEffectOptions" });
  const background = el("div", { classes: ["kefe-background-effect-control"] }).append(
    el("select", { id: "visualiserBackground" }),
  );
  const video = el("div", { classes: ["beui-upload-wrap"] }).append(el("input", { id: "bgVideoInput" }));
  const darkness = el("div", { classes: ["kefe-background-effect-control"] }).append(
    el("input", { id: "backgroundTransparency" }),
  );
  const panel = panelWithForm(options, background, video, darkness);
  expect(groupIds(panel, "background-effects").join(",") === "video,darkness,look",
    `background must expose Video, Darkness and Look: ${JSON.stringify(groupIds(panel, "background-effects"))}`);
  expect(groupCount(panel, "background-effects", "video") === 1, "the background video uploader belongs to Video");
  expect(groupCount(panel, "background-effects", "darkness") === 1, "the darkness slider belongs to Darkness");
  expect(groupCount(panel, "background-effects", "look") === 2, "background choices fall back to Look");
}

/* ── Visualisers: the whole panel stays in one surface ──────── */
{
  const panel = el("section", { classes: ["kefe-panel"] });
  const head = el("div", { classes: ["kefe-panel-head"] });
  const tabs = el("div", { classes: ["kefe-vis-tabs"] });
  const form = el("div", { classes: ["kefe-form", "kefe-visualiser-form"] });
  panel.append(head, tabs, form);
  const groups = resolveGroups(panel, SECTION_BY_ID.get("visualiser"));
  expect(groups.length === 1 && groups[0].id === "visualiser",
    "the visualiser panel must stay a single surface (no tabs inside tabs)");
  expect(groups[0].elements.length === 2 && groups[0].elements[0] === tabs,
    "the visualiser panel must keep both its tab strip and its settings form");
}

/* ── Export: export controls vs. extra files ────────────────── */
{
  const format = el("select", { id: "exportFormat" });
  const resolution = el("select", { id: "exportResolution" });
  const button = el("button", { id: "exportButton" });
  const status = el("div", { id: "exportStatus" });
  const extras = el("div", { id: "kefeExportExtras" });
  const panel = panelWithForm(format, resolution, button, status, extras);
  expect(groupIds(panel, "export").join(",") === "video,extras,more",
    `export must expose Video, Files and More: ${JSON.stringify(groupIds(panel, "export"))}`);
  expect(groupCount(panel, "export", "video") === 3, "format, resolution and the export button belong to Video");
  expect(groupCount(panel, "export", "more") === 1, "the status line falls back to More");
}

/* ── Every section has a fallback group ─────────────────────── */
for (const section of SECTIONS) {
  const fallback = section.groups[section.groups.length - 1];
  expect(fallback && fallback.selectors.length === 0,
    `${section.id} must end with a selector-free fallback group`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS: mobile sidebar control groups map every native panel surface, and late-added controls fall back safely.");
