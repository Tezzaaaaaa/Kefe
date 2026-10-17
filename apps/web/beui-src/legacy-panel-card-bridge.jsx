import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "@/components/motion/card";
import "./legacy-bridge.css";

function PanelCard({ originalNodes }) {
  const card = useRef(null);
  useEffect(() => {
    if (card.current) card.current.append(...originalNodes);
  }, [originalNodes]);

  return (
    <Card
      ref={card}
      className="beui-editor-panel-card w-full max-w-[1200px] gap-0 rounded-xl border p-0 text-foreground shadow-none"
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "clamp(16px, 2vw, 24px)",
        background: "var(--shell-panel)",
        borderColor: "var(--shell-line)",
        color: "var(--shell-text)",
        boxShadow: "none",
      }}
    />
  );
}

function mount(panel) {
  if (panel.dataset.beuiCardMounted || !panel.matches(".kefe-panel[data-panel-view]")) return;
  const originalNodes = [...panel.childNodes];
  const host = document.createElement("div");
  host.className = "beui-panel-card-root";
  panel.replaceChildren(host);
  panel.classList.add("beui-panel-card-hosted");
  panel.dataset.beuiCardMounted = "true";
  createRoot(host).render(<PanelCard originalNodes={originalNodes} />);
}

function start() {
  document.querySelectorAll(".kefe-editor .kefe-panel[data-panel-view]").forEach(mount);
}

if (document.readyState === "complete") {
  start();
} else {
  document.addEventListener("DOMContentLoaded", start, { once: true });
}
