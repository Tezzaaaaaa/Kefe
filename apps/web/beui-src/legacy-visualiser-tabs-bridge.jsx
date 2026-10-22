import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./legacy-bridge.css";

function VisualiserTabs({ backingButtons }) {
  const [active, setActive] = useState(
    [...backingButtons.values()].find((button) => button.getAttribute("aria-selected") === "true")?.dataset.visualiser
      || "",
  );
  useEffect(() => {
    const sync = (event) => {
      const button = event.target?.closest?.(".kefe-vis-tabs button[data-visualiser]");
      if (button && backingButtons.has(button.dataset.visualiser)) {
        setActive(button.dataset.visualiser);
      }
    };
    document.addEventListener("click", sync);
    return () => document.removeEventListener("click", sync);
  }, [backingButtons]);

  function select(value) {
    const backing = backingButtons.get(value);
    const option = backing?.closest(".kefe-vis-option");
    const power = option?.querySelector(".kefe-switch");
    backing?.click();
    const slot = document.getElementById("kefeVisualiserPowerSlot");
    const selectedPower = power || slot?.querySelector(".kefe-switch");
    if (slot && selectedPower && selectedPower.parentElement !== slot) slot.replaceChildren(selectedPower);
  }

  return (
    <div role="tablist" aria-label="Choose visualiser" className="kv-grid">
      {[...backingButtons.entries()].map(([value, backing]) => {
        const rawLabel = backing.querySelector(".kefe-visualiser-tab-label")?.textContent
          || backing.textContent
          || backing.getAttribute("aria-label")
          || backing.title
          || value;
        const label = rawLabel.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s+visuali[sz]er$/i, "").trim() || value;
        const selected = active === value;
        return (
          <div key={value} className={`kv-card${selected ? " is-active" : ""}`}>
            <button
              type="button"
              role="tab"
              aria-selected={selected}
              className="kv-tab"
              title={`${label} visualiser`}
              onClick={() => select(value)}
            >
              <span className="kv-label">{label}</span>
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

  // The legacy Fluid Ink initializer marks this shared tab container hidden at startup.
  // Clear that local hidden state so the React tabs can render when their parent panel is active.
  nav.hidden = false;
  nav.dataset.beuiMounted = "true";

  // Keep legacy buttons only as hidden backing controls for existing effect modules.
  // Move their full option wrappers before mounting React so duplicate labels/toggles
  // never remain in the visible tab list.
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

// The legacy visualiser modules create their tabs during DOMContentLoaded.
// Mount after those initialisers so every existing visualiser is represented.
window.addEventListener("load", start, { once: true });
document.addEventListener("click", (event) => {
  if (event.target?.closest?.('[data-shell-panel="visualiser"], .kefe-section[data-panel="visualiser"]')) {
    window.setTimeout(start, 0);
  }
});
if (document.readyState === "complete") start();
