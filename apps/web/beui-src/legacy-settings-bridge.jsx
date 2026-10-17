import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/motion/button";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter } from "@/components/motion/card";
import { RangeSlider } from "@/components/motion/range-slider";
import { Switch } from "@/components/motion/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";

const settings = () => window.kefeSettings;
const schema = () => settings()?.schema?.() || [];

function displayValue(item, value) {
  if (item.key === "lyricOffset") return `${value > 0 ? "+" : ""}${Number(value).toFixed(2)}s`;
  if (item.key === "fftPower") return String(2 ** Number(value));
  return String(value);
}

function SettingRow({ item, value }) {
  const current = value ?? item.def;
  const set = (next) => settings()?.set(item.key, next);
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border/70 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)] sm:items-center">
      <div className="min-w-0">
        <label className="block text-sm font-medium text-foreground">{item.label}</label>
        {item.hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.hint}</p> : null}
      </div>
      <div className="min-w-0">
        {item.type === "range" ? (
          <div className="space-y-2">
            <div className="text-right text-sm font-semibold tabular-nums text-foreground">{displayValue(item, current)}{item.key === "fpsTarget" ? " FPS" : ""}</div>
            <RangeSlider value={Number(current)} onValueChange={set} min={item.min} max={item.max} step={item.step} aria-label={item.label} showTicks={false} />
          </div>
        ) : null}
        {item.type === "toggle" ? (
          <div className="flex justify-end">
            <Switch checked={Boolean(current)} onCheckedChange={set} ariaLabel={item.label} />
          </div>
        ) : null}
        {item.type === "select" ? (
          <Select value={String(current)} onValueChange={set} className="w-full">
            <SelectTrigger aria-label={item.label} className="h-10 w-full rounded-xl">
              <SelectValue placeholder={item.label} />
            </SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              {item.options?.map(([value, label]) => (
                <SelectItem key={value} value={String(value)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}

function SettingsOverlay() {
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).get("panel") === "settings");
  const [values, setValues] = useState(() => settings()?.all?.() || {});
  const opener = useRef(null);
  const dialog = useRef(null);

  useEffect(() => {
    const onClick = (event) => {
      const button = event.target.closest?.('[data-top-panel="settings"]');
      if (!button) return;
      event.preventDefault();
      opener.current = button;
      setOpen(true);
    };
    const onKeyDown = (event) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = [...(dialog.current?.querySelectorAll('button, input, select, a[href], [tabindex="0"], [role="slider"]') || [])].filter((node) => !node.disabled && node.getClientRects().length > 0);
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    settings()?.onChange?.(() => setValues(settings()?.all?.() || {}));
  }, []);

  useEffect(() => {
    if (open) dialog.current?.focus();
    else if (opener.current?.isConnected) opener.current.focus();
  }, [open]);

  if (!open) return null;
  const groups = schema();
  return (
    <div
      className="beui-settings-root fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
    >
      <Card
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beui-settings-title"
        tabIndex={-1}
        className="w-full max-w-3xl gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl outline-none"
      >
        <CardHeader className="grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">KEFE workspace</p>
            <CardTitle as="h2" id="beui-settings-title" className="m-0 text-xl tracking-tight">Settings</CardTitle>
            <CardDescription className="text-xs">Tune your workspace and export preferences.</CardDescription>
          </div>
          <CardAction className="row-start-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Done</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="max-h-[68vh] overflow-y-auto py-0">
          {groups.map((group) => {
            const items = group.items.filter((item) => item.key !== "aspect");
            if (!items.length) return null;
            return (
              <section key={group.group} className="py-3">
                <h3 className="mb-1 mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.group}</h3>
                {items.map((item) => <SettingRow key={item.key} item={item} value={values[item.key]} />)}
              </section>
            );
          })}
          <section className="my-4 rounded-xl border border-border bg-card p-4">
            <h3 className="m-0 text-sm font-semibold">KEFE Visualiser</h3>
            <p className="mb-4 mt-1 text-xs leading-5 text-muted-foreground">Browser-based music visualiser and lyric-video editor.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open("https://tezzaaaaaa.github.io/Kefe/", "_blank", "noopener,noreferrer")}>Open live site</Button>
              <Button variant="outline" size="sm" onClick={() => window.open("https://github.com/Tezzaaaaaa/Kefe", "_blank", "noopener,noreferrer")}>Open GitHub</Button>
            </div>
          </section>
        </CardContent>
        <CardFooter className="justify-end border-t border-border px-5 py-4 sm:px-7">
          <Button variant="outline" size="sm" onClick={() => settings()?.reset?.()}>Reset to defaults</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

const host = document.createElement("div");
host.id = "beui-settings-root";
document.body.appendChild(host);
createRoot(host).render(<SettingsOverlay />);
