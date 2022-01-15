/// <reference path="../node_modules/@types/p5/global.d.ts" />

const simulatePaint = true;
const debugWater = false;

const moonCount = 9;
const maxMoonPhase = 1;
const moonRadius = 35;
const margin = 10;

const waterScale = 0; // expoonential
const evaporationRate = 0.4;

const spreadRadius = 16;
const paintSizeBuffer = spreadRadius * 2;

let colorSchemeFunc;

let paint;
let water;
let paintBuffer;
let simulationCount = 0;

function setup() {
  noLoop();
  pixelDensity(1);
  const c = createCanvas(800, 80);
  commonSetup(c, "Bulan");

  noiseDetail(3, 0.6);

  background(255);

  const h = random(0, 360);
  colorSchemeFunc = chroma
    .scale([
      chroma
        .blend(chroma.hsl(h + 180, 0.5, 0.5), chroma.rgb(0, 0, 255), "overlay")
        .set("hsl.s", 0.6)
        .set("hsl.l", 0.5),
      chroma.hsl(h, 0.6, 0.55),
      chroma
        .blend(chroma.hsl(h, 0.5, 0.5), chroma.rgb(255, 255, 0), "overlay")
        .set("hsl.s", 0.6)
        .set("hsl.l", 0.6),
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
  console.group("Painting spills...");
  resetPaint(64);
  for (let i = 0; i < moonCount; i++) {
    const x = map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
    paintMoon(x, height / 2, moonRadius, 0, 4, 4, 192, 0.7, 1);
  }
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting base...");
  resetPaint(0);
  for (let i = 0; i < moonCount; i++) {
    const x = map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
    const p = map(i, -1, moonCount, -maxMoonPhase, maxMoonPhase);
    paintMoon(x, height / 2, moonRadius, p, 2, 1, 144, 0, 1);
  }
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting base 2...");
  resetPaint(0);
  for (let i = 0; i < moonCount; i++) {
    const x = map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
    const p = map(i, -1, moonCount, -maxMoonPhase, maxMoonPhase);
    paintMoon(x, height / 2, moonRadius, p, 2, 2, 255, 0.2, 0.8);
  }
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting midtones...");
  resetPaint(0);
  for (let i = 0; i < moonCount; i++) {
    const x = map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
    const p = map(i, -1, moonCount, -maxMoonPhase, maxMoonPhase);
    paintMoon(x, height / 2, moonRadius, p, 2, 1, 144, 0, 0.4);
  }
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group("Painting shadows...");
  resetPaint(0);
  for (let i = 0; i < moonCount; i++) {
    const x = map(i, 0, moonCount - 1, margin + moonRadius, width - margin - moonRadius);
    const p = map(i, -1, moonCount, -maxMoonPhase, maxMoonPhase);
    paintMoon(x, height / 2, moonRadius, p, 1, 1, 128, 0, 0.2);
  }
  simulate();
  applyPaint();
  console.groupEnd();
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

  const noiseScale = 0.02;

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
      bc.setAlpha(255 / max(2 + bw * 0.4, 1));

      const df = 1 - (d / radius) ** 3;
      const blobRatio = 2 ** (randomGaussian(1, 2 ** -(br / 2)) * df);
      const blobAngle = atan2(
        noise(x * noiseScale, y * noiseScale) * 2 - 1,
        noise(x * noiseScale, y * noiseScale, 4) * 2 - 1
      );
      paintBlob(bx, by, br, blobRatio, blobAngle, bc, bw);
    }
  }
}

function getColor(x, y, minNoise, maxNoise) {
  const noiseScale = 0.04;
  const nv = noise(x * noiseScale, y * noiseScale);
  if (nv < minNoise || nv > maxNoise) return undefined;
  return color(colorSchemeFunc(nv).rgb());
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

  evaporateWater(evaporationRate);
  if (simulationCount > 0) {
    water.filter(BLUR, spreadRadius >> waterScale);
  }

  water.loadPixels();
  paint.loadPixels();
  paintBuffer.loadPixels();

  for (let y = paintSizeBuffer, he = paint.height - paintSizeBuffer; y < he; y++) {
    for (let x = paintSizeBuffer, we = paint.width - paintSizeBuffer; x < we; x++) {
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
          const paintFactor = (1 / (2 * Math.PI * sigma2)) * exp(-(d2 / (2 * sigma2)));

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

      r = pow(r, 1 / w) - 1;
      g = pow(g, 1 / w) - 1;
      b = pow(b, 1 / w) - 1;
      a = pow(a, 1 / w) - 1;

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
