import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "@/components/motion/card";
import "./legacy-bridge.css";

function UploadCard({ originalNodes }) {
  const card = useRef(null);
  useEffect(() => {
    if (card.current) card.current.append(...originalNodes);
  }, [originalNodes]);

  return (
    <Card
      ref={card}
      className="beui-upload-card w-full gap-1 rounded-xl border border-dashed p-0 text-center"
      style={{
        width: "100%",
        minHeight: "112px",
        padding: "18px",
        borderStyle: "dashed",
        borderColor: "var(--line)",
        background: "var(--surface)",
        color: "var(--text)",
        boxShadow: "var(--inner)",
      }}
    />
  );
}

function start() {
  const label = document.getElementById("kefeUploadZone");
  if (!label || label.dataset.beuiCardMounted) return;
  const originalNodes = [...label.childNodes];
  const host = document.createElement("div");
  host.className = "beui-upload-card-root";
  label.replaceChildren(host);
  label.classList.add("beui-upload-card-hosted");
  label.dataset.beuiCardMounted = "true";
  createRoot(host).render(<UploadCard originalNodes={originalNodes} />);
}

if (document.readyState === "complete") {
  start();
} else {
  window.addEventListener("load", start, { once: true });
}
