/// <reference path="../node_modules/@types/p5/global.d.ts" />

const renderDetail = true;

let canvas;

const rows = 4;
const cols = 4;
const margin = 100;
const frameSize = 185;
let gapX;
let gapY;

let noiseBias;
let noiseScale;
let noiseMagnitude;
let thicknessBias;
let echoChance;
let splatterChance;

function setup() {
  noLoop();
  pixelDensity(2);
  canvas = createCanvas(1080, 1080);
  commonSetup(canvas, 'Broken squares');

  gapX = (width - margin * 2 - frameSize * cols) / (cols - 1);
  gapY = (height - margin * 2 - frameSize * rows) / (rows - 1);

  noiseDetail(2, 0.5);
  noiseBias = (1 + 0.5) / 4;

  noiseScale = randomGaussian(1, 0.5);
  noiseMagnitude = max(randomGaussian(50, 100), 0);
  thicknessBias = randomGaussian(0, 0.01);
  echoChance = randomGaussian(0.5, 0.5);
  splatterChance = randomGaussian(0.2, 0.1);
}

function draw() {
  drawBackground();

  const colors = chroma
    .scale([
      chroma
        .blend('#910d1f', chroma(random(0, 255), random(0, 255), 0), 'overlay')
        .set('lch.c', 150)
        .luminance(0.1),
      chroma
        .blend('#d4bf7d', chroma(random(0, 255), random(0, 128), 0), 'overlay')
        .set('lch.c', randomGaussian(10, 5))
        .luminance(randomGaussian(0.75, 0.05)),
    ])
    .mode('lch')
    .gamma(0.5)
    .colors(3)
    .map((c) => color(c));

  drawStripes(round(randomGaussian(0, 1)), colors[2]);
  drawStripes(round(randomGaussian(0, 1.5)), colors[1]);
  drawStripes(round(randomGaussian(1.5, 1)), colors[0]);
  drawStripes(round(randomGaussian(17 + echoChance * 10, 3)), color('#0b0c0f'));
  swapRandomFrames();
  applyNoise(0.015);

  drawRandomSplatters(color('#f7f8fa'));

  drawEnvironment();
}

function drawBackground() {
  background('#e3e2da');
  applyNoise(0.04);
}

function drawStripes(num, color) {
  const step = 20;

  let lastLine = undefined;
  let lastRotation = undefined;

  for (let i = 0; i < num; i++) {
    let a0, b0, a1, b1, rotation;

    if (!lastLine || random() >= echoChance) {
      const l0 = max(
        8,
        randomGaussian(width * (0.017 + thicknessBias), width * 0.006)
      );
      a0 = random(0, width - l0);
      b0 = a0 + l0;

      const l1 = max(
        8,
        randomGaussian(width * (0.017 + thicknessBias), width * 0.006)
      );
      a1 = random(0, width - l1);
      b1 = a1 + l1;
      rotation = floor(random() * 2) * HALF_PI;
    } else {
      // echo last line
      [a0, b0, a1, b1] = lastLine;
      const shrink = constrain(randomGaussian(0.4, 0.1), 0, 0.5);
      const offset =
        (max(b0 - a0, b1 - a1) * (1 - shrink * 2) +
          max(randomGaussian(8, 8), 0)) *
        Math.sign(random() - 0.5);
      a0 += offset;
      b0 += offset;
      a1 += offset;
      b1 += offset;
      [a0, b0] = [lerp(a0, b0, shrink), lerp(a0, b0, 1 - shrink)];
      [a1, b1] = [lerp(a1, b1, shrink), lerp(a1, b1, 1 - shrink)];
      rotation = lastRotation;
    }

    push();
    translate(width / 2, height / 2);
    rotate(rotation);
    translate(-width / 2, -height / 2);
    noStroke();
    fill(color);

    for (let j = 0; j < height; j += step) {
      const t0 = j / height;
      const t1 = (j + step) / height;

      const n0 =
        (noise(t0 * noiseScale, i * 0.1) - noiseBias) * 2 * noiseMagnitude;
      const n1 =
        (noise(t1 * noiseScale, i * 0.1) - noiseBias) * 2 * noiseMagnitude;

      const ax0 = lerp(a0, a1, t0) + n0;
      const bx0 = lerp(b0, b1, t0) + n0;
      const ax1 = lerp(a0, a1, t1) + n1;
      const bx1 = lerp(b0, b1, t1) + n1;

      quad(ax0, j, bx0, j, bx1, j + step, ax1, j + step);

      if (random() < splatterChance) {
        drawLinearSplatter(
          (ax0 + ax1 + bx0 + bx1) / 4 +
            Math.max(bx0 - ax0, bx1 - ax1) *
              random(0.75, 1.5) *
              Math.sign(random() - 0.5),
          j + step / 2,
          Math.min(randomGaussian(3, 1), bx0 - ax0, bx1 - ax1),
          randomGaussian(2, 1),
          color
        );
      }
    }

    pop();

    lastRotation = rotation;
    lastLine = [a0, b0, a1, b1];
    if (min(b0 - a0, b1 - a1) < 4) lastLine = undefined;
  }
}

function swapRandomFrames() {
  const buffer = createGraphics(width, height);

  const axisBias = random();

  const count = round(randomGaussian(1.5, 0.5));
  for (let i = 0; i < count; i++) {
    buffer.clear();
    if (random() < axisBias) {
      const srcCol = floor(random(0, cols));
      const srcX = margin + srcCol * (frameSize + gapX);
      buffer.image(canvas, 0, 0, frameSize, height, srcX, 0, frameSize, height);

      const dstCol = floor(random(0, cols));
      const dstX = margin + dstCol * (frameSize + gapX);
      image(canvas, srcX, 0, frameSize, height, dstX, 0, frameSize, height);
      image(buffer, dstX, 0, frameSize, height, 0, 0, frameSize, height);
    } else {
      const srcRow = floor(random(0, rows));
      const srcY = margin + srcRow * (frameSize + gapY);
      buffer.image(canvas, 0, 0, width, frameSize, 0, srcY, width, frameSize);

      const dstRow = floor(random(0, rows));
      const dstY = margin + dstRow * (frameSize + gapY);
      image(canvas, 0, srcY, width, frameSize, 0, dstY, width, frameSize);
      image(buffer, 0, dstY, width, frameSize, 0, 0, width, frameSize);
    }
  }
}

function drawLinearSplatter(x, y, size, length, color, shadow = false) {
  let cx = x;
  let cy = y;
  for (let i = 0; i < length; i++) {
    noStroke();
    if (shadow) {
      fill(0, size * 10);
      circle(cx, cy + 0.5, size);
    }
    fill(color);
    circle(cx, cy, size);

    const step = max(randomGaussian(40, 10), size * 0.5);
    cx += (noise(x, y, i * 0.06) - noiseBias) * 2 * step;
    cy += (noise(x, y, i * 0.06 + 2) - noiseBias) * 2 * step;
    cx += randomGaussian(0, 0.2);
    cy += randomGaussian(0, 0.2);
    size *= constrain(randomGaussian(0.6, 0.05), 0, 1);
  }
}

function drawRandomSplatters(color) {
  const noiseScale = 0.01;
  const spacing = 8;
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < width; y += spacing) {
      const nv = noise(x * noiseScale, y * noiseScale);
      if (random() - nv * 2 + 1.25 >= splatterChance) continue;
      drawLinearSplatter(
        randomGaussian(x, spacing),
        randomGaussian(y, spacing),
        nv * randomGaussian(4, 2),
        nv * randomGaussian(20, 10),
        color,
        true
      );
    }
  }
}

function drawEnvironment() {
  noStroke();
  fill('#c2c2c4');

  rect(0, 0, width, margin);
  rect(0, height - margin, width, margin);

  rect(0, 0, margin, height);
  rect(width - margin, 0, margin, height);

  for (let x = 0; x < cols - 1; x++) {
    rect(margin + frameSize + x * (frameSize + gapX), 0, gapX, height);
  }

  for (let y = 0; y < rows - 1; y++) {
    rect(0, margin + frameSize + y * (frameSize + gapY), width, gapY);
  }

  const shadows = createGraphics(width, height);
  shadows.noStroke();
  const incline = 4;
  const leftLight = -100;
  const rightLight = width + 600;
  const lightY = -4600;
  const lightZ = 16;

  const passes = 16;
  for (let i = 1; i <= passes; i++) {
    const f = (i / passes) ** (1 / 3);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const x0 = margin + x * (frameSize + gapX);
        const y0 = margin + y * (frameSize + gapY);
        const x1 = x0 + frameSize;
        const y1 = y0 + frameSize;

        // ambeint occlusion
        shadows.fill(0, 2 * f);
        shadows.quad(x0, y0, x1, y0, x1, y1, x0, y1);

        // left light
        shadows.fill(0, 1 * f);
        shadows.beginShape();
        shadows.vertex(x1 - incline, y0 + incline);
        shadows.vertex(
          ...projectShadow(
            x1,
            y0,
            leftLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.vertex(
          ...projectShadow(
            x1,
            y1,
            leftLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.vertex(
          ...projectShadow(
            x0,
            y1,
            leftLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.vertex(x0, y1 - incline);
        shadows.endShape(CLOSE);

        // right light
        shadows.fill(0, 2 * f);
        shadows.beginShape();
        shadows.vertex(x0 + incline, y0 + incline);
        shadows.vertex(x1, y1 - incline);
        shadows.vertex(
          ...projectShadow(
            x1,
            y1,
            rightLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.vertex(
          ...projectShadow(
            x0,
            y1,
            rightLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.vertex(
          ...projectShadow(
            x0,
            y0,
            rightLight + randomGaussian(0, 20),
            lightY + randomGaussian(0, 20),
            lightZ * i
          )
        );
        shadows.endShape(CLOSE);
      }
    }

    if (renderDetail) shadows.filter(BLUR, 22 / i);
    else break;
  }

  applyNoise(0.4);

  shadows.erase();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      shadows.rect(
        margin + x * (frameSize + gapX),
        margin + y * (frameSize + gapY),
        frameSize,
        frameSize
      );
    }
  }
  shadows.noErase();

  image(shadows, 0, 0);
}

function projectShadow(x, y, lightX, lightY, lightZ) {
  return [x + (x - lightX) / lightZ, y + (y - lightY) / lightZ];
}

function applyNoise(str) {
  if (!renderDetail) return;

  const noiseOverlay = createGraphics(width, height);
  noiseOverlay.background(255);
  noiseOverlay.loadPixels();
  for (let i = 0, n = noiseOverlay.pixels.length; i < n; i += 4) {
    const v = 128 - floor(random() ** 2 * 128 * str);
    noiseOverlay.pixels[i] = v;
    noiseOverlay.pixels[i + 1] = v;
    noiseOverlay.pixels[i + 2] = v;
  }
  noiseOverlay.updatePixels();

  blend(noiseOverlay, 0, 0, width, height, 0, 0, width, height, OVERLAY);
}
