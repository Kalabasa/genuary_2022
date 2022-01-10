/// <reference path="../node_modules/@types/p5/global.d.ts" />

let skyColor;

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1080);
  commonSetup(c, "Skyscraper");

  skyColor = chroma(randomGaussian(64, 32), randomGaussian(160, 16), 255).desaturate(1);
}

function draw() {
  drawBackground();
  for (let i = 40; i >= 0; i--) {
    drawLevel(i);
  }
}

function drawBackground() {
  background(...skyColor.rgb());
}

function drawLevel(level) {
  let leftColor;
  let rightColor;

  if (level % 2 === 0) {
    const baseColor = chroma(216, 216, 216);
    rightColor = chroma.blend(
      baseColor,
      chroma.temperature(skyColor.luminance() * 7000),
      "overlay"
    );
    leftColor = chroma.blend(rightColor.darken(2), skyColor, "screen");
  } else {
    rightColor = chroma.blend(skyColor, "black", "overlay").desaturate(3).darken(3);
    leftColor = rightColor;
  }

  noStroke();

  const left = createVector(width * -8, height * 8);
  const mid = createVector(width / 2, height);
  const right = createVector(width * 9, height * 8);

  const z = level * 150 + ((level % 2) * 2 - 1) * 50;

  const cx = width / 2;
  const cy = height / 2;
  transformDepth(left, cx, cy, z);
  transformDepth(mid, cx, cy, z);
  transformDepth(right, cx, cy, z);

  fill(...leftColor.rgb());
  beginShape();
  vertex(left.x, left.y);
  vertex(mid.x, mid.y);
  vertex(mid.x, left.y);
  endShape();

  fill(...rightColor.rgb());
  beginShape();
  vertex(mid.x, right.y);
  vertex(mid.x, mid.y);
  vertex(right.x, right.y);
  endShape();
}

function transformDepth(point, cx, cy, z) {
  const focalLength = 1000;
  const s = focalLength / (focalLength + z);
  point.x = cx + (point.x - cx) * s;
  point.y = cy + (point.y - cy) * s;
}
