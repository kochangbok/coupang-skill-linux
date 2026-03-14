import path from "node:path";
import os from "node:os";
import { recognizeDigit, recognizeKeypadMapping } from "../src/keypad-ocr.js";

const screenshotDir = path.join(os.homedir(), ".coupang-session/screenshots");

console.log("개별 인식 테스트:");
for (let i = 0; i < 10; i++) {
  const imgPath = path.join(screenshotDir, `pad-key-${i}.png`);
  const digit = recognizeDigit(imgPath);
  console.log(`  pad-key-${i}: ${digit}`);
}

console.log("\n전체 매핑 테스트:");
const mapping = recognizeKeypadMapping(screenshotDir);
console.log(mapping);

// 실제 매핑과 비교
console.log("\n기대값: {0:8, 1:1, 2:9, 3:3, 4:0, 5:2, 6:7, 7:6, 8:5, 9:4}");
