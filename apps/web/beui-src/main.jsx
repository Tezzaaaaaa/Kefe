import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RangeSlider } from "@/components/motion/range-slider";
import "./styles.css";

function Workbench() {
  const [opacity, setOpacity] = useState(78);
  const [offset, setOffset] = useState(0);

  return (
    <main className="beui-workbench">
      <header className="mb-8">
        <p className="beui-eyebrow mb-3">KEFE · UI migration</p>
        <h1 className="m-0 text-3xl font-semibold tracking-tight">beUI component workbench</h1>
        <p className="beui-note mt-3 max-w-xl">
          This isolated workbench validates the upstream beUI range slider and its
          keyboard, pointer, touch, reduced-motion, and value-step behaviour before
          it is wired into KEFE's production editor.
        </p>
      </header>

      <section className="beui-panel mb-4">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="beui-eyebrow mb-2">Preview opacity</p>
            <p className="beui-number m-0 text-4xl font-semibold">{opacity}%</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Step 1%
          </span>
        </div>
        <RangeSlider
          value={opacity}
          onValueChange={setOpacity}
          min={0}
          max={100}
          step={1}
          aria-label="Preview opacity"
        />
        <p className="beui-note mt-4">Controlled value; updates live as the handle moves.</p>
      </section>

      <section className="beui-panel">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="beui-eyebrow mb-2">Lyric timing offset</p>
            <p className="beui-number m-0 text-4xl font-semibold">
              {offset > 0 ? "+" : ""}{offset.toFixed(2)}s
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Step 0.05s
          </span>
        </div>
        <RangeSlider
          value={offset}
          onValueChange={setOffset}
          min={-3}
          max={3}
          step={0.05}
          aria-label="Lyric timing offset"
        />
        <p className="beui-note mt-4">Fractional steps must remain precise for lyric timing.</p>
      </section>

      <p className="beui-note mt-6">
        Migration status: component source imported; production editor not yet switched over.
      </p>
    </main>
  );
}

createRoot(document.getElementById("beui-root")).render(<Workbench />);
