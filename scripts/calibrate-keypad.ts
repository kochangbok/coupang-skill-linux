/**
 * 키패드 스크린샷에서 숫자 시그니처를 추출하는 캘리브레이션 스크립트.
 * npx tsx scripts/calibrate-keypad.ts
 *
 * 접근: 이미지 중앙 영역을 크롭 → 이진화 → 그리드 셀 내 밝은 픽셀 비율로 시그니처 생성
 */

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SESSION_DIR = path.join(process.env.HOME!, ".coupang-session");
const SCREENSHOT_DIR = path.join(SESSION_DIR, "screenshots");

// 숫자 영역 크롭 (이미지 중앙)
const CROP_MARGIN_X = 0.35; // 좌우 35% 잘라냄
const CROP_MARGIN_Y = 0.30; // 상하 30% 잘라냄

const GRID_COLS = 10;
const GRID_ROWS = 14;
const R_THRESHOLD = 100; // 개별 픽셀의 R채널 기준
const CELL_RATIO_THRESHOLD = 0.15; // 셀 내 밝은 픽셀 비율이 이 이상이면 "1"

function readPng(filePath: string): { width: number; height: number; data: Buffer } {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

function getGridSignature(png: { width: number; height: number; data: Buffer }): string {
  const { width, height, data } = png;

  // 크롭 영역 계산
  const cropX1 = Math.floor(width * CROP_MARGIN_X);
  const cropX2 = Math.floor(width * (1 - CROP_MARGIN_X));
  const cropY1 = Math.floor(height * CROP_MARGIN_Y);
  const cropY2 = Math.floor(height * (1 - CROP_MARGIN_Y));
  const cropW = cropX2 - cropX1;
  const cropH = cropY2 - cropY1;

  const cellW = cropW / GRID_COLS;
  const cellH = cropH / GRID_ROWS;
  let sig = "";

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const startX = cropX1 + Math.floor(col * cellW);
      const endX = cropX1 + Math.floor((col + 1) * cellW);
      const startY = cropY1 + Math.floor(row * cellH);
      const endY = cropY1 + Math.floor((row + 1) * cellH);

      let brightPixels = 0;
      let totalPixels = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          if (r > R_THRESHOLD) brightPixels++;
          totalPixels++;
        }
      }

      const ratio = brightPixels / totalPixels;
      sig += ratio >= CELL_RATIO_THRESHOLD ? "1" : "0";
    }
  }

  return sig;
}

function visualizeSignature(sig: string, cols: number): string {
  let result = "";
  for (let i = 0; i < sig.length; i++) {
    result += sig[i] === "1" ? "██" : "  ";
    if ((i + 1) % cols === 0) result += "\n";
  }
  return result;
}

// 매핑 파일 읽기
const mappingPath = path.join(SESSION_DIR, "keypad-mapping.json");
if (!fs.existsSync(mappingPath)) {
  console.error("keypad-mapping.json 이 필요합니다.");
  process.exit(1);
}

const mapping: Record<string, string> = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
console.log("현재 매핑:", mapping);
console.log(`그리드: ${GRID_COLS}x${GRID_ROWS}, R threshold: ${R_THRESHOLD}, cell ratio: ${CELL_RATIO_THRESHOLD}\n`);

const digitSignatures: Record<string, string> = {};

for (const [keyIdx, digit] of Object.entries(mapping)) {
  const imgPath = path.join(SCREENSHOT_DIR, `pad-key-${keyIdx}.png`);
  if (!fs.existsSync(imgPath)) continue;

  const png = readPng(imgPath);
  const sig = getGridSignature(png);
  digitSignatures[digit] = sig;

  console.log(`=== 숫자 ${digit} (pad-key-${keyIdx}) ===`);
  console.log(visualizeSignature(sig, GRID_COLS));
}

// 유니크 확인
const sigToDigits: Record<string, string[]> = {};
for (const [digit, sig] of Object.entries(digitSignatures)) {
  if (!sigToDigits[sig]) sigToDigits[sig] = [];
  sigToDigits[sig].push(digit);
}

console.log("===== 유니크 확인 =====");
let allUnique = true;
for (const [, digits] of Object.entries(sigToDigits)) {
  if (digits.length > 1) {
    console.log(`중복! 숫자 ${digits.join(", ")} 가 같은 시그니처`);
    allUnique = false;
  }
}
if (allUnique) {
  console.log("✅ 모든 숫자가 유니크한 시그니처를 가집니다!");
}

// 최종 출력
console.log("\n===== 시그니처 맵 (코드 삽입용) =====\n");
console.log("const DIGIT_SIGNATURES: Record<string, string> = {");
for (let d = 0; d <= 9; d++) {
  const sig = digitSignatures[String(d)];
  if (sig) {
    console.log(`  "${d}": "${sig}",`);
  }
}
console.log("};");
