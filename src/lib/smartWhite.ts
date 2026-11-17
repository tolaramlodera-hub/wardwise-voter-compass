// Smart White engine: protects white panels (>= 0.5in x 1in), whitens outer
// background colours, keeps black ink black and coloured ink in original colour.
export interface SmartWhiteOptions {
  dpi: number; // pixels per inch of the rendered page
  bgTolerance?: number; // RGB distance considered "background" (default 40)
}

export const isWhitePx = (r: number, g: number, b: number) =>
  Math.min(r, g, b) >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 30;

/** Returns mask (1 = protected, leave pixel untouched). */
export function protectedWhiteMask(d: Uint8ClampedArray, w: number, h: number, dpi: number): Uint8Array {
  const n = w * h;
  const white = new Uint8Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) white[p] = isWhitePx(d[i]!, d[i + 1]!, d[i + 2]!) ? 1 : 0;
  const label = new Int32Array(n);
  const mask = new Uint8Array(n);
  const stack = new Int32Array(n);
  const shortSide = Math.round(0.5 * dpi), longSide = Math.round(1 * dpi);
  const minArea = shortSide * longSide * 0.5;
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (!white[s] || label[s]) continue;
    id++;
    let sp = 0, count = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack[sp++] = s; label[s] = id;
    while (sp) {
      const p = stack[--sp]!; count++;
      const x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && white[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && white[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && white[p - w] && !label[p - w]) { label[p - w] = id; stack[sp++] = p - w; }
      if (y < h - 1 && white[p + w] && !label[p + w]) { label[p + w] = id; stack[sp++] = p + w; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const big = Math.min(bw, bh) >= shortSide && Math.max(bw, bh) >= longSide && count >= minArea;
    if (!big) continue;
    // protect component + its enclosed holes (text inside the panel).
    // Flood from bbox border through non-component pixels; unreached = inside.
    const ow = bw + 2, oh = bh + 2;
    const out = new Uint8Array(ow * oh);
    const st: number[] = [0]; out[0] = 1;
    while (st.length) {
      const q = st.pop()!;
      const qx = q % ow, qy = (q - qx) / ow;
      const nb = [qx > 0 ? q - 1 : -1, qx < ow - 1 ? q + 1 : -1, qy > 0 ? q - ow : -1, qy < oh - 1 ? q + ow : -1];
      for (const t of nb) {
        if (t < 0 || out[t]) continue;
        const tx = (t % ow) - 1, ty = Math.floor(t / ow) - 1;
        const inside = tx >= 0 && ty >= 0 && tx < bw && ty < bh;
        if (inside && label[(ty + y0) * w + tx + x0] === id) continue;
        out[t] = 1; st.push(t);
      }
    }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++)
      if (!out[(y + 1) * ow + x + 1]) mask[(y + y0) * w + x + x0] = 1;
  }
  return mask;
}

/** Dominant background colours among unprotected pixels (each >= 8% share). */
export function backgroundColours(d: Uint8ClampedArray, mask: Uint8Array): [number, number, number][] {
  const bins = new Map<number, { c: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (mask[p]) continue;
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = bins.get(k) ?? { c: 0, r: 0, g: 0, b: 0 };
    e.c++; e.r += r; e.g += g; e.b += b; bins.set(k, e); total++;
  }
  return [...bins.values()].filter((e) => e.c >= total * 0.08)
    .sort((a, b) => b.c - a.c).slice(0, 4)
    .map((e) => [e.r / e.c, e.g / e.c, e.b / e.c] as [number, number, number]);
}

export function smartWhite(d: Uint8ClampedArray, w: number, h: number, opt: SmartWhiteOptions) {
  const tol = opt.bgTolerance ?? 40;
  const mask = protectedWhiteMask(d, w, h, opt.dpi);
  const bgs = backgroundColours(d, mask);
  const tol2 = tol * tol;
  // Gradient-aware outer background: flood from page border through smooth colour steps.
  const n = w * h, outer = new Uint8Array(n), st = new Int32Array(n);
  let sp = 0;
  const step2 = 14 * 14;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const q = y * w + x; if (!mask[q] && !outer[q]) { outer[q] = 1; st[sp++] = q; } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const q = y * w + x; if (!mask[q] && !outer[q]) { outer[q] = 1; st[sp++] = q; } }
  while (sp) {
    const q = st[--sp]!, qi = q * 4, x = q % w;
    const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w];
    for (const t of nb) {
      if (t < 0 || t >= n || outer[t] || mask[t]) continue;
      const ti = t * 4, dr = d[ti]! - d[qi]!, dg = d[ti + 1]! - d[qi + 1]!, db = d[ti + 2]! - d[qi + 2]!;
      if (dr * dr + dg * dg + db * db > step2) continue;
      outer[t] = 1; st[sp++] = t;
    }
  }
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (mask[p]) continue; // protected white panel: untouched
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    let isBg = outer[p] === 1;
    if (!isBg) for (const c of bgs) {
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      if (dr * dr + dg * dg + db * db <= tol2) { isBg = true; break; }
    }
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (isBg) { d[i] = d[i + 1] = d[i + 2] = 255; }
    else if (lum < 90 && mx - mn < 40) { d[i] = d[i + 1] = d[i + 2] = 0; } // black ink
    else if (isWhitePx(r, g, b)) { d[i] = d[i + 1] = d[i + 2] = 0; } // white text on removed bg -> readable black
    // else: coloured ink keeps original colour
    d[i + 3] = 255;
  }
  return { protectedPixels: mask.reduce((a, v) => a + v, 0), backgrounds: bgs.length };
}
