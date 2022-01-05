/// <reference path="../node_modules/@types/p5/global.d.ts" />

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1350);
  commonSetup(c, 'Square');
}

function draw() {
  drawBackground();
}

function drawBackground() {
  background('#ffffff');
}
