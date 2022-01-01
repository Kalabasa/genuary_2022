/// <reference path="../node_modules/@types/p5/global.d.ts" />

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1350);
  commonSetup(c, 'Frilll');
}

function draw() {
  drawBackground();
  drawSpots();
}

function drawBackground() {
  background('#ebe2cc');
}

function drawSpots() {
  const hexRatio = 4 / 3;

  noStroke();
  const step = 0.3;

  const noiseScale1 = 0.04;
  const noiseScale2 = 0.002;
  noiseDetail(3, 0.3);

  const margin = 0.2;
  const w = 114;
  const h = 88;
  const wf = [19, 19, 19, 19, 19, 57, 114];

  const wd = wf[Math.floor(random(0, wf.length))];

  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      let x =
        width *
        (margin +
          ((1 - margin * 2) * (w * (1 - hexRatio) * 0.5 + i * hexRatio)) / w);
      let y =
        height *
        (margin + ((1 - margin * 2) * (j + (i % 2 == 0 ? 0.5 : 0))) / h);

      let length = 0.01 + noise(i * noiseScale1, j * noiseScale1) ** 2 * 60;
      const diameter = 1.6 + randomGaussian(0, 0.1);

      const angle =
        noise(
          i * noiseScale2 + ((Math.floor(i / wd) * 23) % 2),
          j * noiseScale2 + ((Math.floor(j / 31) * 71) % 2)
        ) *
        Math.PI *
        2;

      const dx = Math.cos(angle) * step;
      const dy = Math.sin(angle) * step;

      while (length > 0) {
        fill('#111114');
        circle(x, y, diameter);
        x += dx + randomGaussian(0, 0.08);
        y += dy + randomGaussian(0, 0.08);
        length -= step;
      }
    }
  }
}
