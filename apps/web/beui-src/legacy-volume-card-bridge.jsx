import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "@/components/motion/card";
import "./legacy-bridge.css";

function VolumeCard({ originalNodes }) {
  const card = useRef(null);
  useEffect(() => {
    if (card.current) card.current.append(...originalNodes);
  }, [originalNodes]);

  return (
    <Card
      ref={card}
      className="beui-volume-card w-full gap-2 rounded-xl border p-3 text-foreground shadow-xl"
      style={{
        background: "var(--shell-panel)",
        borderColor: "var(--shell-line)",
        color: "var(--shell-text)",
        boxShadow: "0 16px 40px rgba(0,0,0,.28)",
      }}
    />
  );
}

function start() {
  const popover = document.getElementById("kefeVolumePopover");
  if (!popover || popover.dataset.beuiMounted) return;
  const originalNodes = [...popover.childNodes];
  const host = document.createElement("div");
  host.className = "beui-volume-card-root";
  popover.replaceChildren(host);
  popover.classList.add("beui-volume-popover-native");
  popover.dataset.beuiMounted = "true";
  createRoot(host).render(<VolumeCard originalNodes={originalNodes} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
