/**
 * 키패드 숫자 인식 모듈
 *
 * 쿠팡 PIN 키패드 스크린샷에서 숫자를 알고리즘으로 판별.
 * R채널 기반 이진화 → 그리드 시그니처 → 해밍 거리 매칭.
 */

import fs from "node:fs";
import { PNG } from "pngjs";

// 크롭 & 그리드 설정
const CROP_MARGIN_X = 0.35;
const CROP_MARGIN_Y = 0.30;
const GRID_COLS = 10;
const GRID_ROWS = 14;
const R_THRESHOLD = 100;
const CELL_RATIO_THRESHOLD = 0.15;

// 캘리브레이션에서 추출한 레퍼런스 시그니처
const DIGIT_SIGNATURES: Record<string, string> = {
  "0": "00000000000000000000000011000000001110000000101000000110110000011011000001101100000110110000011011000001101100000110110000001010000000111000",
  "1": "00000000000000000000000000000000011100000001110000000001000000000100000000010000000001000000000100000000010000000001000000000100000000010000",
  "2": "00000000000000000000000111000000011110000001011000000000100000000010000000011000000001100000000100000000110000000011000000011000000001111000",
  "3": "00000000000000000000000000000000001100000001111000000001100000000110000000011000000011000000001110000000011000000000100000000010000001011000",
  "4": "00000000000000011000000001100000000110000000111000000011100000001110000001111000000111100000011110000001111100000001100000000110000000011000",
  "5": "00000000000000111000000111100000011000000001100000000111000000011110000000011000000001100000000010000000001000000001100000010110000001110000",
  "6": "00000000000000000000000001100000001110000000100000000110000000011000000001111000000111100000011011000001101100000110110000001011000000111000",
  "7": "00000000000000000000000111100000011110000000011000000001100000000110000000011000000001100000000100000000110000000011000000001100000000110000",
  "8": "00000000000000000000000000000000001110000001111000000110100000011010000001111000000011100000001110000001101000000110100000011010000001111000",
  "9": "00000000000000000000000000000000001110000001111000000110100000011010000001101000000110100000011110000000111000000000100000000010000000011000",
};

function getGridSignature(pngData: { width: number; height: number; data: Buffer }): string {
  const { width, height, data } = pngData;

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
          if (data[idx] > R_THRESHOLD) brightPixels++;
          totalPixels++;
        }
      }

      sig += (brightPixels / totalPixels) >= CELL_RATIO_THRESHOLD ? "1" : "0";
    }
  }

  return sig;
}

function hammingDistance(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  // 길이 차이도 거리에 추가
  dist += Math.abs(a.length - b.length);
  return dist;
}

/**
 * PNG 파일에서 숫자를 인식
 * @returns 인식된 숫자 문자열 ("0"-"9") 또는 null
 */
export function recognizeDigit(pngPath: string): string | null {
  const buf = fs.readFileSync(pngPath);
  const png = PNG.sync.read(buf);
  const sig = getGridSignature(png);

  let bestDigit: string | null = null;
  let bestDistance = Infinity;

  for (const [digit, refSig] of Object.entries(DIGIT_SIGNATURES)) {
    const dist = hammingDistance(sig, refSig);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestDigit = digit;
    }
  }

  return bestDigit;
}

/**
 * 10개의 pad-key 스크린샷에서 키패드 매핑을 생성
 * @returns { "0": "표시된숫자", "1": "표시된숫자", ... } 또는 null
 */
export function recognizeKeypadMapping(screenshotDir: string): Record<string, string> | null {
  const mapping: Record<string, string> = {};

  for (let i = 0; i < 10; i++) {
    const imgPath = `${screenshotDir}/pad-key-${i}.png`;
    if (!fs.existsSync(imgPath)) return null;

    const digit = recognizeDigit(imgPath);
    if (digit === null) return null;

    mapping[String(i)] = digit;
  }

  // 검증: 0-9 모든 숫자가 매핑에 있어야 함
  const values = new Set(Object.values(mapping));
  if (values.size !== 10) {
    return null; // 중복이 있으면 인식 실패
  }

  return mapping;
}
