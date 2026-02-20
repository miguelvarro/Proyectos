export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export async function fetchJson(url, fallback = null) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    return fallback;
  }
}

export function showWarn(el, msg) {
  if (!el) return;
  el.style.display = "block";
  el.textContent = msg;
}

