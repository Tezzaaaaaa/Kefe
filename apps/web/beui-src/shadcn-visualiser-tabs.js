/* KEFE — pure JavaScript + CSS shadcn.io visualiser gallery (Tabs + Card).
   The native visualiser buttons stay authoritative for rendering and power; this
   module presents one consistent gallery for every engine, including engines that
   register after the gallery has mounted. */

const VISUALISER_PRESENTATION = {
  gradient: {
    name: "Fluid Ink",
    icon: "≈",
    art: "fluid",
    order: 0,
    description: "Ink blooms, swirls and folds through the frame with the track.",
  },
  "liquid-glass": {
    name: "Liquid Glass",
    icon: "◌",
    art: "liquid-glass",
    order: 1,
    description: "A frosted glass layer that breathes with bass and transparency.",
  },
  fluted: {
    name: "Glass Lens",
    icon: "◇",
    art: "glass-lens",
    order: 2,
    description: "A refracted glass lens over your artwork or background video.",
  },
  "slow-light": {
    name: "Slow Light",
    icon: "☼",
    art: "slow-light",
    order: 3,
    description: "Slow, grainy light fields that drift between cinematic scenes.",
  },
  "silk-road": {
    name: "Silk Road",
    icon: "≋",
    art: "silk-road",
    order: 4,
    description: "Volumetric silk folds moving through a deep, fogged space.",
  },
  "visuals-mix": {
    name: "Visuals Mix",
    icon: "❖",
    art: "visuals-mix",
    order: 5,
    description: "Seven visual scenes and four finishes, mixed with the audio.",
  },
};

function cleanVisualiserLabel(button, fallback) {
  const raw =
    button.querySelector(".kefe-visualiser-tab-label")?.textContent ||
    button.textContent ||
    button.getAttribute("aria-label") ||
    button.title ||
    fallback;
  return (
    raw
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/\s+visuali[sz]er$/i, "")
      .trim() || fallback
  );
}

function findNativePowerSwitch(backingButton) {
  return backingButton?.closest(".kefe-vis-option")?.querySelector(".kefe-switch") || null;
}

function mountVisualiserTabs() {
  const nav = document.querySelector(".kefe-vis-tabs");
  if (!nav || nav.dataset.beuiMounted === "true") return;

  const backingButtons = new Map();
  nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach((button) => {
    if (button.classList.contains("kv-tab")) return;
    const id = button.dataset.visualiser;
    if (id) backingButtons.set(id, button);
  });
  if (!backingButtons.size) return;

  nav.dataset.beuiMounted = "true";
  /* The gallery owns the one tablist. The legacy container used to declare the
     same role, which would nest two tablists around the same cards. */
  nav.removeAttribute("role");

  /* Selection and power are one user action: the native renderers require both
     states before they paint. The hidden backing controls keep that contract. */
  let activating = false;
  document.addEventListener(
    "click",
    (event) => {
      if (activating) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".kv-tab")) return;

      const backingTab = target.closest(
        '.beui-vis-backing-controls [role="tab"][data-visualiser]',
      );
      if (backingTab) {
        const value = backingTab.dataset.visualiser;
        if (value) activeValue = value;
        const power = findNativePowerSwitch(backingTab);
        if (power && power.getAttribute("aria-checked") !== "true") {
          queueMicrotask(() => {
            if (power.isConnected && power.getAttribute("aria-checked") !== "true") {
              activating = true;
              power.click();
              activating = false;
            }
          });
        }
        syncAllStates();
        return;
      }

      const power = target.closest(".beui-vis-backing-controls .kefe-switch");
      if (power && power.getAttribute("aria-checked") !== "true") {
        const backingTabForPower = power
          .closest(".kefe-vis-option")
          ?.querySelector('[role="tab"][data-visualiser]');
        if (backingTabForPower && backingTabForPower.getAttribute("aria-selected") !== "true") {
          activating = true;
          backingTabForPower.click();
          activating = false;
        }
      }
    },
    true,
  );

  const backingHost = document.createElement("div");
  backingHost.className = "beui-vis-backing-controls";
  backingHost.hidden = true;
  backingHost.setAttribute("aria-hidden", "true");
  for (const button of backingButtons.values()) {
    const option = button.closest(".kefe-vis-option");
    backingHost.appendChild(option || button);
  }

  const host = document.createElement("div");
  host.className = "beui-vis-tabs-host";

  const grid = document.createElement("div");
  grid.setAttribute("role", "tablist");
  grid.setAttribute("aria-label", "Choose visualiser");
  grid.className = "kv-grid kv-gallery";

  /* Start unselected until the user explicitly clicks a visualiser card. */
  let activeValue = "";
  const cardsByValue = new Map();

  function syncAllStates() {
    const entries = [...cardsByValue.entries()];
    entries.forEach(([value, parts], index) => {
      const { card, tabBtn, switchBtn, switchState, status } = parts;
      const backing = backingButtons.get(value);
      const power = findNativePowerSwitch(backing);
      const selected = activeValue === value;
      const enabled = power?.getAttribute("aria-checked") === "true";

      card.classList.toggle("is-active", selected);
      card.dataset.state = selected ? "active" : "inactive";
      tabBtn.setAttribute("aria-selected", String(selected));
      tabBtn.dataset.state = selected ? "active" : "inactive";
      tabBtn.tabIndex = selected || (!activeValue && index === 0) ? 0 : -1;

      switchBtn.setAttribute("aria-checked", String(enabled));
      switchBtn.dataset.state = enabled ? "checked" : "unchecked";
      switchBtn.classList.toggle("is-on", enabled);
      const switchAction = `Turn ${card.dataset.label} ${enabled ? "off" : "on"}`;
      switchBtn.title = switchAction;
      switchBtn.setAttribute("aria-label", switchAction);
      if (switchState) switchState.textContent = enabled ? "On" : "Off";
      if (status) status.textContent = selected ? "Selected" : "Preview";
    });
  }

  function registerCard(backing, value) {
    if (!value || cardsByValue.has(value)) return;
    backingButtons.set(value, backing);
    const option = backing.closest(".kefe-vis-option");
    if ((option || backing).parentNode !== backingHost) {
      backingHost.appendChild(option || backing);
    }

    const fallback = cleanVisualiserLabel(backing, value);
    const meta = VISUALISER_PRESENTATION[value] || {};
    const label = meta.name || fallback;
    const description = meta.description || `${label} visualiser`;
    const icon = meta.icon || backing.dataset.icon || "";
    const art = meta.art || "generic";

    const card = document.createElement("article");
    card.className = "kv-card";
    card.dataset.slot = "card";
    card.setAttribute("role", "presentation");
    card.dataset.visualiser = value;
    card.dataset.label = label;
    card.style.order = String(meta.order ?? 99);

    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.setAttribute("role", "tab");
    tabBtn.dataset.visualiser = value;
    tabBtn.setAttribute("aria-selected", "false");
    tabBtn.className = "kv-tab";
    tabBtn.title = `${label} visualiser`;
    /* Keep the native backing tab's "… visualiser" aria-label unique. The visible
       label already names this trigger; screen readers get the same clean name. */
    tabBtn.setAttribute("aria-label", label);
    const controls = backing.getAttribute("aria-controls");
    if (controls) tabBtn.setAttribute("aria-controls", controls);

    const preview = document.createElement("span");
    preview.className = "kv-preview";
    preview.dataset.art = art;
    preview.setAttribute("aria-hidden", "true");

    const iconEl = document.createElement("span");
    iconEl.className = "kv-preview-icon";
    iconEl.textContent = icon;
    preview.appendChild(iconEl);

    const labelSpan = document.createElement("span");
    labelSpan.className = "kv-label";
    labelSpan.textContent = label;

    const descSpan = document.createElement("span");
    descSpan.className = "kv-desc";
    descSpan.textContent = description;

    const body = document.createElement("span");
    body.className = "kv-body";
    body.append(labelSpan, descSpan);
    tabBtn.append(preview, body);

    tabBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      activeValue = value;
      activating = true;
      backing.click();
      const power = findNativePowerSwitch(backing);
      if (power && power.getAttribute("aria-checked") !== "true") power.click();
      activating = false;
      syncAllStates();
    });

    const foot = document.createElement("span");
    foot.className = "kv-card-foot";

    const status = document.createElement("span");
    status.className = "kv-card-status";
    status.textContent = "Preview";

    const switchBtn = document.createElement("button");
    switchBtn.type = "button";
    switchBtn.setAttribute("role", "switch");
    switchBtn.setAttribute("aria-checked", "false");
    switchBtn.setAttribute("aria-label", `${label} visualiser`);
    switchBtn.className = "kv-power-switch";

    const switchState = document.createElement("span");
    switchState.className = "kv-power-state";
    switchState.textContent = "Off";

    const track = document.createElement("span");
    track.className = "kv-power-track";
    track.setAttribute("aria-hidden", "true");
    track.appendChild(document.createElement("span"));

    switchBtn.append(switchState, track);

    switchBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const power = findNativePowerSwitch(backing);
      if (!power) return;
      if (power.getAttribute("aria-checked") !== "true") {
        activeValue = value;
        activating = true;
        const selected = backing.getAttribute("aria-selected") === "true";
        if (!selected) backing.click();
        power.click();
        activating = false;
      } else {
        activating = true;
        power.click();
        activating = false;
      }
      syncAllStates();
    });

    foot.append(status, switchBtn);
    card.append(tabBtn, foot);
    grid.appendChild(card);
    cardsByValue.set(value, { card, tabBtn, switchBtn, switchState, status });
  }

  backingButtons.forEach((backing, value) => registerCard(backing, value));

  host.appendChild(grid);
  nav.prepend(host);
  nav.appendChild(backingHost);

  syncAllStates();

  function sweepLateBackingOptions() {
    let added = false;
    nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach((button) => {
      if (button.classList.contains("kv-tab")) return;
      const value = button.dataset.visualiser;
      if (!value) return;
      const option = button.closest(".kefe-vis-option");
      if (!cardsByValue.has(value)) {
        registerCard(button, value);
        added = true;
      } else if (option && option.parentNode !== backingHost) {
        backingHost.appendChild(option);
      }
    });
    if (added) syncAllStates();
  }

  const lateObserver = new MutationObserver(sweepLateBackingOptions);
  lateObserver.observe(nav, { childList: true });
  lateObserver.observe(grid, { childList: true });

  const observer = new MutationObserver(() => {
    const selectedEntry = [...backingButtons.entries()].find(
      ([, button]) => button.getAttribute("aria-selected") === "true",
    );
    if (selectedEntry) activeValue = selectedEntry[0];
    syncAllStates();
  });

  observer.observe(backingHost, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-checked", "class"],
  });

  grid.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const tabs = [...cardsByValue.values()].map((parts) => parts.tabBtn);
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    let next = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, current - 1);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(tabs.length - 1, current + 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    tabs[next]?.focus();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("load", mountVisualiserTabs, { once: true });
  document.addEventListener("click", (event) => {
    if (
      event.target instanceof Element &&
      event.target.closest('[data-shell-panel="visualiser"], .kefe-section[data-panel="visualiser"]')
    ) {
      window.setTimeout(mountVisualiserTabs, 0);
    }
  });
  if (document.readyState === "complete") {
    mountVisualiserTabs();
  }
}
