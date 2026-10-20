import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Card } from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import "./legacy-bridge.css";

function CommandButton({ backing }) {
  const [hidden, setHidden] = useState(backing.hidden);

  useEffect(() => {
    const observer = new MutationObserver(() => setHidden(backing.hidden));
    observer.observe(backing, { attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, [backing]);

  return (
    <Button
      type="button"
      variant="ghost"
      className="beui-command-button w-full justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm"
      hidden={hidden}
      disabled={backing.disabled}
      title={backing.title || undefined}
      aria-label={backing.getAttribute("aria-label") || undefined}
      onClick={() => backing.click()}
    >
      <span dangerouslySetInnerHTML={{ __html: backing.innerHTML }} />
    </Button>
  );
}

function CommandDialog({ originalNodes }) {
  const card = useRef(null);

  useEffect(() => {
    if (!card.current) return;
    card.current.append(...originalNodes);

    const roots = [];
    card.current.querySelectorAll("#kefeCommandList > button").forEach((backing) => {
      const host = document.createElement("div");
      host.className = "beui-command-button-host";
      backing.insertAdjacentElement("beforebegin", host);
      backing.classList.add("beui-native-command-button");
      const root = createRoot(host);
      root.render(<CommandButton backing={backing} />);
      roots.push(root);
    });

    return () => roots.forEach((root) => root.unmount());
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
