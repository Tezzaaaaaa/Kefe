import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "@/components/motion/card";
import "./legacy-bridge.css";

function CommandDialog({ originalNodes }) {
  const card = useRef(null);

  useEffect(() => {
    if (card.current) card.current.append(...originalNodes);
  }, [originalNodes]);

  return (
    <Card
      ref={card}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kefeCommandTitle"
      tabIndex={-1}
      className="kefe-command-dialog beui-command-dialog w-full max-w-[520px] gap-0 overflow-hidden rounded-[13px] border p-0 text-foreground shadow-2xl"
      style={{
        maxHeight: "min(70vh, 560px)",
        background: "var(--shell-panel)",
        borderColor: "var(--shell-line)",
        color: "var(--shell-text)",
        boxShadow: "0 24px 80px rgba(0,0,0,.32)",
      }}
    />
  );
}

function start() {
  const overlay = document.getElementById("kefeCommandPalette");
  const original = overlay?.querySelector(".kefe-command-dialog");
  if (!overlay || !original || original.dataset.beuiMounted) return;

  const originalNodes = [...original.childNodes];
  const host = document.createElement("div");
  host.className = "beui-command-dialog-root";
  original.replaceWith(host);
  original.dataset.beuiMounted = "true";
  createRoot(host).render(<CommandDialog originalNodes={originalNodes} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
