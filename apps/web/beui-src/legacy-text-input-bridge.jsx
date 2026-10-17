import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Input } from "@/components/motion/input";
import "./legacy-bridge.css";

const SUPPORTED_TYPES = new Set(["text", "search", "number", "email", "url", "tel", "password"]);
let nextInputId = 0;

function attributes(input, visualId) {
  const aria = {};
  for (const attribute of input.attributes) {
    if (attribute.name.startsWith("aria-") && attribute.name !== "aria-hidden") aria[attribute.name] = attribute.value;
  }
  return {
    aria,
    autoComplete: input.autocomplete || undefined,
    className: input.className.replace(/\bbeui-native-input\b/g, "").trim(),
    disabled: input.disabled,
    id: visualId,
    max: input.max || undefined,
    min: input.min || undefined,
    pattern: input.pattern || undefined,
    placeholder: input.placeholder || undefined,
    readOnly: input.readOnly,
    required: input.required,
    step: input.step || undefined,
    title: input.title || undefined,
    type: input.type,
  };
}

function BeUIInput({ backing, visualId }) {
  const [value, setValue] = useState(backing.value);
  const [attrs, setAttrs] = useState(() => attributes(backing, visualId));

  useEffect(() => {
    const sync = () => {
      setValue(backing.value);
      setAttrs(attributes(backing, visualId));
    };
    backing.addEventListener("input", sync);
    backing.addEventListener("change", sync);
    backing.addEventListener("beui-sync", sync);
    const observer = new MutationObserver(sync);
    observer.observe(backing, { attributes: true, attributeFilter: ["disabled", "placeholder", "required", "readonly", "min", "max", "step", "pattern", "autocomplete", "aria-label", "aria-describedby", "title", "class", "value"] });
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
    <Input
      {...attrs.aria}
      type={attrs.type}
      id={attrs.id}
      value={value}
      onChange={change}
      disabled={attrs.disabled}
      required={attrs.required}
      readOnly={attrs.readOnly}
      placeholder={attrs.placeholder}
      autoComplete={attrs.autoComplete}
      min={attrs.min}
      max={attrs.max}
      step={attrs.step}
      pattern={attrs.pattern}
      title={attrs.title}
      classNames={{
        root: "beui-input-control w-full min-w-0",
        field: "w-full min-w-0",
        input: `${attrs.className} w-full min-w-0`,
      }}
    />
  );
}

function canBridge(input) {
  return input instanceof HTMLInputElement
    && SUPPORTED_TYPES.has(input.type)
    && input.closest(".kefe-editor")
    && input.id !== "kefeCommandInput"
    && !input.hidden
    && !input.closest("#beui-settings-root")
    && !input.closest(".beui-input-host")
    && !input.dataset.beuiInputMounted
    && !input.closest("label");
}

function mount(input) {
  if (!canBridge(input)) return;
  const visualId = `beui-${input.id || `field-${++nextInputId}`}`;
  const host = document.createElement("div");
  host.className = "beui-input-host";
  input.insertAdjacentElement("afterend", host);
  input.classList.add("beui-native-input");
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.dataset.beuiInputMounted = "true";
  if (input.id) {
    document.querySelectorAll("label[for]").forEach((label) => {
      if (label.htmlFor === input.id) label.htmlFor = visualId;
    });
  }
  createRoot(host).render(<BeUIInput backing={input} visualId={visualId} />);
}

function scan(root = document) {
  if (root instanceof HTMLInputElement) mount(root);
  root.querySelectorAll?.("input").forEach(mount);
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
