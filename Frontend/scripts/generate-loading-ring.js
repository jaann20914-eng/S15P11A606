/*
  AI 로딩 링 PNG 생성기.

  react-native-svg 없이 같은 모양을 내려고 링을 미리 그려 둔다. 앱에서는 이 그림을 돌리기만
  하면 되므로 네이티브 모듈이 필요 없다.

  사용법: node scripts/generate-loading-ring.js <출력경로> [지름] [색 구간 비율]

  시안 값을 따른다.
  - strokeWidth = size * 0.045
  - radius = size / 2 - strokeWidth
  - 색이 있는 구간의 비율은 인자로 받는다. 나머지는 비고 양 끝은 둥글게 처리한다.
  - 그라데이션: 왼쪽 위 → 오른쪽 아래
*/
const fs = require('fs');
const zlib = require('zlib');

const SIZE = Number(process.argv[3] ?? 320);
const STROKE = SIZE * 0.045;
const RADIUS = SIZE / 2 - STROKE;

/** 색이 있는 구간의 비율. 이 값만 바꿔 길이가 다른 장면을 여러 장 뽑는다. */
const DASH_RATIO = Number(process.argv[4] ?? 0.78);

/** 시안의 세 정지점. offset, 색, 불투명도. */
const STOPS = [
  { at: 0, rgb: [0xc4, 0xe6, 0x00], alpha: 1 },
  { at: 0.55, rgb: [0xd7, 0xf9, 0x5b], alpha: 0.85 },
  { at: 1, rgb: [0xf4, 0xf9, 0xde], alpha: 0.2 },
];

/** 계단이 보이지 않도록 한 픽셀을 이만큼 나눠 평균한다. */
const SUPERSAMPLE = 3;

function gradientAt(t) {
  const clamped = Math.min(1, Math.max(0, t));

  for (let i = 1; i < STOPS.length; i += 1) {
    const from = STOPS[i - 1];
    const to = STOPS[i];

    if (clamped > to.at && i < STOPS.length - 1) continue;

    const span = to.at - from.at;
    const k = span === 0 ? 0 : (clamped - from.at) / span;

    return {
      rgb: from.rgb.map((c, index) => c + (to.rgb[index] - c) * k),
      alpha: from.alpha + (to.alpha - from.alpha) * k,
    };
  }

  return { rgb: STOPS[0].rgb, alpha: STOPS[0].alpha };
}

/**
 * 이 점이 링 안에 있는지.
 *
 * 띠(가운데 원에서 두께의 절반 이내) 위에 있고, 색이 있는 각도 구간에 들어야 한다.
 * 구간 밖이라도 양 끝의 둥근 마개 안이면 칠한다.
 */
function inRing(x, y) {
  const cx = x - SIZE / 2;
  const cy = y - SIZE / 2;
  const distance = Math.hypot(cx, cy);
  const half = STROKE / 2;

  if (Math.abs(distance - RADIUS) <= half) {
    // SVG와 같게 3시 방향에서 시작해 시계 방향으로 진행한다.
    let angle = Math.atan2(cy, cx);
    if (angle < 0) angle += Math.PI * 2;

    if (angle <= Math.PI * 2 * DASH_RATIO) return true;
  }

  for (const end of [0, Math.PI * 2 * DASH_RATIO]) {
    const ex = Math.cos(end) * RADIUS;
    const ey = Math.sin(end) * RADIUS;

    if (Math.hypot(cx - ex, cy - ey) <= half) return true;
  }

  return false;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));

for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;

  for (let x = 0; x < SIZE; x += 1) {
    let hits = 0;

    for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
      for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
        const px = x + (sx + 0.5) / SUPERSAMPLE;
        const py = y + (sy + 0.5) / SUPERSAMPLE;

        if (inRing(px, py)) hits += 1;
      }
    }

    const coverage = hits / (SUPERSAMPLE * SUPERSAMPLE);
    const offset = rowStart + 1 + x * 4;

    if (coverage === 0) continue;

    const { rgb, alpha } = gradientAt((x + y) / (SIZE * 2));
    const finalAlpha = alpha * coverage;

    // 미리 곱하지 않은 값으로 저장한다(PNG 규격).
    raw[offset] = Math.round(rgb[0]);
    raw[offset + 1] = Math.round(rgb[1]);
    raw[offset + 2] = Math.round(rgb[2]);
    raw[offset + 3] = Math.round(finalAlpha * 255);
  }
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);

  return Buffer.concat([length, body, crc]);
}

let crcTable = null;

function crc32(buffer) {
  if (crcTable === null) {
    crcTable = [];

    for (let n = 0; n < 256; n += 1) {
      let c = n;

      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }

      crcTable[n] = c;
    }
  }

  let crc = 0xffffffff;

  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);

  return crc ^ 0xffffffff;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.writeFileSync(process.argv[2], png);
console.log(`${process.argv[2]} ${png.length} bytes (${SIZE}x${SIZE})`);
