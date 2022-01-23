/// <reference path="../node_modules/@types/p5/global.d.ts" />

const params = new URLSearchParams(window.location.search);
const renderDetail = params.has("d");
const backendMode = params.has("b");

const cellSize = 8;
const artSize = 120;
const clothSize = cellSize * artSize;

const canvasLinesPerCell = 6;
const canvasGap = 2;

let clothGraphics;
let artGraphics;
let stitchGraphics;

// Floridablanca vars

let blockers;
let blockersBuffer;

const margin = 10;
let gap;
let palette;

let spreadiness;

const particles = [];
const poles = [];

function setup() {
  pixelDensity(renderDetail ? 2 : 1);
  const c = createCanvas(1080, 1080);
  commonSetup(c, "Floridablanca ⨉ Jacquard");

  clothGraphics = createGraphics(clothSize, clothSize);
  clothGraphics.pixelDensity(pixelDensity());
  artGraphics = createGraphics(artSize, artSize);
  artGraphics.noSmooth();
  stitchGraphics = createGraphics(clothSize, clothSize);
  stitchGraphics.pixelDensity(pixelDensity());

  // Floridablanca setup

  blockers = createGraphics(artSize, artSize);
  blockersBuffer = createGraphics(artSize, artSize);

  blockers.background(0);

  noiseDetail(4, 0.2);

  const vibrance = randomGaussian(75, 50);
  const mainColor = chroma.blend(
    chroma(random(0, 255), random(0, 255), random(0, 255)),
    "white",
    "overlay"
  );
  palette = chroma
    .scale([
      mainColor.set("lch.c", vibrance).luminance(0.5),
      chroma
        .blend(chroma(random(0, 255), random(0, 255), random(0, 255)), "black", "overlay")
        .set("lch.c", vibrance)
        .luminance(0.25),
      mainColor.set("lch.h", "+180").luminance(0.2),
      "black",
    ])
    .gamma(randomGaussian(1.5, 1))
    .mode("hsl")
    .colors(max(round(randomGaussian(4, 1), 3)));

  const colorNoisiness = constrain(randomGaussian(0.75, 0.25), 0, 1);

  const minThickness = max(randomGaussian(4, 2), 2);
  const maxThickness =
    minThickness + max(randomGaussian(minThickness * 1.25, minThickness * 0.25), 0);

  const minThicknessAllowed = randomGaussian(0, minThickness * 0.4);

  const averageLifeTime = max(randomGaussian(600, 300), 2);
  const stdDevLifeTime = abs(randomGaussian(0, 200));

  gap =
    (minThickness * 0.25 + max(randomGaussian(0, 3), -maxThickness)) *
    (1.05 - 1 / (averageLifeTime * 20 + stdDevLifeTime));
  const spacing = constrain(gap * 0.6, 1, 20);

  const brushiness = constrain(randomGaussian(0.75, 0.25), 0, 1);
  spreadiness = max(randomGaussian(0.2, 0.8), 0);

  for (let x = margin; x < artSize - margin; x += spacing) {
    for (let y = margin; y < artSize - margin; y += spacing) {
      const thickness = constrain(
        maxThickness * max(randomGaussian(0, 0.4), 0) ** 2,
        minThickness,
        maxThickness
      );

      if (particles.length > 10 && thickness < minThicknessAllowed) continue;

      const points = [];
      for (let i = 0; i < thickness; i++) {
        const a = random(0, TWO_PI);
        const r = random(0, 0.5 * thickness * brushiness);
        points.push({
          thickness: constrain(
            (thickness * 0.5 - r) * random(),
            minThickness * 0.6,
            minThickness + 1 + brushiness * thickness * 0.1
          ),
          x: sin(a) * r,
          y: cos(a) * r,
        });
      }

      let colorBias = randomGaussian(0.5, 0.5 * (minThickness / thickness) * colorNoisiness);
      colorBias += (noise(x * 0.002, y * 0.002) - 0.5) * (1 - colorNoisiness);
      colorBias = constrain(colorBias, 0, 1 - Number.EPSILON);

      const particle = {
        pos: createVector(randomGaussian(x, spacing * 0.5), randomGaussian(y, spacing * 0.5)),
        histPos: undefined,
        thickness,
        points,
        color: color(palette[floor(palette.length * colorBias)]),
        lifetime: 0,
        ttl: randomGaussian(averageLifeTime, stdDevLifeTime),
      };
      particles.push(particle);
    }
  }
  shuffle(particles, true);
  particles.sort((a, b) => b.thickness - a.thickness);

  const turniness = constrain(randomGaussian(0.75, 1), 0, 1);
  const pulliness = constrain(randomGaussian(0.75, 1), 0, 1);

  const numPoles = max(randomGaussian(2, 7), 2);
  for (let i = 0; i < numPoles; i++) {
    let pos;
    if (i < 3) {
      pos = createVector(
        randomGaussian(artSize / 2, artSize / 12),
        randomGaussian(artSize / 2, artSize / 12)
      );
    } else {
      pos = createVector(random(0, artSize), random(0, artSize));
    }
    const minRange = random(20, min(artSize, artSize) / 6);
    const maxRange = minRange + 20 + random(0, max(artSize, artSize) / 12);
    const dir = p5.Vector.fromAngle(random(0, PI * 2));
    const force = max(1, randomGaussian(1, 1));
    const pole = {
      pos,
      minRange,
      maxRange,
      pull: dir.x * force * pulliness,
      turn: dir.y * force * turniness,
    };
    poles.push(pole);
  }

  // global poles so everything moves
  for (let i = 0; i < 1; i++) {
    const dir = p5.Vector.fromAngle(random(0, PI * 2));
    const force = 0.5;
    const pole = {
      pos: createVector(random(0, artSize), random(0, artSize)),
      minRange: 0,
      maxRange: Math.hypot(artSize, artSize),
      pull: dir.x * force,
      turn: dir.y * force,
    };
    poles.push(pole);
  }
}

function draw() {
  while (particles.length && isBlocked(particles[0].pos.x, particles[0].pos.y)) {
    particles.shift();
  }

  if (!particles.length) {
    if (renderDetail) {
      if (document.body.style.cursor === "wait") {
        noLoop();
        drawJacquard();
        document.body.style.cursor = "";
        setTimeout(() => alert("Done rendering!"));
      } else {
        document.body.style.cursor = "wait";
      }
    }
    return;
  }

  const tmpVec0 = createVector();
  const tmpVec1 = createVector();

  const pc = particles[0];
  blockersBuffer.clear();

  while (true) {
    const forces = [];
    for (const pl of poles) {
      const delta = p5.Vector.sub(pl.pos, pc.pos);
      const dist = delta.mag();

      if (dist <= pl.minRange || dist >= pl.maxRange) continue;

      const relDist = (dist - pl.minRange) / (pl.maxRange - pl.minRange);
      const power = (relDist * (1 - relDist)) ** 3 * 96 ** -relDist;

      const dir = p5.Vector.mult(delta, 1 / delta.mag(), tmpVec0);
      const latDir = p5.Vector.rotate(dir, HALF_PI, tmpVec1);

      forces.push(
        createVector()
          .add(p5.Vector.mult(dir, pl.pull * power, tmpVec0))
          .add(p5.Vector.mult(latDir, pl.turn * power, tmpVec1))
      );
    }

    let checkHistPos = false;
    if (pc.histPos) {
      pc.histPos.lerp(pc.pos, 0.5);
      checkHistPos = true;
    } else {
      pc.histPos = pc.pos.copy();
    }

    const sum = createVector(0, 0);
    for (const f of forces) sum.add(f);
    sum.setMag(forces.length ? 24 / (6 + forces.length) : 0);
    const { x: hx, y: hy } = pc.pos;
    pc.pos.x += sum.x;
    pc.pos.y += sum.y;

    pc.lifetime++;
    pc.ttl--;

    if (
      pc.ttl <= 0 ||
      pc.pos.x < margin ||
      pc.pos.y < margin ||
      pc.pos.x >= artSize - margin ||
      pc.pos.y >= artSize - margin ||
      (checkHistPos && pc.pos.dist(pc.histPos) < 1 + sum.mag() * 0.5) ||
      isBlocked(pc.pos.x, pc.pos.y)
    ) {
      particles.shift();
      blockers.image(blockersBuffer, 0, 0);
      break;
    }

    artGraphics.stroke(pc.color);
    blockersBuffer.stroke(255);

    let spread = 0;
    for (const pt of pc.points) {
      let { x, y, thickness } = pt;
      spread =
        (noise(pc.pos.x * 0.025, pc.pos.y * 0.025) * (2 + spreadiness)) / (20 + pc.thickness);
      const hf = 1 + spread - 1 / (pc.lifetime * 2);
      const f = 1 + spread - 1 / ((pc.lifetime + 1) * 2);
      const phx = hx + x * hf;
      const phy = hy + y * hf;
      const px = pc.pos.x + x * f;
      const py = pc.pos.y + y * f;

      artGraphics.strokeWeight(thickness);
      artGraphics.line(phx, phy, px, py);

      if (thickness + gap > 0) {
        blockersBuffer.strokeWeight(thickness + gap);
        blockersBuffer.line(phx, phy, px, py);
      }
    }
  }

  background(255);
  image(artGraphics, 0, 0, width, height);
}

function isBlocked(x, y) {
  return blockers.get(x, y)[0] > 0;
}

function drawJacquard() {
  background("#d4d2c3");

  drawClothTexture(clothGraphics, 0, 0, clothSize, clothSize);
  if (backendMode) {
    drawBackStitches(stitchGraphics, 0, 0, clothSize, clothSize);
  } else {
    drawStitches(stitchGraphics, 0, 0, clothSize, clothSize);
  }

  push();

  const x = (width - clothSize) / 2;
  const y = (height - clothSize) / 2;

  translate(width / 2, height / 2);
  if (backendMode) scale(-1, 1);
  rotate(randomGaussian(0, PI * 0.04));
  translate(-width / 2, -height / 2);

  const clothShadowGraphics = createGraphics(width, height);
  clothShadowGraphics.noStroke();
  clothShadowGraphics.fill(0, 32);
  clothShadowGraphics.rect(
    x + cellSize / 2 + 2,
    y + cellSize / 2 + 3,
    clothSize - cellSize,
    clothSize - cellSize
  );
  clothShadowGraphics.filter(BLUR, 5);
  image(clothShadowGraphics, 0, 0);

  image(clothGraphics, x, y);
  image(stitchGraphics, x, y);

  pop();

  applyNoise(this, 0.4);
}

function drawStitches(target, x, y, w, h) {
  const stitchesMask = createGraphics(w, h);
  const stitchesColor = createGraphics(w, h);

  const artAlphaThreshold = 128;

  const crossStitches = [];

  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      const rgba = artGraphics.get(x / cellSize, y / cellSize);

      if (rgba[3] < artAlphaThreshold) continue;
      if (rgba[0] === 255 && rgba[1] === 255 && rgba[2] === 255) continue;

      const colour = findPaletteColor(rgba);

      if (!renderDetail) {
        target.noStroke();
        target.fill(colour);
        target.rect(x, y, cellSize, cellSize);
        continue;
      }

      const centerX = x + cellSize / 2;
      const centerY = y + cellSize / 2;

      const shadeRGB = chroma(colour).darken(1.5).rgb();

      // center shade
      drawShade(target, centerX, centerY, cellSize, cellSize, color(...shadeRGB, 8));
      drawShade(target, centerX, centerY, cellSize * 1.2, cellSize * 1.2, color(...shadeRGB, 16));

      // holes
      drawShade(
        target,
        x + cellSize * 0.1,
        y + cellSize * 0.1,
        cellSize * 0.5,
        cellSize * 0.5,
        color(...shadeRGB, 24)
      );
      drawShade(
        target,
        x + cellSize * 0.9,
        y + cellSize * 0.1,
        cellSize * 0.5,
        cellSize * 0.5,
        color(...shadeRGB, 24)
      );
      drawShade(
        target,
        x + cellSize * 0.1,
        y + cellSize * 0.9,
        cellSize * 0.5,
        cellSize * 0.5,
        color(...shadeRGB, 24)
      );
      drawShade(
        target,
        x + cellSize * 0.9,
        y + cellSize * 0.9,
        cellSize * 0.5,
        cellSize * 0.5,
        color(...shadeRGB, 24)
      );

      drawStitch(stitchesColor, x + 0.5, y + cellSize - 0.5, x + cellSize - 0.5, y + 0.5, colour);
      drawStitch(stitchesColor, x + 0.5, y + 0.5, x + cellSize - 0.5, y + cellSize - 0.5, colour);

      crossStitches.push([x, y]);
    }
  }

  stitchesMask.image(stitchesColor, 0, 0);

  // makes individual squares stand out
  if (renderDetail) {
    for (const [x, y] of crossStitches) {
      drawShade(
        stitchesColor,
        x + cellSize * 0.5,
        y + cellSize * 0.05,
        cellSize,
        cellSize * 0.4,
        color(255, 16)
      );
      drawShade(
        stitchesColor,
        x + cellSize * 0.05,
        y + cellSize * 0.5,
        cellSize * 0.4,
        cellSize,
        color(255, 2)
      );
      drawShade(
        stitchesColor,
        x + cellSize * 0.5,
        y + cellSize * 0.95,
        cellSize,
        cellSize * 0.4,
        color(0, 12)
      );
      drawShade(
        stitchesColor,
        x + cellSize * 0.95,
        y + cellSize * 0.5,
        cellSize * 0.4,
        cellSize,
        color(0, 2)
      );
    }
  }

  const clone = stitchesColor.get();
  clone.mask(stitchesMask);
  target.image(clone, x, y);
}

function drawStitch(target, x0, y0, x1, y1, colour) {
  if (!renderDetail) {
    target.stroke(colour);
    target.strokeWeight(6);
    target.line(x0, y0, x1, y1);
    return;
  }

  const maxSpin = 0.4;
  let spin = maxSpin;
  const threadCount = 4;
  const threadThickness = 1.5;
  const raiseFactor = randomGaussian(4, 4);
  const spreadFactor = randomGaussian(6, 1);

  const lightColor = chroma(colour).brighten(1.5);
  const darkColor = chroma(colour).darken(0.5);

  const threads = [];
  for (let i = 0; i < threadCount; i++) {
    threads.push({ angle: TWO_PI * (i / threadCount) });
  }

  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = 0.2;
  for (let i = 0; i < dist - step; i += step) {
    const t = i / dist;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    const nextT = (i + step) / dist;
    const nextX = lerp(x0, x1, nextT);
    const nextY = lerp(y0, y1, nextT);
    const radius = threadThickness / 3 + spreadFactor * (t * (1 - t));
    for (let j = 0; j < threadCount; j++) {
      const thread = threads[j];

      const offX = sin(thread.angle) * radius;
      const offY = cos(thread.angle) * radius - raiseFactor * (t * (1 - t));

      thread.angle += spin;
      spin = constrain(randomGaussian(spin, 0.01), -maxSpin, maxSpin);

      const nextOffX = sin(thread.angle) * radius;
      const nextOffY = cos(thread.angle) * radius - raiseFactor * (nextT * (1 - nextT));

      target.strokeWeight(threadThickness);

      target.stroke(darkColor.rgb());
      target.line(x + offX, y + offY + 0.5, nextX + nextOffX, nextY + nextOffY + 0.5);

      target.stroke(colour);
      target.line(x + offX, y + offY, nextX + nextOffX, nextY + nextOffY);

      target.strokeWeight(threadThickness * 0.75);

      target.stroke(
        color(
          ...lightColor.rgb(),
          constrain(round(255 * abs(cos(thread.angle * 0.7)) ** 16), 0, 255)
        )
      );
      target.line(x + offX, y + offY - 0.25, nextX + nextOffX, nextY + nextOffY - 0.25);
    }
  }
}

function findPaletteColor(rgb) {
  const srcChroma = chroma(...rgb.slice(0, 3));
  let bestColor;
  let bestColorDelta = Infinity;
  for (const c of palette) {
    const delta = chroma.deltaE(srcChroma, c);
    if (delta < bestColorDelta) {
      bestColor = c;
      bestColorDelta = delta;
    }
  }
  return bestColor;
}

function drawClothTexture(target, x, y, w, h) {
  const canvasMask = createGraphics(w, h);
  const canvasColor = createGraphics(w, h);

  for (let y = 0; y < h / cellSize; y++) {
    for (let x = 0; x < w / cellSize; x++) {
      const cx = x * cellSize;
      const cy = y * cellSize;
      const even = (x + y) % 2 == 0;
      drawClothTextureCell(canvasMask, cx, cy, even);
      drawClothTextureCell(canvasMask, cx, cy, !even);
    }
  }

  for (let y = 0; y < h / cellSize; y++) {
    for (let x = 0; x < w / cellSize; x++) {
      const cx = x * cellSize;
      const cy = y * cellSize;
      const centerX = cx + cellSize / 2;
      const centerY = cy + cellSize / 2;
      const even = (x + y) % 2 == 0;
      drawClothTextureCell(canvasColor, cx, cy, even);
      drawShade(canvasColor, centerX, centerY, cellSize, cellSize, color(0, 8));
      drawClothTextureCell(canvasColor, cx, cy, !even);
    }
  }

  for (let y = 0; y < h / cellSize; y++) {
    for (let x = 0; x < w / cellSize; x++) {
      const cx = x * cellSize;
      const cy = y * cellSize;
      const centerX = cx + cellSize / 2;
      const centerY = cy + cellSize / 2;
      drawShade(
        canvasColor,
        centerX,
        centerY,
        cellSize,
        cellSize,
        color(255, (x % 2 == 0 && y % 2 == 0 ? 8 : 0) + randomGaussian(4, 4))
      );
      drawShade(
        canvasColor,
        centerX,
        centerY + cellSize * 0.4,
        cellSize * 0.8,
        cellSize * 0.6,
        color(0, 2)
      );
    }
  }

  drawCreases(canvasColor, randomGaussian(w / 2, w / 6), randomGaussian(h / 2, h / 6), 800);

  applyNoise(canvasColor, 0.7);

  const clone = canvasColor.get();
  clone.mask(canvasMask);
  target.image(clone, x, y);

  cutSides(target);
}

function cutSides(target) {
  const noiseScale = 0.3;

  target.erase();
  target.noStroke();
  target.fill(255);

  target.beginShape();
  target.vertex(0, 0);
  for (let x = 0; x <= target.width; x += target.width / 16) {
    target.vertex(x, cellSize * 0.35 + (noise(x * noiseScale) - 0.5) * cellSize * 0.6);
  }
  target.vertex(target.width, 0);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(0, target.height);
  for (let x = 0; x <= target.width; x += target.width / 16) {
    target.vertex(
      x,
      target.height - cellSize * 0.35 + (noise(x * noiseScale) - 0.5) * cellSize * 0.6
    );
  }
  target.vertex(target.width, target.height);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(0, 0);
  for (let y = 0; y <= target.height; y += target.height / 16) {
    target.vertex(cellSize * 0.35 + (noise(y * noiseScale) - 0.5) * cellSize * 0.6, y);
  }
  target.vertex(0, target.height);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(target.width, 0);
  for (let y = 0; y <= target.height; y += target.height / 16) {
    target.vertex(
      target.width - cellSize * 0.35 + (noise(y * noiseScale) - 0.5) * cellSize * 0.6,
      y
    );
  }
  target.vertex(target.width, target.height);
  target.endShape(CLOSE);

  target.noErase();
}

function drawClothTextureCell(target, x, y, axis) {
  const lightColor = "#f7f1e1";
  const darkColor = "#e3dcca";

  const lineSize = cellSize / canvasLinesPerCell;
  target.strokeWeight(lineSize * 0.6);

  for (let i = canvasGap / 2; i < canvasLinesPerCell - canvasGap / 2; i++) {
    const ix = x + i * lineSize;
    const iy = y + i * lineSize;

    if (axis) {
      target.stroke(darkColor);
      target.line(x, iy + lineSize * 0.7, x + cellSize, iy + lineSize * 0.7);
      target.stroke(lightColor);
      target.line(x, iy + lineSize * 0.3, x + cellSize, iy + lineSize * 0.3);
    } else {
      target.stroke(darkColor);
      target.line(ix + lineSize * 0.7, y, ix + lineSize * 0.7, y + cellSize);
      target.stroke(lightColor);
      target.line(ix + lineSize * 0.3, y, ix + lineSize * 0.3, y + cellSize);
    }
  }
}

function drawShade(target, x, y, w, h, colour) {
  target.noStroke();
  target.fill(colour);
  const passes = renderDetail ? 8 : 1;
  for (let i = passes; i >= 0; i--) {
    const t = i / passes;
    const tw = t * w;
    const th = t * h;
    target.ellipse(x, y, tw, th);
  }
}

function drawCreases(target, x, y, length) {
  target.noFill();

  const angle = randomGaussian(round(random()) * HALF_PI, 0.08);
  const cosValue = cos(angle);
  const sinValue = sin(angle);

  let ox, oy;

  const passes = renderDetail ? 8 : 1;
  for (let i = passes; i >= 0; i--) {
    const t = i / passes;
    const tt = t * 120;
    const td = t * 120;

    target.strokeWeight(tt);

    // main crease
    ox = sinValue * td;
    oy = cosValue * td;
    target.stroke(color(0, (1 - t) * 4));
    target.line(
      x + ox - cosValue * length,
      y + oy - sinValue * length,
      x + ox + cosValue * length,
      y + oy + sinValue * length
    );

    target.stroke(color(255, 6));
    target.line(
      x - ox - cosValue * length,
      y - oy - sinValue * length,
      x - ox + cosValue * length,
      y - oy + sinValue * length
    );

    // second crease
    ox = cosValue * td;
    oy = -sinValue * td;
    target.stroke(color(0, 1));
    target.line(x + ox, y + oy, x + ox + sinValue * length, y + oy - cosValue * length);
    target.line(x - ox - sinValue * length, y - oy + cosValue * length, x - ox, y - oy);

    target.stroke(color(255, 2));
    target.line(x - ox, y - oy, x - ox + sinValue * length, y - oy - cosValue * length);
    target.line(x + ox - sinValue * length, y + oy + cosValue * length, x + ox, y + oy);
  }
}

function applyNoise(target, str) {
  if (!renderDetail) return;

  const noiseOverlay = createGraphics(target.width, target.height);
  noiseOverlay.background(255);
  noiseOverlay.loadPixels();
  for (let i = 0, n = noiseOverlay.pixels.length; i < n; i += 4) {
    const v = 128 - floor(random() ** 2 * 128 * str);
    noiseOverlay.pixels[i] = v;
    noiseOverlay.pixels[i + 1] = v;
    noiseOverlay.pixels[i + 2] = v;
  }
  noiseOverlay.updatePixels();

  target.blend(noiseOverlay, 0, 0, width, height, 0, 0, width, height, OVERLAY);
}

// brute force because noSmooth doesn't work
function antiAntiAlias(f) {
  const iterations = renderDetail ? 4 : 1;
  for (let i = 0; i < iterations; i++) f();
}

// ------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------
// -------------------------------------BONUS: BACKEND MODE----------------------------------------
// ------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------

function drawBackStitches(target, x, y, w, h) {
  const artAlphaThreshold = 128;

  const colorMap = [];
  const visited = {};

  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      const ax = floor(x / cellSize);
      const ay = floor(y / cellSize);
      const rgba = artGraphics.get(ax, ay);

      if (rgba[3] < artAlphaThreshold || (rgba[0] === 255 && rgba[1] === 255 && rgba[2] === 255)) {
        colorMap[ax + ay * artSize] = undefined;
      } else {
        const paletteIndex = palette.indexOf(findPaletteColor(rgba));
        colorMap[ax + ay * artSize] = paletteIndex;
      }
    }
  }

  for (let i = 0; i < palette.length; i++) {
    const currentColor = palette[i];
    const lastPos = { x: undefined, y: undefined };

    for (let y = 0; y < h; y += cellSize) {
      for (let x = 0; x < w; x += cellSize) {
        if (!isMatchArtColor(x, y, currentColor, colorMap)) continue;

        if (
          lastPos.x === undefined ||
          lastPos.y === undefined ||
          Math.hypot(lastPos.x - x, lastPos.y - y) > 40 * cellSize
        ) {
          lastPos.x = x;
          lastPos.y = y;
          // starter knot
          drawStitch(target, x, y, x + cellSize, y + cellSize, currentColor);
          drawStitch(target, x, y, x + cellSize, y + cellSize, currentColor);
        }

        drawBackStitchFill(target, x, y, lastPos, currentColor, visited, colorMap);
      }
    }
  }
}

function drawBackStitchFill(target, x, y, lastPos, currentColor, visited, colorMap) {
  if (!isMatchArtColor(x, y, currentColor, colorMap)) return;

  const key = `${x}:${y}`;
  if (visited[key]) return;
  visited[key] = true;

  drawStitch(target, lastPos.x, lastPos.y, x + cellSize, y, currentColor);
  drawStitch(target, x, y + cellSize, x + cellSize, y + cellSize, currentColor);
  lastPos.x = x;
  lastPos.y = y;

  drawBackStitchFill(target, x + cellSize, y, lastPos, currentColor, visited, colorMap);
  drawBackStitchFill(target, x - cellSize, y, lastPos, currentColor, visited, colorMap);
  drawBackStitchFill(target, x, y + cellSize, lastPos, currentColor, visited, colorMap);
  drawBackStitchFill(target, x, y - cellSize, lastPos, currentColor, visited, colorMap);
}

function isMatchArtColor(x, y, checkColor, colorMap) {
  const ax = floor(x / cellSize);
  const ay = floor(y / cellSize);
  const paletteIndex = colorMap[ax + ay * artSize];
  return paletteIndex !== undefined && checkColor === palette[paletteIndex];
}
