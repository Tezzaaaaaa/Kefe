/* KEFE mobile editor sidebar — section and control-group map.
   Kept free of React and DOM-construction so the mapping can be unit tested
   (`scripts/smoke-mobile-sidebar-groups.mjs`) and shared with the sidebar UI.

   `container` names the element whose direct children are distributed into
   control groups: `form` = the panel's `.kefe-form`, `panel` = the whole
   section panel. Groups are listed in tab order; the final group in each
   section has no selectors and acts as the fallback, so controls other KEFE
   modules append later are never orphaned or hidden. */

export const SECTIONS = [
  {
    id: "media",
    label: "Media",
    short: "Media",
    icon: "folder",
    blurb: "Import audio or video, identify the track and confirm its details.",
    container: "form",
    groups: [
      {
        id: "source",
        label: "Source",
        icon: "upload",
        selectors: [
          "#kefeUploadZone",
          "#kefeMediaTrack",
          "#kefeSuggestions",
          ".kefe-media-carousel",
          ".beui-horizontal-carousel",
        ],
      },
      { id: "details", label: "Details", icon: "music", selectors: [] },
    ],
  },
  {
    id: "lyrics",
    label: "Lyric Sync",
    short: "Lyrics",
    icon: "list",
    blurb: "Find, import and time the lyrics that drive the preview.",
    container: "form",
    groups: [
      { id: "lyrics", label: "Lyrics", icon: "file", selectors: ["#lyricsInput", "#kefeAutoSync"] },
      {
        id: "timing",
        label: "Timing",
        icon: "clock",
        selectors: ["#lyricsTiming", "#kefeTimingEditor", ".kefe-lyrics-timing"],
      },
      { id: "more", label: "More", icon: "sliders", selectors: [] },
    ],
  },
  {
    id: "effects",
    label: "Lyric Effects",
    short: "Effects",
    icon: "sparkles",
    blurb: "Pick an effect, then tune the display mode, font and lyric style.",
    container: "form",
    groups: [
      {
        id: "effect",
        label: "Effect",
        icon: "sparkles",
        selectors: [".kefe-lyric-effects-control", ".kefe-font-selector-control", ".kefe-font-card"],
      },
      {
        id: "display",
        label: "Display",
        icon: "type",
        selectors: ["#kefeDisplayGroup", ".kefe-lyric-settings", ".kefe-case-control"],
      },
      { id: "style", label: "Style", icon: "palette", selectors: ["#kefeStyleGroup"] },
      { id: "more", label: "More", icon: "sliders", selectors: [] },
    ],
  },
  {
    id: "background-effects",
    label: "Background",
    short: "Backdrop",
    icon: "image",
    blurb: "Choose the canvas backdrop, add video footage and set darkness.",
    container: "form",
    groups: [
      {
        id: "video",
        label: "Video",
        icon: "video",
        selectors: ["#kefeBgVideoZone", ".beui-upload-wrap", "#bgVideoInput"],
      },
      { id: "darkness", label: "Darkness", icon: "moon", selectors: ["#backgroundTransparency"] },
      { id: "look", label: "Look", icon: "palette", selectors: [] },
    ],
  },
  {
    id: "visualiser",
    label: "Visualisers",
    short: "Visuals",
    icon: "activity",
    blurb: "Switch visualiser engines and tune the active one.",
    container: "panel",
    groups: [{ id: "visualiser", label: "Visualiser", icon: "activity", selectors: [] }],
  },
  {
    id: "export",
    label: "Export",
    short: "Export",
    icon: "download",
    blurb: "Set the format and resolution, then export your lyric video.",
    container: "form",
    groups: [
      {
        id: "video",
        label: "Video",
        icon: "download",
        selectors: ["#exportFormat", "#exportResolution", "#exportButton", "#exportStatus"],
      },
      { id: "extras", label: "Files", icon: "file", selectors: ["#kefeExportExtras"] },
      { id: "more", label: "More", icon: "sliders", selectors: [] },
    ],
  },
];

export const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

/** Settings-shell slot that hosts each native panel. */
export const MIGRATED_SLOTS = {
  media: "media",
  lyrics: "lyric-sync",
  effects: "lyric-effects",
  "background-effects": "background",
  visualiser: "visualisers",
  export: "export",
};

export function elementMatches(element, selectors) {
  return selectors.some((selector) => {
    try {
      return element.matches(selector) || Boolean(element.querySelector(selector));
    } catch (_) {
      return false;
    }
  });
}

/** Direct children of a panel's control container, minus the panel heading. */
export function controlElements(panel, section) {
  if (!panel) return [];
  const container = section.container === "panel"
    ? panel
    : panel.querySelector(".kefe-form") || panel.querySelector(".kefe-visualiser-form") || panel;
  return Array.from(container.children).filter(
    (element) => !element.classList.contains("kefe-panel-head") && element.tagName !== "H2",
  );
}

/**
 * Distribute the live control elements into the section's control groups.
 * Controls that no selector claims fall into the trailing fallback group.
 */
export function resolveGroups(panel, section) {
  const elements = controlElements(panel, section);
  const buckets = new Map(section.groups.map((group) => [group.id, []]));
  const fallback = section.groups[section.groups.length - 1];

  for (const element of elements) {
    const group = section.groups.find(
      (candidate) => candidate.selectors.length > 0 && elementMatches(element, candidate.selectors),
    ) || fallback;
    buckets.get(group.id)?.push(element);
  }

  return section.groups
    .map((group) => ({ ...group, elements: buckets.get(group.id) || [] }))
    .filter((group) => group.elements.length > 0);
}
