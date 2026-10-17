import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Textarea } from "@/components/motion/textarea";
import "./legacy-bridge.css";

let nextTextareaId = 0;

function readAttrs(backing, visualId) {
  const aria = {};
  for (const attribute of backing.attributes) {
    if (attribute.name.startsWith("aria-") && attribute.name !== "aria-hidden") aria[attribute.name] = attribute.value;
  }
  return {
    aria,
    className: backing.className.replace(/\bbeui-native-textarea\b/g, "").trim(),
    disabled: backing.disabled,
    id: visualId,
    maxLength: backing.maxLength > -1 ? backing.maxLength : undefined,
    placeholder: backing.placeholder || undefined,
    readOnly: backing.readOnly,
    required: backing.required,
    rows: backing.rows || 4,
    spellCheck: backing.spellcheck,
    title: backing.title || undefined,
  };
}

function BeUITextarea({ backing, visualId }) {
  const [value, setValue] = useState(backing.value);
  const [attrs, setAttrs] = useState(() => readAttrs(backing, visualId));

  useEffect(() => {
    const sync = () => {
      setValue(backing.value);
      setAttrs(readAttrs(backing, visualId));
    };
    backing.addEventListener("input", sync);
    backing.addEventListener("change", sync);
    backing.addEventListener("beui-sync", sync);
    const observer = new MutationObserver(sync);
    observer.observe(backing, { attributes: true, attributeFilter: ["disabled", "placeholder", "required", "readonly", "maxlength", "rows", "spellcheck", "aria-label", "aria-describedby", "title", "class", "value"] });
    return () => {
      backing.removeEventListener("input", sync);
      backing.removeEventListener("change", sync);
      backing.removeEventListener("beui-sync", sync);
      observer.disconnect();
    };
  }, [backing, visualId]);

  const change = (next) => {
    backing.value = next;
    setValue(next);
    backing.dispatchEvent(new Event("input", { bubbles: true }));
    backing.dispatchEvent(new Event("change", { bubbles: true }));
  };

  return (
    <Textarea
      {...attrs.aria}
      id={attrs.id}
      value={value}
      onChange={change}
      disabled={attrs.disabled}
      readOnly={attrs.readOnly}
      required={attrs.required}
      placeholder={attrs.placeholder}
      maxLength={attrs.maxLength}
      rows={attrs.rows}
      spellCheck={attrs.spellCheck}
      title={attrs.title}
      className="min-h-40"
    />
  );
}

function canBridge(textarea) {
  return textarea instanceof HTMLTextAreaElement
    && !textarea.hidden
    && !textarea.dataset.beuiTextareaMounted
    && !textarea.closest("#beui-settings-root")
    && !textarea.closest("label");
}

function mount(textarea) {
  if (!canBridge(textarea)) return;
  const visualId = `beui-${textarea.id || `textarea-${++nextTextareaId}`}`;
  const host = document.createElement("div");
  host.className = "beui-textarea-host";
  textarea.insertAdjacentElement("afterend", host);
  textarea.classList.add("beui-native-textarea");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.dataset.beuiTextareaMounted = "true";
  if (textarea.id) {
    document.querySelectorAll("label[for]").forEach((label) => {
      if (label.htmlFor === textarea.id) label.htmlFor = visualId;
    });
  }
  createRoot(host).render(<BeUITextarea backing={textarea} visualId={visualId} />);
}

function scan(root = document) {
  if (root instanceof HTMLTextAreaElement) mount(root);
  root.querySelectorAll?.(".kefe-editor textarea").forEach(mount);
}

function start() {
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
