/* KEFE — Pure JavaScript + CSS shadcn.io Visualiser Selector (Card + Tabs + Switch).
   Replaces the React visualiser tabs bridge while keeping the native backing buttons
   and .kefe-switch power controls authoritative. */

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

  /* Selection and power are one user action: the native renderers require both
     states before they paint. Delegation also covers the preview toolbar. */
  let activating = false;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || activating) return;
      const tab = target.closest('.kefe-vis-tabs [role="tab"][data-visualiser]');
      if (tab) {
        const power = tab.closest(".kefe-vis-option")?.querySelector(".kefe-switch");
        if (power && power.getAttribute("aria-checked") !== "true") {
          queueMicrotask(() => {
            if (power.isConnected && power.getAttribute("aria-checked") !== "true") {
              activating = true;
              power.click();
              activating = false;
            }
          });
        }
        return;
      }
      const power = target.closest(".kefe-vis-option .kefe-switch");
      if (power && power.getAttribute("aria-checked") !== "true") {
        const backingTab = power.closest(".kefe-vis-option")?.querySelector('[role="tab"][data-visualiser]');
        if (backingTab && backingTab.getAttribute("aria-selected") !== "true") {
          activating = true;
          backingTab.click();
          activating = false;
        }
      }
    },
    true,
  );

  const backingButtons = new Map();
  nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach((button) => {
    const id = button.dataset.visualiser;
    if (id) backingButtons.set(id, button);
  });
  if (!backingButtons.size) return;

  nav.dataset.beuiMounted = "true";

  const backingHost = document.createElement("div");
  backingHost.className = "beui-vis-backing-controls";
  backingHost.hidden = true;
  backingHost.setAttribute("aria-hidden", "true");
  while (nav.firstChild) {
    backingHost.appendChild(nav.firstChild);
  }

  const host = document.createElement("div");
  host.className = "beui-vis-tabs-host";

  const grid = document.createElement("div");
  grid.setAttribute("role", "tablist");
  grid.setAttribute("aria-label", "Choose visualiser");
  grid.className = "kv-grid shad-vis-grid";

  // Start unselected until the user explicitly clicks a visualiser tab.
  let activeValue = "";
  const cardsByValue = new Map();

  function syncAllStates() {
    cardsByValue.forEach(({ card, tabBtn, switchBtn, switchState }, value) => {
      const backing = backingButtons.get(value);
      const power = findNativePowerSwitch(backing);
      const selected = activeValue === value;
      const enabled = power?.getAttribute("aria-checked") === "true";

      card.classList.toggle("is-active", selected);
      card.dataset.state = selected ? "active" : "inactive";
      tabBtn.setAttribute("aria-selected", String(selected));
      tabBtn.dataset.state = selected ? "active" : "inactive";

      switchBtn.setAttribute("aria-checked", String(enabled));
      switchBtn.dataset.state = enabled ? "checked" : "unchecked";
      switchBtn.classList.toggle("is-on", enabled);
      switchBtn.title = `Turn ${card.dataset.label} ${enabled ? "off" : "on"}`;
      if (switchState) switchState.textContent = enabled ? "On" : "Off";
    });
  }

  backingButtons.forEach((backing, value) => {
    const label = cleanVisualiserLabel(backing, value);

    const card = document.createElement("div");
    card.className = "kv-card shad-vis-card";
    card.dataset.slot = "card";
    card.dataset.label = label;

    const tabBtn = document.createElement("button");
    tabBtn.type = "button";
    tabBtn.setAttribute("role", "tab");
    tabBtn.dataset.visualiser = value;
    tabBtn.setAttribute("aria-selected", "false");
    tabBtn.className = "kv-tab shad-vis-tab";
    tabBtn.title = `${label} visualiser`;

    const labelSpan = document.createElement("span");
    labelSpan.className = "kv-label";
    labelSpan.textContent = label;
    tabBtn.appendChild(labelSpan);

    tabBtn.addEventListener("click", () => {
      activeValue = value;
      backing.click();
      const power = findNativePowerSwitch(backing);
      if (power && power.getAttribute("aria-checked") !== "true") power.click();
      syncAllStates();
    });

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
        backing.click();
      }
      power.click();
      syncAllStates();
    });

    card.append(tabBtn, switchBtn);
    grid.appendChild(card);
    cardsByValue.set(value, { card, tabBtn, switchBtn, switchState });
  });

  host.appendChild(grid);
  nav.append(host, backingHost);

  syncAllStates();

  const observer = new MutationObserver(() => {
    const selectedEntry = [...backingButtons.entries()].find(
      ([, button]) => button.getAttribute("aria-selected") === "true",
    );
    if (selectedEntry) {
      activeValue = selectedEntry[0];
    }
    syncAllStates();
  });

  observer.observe(backingHost, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-checked", "class"],
  });
}

if (typeof window !== "undefined") {
  const boot = () => {
    mountVisualiserTabs();
    if (!document.querySelector('.kefe-vis-tabs[data-beui-mounted="true"]')) {
      const obs = new MutationObserver(() => {
        if (document.querySelector(".kefe-vis-tabs")) {
          mountVisualiserTabs();
          if (document.querySelector('.kefe-vis-tabs[data-beui-mounted="true"]')) {
            obs.disconnect();
          }
        }
      });
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
