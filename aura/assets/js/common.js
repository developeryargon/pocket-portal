export const STORE_KEY = "aura_soma_state_v1";

export function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveState(patch) {
  const prev = loadState();
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
  return next;
}

export function resetState() {
  localStorage.removeItem(STORE_KEY);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function pickTopColors(scoreMap, topN = 2) {
  return Object.entries(scoreMap)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, topN)
    .map(([k]) => k);
}

export function basePath() {
  // /aura/ のように末尾スラッシュのディレクトリを基準にする
  const path = location.pathname;
  // index.html を開いてても /aura/ を返す
  if (path.endsWith("/")) return path;
  return path.substring(0, path.lastIndexOf("/") + 1);
}

export function go(page) {
  // page: "mist.html" "bottle.html" など
  location.href = basePath() + page;
}
