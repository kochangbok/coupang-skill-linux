/**
 * 키패드 숫자의 특징점을 분석하여 견고한 인식 기준을 설계하는 스크립트.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const SESSION_DIR = path.join(process.env.HOME!, ".coupang-session");
const SCREENSHOT_DIR = path.join(SESSION_DIR, "screenshots");
const R_THRESHOLD = 100;

function readPng(filePath: string) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function binarize(png: { width: number; height: number; data: Buffer }): boolean[][] {
  const { width, height, data } = png;
  const grid: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      row.push(data[idx] > R_THRESHOLD);
    }
    grid.push(row);
  }
  return grid;
}

function getBBox(grid: boolean[][]) {
  const h = grid.length, w = grid[0].length;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** BFS로 배경에서 시작하여 내부 구멍 수를 세기 */
function countHoles(grid: boolean[][], bbox: ReturnType<typeof getBBox>): number {
  const { minX, maxX, minY, maxY } = bbox;
  // 1px 패딩 추가한 서브그리드
  const padW = (maxX - minX + 3);
  const padH = (maxY - minY + 3);
  const sub: boolean[][] = Array.from({ length: padH }, () => Array(padW).fill(false));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      sub[y - minY + 1][x - minX + 1] = grid[y][x];
    }
  }

  const visited: boolean[][] = Array.from({ length: padH }, () => Array(padW).fill(false));

  function bfs(sy: number, sx: number) {
    const queue = [[sy, sx]];
    visited[sy][sx] = true;
    while (queue.length > 0) {
      const [cy, cx] = queue.shift()!;
      for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const ny = cy + dy, nx = cx + dx;
        if (ny >= 0 && ny < padH && nx >= 0 && nx < padW && !visited[ny][nx] && !sub[ny][nx]) {
          visited[ny][nx] = true;
          queue.push([ny, nx]);
        }
      }
    }
  }

  // 외부 배경 flood fill (0,0에서 시작)
  bfs(0, 0);

  // 남은 미방문 비밝은 영역 = 구멍
  let holes = 0;
  for (let y = 0; y < padH; y++) {
    for (let x = 0; x < padW; x++) {
      if (!visited[y][x] && !sub[y][x]) {
        holes++;
        bfs(y, x); // 이 구멍 전체를 방문 처리
      }
    }
  }

  return holes;
}

/** 사분면별 밝은 픽셀 비율 (bbox 기준) */
function quadrantDensity(grid: boolean[][], bbox: ReturnType<typeof getBBox>) {
  const { minX, maxX, minY, maxY, width, height } = bbox;
  const midX = minX + Math.floor(width / 2);
  const midY = minY + Math.floor(height / 2);

  const counts = { tl: 0, tr: 0, bl: 0, br: 0, total: 0 };

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid[y][x]) {
        counts.total++;
        if (y < midY && x < midX) counts.tl++;
        else if (y < midY && x >= midX) counts.tr++;
        else if (y >= midY && x < midX) counts.bl++;
        else counts.br++;
      }
    }
  }

  const area = width * height / 4;
  return {
    tl: +(counts.tl / area).toFixed(3),
    tr: +(counts.tr / area).toFixed(3),
    bl: +(counts.bl / area).toFixed(3),
    br: +(counts.br / area).toFixed(3),
    fillRatio: +(counts.total / (width * height)).toFixed(3),
  };
}

/** 무게중심 (normalized 0-1) */
function centerOfMass(grid: boolean[][], bbox: ReturnType<typeof getBBox>) {
  const { minX, maxX, minY, maxY, width, height } = bbox;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid[y][x]) {
        sumX += (x - minX);
        sumY += (y - minY);
        count++;
      }
    }
  }
  return {
    cx: +((sumX / count) / width).toFixed(3),
    cy: +((sumY / count) / height).toFixed(3),
  };
}

/** 수평 스캔: 각 높이에서 밝은 구간 수 (dark→bright 전환 수) */
function horizontalSegments(grid: boolean[][], bbox: ReturnType<typeof getBBox>, relativeY: number): number {
  const y = bbox.minY + Math.floor(bbox.height * relativeY);
  if (y < 0 || y >= grid.length) return 0;
  let segments = 0;
  let inBright = false;
  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    if (grid[y][x] && !inBright) {
      segments++;
      inBright = true;
    } else if (!grid[y][x]) {
      inBright = false;
    }
  }
  return segments;
}

// 매핑 파일 읽기
const mappingPath = path.join(SESSION_DIR, "keypad-mapping.json");
const mapping: Record<string, string> = fs.existsSync(mappingPath)
  ? JSON.parse(fs.readFileSync(mappingPath, "utf-8"))
  : {};

console.log("매핑:", mapping);
console.log("\n=== 특징 분석 ===\n");
console.log("digit | holes | fill  | cx    | cy    | tl    | tr    | bl    | br    | seg25 | seg50 | seg75 | w/h");
console.log("------+-------+-------+-------+-------+-------+-------+-------+-------+-------+-------+-------+------");

for (let i = 0; i < 10; i++) {
  const imgPath = path.join(SCREENSHOT_DIR, `pad-key-${i}.png`);
  if (!fs.existsSync(imgPath)) continue;

  const png = readPng(imgPath);
  const grid = binarize(png);
  const bbox = getBBox(grid);
  const holes = countHoles(grid, bbox);
  const quad = quadrantDensity(grid, bbox);
  const com = centerOfMass(grid, bbox);
  const seg25 = horizontalSegments(grid, bbox, 0.25);
  const seg50 = horizontalSegments(grid, bbox, 0.50);
  const seg75 = horizontalSegments(grid, bbox, 0.75);
  const aspect = +(bbox.width / bbox.height).toFixed(3);

  const digit = mapping[String(i)] || "?";
  console.log(
    `  ${digit}   | ${holes}     | ${quad.fillRatio.toFixed(3)} | ${com.cx.toFixed(3)} | ${com.cy.toFixed(3)} | ${quad.tl.toFixed(3)} | ${quad.tr.toFixed(3)} | ${quad.bl.toFixed(3)} | ${quad.br.toFixed(3)} | ${seg25}     | ${seg50}     | ${seg75}     | ${aspect}`
  );
}
