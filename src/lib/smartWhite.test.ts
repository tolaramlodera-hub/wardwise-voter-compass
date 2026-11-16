import { describe, it, expect } from "vitest";
import { smartWhite } from "./smartWhite";

const DPI = 20; // 0.5in = 10px, 1in = 20px
function page(w: number, h: number, rgb: [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
  return d;
}
function set(d: Uint8ClampedArray, w: number, x: number, y: number, c: number[]) { const i = (y * w + x) * 4; d[i] = c[0]!; d[i + 1] = c[1]!; d[i + 2] = c[2]!; }
function rect(d: Uint8ClampedArray, w: number, x0: number, y0: number, rw: number, rh: number, c: number[]) { for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) set(d, w, x, y, c); }
const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];

describe("smartWhite rules", () => {
  it("outer maroon background becomes pure white", () => {
    const w = 60, h = 60, d = page(w, h, [120, 20, 40]);
    smartWhite(d, w, h, { dpi: DPI });
    expect(px(d, w, 2, 2)).toEqual([255, 255, 255]);
  });
  it("black text on maroon stays black, red text keeps colour", () => {
    const w = 60, h = 60, d = page(w, h, [120, 20, 40]);
    set(d, w, 5, 5, [10, 10, 10]); set(d, w, 6, 5, [0, 60, 220]);
    smartWhite(d, w, h, { dpi: DPI });
    expect(px(d, w, 5, 5)).toEqual([0, 0, 0]);
    expect(px(d, w, 6, 5)).toEqual([0, 60, 220]);
  });
  it("white panel >= 0.5x1in keeps every pixel inside unchanged (incl. light/grey text)", () => {
    const w = 60, h = 60, d = page(w, h, [120, 20, 40]);
    rect(d, w, 10, 10, 30, 15, [255, 255, 255]);
    set(d, w, 20, 15, [200, 100, 100]); set(d, w, 21, 15, [150, 150, 150]); set(d, w, 22, 15, [120, 20, 40]);
    smartWhite(d, w, h, { dpi: DPI });
    expect(px(d, w, 20, 15)).toEqual([200, 100, 100]);
    expect(px(d, w, 21, 15)).toEqual([150, 150, 150]);
    expect(px(d, w, 22, 15)).toEqual([120, 20, 40]);
  });
  it("white area smaller than 0.5x1in is not protected (white text becomes black)", () => {
    const w = 60, h = 60, d = page(w, h, [120, 20, 40]);
    rect(d, w, 10, 10, 15, 8, [255, 255, 255]); // 0.75in x 0.4in
    smartWhite(d, w, h, { dpi: DPI });
    expect(px(d, w, 12, 12)).toEqual([0, 0, 0]);
  });
});
