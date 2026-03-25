/**
 * 키패드 숫자 인식 모듈 (특징점 기반)
 *
 * 쿠팡 PIN 키패드 스크린샷에서 숫자를 알고리즘으로 판별.
 * R채널 이진화 → 구멍 수 + 무게중심 + 사분면 밀도 + 수평 세그먼트 패턴으로 분류.
 */
import fs from "node:fs";
import { PNG } from "pngjs";
const R_THRESHOLD = 100;
// ─── 이미지 처리 ───
function binarize(png) {
    const { width, height, data } = png;
    const grid = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push(data[(y * width + x) * 4] > R_THRESHOLD);
        }
        grid.push(row);
    }
    return grid;
}
function getBBox(grid) {
    const h = grid.length, w = grid[0].length;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (grid[y][x]) {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
// ─── 특징 추출 ───
/** BFS로 구멍(enclosed region) 수 세기 */
function countHoles(grid, bbox) {
    const { minX, maxX, minY, maxY } = bbox;
    const padW = maxX - minX + 3;
    const padH = maxY - minY + 3;
    const sub = Array.from({ length: padH }, () => Array(padW).fill(false));
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            sub[y - minY + 1][x - minX + 1] = grid[y][x];
        }
    }
    const visited = Array.from({ length: padH }, () => Array(padW).fill(false));
    function bfs(sy, sx) {
        const queue = [[sy, sx]];
        visited[sy][sx] = true;
        while (queue.length > 0) {
            const [cy, cx] = queue.shift();
            for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const ny = cy + dy, nx = cx + dx;
                if (ny >= 0 && ny < padH && nx >= 0 && nx < padW && !visited[ny][nx] && !sub[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push([ny, nx]);
                }
            }
        }
    }
    // 외부 배경 flood fill
    bfs(0, 0);
    // 남은 미방문 비밝은 영역 = 구멍
    let holes = 0;
    for (let y = 0; y < padH; y++) {
        for (let x = 0; x < padW; x++) {
            if (!visited[y][x] && !sub[y][x]) {
                holes++;
                bfs(y, x);
            }
        }
    }
    return holes;
}
/** 무게중심 (bbox 내 normalized 0-1) */
function centerOfMass(grid, bbox) {
    let sumX = 0, sumY = 0, count = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
        for (let x = bbox.minX; x <= bbox.maxX; x++) {
            if (grid[y][x]) {
                sumX += x - bbox.minX;
                sumY += y - bbox.minY;
                count++;
            }
        }
    }
    return {
        cx: (sumX / count) / bbox.width,
        cy: (sumY / count) / bbox.height,
    };
}
/** 사분면별 밝은 픽셀 밀도 */
function quadrantDensity(grid, bbox) {
    const midX = bbox.minX + Math.floor(bbox.width / 2);
    const midY = bbox.minY + Math.floor(bbox.height / 2);
    let tl = 0, tr = 0, bl = 0, br = 0, total = 0;
    for (let y = bbox.minY; y <= bbox.maxY; y++) {
        for (let x = bbox.minX; x <= bbox.maxX; x++) {
            if (grid[y][x]) {
                total++;
                if (y < midY && x < midX)
                    tl++;
                else if (y < midY)
                    tr++;
                else if (x < midX)
                    bl++;
                else
                    br++;
            }
        }
    }
    const area = bbox.width * bbox.height / 4;
    return {
        tl: tl / area, tr: tr / area, bl: bl / area, br: br / area,
        fillRatio: total / (bbox.width * bbox.height),
    };
}
/** 수평 스캔: 특정 높이에서 밝은 세그먼트 수 */
function horizontalSegments(grid, bbox, relY) {
    const y = bbox.minY + Math.floor(bbox.height * relY);
    if (y < 0 || y >= grid.length)
        return 0;
    let segments = 0, inBright = false;
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
        if (grid[y][x] && !inBright) {
            segments++;
            inBright = true;
        }
        else if (!grid[y][x]) {
            inBright = false;
        }
    }
    return segments;
}
function extractFeatures(grid) {
    const bbox = getBBox(grid);
    const holes = countHoles(grid, bbox);
    const { cx, cy } = centerOfMass(grid, bbox);
    const quad = quadrantDensity(grid, bbox);
    const seg25 = horizontalSegments(grid, bbox, 0.25);
    const seg50 = horizontalSegments(grid, bbox, 0.50);
    const seg75 = horizontalSegments(grid, bbox, 0.75);
    return { holes, cx, cy, ...quad, seg25, seg50, seg75 };
}
function classifyDigit(f) {
    // 2 holes → 8
    if (f.holes >= 2)
        return "8";
    // 1 hole → 0, 4, 6, 9
    if (f.holes === 1) {
        // seg 패턴으로 분류
        const hasGap25 = f.seg25 >= 2;
        const hasGap50 = f.seg50 >= 2;
        const hasGap75 = f.seg75 >= 2;
        // 0: 상중하 모두 갭 있음
        if (hasGap25 && hasGap50 && hasGap75)
            return "0";
        // 6: 하단에 구멍 → 상단 갭 없고 하단 갭 있음
        if (!hasGap25 && hasGap50 && hasGap75)
            return "6";
        if (!hasGap25 && !hasGap50 && hasGap75)
            return "6";
        // 4 vs 9: 상단 갭 있고 하단 갭 없음
        if (hasGap25 && hasGap50 && !hasGap75) {
            // 4: fill 낮음, tl 밀도 낮음 / 9: fill 높음, tl 밀도 높음
            if (f.fillRatio < 0.47)
                return "4";
            return "9";
        }
        // fallback: cy로 구분 (9: 상단 편중, 6: 하단 편중)
        if (f.cy < 0.47)
            return "9";
        if (f.cy > 0.48)
            return "6";
        // 추가 fallback
        if (f.tl > f.bl)
            return "9";
        return "6";
    }
    // 0 holes → 1, 2, 3, 5, 7
    // 1, 7: fill이 낮음 (< 0.42)
    if (f.fillRatio < 0.42) {
        // 1 vs 7: 7은 상단 편중 (cy < 0.45), 1은 중앙 (cy ≈ 0.5)
        if (f.cy < 0.45)
            return "7";
        return "1";
    }
    // 2, 3, 5: fill ≥ 0.42
    // 3: cx 우측 편중 (cx > 0.53)
    if (f.cx > 0.53)
        return "3";
    // 2 vs 5: 사분면 패턴으로 구분
    // 5: tl 밀도 높고 br 밀도 높음 (왼쪽 위 + 오른쪽 아래)
    // 2: tr 밀도 높고 bl 밀도 높음 (오른쪽 위 + 왼쪽 아래)
    if (f.tl > f.tr && f.br > f.bl)
        return "5";
    if (f.tr > f.tl && f.bl > f.br)
        return "2";
    // fallback: cy로
    if (f.cy < 0.48)
        return "5"; // 5는 약간 상단 편중
    return "2";
}
// ─── Public API ───
/**
 * PNG 파일에서 숫자를 인식
 */
export function recognizeDigit(pngPath) {
    try {
        const buf = fs.readFileSync(pngPath);
        const png = PNG.sync.read(buf);
        const grid = binarize(png);
        const bbox = getBBox(grid);
        // 유효성 체크: 숫자 영역이 너무 작으면 실패
        if (bbox.width < 5 || bbox.height < 5)
            return null;
        const features = extractFeatures(grid);
        return classifyDigit(features);
    }
    catch {
        return null;
    }
}
/**
 * 10개의 pad-key 스크린샷에서 키패드 매핑을 생성
 */
export function recognizeKeypadMapping(screenshotDir) {
    const mapping = {};
    for (let i = 0; i < 10; i++) {
        const imgPath = `${screenshotDir}/pad-key-${i}.png`;
        if (!fs.existsSync(imgPath))
            return null;
        const digit = recognizeDigit(imgPath);
        if (digit === null)
            return null;
        mapping[String(i)] = digit;
    }
    // 검증: 0-9 모든 숫자가 정확히 1번씩 나와야 함
    const values = new Set(Object.values(mapping));
    if (values.size !== 10)
        return null;
    return mapping;
}
