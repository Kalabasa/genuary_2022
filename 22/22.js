/// <reference path="../node_modules/@types/p5/global.d.ts" />

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1080);
  commonSetup(c, "Iceberg");
}

function draw() {
  drawBackground();
}

function drawBackground() {
  background('red');
}
