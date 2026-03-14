/**
 * 키패드 이미지의 R채널 분포를 상세히 확인
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SESSION_DIR = path.join(process.env.HOME!, ".coupang-session");

// pad-key-0 (숫자 8)의 R채널 히트맵
const img = path.join(SESSION_DIR, "screenshots/pad-key-0.png");
const png = PNG.sync.read(fs.readFileSync(img));
const { width, height, data } = png;

console.log(`이미지 크기: ${width}x${height}`);
console.log("\nR채널 히스토그램:");
const hist: Record<number, number> = {};
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const bucket = Math.floor(r / 10) * 10;
    hist[bucket] = (hist[bucket] || 0) + 1;
  }
}
for (const k of Object.keys(hist).map(Number).sort((a, b) => a - b)) {
  console.log(`  R ${k.toString().padStart(3)}-${(k + 9).toString().padStart(3)}: ${"█".repeat(Math.min(Math.ceil(hist[k] / 30), 80))} (${hist[k]})`);
}

// R채널 ASCII 히트맵 (매 1px)
console.log("\nR채널 ASCII (>100 = 밝음):");
for (let y = 0; y < height; y += 1) {
  let row = `${y.toString().padStart(2)}| `;
  for (let x = 0; x < width; x += 1) {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    if (r > 200) row += "█";
    else if (r > 150) row += "▓";
    else if (r > 100) row += "░";
    else if (r > 70) row += "·";
    else row += " ";
  }
  console.log(row);
}

// 다른 이미지도 확인 (pad-key-1 = 숫자 1)
console.log("\n\n=== pad-key-1 (숫자 1) R채널 ===");
const img1 = path.join(SESSION_DIR, "screenshots/pad-key-1.png");
const png1 = PNG.sync.read(fs.readFileSync(img1));
for (let y = 0; y < png1.height; y += 1) {
  let row = `${y.toString().padStart(2)}| `;
  for (let x = 0; x < png1.width; x += 1) {
    const idx = (y * png1.width + x) * 4;
    const r = png1.data[idx];
    if (r > 200) row += "█";
    else if (r > 150) row += "▓";
    else if (r > 100) row += "░";
    else if (r > 70) row += "·";
    else row += " ";
  }
  console.log(row);
}
