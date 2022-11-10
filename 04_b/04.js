/// <reference path="../node_modules/@types/p5/global.d.ts" />

let blockers;
let blockersBuffer;

const margin = 80;
let gap;
let palette;

let spreadiness;

const particles = [];
const poles = [];

function setup() {
  pixelDensity(2);
  const c = createCanvas(1080, 1080);
  commonSetup(c, 'Floridablanca*');

  blockers = createGraphics(width, height);
  blockersBuffer = createGraphics(width, height);

  blockers.background(0);
  background(
    ...chroma
      .temperature(random(1000, 6500))
      .luminance(randomGaussian(0.96, 0.02))
      .rgb()
  );

  noiseDetail(4, 0.2);

  const vibrance = randomGaussian(75, 50);
  const mainColor = chroma.blend(
    chroma(random(0, 255), random(0, 255), random(0, 255)),
    'white',
    'overlay'
  );
  palette = chroma
    .scale([
      mainColor.set('lch.c', vibrance).luminance(0.5),
      chroma
        .blend(
          chroma(random(0, 255), random(0, 255), random(0, 255)),
          'black',
          'overlay'
        )
        .set('lch.c', vibrance)
        .luminance(0.25),
      mainColor.set('lch.h', '+180').luminance(0.2),
      'black',
    ])
    .gamma(randomGaussian(1.5, 1))
    .mode('hsl')
    .classes(max(round(randomGaussian(8, 2), 1)));

  const colorNoisiness = constrain(randomGaussian(0.4, 0.25), 0, 1);

  const minThickness = max(randomGaussian(8, 8), 2);
  const maxThickness =
    minThickness +
    max(randomGaussian(minThickness * 0.75, minThickness * 0.25), 0);

  const minThicknessAllowed = randomGaussian(0, minThickness * 0.4);

  const averageLifeTime = max(randomGaussian(600, 300), 2);
  const stdDevLifeTime = abs(randomGaussian(0, 200));

  gap =
    (minThickness + max(randomGaussian(15, 10), 4)) *
    (1.05 - 1 / (averageLifeTime * 20 + stdDevLifeTime));
  const spacing = constrain(gap * 0.75, 6, 80);

  const brushiness = constrain(randomGaussian(0.75, 0.25), 0, 1);
  spreadiness = max(randomGaussian(0.25, 1), 0);

  for (let x = margin; x < width - margin; x += spacing) {
    for (let y = margin; y < height - margin; y += spacing) {
      const thickness = constrain(
        maxThickness * max(randomGaussian(0, 0.4), 0) ** 8,
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

      let colorBias = randomGaussian(
        0.5,
        0.5 * (minThickness / thickness) * colorNoisiness
      );
      colorBias += (noise(x * 0.002, y * 0.002) - 0.5) * (1 - colorNoisiness);
      colorBias = constrain(colorBias, 0, 1);

      const particle = {
        pos: createVector(
          randomGaussian(x, spacing * 0.5),
          randomGaussian(y, spacing * 0.5)
        ),
        histPos: undefined,
        thickness,
        points,
        color: color(...palette(colorBias).rgb()),
        lifetime: 0,
        ttl: randomGaussian(averageLifeTime, stdDevLifeTime),
      };
      particles.push(particle);
    }
  }
  shuffle(particles, true);
  particles.sort((a, b) => b.thickness - a.thickness);

  const numPoles = max(randomGaussian(4, 15), 2);
  for (let i = 0; i < numPoles; i++) {
    let pos;
    if (i < 3) {
      pos = createVector(
        randomGaussian(width / 2, width / 12),
        randomGaussian(height / 2, height / 12)
      );
    } else {
      pos = createVector(random(0, width), random(0, height));
    }
    const turniness = constrain(randomGaussian(Math.exp(-i / 3), 1), 0, 1);
    const pulliness = constrain(randomGaussian(Math.exp(-i / 3), 1), 0, 1);
    const minRange = random(200, min(width, height) / 6);
    const maxRange = minRange + 200 + random(0, max(width, height) / 12);
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
      pos: createVector(random(0, width), random(0, height)),
      minRange: 0,
      maxRange: Math.hypot(width, height),
      pull: dir.x * force,
      turn: dir.y * force,
    };
    poles.push(pole);
  }
}

function draw() {
  while (
    particles.length &&
    isBlocked(particles[0].pos.x, particles[0].pos.y)
  ) {
    particles.shift();
  }

  if (!particles.length) {
    noLoop();
    drawNoiseOverlay();
    drawDebug();
    alert('Done rendering!');
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
      pc.pos.x >= width - margin ||
      pc.pos.y >= height - margin ||
      (checkHistPos && pc.pos.dist(pc.histPos) < 1 + sum.mag() * 0.5) ||
      isBlocked(pc.pos.x, pc.pos.y)
    ) {
      particles.shift();
      blockers.image(blockersBuffer, 0, 0);
      break;
    }

    stroke(pc.color);
    blockersBuffer.stroke(255);

    let spread = 0;
    for (const pt of pc.points) {
      let { x, y, thickness } = pt;
      spread =
        (noise(pc.pos.x * 0.025, pc.pos.y * 0.025) * (20 + spreadiness)) /
        (20 + pc.thickness);
      const hf = 1 + spread - 1 / (pc.lifetime * 2);
      const f = 1 + spread - 1 / ((pc.lifetime + 1) * 2);
      const phx = hx + x * hf;
      const phy = hy + y * hf;
      const px = pc.pos.x + x * f;
      const py = pc.pos.y + y * f;

      strokeWeight(thickness);
      line(phx, phy, px, py);

      blockersBuffer.strokeWeight(thickness + gap);
      blockersBuffer.line(phx, phy, px, py);
    }
  }
}

function drawNoiseOverlay() {
  return;
  noiseDetail(4, 0.5);
  blendMode(MULTIPLY);
  noStroke();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nv = noise(x * 0.8, y * 0.8, y * 0.22);
      fill(round(240 + nv * 16));
      quad(x, y, x + 1, y, x + 1, y + 1, x, y + 1);
    }
  }
}

function drawDebug() {
  return;
  noFill();
  blendMode(NORMAL);
  for (const pl of poles) {
    console.log(pl);
    stroke(0, 0, 255, 255);
    strokeWeight(4);
    line(pl.pos.x - 5, pl.pos.y, pl.pos.x + 5, pl.pos.y);
    line(pl.pos.x, pl.pos.y - 5, pl.pos.x, pl.pos.y + 5);
    circle(pl.pos.x, pl.pos.y, pl.minRange * 2);
    circle(pl.pos.x, pl.pos.y, pl.maxRange * 2);

  }
}

function isBlocked(x, y) {
  return blockers.get(x, y)[0] > 0;
}
