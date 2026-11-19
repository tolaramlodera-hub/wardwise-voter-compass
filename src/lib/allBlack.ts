// "All Black" engine: final page = pure white background, every letter/line pure black.
// Ink = pixels that differ clearly from the local background colour (works for any
// text colour on any background colour, including white text on dark slides).
export function allBlack(d: Uint8ClampedArray, w: number, h: number, dpi: number, strength = 160) {
  const B = Math.max(8, Math.round(dpi / 5)); // block size ~0.2 inch
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const blk = new Float32Array(bw * bh * 3);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const med = (a: number[]) => { a.sort((x, y) => x - y); return a[a.length >> 1]!; };
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    rs.length = gs.length = bs.length = 0;
    const step = Math.max(1, B >> 3);
    for (let y = by * B; y < Math.min(h, by * B + B); y += step)
      for (let x = bx * B; x < Math.min(w, bx * B + B); x += step) {
        const i = (y * w + x) * 4; rs.push(d[i]!); gs.push(d[i + 1]!); bs.push(d[i + 2]!);
      }
    const k = (by * bw + bx) * 3; blk[k] = med(rs); blk[k + 1] = med(gs); blk[k + 2] = med(bs);
  }
  // background per block = median of a 9x9 block neighbourhood (~1.8 inch) -> ignores big letters
  const R = 4, bg = new Float32Array(bw * bh * 3);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    rs.length = gs.length = bs.length = 0;
    for (let y = Math.max(0, by - R); y <= Math.min(bh - 1, by + R); y++)
      for (let x = Math.max(0, bx - R); x <= Math.min(bw - 1, bx + R); x++) {
        const k = (y * bw + x) * 3; rs.push(blk[k]!); gs.push(blk[k + 1]!); bs.push(blk[k + 2]!);
      }
    const k = (by * bw + bx) * 3; bg[k] = med(rs); bg[k + 1] = med(gs); bg[k + 2] = med(bs);
  }
  // --- flat colour regions (panels, bars, boxes) ---
  const n = w * h, lab = new Int32Array(n), st = new Int32Array(n);
  const flat2 = 3 * 9 * 9;
  const regs: { area: number; x0: number; y0: number; x1: number; y1: number; r: number; g: number; b: number }[] = [{ area: 0, x0: 0, y0: 0, x1: 0, y1: 0, r: 0, g: 0, b: 0 }];
  for (let s0 = 0; s0 < n; s0++) {
    if (lab[s0]) continue;
    const id = regs.length; const R0 = { area: 0, x0: w, y0: h, x1: 0, y1: 0, r: 0, g: 0, b: 0 }; regs.push(R0);
    let sp = 0; st[sp++] = s0; lab[s0] = id;
    while (sp) {
      const q = st[--sp]!, qi = q * 4, x = q % w, y = (q - x) / w;
      R0.area++; R0.r += d[qi]!; R0.g += d[qi + 1]!; R0.b += d[qi + 2]!;
      if (x < R0.x0) R0.x0 = x; if (x > R0.x1) R0.x1 = x; if (y < R0.y0) R0.y0 = y; if (y > R0.y1) R0.y1 = y;
      const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1];
      for (const t of nb) {
        if (t < 0 || lab[t]) continue;
        const ti = t * 4, a = d[ti]! - d[qi]!, b2 = d[ti + 1]! - d[qi + 1]!, c = d[ti + 2]! - d[qi + 2]!;
        if (a * a + b2 * b2 + c * c > flat2) continue;
        lab[t] = id; st[sp++] = t;
      }
    }
  }
  // thickness: pixel is "core" if same region at distance r in 4 directions
  const r = Math.max(3, Math.round(dpi * 0.07));
  const core = new Int32Array(regs.length);
  for (let y = r; y < h - r; y += 2) for (let x = r; x < w - r; x += 2) {
    const q = y * w + x, L = lab[q]!;
    if (lab[q - r] === L && lab[q + r] === L && lab[q - r * w] === L && lab[q + r * w] === L) core[L] = core[L]! + 1;
  }
  const thick = (id: number) => core[id]! >= 20;
  // thin pixel counts per bbox via integral image
  const iw = w + 1, integ = new Int32Array(iw * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += thick(lab[y * w + x]!) ? 0 : 1; integ[(y + 1) * iw + x + 1] = integ[y * iw + x + 1]! + row; } }
  const thinIn = (R: typeof regs[0]) => integ[(R.y1 + 1) * iw + R.x1 + 1]! - integ[R.y0 * iw + R.x1 + 1]! - integ[(R.y1 + 1) * iw + R.x0]! + integ[R.y0 * iw + R.x0]!;
  const minSide = dpi * 0.3;
  const isPanel = new Uint8Array(regs.length);
  const panels: number[] = [];
  for (let id = 1; id < regs.length; id++) {
    const R = regs[id]!;
    if (!thick(id)) continue;
    const bw2 = R.x1 - R.x0 + 1, bh2 = R.y1 - R.y0 + 1;
    const border = R.x0 === 0 || R.y0 === 0 || R.x1 === w - 1 || R.y1 === h - 1;
    if (border) { isPanel[id] = 1; panels.push(id); R.r /= R.area; R.g /= R.area; R.b /= R.area; continue; }
    if (bw2 < minSide || bh2 < minSide || thinIn(R) < Math.max(150, bw2 * bh2 * 0.004)) continue;
    // A big thick region is a panel only if it holds real content: thin pixels that are not
    // just edge blending between this region's colour and the surrounding background (big letters).
    const mr = R.r / R.area, mg = R.g / R.area, mb = R.b / R.area;
    const sk = (Math.min(bh - 1, ((Math.max(0, R.y0 - 2)) / B) | 0) * bw + Math.min(bw - 1, ((Math.max(0, R.x0 - 2)) / B) | 0)) * 3;
    const or = bg[sk]!, og = bg[sk + 1]!, ob = bg[sk + 2]!;
    const vr = or - mr, vg = og - mg, vb = ob - mb, vv = vr * vr + vg * vg + vb * vb || 1;
    let content = 0;
    for (let y = R.y0; y <= R.y1; y += 2) for (let x = R.x0; x <= R.x1; x += 2) {
      const q = y * w + x;
      if (thick(lab[q]!)) continue;
      const i = q * 4, pr = d[i]! - mr, pg = d[i + 1]! - mg, pb = d[i + 2]! - mb;
      let u = (pr * vr + pg * vg + pb * vb) / vv; u = u < 0 ? 0 : u > 1 ? 1 : u;
      const er = pr - u * vr, eg = pg - u * vg, eb = pb - u * vb;
      if (er * er + eg * eg + eb * eb > 75 * 75) content++;
    }
    if (content * 4 >= Math.max(500, bw2 * bh2 * 0.01)) {
      isPanel[id] = 1; panels.push(id); R.r = mr; R.g = mg; R.b = mb;
    }
  }
  // innermost panel reference colour for every pixel inside a panel's box
  panels.sort((a, b) => regs[b]!.area - regs[a]!.area);
  const ref = new Int32Array(n);
  for (const id of panels) {
    const R = regs[id]!;
    if (R.x0 === 0 && R.y0 === 0 && R.x1 === w - 1 && R.y1 === h - 1) continue; // outer page bg: use local bg
    for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) ref[y * w + x] = id;
  }
  // strength 60..240 -> colour-distance threshold 110..35 (higher = fainter ink becomes black)
  const t = 145 - strength * 0.45, t2 = t * t;
  for (let y = 0; y < h; y++) {
    const by = Math.min(bh - 1, (y / B) | 0);
    for (let x = 0; x < w; x++) {
      const q = y * w + x, i = q * 4;
      if (isPanel[lab[q]!]) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255; continue; }
      let cr: number, cg: number, cb: number;
      const pr = ref[q]!;
      if (pr) { const R = regs[pr]!; cr = R.r; cg = R.g; cb = R.b; }
      else { const k = (by * bw + Math.min(bw - 1, (x / B) | 0)) * 3; cr = bg[k]!; cg = bg[k + 1]!; cb = bg[k + 2]!; }
      const dr = d[i]! - cr, dg = d[i + 1]! - cg, db = d[i + 2]! - cb;
      const v = dr * dr + dg * dg + db * db > t2 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  }
}
