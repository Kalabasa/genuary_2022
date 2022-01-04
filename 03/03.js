/// <reference path="../node_modules/@types/p5/global.d.ts" />
/*
good seeds = score
667 = 9
4600 = 8
628 = 8
9378 = 9
7006 = 7
5747 = 6
8935 = 5
4943 = 3
*/
const simulatePaint = true;
const debugWater = false;
const waterScale = 0; // expoonential

const radius = 450;

const spreadRadius = 8;
const evaporation = 32;

let colorSchemeFunc;

let paint;
let water;
let paintBuffer;

function setup() {
  noLoop();
  pixelDensity(1);
  const c = createCanvas(1080, 1080);
  commonSetup(c, 'Nebulae');

  noiseDetail(3, 0.6);

  background('#ebeae6');

  const h = random(0, 360);
  colorSchemeFunc = chroma
    .scale([
      'black',
      chroma
        .blend(chroma.hsl(h, 1, 0.5), 'blue', 'overlay')
        .set('hsl.l', 0.1)
        .set('hsl.s', 1),
      chroma
        .blend(chroma.hsl(randomGaussian(h, 60), 1, 0.5), 'yellow', 'overlay')
        .set('hsl.l', 0.6)
        .set('hsl.s', 1),
      'white',
    ])
    .mode('hsl')
    .gamma(2);

  paint = createGraphics(width, height);
  water = createGraphics(width >> waterScale, height >> waterScale);
  paintBuffer = createGraphics(width, height);

  if (Notification.permission !== 'denied') {
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
        0,
        0,
        width >> waterScale,
        height >> waterScale
      );
    }

    return;
  }

  drawStars();

  console.log('Done rendering!');
  if (Notification.permission === 'granted') {
    new Notification('Done rendering!');
  }
}

function* run() {
  console.group('Painting base layer...');
  resetPaint(-64);
  paintBaseFill(100);
  paintNebula(40, 40, 128);
  paintNebula(20, 20, 255);
  simulate();
  applyPaint();
  console.groupEnd();

  yield;

  console.group('Painting gradient...');
  resetPaint(8);
  paintNebula(6, 9, 128, 240, 256);
  simulate();
  applyPaint();

  yield;

  resetPaint(8);
  paintNebula(6, 9, 128, 160, 240); 
  simulate();
  applyPaint();

  yield;

  resetPaint(8);
  paintNebula(6, 9, 128, 0, 160);
  simulate();
  applyPaint();
  console.groupEnd();
}

function resetPaint(level) {
  const noiseScale = 0.15;
  water.loadPixels();
  for (let j = 0; j < water.width; j++) {
    for (let i = 0; i < water.height; i++) {
      const index = (i + j * water.width) * 4;
      const nv = noise(i * noiseScale, j * noiseScale);
      const w = constrain(round(level + nv * 255 - 128), 0, 255);
      water.pixels[index] = w;
      water.pixels[index + 1] = w;
      water.pixels[index + 2] = w;
      water.pixels[index + 3] = 255;
    }
  }
  water.updatePixels();

  paint.clear();
}

function applyPaint() {
  image(paint, 0, 0, width, height, 0, 0, width, height);
}

function paintBaseFill(baseFillRadius) {
  console.log(`Painting base fill...`);

  for (
    let x = width / 2 - radius, we = width / 2 + radius;
    x < we;
    x += baseFillRadius * 1.41
  ) {
    for (
      let y = height / 2 - radius, he = height / 2 + radius;
      y < he;
      y += baseFillRadius * 1.41
    ) {
      if (Math.hypot(x - width / 2, y - height / 2) < radius - baseFillRadius) {
        paintBlob(
          x,
          y,
          baseFillRadius,
          color(...colorSchemeFunc(0.4).rgb()),
          192
        );
      }
    }
  }

  const noiseScale = 0.5;
  const ao = random(0, Math.PI * 2);
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const nv = noise(a * noiseScale);
    const r = radius - baseFillRadius + radius * nv * 0.05;
    const x = width / 2 + Math.sin(ao + a) * r;
    const y = height / 2 + Math.cos(ao + a) * r;
    paintBlob(
      x,
      y,
      baseFillRadius,
      color(...colorSchemeFunc(0.5).rgb(), 192),
      64
    );
  }
}

function paintNebula(blobSize, step, wetness, minThreshold = 0, maxThreshold = 256) {
  console.log(`Painting nebula (${blobSize})...`);
  for (let x = width / 2 - radius, we = width / 2 + radius; x < we; x += step) {
    for (
      let y = height / 2 - radius, he = height / 2 + radius;
      y < he;
      y += step
    ) {
      const bx = random(x, x + step);
      const by = random(y, y + step);
      const br = max(randomGaussian(blobSize, blobSize), 2);
      if (Math.hypot(bx - width / 2, by - height / 2) < radius - br) {
        const bc = getColor(bx, by);
        const b = brightness(bc);
        if (b < minThreshold || b >= maxThreshold) continue;

        const bw = random(8, wetness);
        bc.setAlpha(255 + 32 - bw);

        paintBlob(bx, by, br, bc, bw);
      }
    }
  }
}

function drawStars() {
  console.log('Drawing stars...');

  noStroke();
  for (let i = 0; i < 6000; i++) {
    const x = random(0, width);
    const y = random(0, height);

    if (Math.hypot(x - width / 2, y - height / 2) > radius && random() < 0.95) {
      continue;
    }

    const d = randomGaussian(0.2, 2);
    fill(color(0, 128));
    circle(x, y + 0.5, d);
    fill('white');
    circle(x, y, d);
  }
}

function getColor(x, y) {
  const noiseScale = 0.007;
  const nv = noise(x * noiseScale, y * noiseScale);
  const highlight = noise((y * noiseScale) / 2, (x * noiseScale) / 2);
  return color(
    ...chroma
      .blend(
        colorSchemeFunc(nv),
        chroma.temperature(highlight * 14000 + 1000).luminance(0.4),
        'overlay'
      )
      .rgb()
  );
}

function paintBlob(x, y, r, color, wetness) {
  const ratio = 2 ** randomGaussian(0, 2 ** -(r / 20));
  const d = r * 2;

  paint.push();
  paint.noStroke();
  paint.fill(color);
  paint.translate(x, y);
  paint.rotate(random(0, Math.PI * 2));
  paint.ellipse(0, 0, d, d * ratio);
  paint.pop();

  water.push();
  water.noStroke();
  water.fill(255, wetness);
  water.translate(x >> waterScale, y >> waterScale);
  water.rotate(random(0, Math.PI * 2));
  water.ellipse(0, 0, d >> waterScale, (d >> waterScale) * ratio);
  water.pop();
}

function simulate() {
  if (!simulatePaint) return;
  console.log('Simulating paint...');

  water.loadPixels();
  paint.loadPixels();
  paintBuffer.loadPixels();

  for (let x = spreadRadius * 2, he = height - spreadRadius * 2; x < he; x++) {
    for (let y = spreadRadius * 2, we = width - spreadRadius * 2; y < we; y++) {
      const index = (y + x * width) * 4;
      const waterIndex =
        ((x >> waterScale) + (y >> waterScale) * water.width) * 4;
      const w0 = water.pixels[waterIndex];

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (
        let dx = -spreadRadius * 2, dhe = spreadRadius * 2;
        dx <= dhe;
        dx++
      ) {
        for (
          let dy = -spreadRadius * 2, dwe = spreadRadius * 2;
          dy <= dwe;
          dy++
        ) {
          const px = y + dy;
          const py = x + dx;
          const pIndex = (px + py * width) * 4;
          const waterPIndex =
            ((px >> waterScale) + (py >> waterScale) * water.width) * 4;

          const wetness = (w0 * water.pixels[waterPIndex]) / 65025;
          const paintSpreadRadius = 0.2 + spreadRadius * wetness;
          const d2 = dy ** 2 + dx ** 2;
          const paintFactor =
            (1 / (2 * Math.PI * paintSpreadRadius ** 2)) *
            Math.E ** -(d2 / (2 * paintSpreadRadius ** 2));
          const alpha = paint.pixels[pIndex + 3] / 255;
          const colorFactor = alpha * paintFactor;
          r += paint.pixels[pIndex] * colorFactor;
          g += paint.pixels[pIndex + 1] * colorFactor;
          b += paint.pixels[pIndex + 2] * colorFactor;
          a += 255 * colorFactor;
        }
      }

      paintBuffer.pixels[index] = constrain(round(r), 0, 255);
      paintBuffer.pixels[index + 1] = constrain(round(g), 0, 255);
      paintBuffer.pixels[index + 2] = constrain(round(b), 0, 255);
      paintBuffer.pixels[index + 3] = constrain(round(a), 0, 255);
    }
  }

  paintBuffer.updatePixels();
  [paint, paintBuffer] = [paintBuffer, paint];

  water.filter(BLUR, spreadRadius >> waterScale);
}
