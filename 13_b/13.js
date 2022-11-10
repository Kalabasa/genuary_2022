/// <reference path="../node_modules/@types/p5/global.d.ts" />

const simulatePaint = true;
const debugWater = false;

const moonCount = 1;
const maxMoonPhase = 1;
const moonRadius = 250;
const margin = 10;

const waterScale = 0; // expoonential
const evaporationRate = 0.2;

const spreadRadius = 10;
const paintSizeBuffer = spreadRadius * 2;

let colorSchemeFunc;

let paint;
let water;
let paintBuffer;
let simulationCount = 0;

function setup() {
  noLoop();
  pixelDensity(1);
  const c = createCanvas(600, 600);
  commonSetup(c, "Bulan");

  background(255);

  const h = random(0, 360);
  colorSchemeFunc = chroma
    .scale([
      chroma
        .blend(chroma.hsl(h + 180, 0.5, 0.5), chroma.rgb(0, 0, 255), "overlay")
        .set("hsl.s", 0.6)
        .set("hsl.l", 0.5),
      chroma.hsl(h, 0.6, 0.525),
      chroma
        .blend(chroma.hsl(h, 0.5, 0.5), chroma.rgb(255, 224, 0), "overlay")
        .set("hsl.s", 0.6)
        .set("hsl.l", 0.55),
    ])
    .mode("hsl")
    .gamma(0.8);

  paint = createGraphics(width + paintSizeBuffer * 2, height + paintSizeBuffer * 2);
  water = createGraphics(
    (width + paintSizeBuffer * 2) >> waterScale,
    (height + paintSizeBuffer * 2) >> waterScale
  );
  paintBuffer = createGraphics(width + paintSizeBuffer * 2, height + paintSizeBuffer * 2);

  if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

const runner = run();

function draw() {
  noLoop();
  if (!runner.next().done) {
    setTimeout(loop, 0);

    if (debugWater) {
      image(
        water,
        0,
        0,
        width / 1,
        height / 1,
        paintSizeBuffer >> waterScale,
        paintSizeBuffer >> waterScale,
        width >> waterScale,
        height >> waterScale
      );
    }

    return;
  }

  console.log("Done rendering!");
  if (Notification.permission === "granted") {
    new Notification("Done rendering!");
  }
}

function* run() {
  console.group("Painting base...");
  resetPaint(32);
  for (let i = 0; i < moonCount; i++) {
    const x = getMoonX(i);
    const p = getMoonPhase(i);
    paintMoon(x, height / 2, moonRadius, p, 2, 2, 240, 0, 1);
  }
  simulate();
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting base 2...");
  resetPaint(32);
  for (let i = 0; i < moonCount; i++) {
    const x = getMoonX(i);
    const p = getMoonPhase(i);
    paintMoon(x, height / 2, moonRadius, p, 2, 2, 240, 0.2, 0.8);
  }
  simulate();
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting midtones...");
  resetPaint(32);
  for (let i = 0; i < moonCount; i++) {
    const x = getMoonX(i);
    const p = getMoonPhase(i);
    paintMoon(x, height / 2, moonRadius, p, 2, 2, 240, 0, 0.4);
  }
  simulate();
  simulate();
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting shadows...");
  resetPaint(32);
  for (let i = 0; i < moonCount; i++) {
    const x = getMoonX(i);
    const p = getMoonPhase(i);
    paintMoon(x, height / 2, moonRadius, p, 2, 2, 240, 0, 0.3);
  }
  simulate();
  simulate();
  simulate();
  simulate();
  applyPaint();
  console.groupEnd();
}

function getMoonX(i) {
  return moonCount === 1
    ? width / 2
    : map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
}

function getMoonPhase(i) {
  return map(i, -1, moonCount, -maxMoonPhase, maxMoonPhase);
}

function resetPaint(waterLevel) {
  water.background(waterLevel);
  paint.clear();
  simulationCount = 0;
}

function applyPaint() {
  image(paint, 0, 0, width, height, paintSizeBuffer, paintSizeBuffer, width, height);
}

function evaporateWater(rate) {
  const noiseScale = 0.1;
  noiseDetail(3, 0.6);

  water.loadPixels();
  for (let j = 0; j < water.height; j++) {
    for (let i = 0; i < water.width; i++) {
      const index = (i + j * water.width) * 4;
      const nv = noise(i * noiseScale, j * noiseScale);
      const sub = max(rate * (255 + 128) - nv * 128, 0);
      const value = water.pixels[index];
      water.pixels[index] = ceil(max(value - sub, 8));
    }
  }
  water.updatePixels();
}

function paintMoon(cx, cy, radius, phase, blobSize, step, wetness, minNoise = 0, maxNoise = 1) {
  console.log(`Painting moon (${round(cx)}, ${round(cy)}) (blobSize=${blobSize})...`);

  const angleNoiseScale = 0.003;

  for (let y = cy - radius, he = cy + radius; y < he; y += step) {
    const yx = sqrt(radius ** 2 - (y - cy) ** 2);
    for (let x = cx - yx, we = cx + yx; x < we; x += step) {
      const bx = random(x, x + step);
      const by = random(y, y + step);
      const br = max(randomGaussian(blobSize, blobSize), 2);

      const d = Math.hypot(bx - cx, by - cy);
      if (d > radius - br) continue;

      if (phase < 0) {
        if ((1 - cos(map(bx, cx - yx, cx + yx, 0, PI))) * 0.5 < -phase) continue;
      } else {
        if ((1 + cos(map(bx, cx - yx, cx + yx, 0, PI))) * 0.5 < phase) continue;
      }

      const bc = getColor(bx, by, minNoise, maxNoise);
      if (!bc) continue;

      const bw = randomGaussian(wetness, 8);
      bc.setAlpha(constrain(32 - bw * 0.1, 0, 255));

      noiseDetail(3, 0.4);
      const df = 1 - (d / radius) ** 3;
      const blobRatio = 2 ** (randomGaussian(1, 2 ** -(br / 2)) * df);
      const blobAngle = atan2(
        noise(x * angleNoiseScale, y * angleNoiseScale) * 2 - 1,
        noise(x * angleNoiseScale, y * angleNoiseScale, 4) * 2 - 1
      );
      paintBlob(bx, by, br, blobRatio, blobAngle, bc, bw);
    }
  }
}

function getColor(x, y, minNoise, maxNoise) {
  const noiseScale = 0.006;
  noiseDetail(2, 0.6);
  const nv = noise(x * noiseScale, y * noiseScale);
  if (nv < minNoise || nv > maxNoise) return undefined;
  return color(colorSchemeFunc(lerp(nv, maxNoise, 0.85)).rgb());
}

function paintBlob(x, y, r, ratio, angle, color, wetness) {
  const d = r * 2;

  paint.push();
  paint.noStroke();
  paint.fill(color);
  paint.translate(x + paintSizeBuffer, y + paintSizeBuffer);
  paint.rotate(angle);
  paint.ellipse(0, 0, d, d * ratio);
  paint.pop();

  water.push();
  water.noStroke();
  water.fill(255, 0, 0, wetness);
  water.translate((x + paintSizeBuffer) >> waterScale, (y + paintSizeBuffer) >> waterScale);
  water.rotate(angle);
  water.ellipse(0, 0, d >> waterScale, (d >> waterScale) * ratio);
  water.pop();
}

function simulate() {
  if (!simulatePaint) return;
  console.log("Simulating paint...");

  const totalWork = (paint.height - paintSizeBuffer * 2) * (paint.width - paintSizeBuffer * 2);
  let workCount = 0;
  const incrementWork = () => {
    const prevPerc = Math.round(100 * workCount / totalWork);
    workCount++;
    const nowPerc = Math.round(100 * workCount / totalWork);
    if (prevPerc < nowPerc) console.log('%');
  }

  const PI = Math.PI;
  const E = Math.E;

  evaporateWater(evaporationRate);
  if (simulationCount > 0) {
    water.filter(BLUR, spreadRadius >> waterScale);
  }

  water.loadPixels();
  paint.loadPixels();
  paintBuffer.loadPixels();

  for (let y = paintSizeBuffer, he = paint.height - paintSizeBuffer; y < he; y++) {
    for (let x = paintSizeBuffer, we = paint.width - paintSizeBuffer; x < we; x++) {
      incrementWork();
      const index = (x + y * paint.width) * 4;
      const waterIndex = ((x >> waterScale) + (y >> waterScale) * water.width) * 4;
      const w0 = water.pixels[waterIndex];

      const scale = 1 / 255;

      let r = 1;
      let g = 1;
      let b = 1;
      let a = 1;
      let w = 0;

      for (let dy = -paintSizeBuffer, dhe = paintSizeBuffer; dy <= dhe; dy++) {
        const py = y + dy;
        const dy2 = dy ** 2;
        for (let dx = -paintSizeBuffer, dwe = paintSizeBuffer; dx <= dwe; dx++) {
          const px = x + dx;
          const dx2 = dx ** 2;

          const pIndex = (px + py * paint.width) * 4;
          const waterPIndex = ((px >> waterScale) + (py >> waterScale) * water.width) * 4;

          const wetness = (w0 * water.pixels[waterPIndex]) / 65025;
          const paintSpreadRadius = 0.01 + spreadRadius * wetness;

          // gaussian blur factor
          const sigma2 = paintSpreadRadius ** 2;
          const d2 = dx2 + dy2;
          const paintFactor = (1 / (2 * PI * sigma2)) * E ** -(d2 / (2 * sigma2));

          const pa = paint.pixels[pIndex + 3] * scale;
          const pw = pa * paintFactor;
          r *= (1 + paint.pixels[pIndex] * scale) ** pw;
          g *= (1 + paint.pixels[pIndex + 1] * scale) ** pw;
          b *= (1 + paint.pixels[pIndex + 2] * scale) ** pw;
          a *= (1 + pa) ** pw;
          w += pw;
        }
      }

      const alpha = paint.pixels[index + 3] * scale;
      const weight = alpha;
      r *= (1 + paint.pixels[index] * scale) ** weight;
      g *= (1 + paint.pixels[index + 1] * scale) ** weight;
      b *= (1 + paint.pixels[index + 2] * scale) ** weight;
      a *= (1 + alpha) ** weight;
      w += weight;

      r = r ** (1 / w) - 1;
      g = g ** (1 / w) - 1;
      b = b ** (1 / w) - 1;
      a = a ** (1 / w) - 1;

      paintBuffer.pixels[index] = constrain(round(r / scale), 0, 255);
      paintBuffer.pixels[index + 1] = constrain(round(g / scale), 0, 255);
      paintBuffer.pixels[index + 2] = constrain(round(b / scale), 0, 255);
      paintBuffer.pixels[index + 3] = constrain(round(a / scale), 0, 255);
    }
  }

  paintBuffer.updatePixels();
  [paint, paintBuffer] = [paintBuffer, paint];

  simulationCount++;
}
