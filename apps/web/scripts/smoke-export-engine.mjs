import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

// The export engine is a classic browser script. Load it in a bare sandbox to exercise its pure maths:
// the FFT, the analyser-compatible spectrum used to drive audio-reactive visualisers during offline export,
// the bitrate planner, and the codec level selection.
const here = dirname(fileURLToPath(import.meta.url));
const sandbox = { window: {}, console, Math, Float64Array, Float32Array, Uint8Array, Uint32Array, WeakMap, Promise, setTimeout, clearTimeout };
runInNewContext(readFileSync(resolve(here, "../app/export/export-engine.js"), "utf8"), sandbox);
const engine = sandbox.window.kefeExportEngine;
assert.ok(engine && typeof engine.run === "function" && typeof engine.createSpectrum === "function", "export engine must expose run() and createSpectrum()");
assert.equal(engine.supported(), false, "engine must report unsupported when WebCodecs and the muxers are missing");

// FFT agrees with a direct DFT.
{
  const n = 64, fft = engine._internals.makeFft(n);
  const re = new Float64Array(n), im = new Float64Array(n), input = new Float64Array(n);
  for (let i = 0; i < n; i++) input[i] = re[i] = Math.sin(2 * Math.PI * 5 * i / n) + 0.5 * Math.cos(2 * Math.PI * 11 * i / n) + (i % 7) * 0.01;
  fft(re, im);
  for (let k = 0; k < n; k++) {
    let dr = 0, di = 0;
    for (let t = 0; t < n; t++) { dr += input[t] * Math.cos(2 * Math.PI * k * t / n); di -= input[t] * Math.sin(2 * Math.PI * k * t / n); }
    assert.ok(Math.abs(dr - re[k]) < 1e-9 && Math.abs(di - im[k]) < 1e-9, `FFT bin ${k} must match the DFT`);
  }
}

// A pure tone lands in the right bin; silence stays at zero; output is deterministic for a given time.
{
  const rate = 48000, seconds = 2, freq = 3000, samples = rate * seconds;
  const tone = new Float32Array(samples);
  for (let i = 0; i < samples; i++) tone[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / rate);
  const a = engine.createSpectrum([tone], rate, { fftSize: 2048, fps: 60 });
  for (let f = 0; f < 30; f++) a.update(0.5 + f / 60);
  const peak = a.bytes.indexOf(Math.max(...a.bytes));
  assert.ok(Math.abs(peak - Math.round(freq / (rate / 2048))) <= 1, `3 kHz tone must peak near bin ${Math.round(freq / (rate / 2048))}, got ${peak}`);
  assert.ok(a.bytes[peak] > 150, "a loud tone must read as a strong spectrum value");
  assert.equal(a.analyser.frequencyBinCount, 1024);
  const out = new Uint8Array(1024);
  a.fill(out);
  assert.equal(out[peak], a.bytes[peak], "fill() must copy the current spectrum");
  const b = engine.createSpectrum([tone], rate, { fftSize: 2048, fps: 60 });
  for (let f = 0; f < 30; f++) b.update(0.5 + f / 60);
  assert.deepEqual(Array.from(b.bytes), Array.from(a.bytes), "same times must give identical spectra (deterministic export)");
  const silent = engine.createSpectrum([new Float32Array(rate)], rate, { fftSize: 2048, fps: 30 });
  silent.update(0.5);
  assert.equal(Math.max(...silent.bytes), 0, "silence must produce an all-zero spectrum");
}

// Bitrate planner scales with resolution and keeps long tracks inside the memory budget.
{
  const hd = engine.chooseBitrates({ width: 1920, height: 1080, fps: 30, duration: 200 });
  const uhd = engine.chooseBitrates({ width: 3840, height: 2160, fps: 60, duration: 200 });
  assert.ok(uhd.video > hd.video, "4K must get a higher bitrate than 1080p");
  const long = engine.chooseBitrates({ width: 1280, height: 720, fps: 30, duration: 1800 });
  assert.equal(long.tooLarge, false, "a 30 minute 720p30 export fits the budget");
  assert.ok(long.video * 1800 / 8 <= 520e6, "a 30 minute 720p export must stay within the memory budget");
  assert.ok(long.note.length > 0, "a bitrate cut must be reported to the user");
  assert.equal(engine.chooseBitrates({ width: 3840, height: 2160, fps: 60, duration: 3600 }).tooLarge, true, "a one hour 4K60 export cannot fit and must be flagged so the ladder steps down");
  const phone = engine.chooseBitrates({ width: 1920, height: 1080, fps: 30, duration: 600, mobile: true });
  assert.ok(phone.video * 600 / 8 <= 220e6, "mobile exports must use the smaller memory budget");
}

// Codec lists: H.264 is tried first for MP4 and VP9 first for WebM; levels grow with size.
{
  const mp4 = engine._internals.videoCandidates("mp4", 1920, 1080, 30);
  assert.match(mp4[0].codec, /^avc1\.6400/);
  assert.equal(mp4[0].mux, "avc");
  const webm = engine._internals.videoCandidates("webm", 1920, 1080, 30);
  assert.match(webm[0].codec, /^vp09/);
  assert.ok(engine._internals.avcLevel(3840, 2160, 60) > engine._internals.avcLevel(1280, 720, 30), "AVC level must grow with frame size and rate");
  assert.equal(engine._internals.even(1081), 1082);
}

console.log("PASS: export engine FFT, spectrum, bitrate planning and codec selection");
