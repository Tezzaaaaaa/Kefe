import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./legacy-bridge.css";

function VisualiserTabs({ backingButtons }) {
  const [active, setActive] = useState(
    [...backingButtons.values()].find((button) => button.getAttribute("aria-selected") === "true")?.dataset.visualiser || "",
  );
  const [powerStates, setPowerStates] = useState({});

  function nativePower(value) {
    return backingButtons.get(value)?.closest(".kefe-vis-option")?.querySelector(".kefe-switch") || null;
  }

  function syncPower(value) {
    const power = nativePower(value);
    if (power) {
      setPowerStates((current) => ({ ...current, [value]: power.getAttribute("aria-checked") === "true" }));
    }
  }

  useEffect(() => {
    for (const [value, backing] of backingButtons) {
      const power = backing.closest(".kefe-vis-option")?.querySelector(".kefe-switch");
      if (power) {
        setPowerStates((current) => ({ ...current, [value]: power.getAttribute("aria-checked") === "true" }));
      }
    }
  }, [backingButtons]);

  useEffect(() => {
    const sync = (event) => {
      const button = event.target?.closest?.(".kefe-vis-tabs button[data-visualiser]");
      if (button && backingButtons.has(button.dataset.visualiser)) {
        setActive(button.dataset.visualiser);
        window.setTimeout(() => syncPower(button.dataset.visualiser), 0);
      }
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, [backingButtons]);

  function select(value) {
    backingButtons.get(value)?.click();
    setActive(value);
    window.setTimeout(() => syncPower(value), 0);
  }

  function toggle(value, event) {
    event.stopPropagation();
    const power = nativePower(value);
    if (!power) return;
    power.click();
    setPowerStates((current) => ({ ...current, [value]: power.getAttribute("aria-checked") === "true" }));
  }

  return (
    <div role="tablist" aria-label="Choose visualiser" className="kv-grid">
      {[...backingButtons.entries()].map(([value, backing]) => {
        const rawLabel = backing.querySelector(".kefe-visualiser-tab-label")?.textContent
          || backing.textContent || backing.getAttribute("aria-label") || backing.title || value;
        const label = rawLabel.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+visuali[sz]er$/i, "").trim() || value;
        const selected = active === value;
        const enabled = powerStates[value] === true;
        return (
          <div key={value} className={`kv-card${selected ? " is-active" : ""}`}>
            <button
              type="button"
              role="tab"
              data-visualiser={value}
              aria-selected={selected}
              className="kv-tab"
              title={`${label} visualiser`}
              onClick={() => select(value)}
            >
              <span className="kv-label">{label}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={`${label} visualiser`}
              className={`kv-power-switch${enabled ? " is-on" : ""}`}
              title={`Turn ${label} ${enabled ? "off" : "on"}`}
              onClick={(event) => toggle(value, event)}
            >
              <span className="kv-power-state">{enabled ? "On" : "Off"}</span>
              <span className="kv-power-track" aria-hidden="true"><span /></span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function start() {
  const nav = document.querySelector(".kefe-vis-tabs");
  if (!nav || nav.dataset.beuiMounted === "true") return;

  const backingButtons = new Map();
  nav.querySelectorAll('button[role="tab"][data-visualiser]').forEach((button) => {
    backingButtons.set(button.dataset.visualiser, button);
  });
  if (!backingButtons.size) return;

  nav.hidden = false;
  nav.dataset.beuiMounted = "true";

  const backingHost = document.createElement("div");
  backingHost.className = "beui-vis-backing-controls";
  backingHost.hidden = true;
  backingHost.setAttribute("aria-hidden", "true");
  for (const button of backingButtons.values()) {
    const option = button.closest(".kefe-vis-option");
    backingHost.appendChild(option || button);
  }
  nav.appendChild(backingHost);

  const host = document.createElement("div");
  host.className = "beui-vis-tabs-host";
  nav.prepend(host);
  createRoot(host).render(<VisualiserTabs backingButtons={backingButtons} />);
}

window.addEventListener("load", start, { once: true });
document.addEventListener("click", (event) => {
  if (event.target?.closest?.('[data-shell-panel="visualiser"], .kefe-section[data-panel="visualiser"]')) {
    window.setTimeout(start, 0);
  }
});
if (document.readyState === "complete") start();
