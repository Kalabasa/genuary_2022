/// <reference path="../node_modules/@types/p5/global.d.ts" />

const cover = [];
const coverBias = [];

const margin = 200;

let bgColor;
let fgColor;

const dither = [
  (x, y) => true,
  (x, y) => (x + Math.floor(y * 3)) % 10 !== 0,
  (x, y) => x % 2 !== 0 || (y + Math.floor(x / 2)) % 2 !== 0,
  (x, y) => (x + y) % 2 === 0,
  (x, y) => x % 2 === 0 && (y + Math.floor(x / 2)) % 2 === 0,
  (x, y) => (x + Math.floor(y * 3)) % 10 === 0,
  (x, y) => (x + Math.floor(y / 5) * 3) % 6 === 0 && y % 5 === 0,
];

function setup() {
  noLoop();
  pixelDensity(1);
  const c = createCanvas(1080, 1350);
  commonSetup(c, 'Offworld');

  noSmooth();

  colorMode(HSB, 360, 1, 1);
  const h = random(360);
  bgColor = color(
    ...chroma
      .blend(
        chroma.hsl(h, 0.2, 0.5),
        chroma.temperature(1000),
        'overlay'
      )
      .set('hsl.s', 0.06)
      .set('hsl.l', 0.84)
      .hsl()
  );
  fgColor = color(
    ...chroma
      .blend(
        chroma.hsl(h + random(-30, 30), 0.4, 0.5),
        chroma.temperature(15000),
        'overlay'
      )
      .set('hsl.s', 0.6)
      .set('hsl.l', 0.2)
      .hsl()
  );
}

function draw() {
  drawBackground();

  let d = 0;
  let y = floor(height * 0.65);
  for (i = 0; i < 7; i++) {
    y -= random(0, 80 + i * 40);
    drawHills(y, dither[d], d < 3);
    d = (d + 1) % dither.length;
  }

  drawSun(y);
}

function drawBackground() {
  background(bgColor);
}

function drawHills(y, f, bias) {
  noiseDetail(4, constrain(randomGaussian(0.35, 0.1), 0, 1));

  for (let i = margin, w = width - margin; i < w; i++) {
    const currentCover = cover[i] ?? height;
    const leftCover = cover[i + 1] ?? height;
    const rightCover = cover[i + 1] ?? height;
    const currentBias = coverBias[i] ?? true;

    const iy = floor(y + noise(i / 400, y) * 400);
    for (
      let j = max(iy, margin), h = min(currentCover, height - margin);
      j < h;
      j++
    ) {
      if (
        (j + 1 >= currentCover && isSet(i, j + 1) !== currentBias) ||
        (j >= leftCover && isSet(i - 1, j) !== currentBias) ||
        (j >= rightCover && isSet(i + 1, j) !== currentBias)
      ) {
        if (currentBias) set(i, j, fgColor);
        continue;
      }

      if (!f(i, j)) continue;

      set(i, j, fgColor);
    }

    if (currentCover >= iy) coverBias[i] = bias;
    cover[i] = min(currentCover, iy);
  }

  updatePixels();
}

function drawSun(y) {
  y = floor(y + randomGaussian(0, 100));
  const r = floor(randomGaussian(60, 5));
  const x = floor(random(margin + r, width - margin - r));

  if (y >= cover[x] - r) {
  y = cover[x] + randomGaussian(-r / 4, r / 8);
  }

  if (y - r < margin) return;

  for (let i = x - r, we = x + r; i < we; i++) {
    const h = floor(r * abs(sin(acos((i - x) / r))));
    for (let j = y - h, he = y + h; j < he; j++) {
      if (j >= cover[i]) break;
      set(i, j, fgColor);
    }
  }

  updatePixels();
}

function isSet(x, y) {
  return get(x, y)[0] < 0x88;
}
