/// <reference path="../node_modules/@types/p5/global.d.ts" />

const renderDetail = true;
const backendMode = false;

const cellSize = 12;
const artSize = 80;
const clothSize = cellSize * artSize;

const canvasLinesPerCell = 6;
const canvasGap = 2;

const PALETTE_LEAF = 0;
const PALETTE_BRANCH = 1;
const PALETTE_PETAL = 2;
const PALETTE_PISTIL = 3;
let palette = ['#00cc00', '#448800', '#ff0000', '#ffff00'];

let clothGraphics;
let artGraphics;
let stitchGraphics;

const flowers = [];
const rawStitches = [];

let eraseThickness;
let branchThickness;
let branchWideness;
let branchLengthFactorMin;
let branchLengthFactorMax;
let leafSizeFactor;
let leafShape;
let petalCount;
let petalWidthFactor;
let pistilRatio;
let flowerRadius;
let flowerChance;
let leafChance;

function setup() {
  noLoop();
  pixelDensity(renderDetail ? 2 : 1);
  const c = createCanvas(1080, 1080);
  commonSetup(c, 'Jacquard');

  clothGraphics = createGraphics(clothSize, clothSize);
  clothGraphics.pixelDensity(pixelDensity());
  artGraphics = createGraphics(artSize, artSize);
  artGraphics.noSmooth();
  stitchGraphics = createGraphics(clothSize, clothSize);
  stitchGraphics.pixelDensity(pixelDensity());

  const leafColor = chroma.hsl(100, 0.95, 0.3);
  const branchColor = chroma.mix(
    leafColor.darken(0.8),
    '#572000',
    randomGaussian(0.4, 0.2),
    'hsl'
  );
  const petalColor = chroma.hsl(random(180, 360 + 60), 0.8, 0.5);
  let pistilColor = chroma.hsl(random(20, 60), 0.8, 0.5);
  const flowerColorsDelta = chroma.deltaE(petalColor, pistilColor);
  if (flowerColorsDelta < 20) {
    pistilColor = pistilColor.darken(2).set('lch.c', 125);
  }

  palette = [
    leafColor.hex(),
    branchColor.hex(),
    petalColor.hex(),
    pistilColor.hex(),
  ];

  eraseThickness = round(max(randomGaussian(-1, 2), 0));
  if (eraseThickness > 0) eraseThickness += 0.5;
  branchThickness = max(randomGaussian(1.5, 0.5), 1.5);
  branchWideness = constrain(
    randomGaussian(0.35 + branchThickness * 0.1, 0.1),
    0.25,
    0.5
  );
  branchLengthFactorMin = constrain(randomGaussian(0.5, 0.1), 0, 1);
  branchLengthFactorMax = constrain(
    randomGaussian(0.95, 0.1),
    branchLengthFactorMin,
    1
  );
  leafSizeFactor = randomGaussian(30, 15);
  leafShape = randomGaussian(0.4, 0.1);
  flowerRadius = randomGaussian(6, 1);
  petalWidthFactor = max(randomGaussian(0.5, 0.5), 2 / flowerRadius);
  petalCount = max(round(randomGaussian(14 - 10 * petalWidthFactor, 1)), 3);
  pistilRatio = randomGaussian(0.3, 0.05);
  flowerChance = randomGaussian(0.8, 0.4);
  leafChance = randomGaussian(0.8, 0.4);
}

function draw() {
  background('#d4d2c3');

  drawClothTexture(clothGraphics, 0, 0, clothSize, clothSize);
  drawArt(artGraphics);
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
  rotate(randomGaussian(0, PI * 0.1));
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

function drawArt(target) {
  drawBranch(
    target,
    target.width / 2,
    target.height * 0.9,
    randomGaussian(0, 0.1),
    12
  );

  flowers.sort(([, y0], [, y1]) => y0 - y1);

  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    const [x, y, r] = f;
    drawFlower(target, ...f);
    deleteRawStitches(x * cellSize, y * cellSize, (r + 2) * cellSize);

    for (let j = flowers.length - 1; j > i; j--) {
      const f2 = flowers[j];
      const [x2, y2, r2] = f2;
      if (Math.hypot(x2 - x, y2 - y) < r + r2) {
        flowers.splice(j, 1);
      }
    }
  }

  let [dx, dy] = centerNontransparent(target);
  dx *= cellSize;
  dy *= cellSize;
  for (const s of rawStitches) {
    s[0] += dx;
    s[1] += dy;
    s[2] += dx;
    s[3] += dy;
  }
}

function drawBranch(target, x, y, angle, length) {
  const endX = x + sin(angle) * length;
  const endY = y - cos(angle) * length;

  const outOfBounds =
    Math.hypot(target.width / 2 - endX, target.height / 2 - endY) >
    artSize * 0.3;

  let hasChildren = false;
  if (!outOfBounds) {
    target.stroke(palette[PALETTE_BRANCH]);
    target.strokeWeight(branchThickness);
    target.line(x, y, endX, endY);

    hasChildren = length > 8;
    if (hasChildren) {
      const numBranches = 2; // more than two results in messy
      const angleBias = randomGaussian(0, 0.5);
      const wideness = randomGaussian(branchWideness, 0.1);
      for (let i = 0; i < numBranches; i++) {
        const t = i / (numBranches - 1);
        const sideBias = random();
        drawBranch(
          target,
          endX,
          endY,
          angle * 0.7 +
            (t - 0.5) * PI * wideness +
            randomGaussian(0, 0.06) +
            angleBias,
          max(
            length *
              (lerp(
                branchLengthFactorMin,
                branchLengthFactorMax,
                abs(t - sideBias) ** 0.2
              ) +
                randomGaussian(0, 0.001)),
            0
          )
        );
      }
    }
  }

  if ((outOfBounds || !hasChildren) && random() < flowerChance) {
    const flowerX = outOfBounds ? x : endX;
    const flowerY = outOfBounds ? y : endY;
    const radius = randomGaussian(flowerRadius, 1);
    if (radius > 1) {
      flowers.push([flowerX, flowerY, radius]);
    }
  } else if (!outOfBounds && random() < leafChance) {
    drawLeaf(
      target,
      endX,
      endY,
      angle +
        randomGaussian(0, 0.05) +
        (hasChildren
          ? HALF_PI * (random(-PI, PI) > angle ? -1 : 1)
          : PI * 0.1 * Math.sign(angle)),
      leafSizeFactor * Math.log2(1 + length * 0.02)
    );
  }
}

function drawLeaf(target, x, y, angle, size) {
  x += sin(angle) * 3;
  y += -cos(angle) * 3;
  let tipX = x + sin(angle) * size;
  let tipY = y - cos(angle) * size;

  const sideSize = size * (leafShape * (1 - leafShape)) ** 0.5;

  const rightAngle = angle + PI * leafShape;
  const controlRightX = x + sin(rightAngle) * sideSize;
  const controlRightY = y - cos(rightAngle) * sideSize;

  const leftAngle = angle - PI * leafShape;
  const controlLeftX = x + sin(leftAngle) * sideSize;
  const controlLeftY = y - cos(leftAngle) * sideSize;

  if (eraseThickness > 0) {
    target.stroke(255);
    target.strokeWeight(2 + eraseThickness);
    target.fill(255);

    target.erase();

    antiAntiAlias(() => {
      target.beginShape();
      target.vertex(x, y);
      target.quadraticVertex(controlLeftX, controlLeftY, tipX, tipY);
      target.quadraticVertex(controlRightX, controlRightY, x, y);
      target.endShape(CLOSE);
    });
  }

  deleteRawStitches(
    lerp(x, tipX, 0.5) * cellSize,
    lerp(y, tipY, 0.5) * cellSize,
    (size + 6) * 0.5 * cellSize
  );

  target.noErase();
  target.stroke(palette[PALETTE_LEAF]);
  target.strokeWeight(2);
  target.strokeJoin(ROUND);
  target.fill(palette[PALETTE_LEAF]);

  antiAntiAlias(() => {
    target.beginShape();
    target.vertex(x, y);
    target.quadraticVertex(controlLeftX, controlLeftY, tipX, tipY);
    target.quadraticVertex(controlRightX, controlRightY, x, y);
    target.endShape(CLOSE);
  });

  let d = Math.hypot(tipX - x, tipY - y);
  let lastStitchX, lastStitchY;
  for (let i = 0; i < d; i += 1) {
    const t = i / d;
    const stitchX = round(lerp(x, tipX, t) * cellSize);
    const stitchY = round(lerp(y, tipY, t) * cellSize);
    if (i > 0) {
      rawStitches.push([
        lastStitchX,
        lastStitchY,
        stitchX,
        stitchY,
        palette[PALETTE_BRANCH],
      ]);
    }
    lastStitchX = stitchX;
    lastStitchY = stitchY;
  }
}

function drawFlower(target, x, y, radius) {
  const baseAngle = random(0, TWO_PI);

  for (let e = 0; e < 2; e++) {
    const isErasing = e === 0;
    if (isErasing) {
      if (eraseThickness <= 0) continue;
      target.erase();
      target.stroke(255);
      target.strokeWeight(1 + eraseThickness);
    } else {
      target.noErase();
      target.stroke(palette[PALETTE_PETAL]);
      target.strokeWeight(1);
    }
    target.fill(palette[PALETTE_PETAL]);

    for (let i = 0; i < petalCount; i++) {
      const angle = baseAngle + TWO_PI * (i / petalCount);
      const tipX = x + sin(angle) * radius;
      const tipY = y - cos(angle) * radius;

      const centerX = lerp(x, tipX, 0.5);
      const centerY = lerp(y, tipY, 0.5);

      target.push();

      target.translate(round(centerX) - 0.25, round(centerY) - 0.25);
      target.rotate(angle + HALF_PI);

      antiAntiAlias(() =>
        target.ellipse(
          0,
          0,
          radius,
          radius * petalWidthFactor * (isErasing ? 1.5 : 1)
        )
      );

      target.pop();
    }
  }

  target.noErase();

  target.noStroke();
  target.fill(palette[PALETTE_PISTIL]);
  antiAntiAlias(() =>
    target.circle(
      round(x) - 0.25,
      round(y) - 0.25,
      ceil(radius * pistilRatio) + 0.5
    )
  );
}

function centerNontransparent(target) {
  target.loadPixels();

  let left = 0;
  while (left < target.width) {
    const image = target.get(left, 0, 1, target.height);
    image.loadPixels();
    if (!transparent(image.pixels)) break;
    left++;
  }

  let right = target.width;
  while (right >= 0) {
    const image = target.get(right - 1, 0, 1, target.height);
    image.loadPixels();
    if (!transparent(image.pixels)) break;
    right--;
  }

  let top = 0;
  while (top < target.height) {
    const image = target.get(0, top, target.width, 1);
    image.loadPixels();
    if (!transparent(image.pixels)) break;
    top++;
  }

  let bottom = target.height;
  while (bottom >= 0) {
    const image = target.get(0, bottom - 1, target.width, 1);
    image.loadPixels();
    if (!transparent(image.pixels)) break;
    bottom--;
  }

  const cropped = createGraphics(right - left, bottom - top);
  cropped.image(
    target,
    0,
    0,
    right - left,
    bottom - top,
    left,
    top,
    right - left,
    bottom - top
  );
  target.clear();
  const newX = (target.width - (right - left)) / 2;
  const newY = (target.height - (bottom - top)) / 2;
  target.image(cropped, newX, newY);

  return [newX - left, newY - top];
}

function transparent(pixels) {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) return false;
  }
  return true;
}

function deleteRawStitches(x, y, r) {
  for (let i = rawStitches.length - 1; i >= 0; i--) {
    const [x0, y0, x1, y1] = rawStitches[i];
    if (Math.hypot(x0 - x, y0 - y) <= r || Math.hypot(x1 - x, y1 - y) <= r) {
      rawStitches.splice(i, 1);
    }
  }
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
      drawShade(
        target,
        centerX,
        centerY,
        cellSize,
        cellSize,
        color(...shadeRGB, 8)
      );
      drawShade(
        target,
        centerX,
        centerY,
        cellSize * 1.2,
        cellSize * 1.2,
        color(...shadeRGB, 16)
      );

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

      drawStitch(
        stitchesColor,
        x + 0.5,
        y + cellSize - 0.5,
        x + cellSize - 0.5,
        y + 0.5,
        colour
      );
      drawStitch(
        stitchesColor,
        x + 0.5,
        y + 0.5,
        x + cellSize - 0.5,
        y + cellSize - 0.5,
        colour
      );

      crossStitches.push([x, y]);
    }
  }

  for (const s of rawStitches) {
    drawStitch(stitchesColor, ...s);
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

  const maxSpin = 0.2;
  let spin = maxSpin;
  const threadCount = 4;
  const threadThickness = 2;
  const raiseFactor = randomGaussian(4, 4);
  const spreadFactor = randomGaussian(6, 1);

  const lightColor = chroma(colour).brighten(1.5);
  const darkColor = chroma(colour).darken(0.5);

  const threads = [];
  for (let i = 0; i < threadCount; i++) {
    threads.push({ angle: TWO_PI * (i / threadCount) });
  }

  const dist = Math.hypot(x1 - x0, y1 - y0);
  const step = 0.5;
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
      const nextOffY =
        cos(thread.angle) * radius - raiseFactor * (nextT * (1 - nextT));

      target.strokeWeight(threadThickness);

      target.stroke(darkColor.rgb());
      target.line(
        x + offX,
        y + offY + 0.5,
        nextX + nextOffX,
        nextY + nextOffY + 0.5
      );

      target.stroke(colour);
      target.line(x + offX, y + offY, nextX + nextOffX, nextY + nextOffY);

      target.strokeWeight(threadThickness * 0.75);

      target.stroke(
        color(
          ...lightColor.rgb(),
          constrain(round(255 * abs(cos(thread.angle * 0.7)) ** 16), 0, 255)
        )
      );
      target.line(
        x + offX,
        y + offY - 0.25,
        nextX + nextOffX,
        nextY + nextOffY - 0.25
      );
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

  drawCreases(
    canvasColor,
    randomGaussian(w / 2, w / 6),
    randomGaussian(h / 2, h / 6),
    800
  );

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
    target.vertex(
      x,
      cellSize * 0.35 + (noise(x * noiseScale) - 0.5) * cellSize * 0.6
    );
  }
  target.vertex(target.width, 0);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(0, target.height);
  for (let x = 0; x <= target.width; x += target.width / 16) {
    target.vertex(
      x,
      target.height -
        cellSize * 0.35 +
        (noise(x * noiseScale) - 0.5) * cellSize * 0.6
    );
  }
  target.vertex(target.width, target.height);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(0, 0);
  for (let y = 0; y <= target.height; y += target.height / 16) {
    target.vertex(
      cellSize * 0.35 + (noise(y * noiseScale) - 0.5) * cellSize * 0.6,
      y
    );
  }
  target.vertex(0, target.height);
  target.endShape(CLOSE);

  target.beginShape();
  target.vertex(target.width, 0);
  for (let y = 0; y <= target.height; y += target.height / 16) {
    target.vertex(
      target.width -
        cellSize * 0.35 +
        (noise(y * noiseScale) - 0.5) * cellSize * 0.6,
      y
    );
  }
  target.vertex(target.width, target.height);
  target.endShape(CLOSE);

  target.noErase();
}

function drawClothTextureCell(target, x, y, axis) {
  const lightColor = '#f7f1e1';
  const darkColor = '#e3dcca';

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
    target.line(
      x + ox,
      y + oy,
      x + ox + sinValue * length,
      y + oy - cosValue * length
    );
    target.line(
      x - ox - sinValue * length,
      y - oy + cosValue * length,
      x - ox,
      y - oy
    );

    target.stroke(color(255, 2));
    target.line(
      x - ox,
      y - oy,
      x - ox + sinValue * length,
      y - oy - cosValue * length
    );
    target.line(
      x + ox - sinValue * length,
      y + oy + cosValue * length,
      x + ox,
      y + oy
    );
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
  const iterations = renderDetail ? 64 : 16;
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

      if (
        rgba[3] < artAlphaThreshold ||
        (rgba[0] === 255 && rgba[1] === 255 && rgba[2] === 255)
      ) {
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
          Math.hypot(lastPos.x - x, lastPos.y - y) > 12 * cellSize
        ) {
          lastPos.x = x;
          lastPos.y = y;
          // starter knot
          drawStitch(target, x, y, x + cellSize, y + cellSize, currentColor);
          drawStitch(target, x, y, x + cellSize, y + cellSize, currentColor);
        }

        drawBackStitchFill(
          target,
          x,
          y,
          lastPos,
          currentColor,
          visited,
          colorMap
        );
      }
    }
  }
}

function drawBackStitchFill(
  target,
  x,
  y,
  lastPos,
  currentColor,
  visited,
  colorMap
) {
  if (!isMatchArtColor(x, y, currentColor, colorMap)) return;

  const key = `${x}:${y}`;
  if (visited[key]) return;
  visited[key] = true;

  drawStitch(target, lastPos.x, lastPos.y, x + cellSize, y, currentColor);
  drawStitch(target, x, y + cellSize, x + cellSize, y + cellSize, currentColor);
  lastPos.x = x;
  lastPos.y = y;

  drawBackStitchFill(
    target,
    x + cellSize,
    y,
    lastPos,
    currentColor,
    visited,
    colorMap
  );
  drawBackStitchFill(
    target,
    x - cellSize,
    y,
    lastPos,
    currentColor,
    visited,
    colorMap
  );
  drawBackStitchFill(
    target,
    x,
    y + cellSize,
    lastPos,
    currentColor,
    visited,
    colorMap
  );
  drawBackStitchFill(
    target,
    x,
    y - cellSize,
    lastPos,
    currentColor,
    visited,
    colorMap
  );
}

function isMatchArtColor(x, y, checkColor, colorMap) {
  const ax = floor(x / cellSize);
  const ay = floor(y / cellSize);
  const paletteIndex = colorMap[ax + ay * artSize];
  return paletteIndex !== undefined && checkColor === palette[paletteIndex];
}
