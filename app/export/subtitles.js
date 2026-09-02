// Standard subtitle sidecars for KEFE lyric/caption timelines.
function pad(value, width = 2) { return String(value).padStart(width, '0'); }

export function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function formatVttTime(seconds) {
  return formatSrtTime(seconds).replace(',', '.');
}

export function timedLinesForState(state) {
  if (state?.captions?.mode === 'captions' && Array.isArray(state.captions.lines)) return state.captions.lines;
  return Array.isArray(state?.lyrics?.lines) ? state.lyrics.lines : [];
}

export function generateSrt(lines) {
  return lines.map((line, index) => {
    const start = Math.max(0, Number(line?.time) || 0);
    const explicitEnd = Number(line?.endTime);
    const nextStart = Number(lines[index + 1]?.time);
    const end = Number.isFinite(explicitEnd) && explicitEnd > start
      ? explicitEnd
      : Number.isFinite(nextStart) && nextStart > start
        ? nextStart
        : start + 3;
    const text = String(line?.text ?? '').trim();
    return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(Math.max(start + 0.05, end))}\n${text}\n`;
  }).filter(Boolean).join('\n');
}

export function generateVtt(lines) {
  const body = lines.map((line, index) => {
    const start = Math.max(0, Number(line?.time) || 0);
    const explicitEnd = Number(line?.endTime);
    const nextStart = Number(lines[index + 1]?.time);
    const end = Number.isFinite(explicitEnd) && explicitEnd > start ? explicitEnd : Number.isFinite(nextStart) && nextStart > start ? nextStart : start + 3;
    const text = String(line?.text ?? '').trim();
    return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(Math.max(start + 0.05, end))}\n${text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${body}`;
}
