/// <reference path="../node_modules/@types/p5/global.d.ts" />

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ score: number, a: Point, b: Point, c: Point }} Segment
 */

/** @type {Segment[]} */
let segments = [];
let sourceSegments = [];
let sourceNeighbors;

let strokeFriction;
let strokeAcceleration;
let strokeTremor;

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1350);
  commonSetup(c, "Linya");

  drawBackground();

  strokeFriction = constrain(randomGaussian(0.93, 0.01), 0, 0.97);
  strokeAcceleration = max(randomGaussian(0.1, 0.02), 0.002);
  strokeTremor = randomGaussian(0, 0.01);

  const cx = width / 2;
  const cy = height / 3;

  const headWidth = 800;
  const headHeight = 1200;

  const eyeWidth = headWidth * 0.24 + randomGaussian(0, 10);
  const eyeHeight = eyeWidth * (4 / 5) + randomGaussian(0, 10);
  const eyeSpan = headWidth * 0.22 + randomGaussian(0, 10);
  const leftEyeX = -eyeSpan;
  const rightEyeX = eyeSpan;
  const eyeY = 0;

  const noseX = 0;
  const noseY = headHeight * 0.15 + randomGaussian(0, 10);
  const noseWidth = headWidth * 0.18 + randomGaussian(0, 20);
  const noseHeight = headHeight * 0.23 + randomGaussian(0, 10);

  const lipsX = 0;
  const lipsY = headHeight * 0.35 + randomGaussian(0, 2);
  const lipsWidth = headWidth * 0.3 + randomGaussian(0, 20);
  const lipsHeight = headHeight * 0.08 + randomGaussian(0, 5);

  const jawX = 0;
  const jawY = headHeight * 0.3 + randomGaussian(0, 5);
  const jawWidth = headWidth * 0.9 + randomGaussian(0, 5);
  const jawHeight = headHeight * 0.4 + randomGaussian(0, 5);

  const cheekX = 0;
  const cheekY = headHeight * 0.22 + randomGaussian(0, 5);
  const cheekWidth = headWidth * 0.8 + randomGaussian(0, 5);
  const cheekHeight = headHeight * 0.2 + randomGaussian(0, 5);

  const chinX = 0;
  const chinTop = lipsY + lipsHeight / 2 + 30;
  const chinBottom = headHeight / 2 - 30;

  segments.push(
    ...transformSegs(eyeSegs(), cx + leftEyeX, cy + eyeY, eyeWidth, eyeHeight, 0, 0),
    ...transformSegs(eyeSegs(), cx + rightEyeX, cy + eyeY, eyeWidth, eyeHeight, 0, 0),
    ...transformSegs(noseSegs(), cx + noseX, cy + noseY, noseWidth, noseHeight, 0, 0),
    ...transformSegs(lipsSegs(), cx + lipsX, cy + lipsY, lipsWidth, lipsHeight, 0, 0),
    ...transformSegs(jawSegs(), cx + jawX, cy + jawY, jawWidth, jawHeight, 0, 0),
    ...transformSegs(cheekSegs(), cx + cheekX, cy + cheekY, cheekWidth, cheekHeight, 0, 0),
    // chin
    {
      score: 0.5,
      a: { x: cx + chinX, y: cy + chinTop, z: 0.3 },
      c: { x: cx + chinX, y: cy + lerp(chinTop, chinBottom, 0.8), z: 0.25 },
      b: { x: cx + chinX, y: cy + chinBottom, z: 0.1 },
    }
  );

  const shadeSide = random() < 0.5 ? -1 : 1;
  for (const s of segments) {
    if (Math.sign(s.a.x - cx) === shadeSide && Math.sign(s.b.x - cx) === shadeSide) {
      s.score *= 0.1;
    }
  }

  // pseudo-3d
  const angleX = randomGaussian(0, 100);
  const angleY = randomGaussian(-50, 50);
  for (const s of segments) {
    s.a.x += s.a.z * angleX;
    s.a.y += s.a.z * angleY;
    s.b.x += s.b.z * angleX;
    s.b.y += s.b.z * angleY;
    s.c.x += s.c.z * angleX;
    s.c.y += s.c.z * angleY;
  }

  sourceSegments = [...segments];
  sourceNeighbors = computeNeighbors();

  const startSideX = (-shadeSide + 1) * 0.5 * width;
  const sortedIndices = segments
    .map((s, i) => [i, s])
    .sort(
      ([, s0], [, s1]) =>
        min(abs(s0.a.x - startSideX), abs(s0.b.x - startSideX)) / (20 + s0.score) -
        min(abs(s1.a.x - startSideX), abs(s1.b.x - startSideX)) / (20 + s1.score)
    )
    .map(([i]) => i);
  const startIndex = sortedIndices[floor(constrain(randomGaussian(1, 2), 0, segments.length - 1))];
  const startSeg = segments[startIndex];
  const startEntryKey = abs(startSeg.a.x - startSideX) < abs(startSeg.b.x - startSideX) ? "a" : "b";

  noStroke();
  fill("blue");
  circle(segments[startIndex][startEntryKey].x, segments[startIndex][startEntryKey].y, 32);

  const path = findPath(startIndex, startEntryKey, 1000);
  console.log(path);

  const pathSegments = [];
  for (const node of path) {
    let seg = segments[node.index];
    if (node.entryKey === "b") {
      seg = {
        a: seg.b,
        b: seg.a,
        c: seg.c,
      };
    }
    pathSegments.push(seg);
    textStyle(BOLD);
    textSize(20);
    text(node.index, seg.a.x + 10, seg.a.y + 20);
  }
  segments = pathSegments;
}

function draw() {
  drawSourceSegments();

  if (!segments.length) return;

  let x = segments[0].a.x;
  let y = segments[0].a.y;
  let vx = 0;
  let vy = 0;

  const step = 4;
  const acc = strokeAcceleration;
  const fric = strokeFriction;

  noFill();
  stroke(0);
  strokeWeight(6);
  strokeJoin(ROUND);

  const dt = 0.001;

  beginShape();
  for (const s of segments) {
    for (let t = 0; t < 1; t += dt) {
      const p = segPoint(s, t);

      const dx = p.x - x - vx * 8;
      const dy = p.y - y - vy * 8;
      const d = Math.hypot(dx, dy);

      if (d < step) continue;
      else if (d > step * 2) t -= dt;

      vx += (acc * dx) / d + randomGaussian(0, strokeTremor);
      vy += (acc * dy) / d + randomGaussian(0, strokeTremor);

      vx *= fric;
      vy *= fric;
      x += vx;
      y += vy;
      vertex(x, y);
    }
  }
  endShape();
}

function drawSourceSegments() {
  noFill();

  for (let i = 0; i < sourceSegments.length; i++) {
    const seg = sourceSegments[i];

    for (const key of ["a", "b"]) {
      for (const n of sourceNeighbors[i][key]) {
        const p = sourceSegments[n.index][n.entryKey];

        stroke(0, 192, 0, 8);
        strokeWeight(12);
        line(seg[key].x, seg[key].y, p.x, p.y);
      }
    }

    stroke(255, 0, 0, 64 + seg.score * 32);
    strokeWeight(25);
    beginShape();
    vertex(seg.a.x, seg.a.y);
    quadraticVertex(seg.c.x, seg.c.y, seg.b.x, seg.b.y);
    endShape();
  }
}

function drawBackground() {
  background("#ebe2cc");
}

function segPoint(seg, t) {
  const c0x = lerp(seg.a.x, seg.c.x, t);
  const c0y = lerp(seg.a.y, seg.c.y, t);
  const c1x = lerp(seg.c.x, seg.b.x, t);
  const c1y = lerp(seg.c.y, seg.b.y, t);
  return {
    x: lerp(c0x, c1x, t),
    y: lerp(c0y, c1y, t),
  };
}

function findPath(startIndex, entryKey, maxLength) {
  const depthStep = 6;

  const context = {
    exclude: new Map(),
    neighbors: [...sourceNeighbors],
    maxDepth: depthStep,
    iterPath: new Map(),
    iterLength: 0,
    iterScore: 0,
    bestPath: [],
    bestScore: 0,
  };

  const startSeg = segments[startIndex];
  const exitKey = entryKey == "a" ? "b" : "a";

  let currentNode = {
    index: startIndex,
    seg: startSeg,
    entryKey,
    length: computeLength(startSeg[entryKey], startSeg[entryKey], startSeg.c, startSeg[exitKey]),
    score: 0,
  };

  context.iterPath.set(startIndex, currentNode);

  let path = [];

  while (context.iterPath.length < segments.length) {
    findPath2(currentNode.index, currentNode.entryKey, context);

    if (context.bestScore <= 0) break;

    currentNode = context.bestPath[min(2, context.bestPath.length) - 1];
    path.push(...context.bestPath);

    if (currentNode.length >= maxLength || context.bestPath.length === segments.length) break;

    context.maxDepth = context.iterPath.size + depthStep;
    for (const node of context.bestPath) {
      context.iterPath.set(node.index, node);
    }
    context.iterLength = currentNode.length;
    context.iterScore = currentNode.score;
    context.bestPath = [];
    context.bestScore = 0;
  }

  return path;
}

function findPath2(startIndex, entryKey, context) {
  const { exclude, neighbors, maxDepth, iterPath } = context;

  const startSeg = segments[startIndex];
  const exitKey = entryKey == "a" ? "b" : "a";
  const currentPoint = startSeg[exitKey];

  if (iterPath.size >= maxDepth || iterPath.size >= segments.length - 1) {
    if (context.iterScore > context.bestScore) {
      context.bestScore = context.iterScore;
      context.bestPath = [...iterPath.values()];
    }
    return;
  }

  const origScore = context.iterScore;
  const origLength = context.iterLength;

  for (const next of neighbors[startIndex][exitKey]) {
    const index = next.index;
    if (exclude.has(index) || iterPath.has(index)) continue;

    const seg = segments[index];
    const nextEntryKey = next.entryKey;
    const nextExitKey = nextEntryKey == "a" ? "b" : "a";

    const score = computeScore(
      startSeg,
      seg,
      startSeg.c,
      currentPoint,
      seg[nextEntryKey],
      seg.c,
      context
    );

    if (score <= 0) continue;

    context.iterScore += score;
    context.iterLength += computeLength(currentPoint, seg[nextEntryKey], seg.c, seg[nextExitKey]);

    iterPath.set(index, {
      index,
      seg,
      entryKey: nextEntryKey,
      score: context.iterScore,
      length: context.iterLength,
    });

    findPath2(index, nextEntryKey, context);

    iterPath.delete(index);
    context.iterScore = origScore;
    context.iterLength = origLength;
  }
}

const dist2Cutoff = 130 ** 2;
function computeNeighbors() {
  const n = segments.length;

  const neighbors = [];
  for (let i = 0; i < n; i++) {
    neighbors[i] = { a: [], b: [] };
  }

  for (let i = 0; i < n; i++) {
    const s0 = segments[i];
    for (let j = i + 1; j < n; j++) {
      const s1 = segments[j];

      const d2aa = (s0.a.x - s1.a.x) ** 2 + (s0.a.y - s1.a.y) ** 2;
      const d2ab = (s0.a.x - s1.b.x) ** 2 + (s0.a.y - s1.b.y) ** 2;
      const d2ba = (s0.b.x - s1.a.x) ** 2 + (s0.b.y - s1.a.y) ** 2;
      const d2bb = (s0.b.x - s1.b.x) ** 2 + (s0.b.y - s1.b.y) ** 2;

      if (d2aa < dist2Cutoff) {
        neighbors[i].a.push({ index: j, entryKey: "a" });
        neighbors[j].a.push({ index: i, entryKey: "a" });
      }
      if (d2ab < dist2Cutoff) {
        neighbors[i].a.push({ index: j, entryKey: "b" });
        neighbors[j].b.push({ index: i, entryKey: "a" });
      }
      if (d2ba < dist2Cutoff) {
        neighbors[i].b.push({ index: j, entryKey: "a" });
        neighbors[j].a.push({ index: i, entryKey: "b" });
      }
      if (d2bb < dist2Cutoff) {
        neighbors[i].b.push({ index: j, entryKey: "b" });
        neighbors[j].b.push({ index: i, entryKey: "b" });
      }
    }
  }

  return neighbors;
}

function computeLength(current, nextEntry, nextControl, nextExit) {
  const cacheKey =
    getCacheID(current) +
    ":" +
    getCacheID(nextEntry) +
    ":" +
    getCacheID(nextControl) +
    ":" +
    getCacheID(nextExit);
  if (computeLength.cache[cacheKey]) {
    return computeLength.cache[cacheKey];
  }

  const dx = nextEntry.x - current.x;
  const dy = nextEntry.y - current.y;
  const dxNext = nextExit.x - nextEntry.x;
  const dyNext = nextExit.y - nextEntry.y;

  const value = Math.hypot(dx, dy) + Math.hypot(dxNext, dyNext);
  computeLength.cache[cacheKey] = value;
  return value;
}
computeLength.cache = {};

function computeScore(currentSeg, testSeg, prev, current, test, testNext, context) {
  const cacheKey =
    getCacheID(prev) +
    ":" +
    getCacheID(current) +
    ":" +
    getCacheID(test) +
    ":" +
    getCacheID(testNext);
  if (!computeScore.cache[cacheKey]) {
    const dx = test.x - current.x;
    const dy = test.y - current.y;
    const dxPrev = current.x - prev.x;
    const dyPrev = current.y - prev.y;
    const dxNext = testNext.x - test.x;
    const dyNext = testNext.y - test.y;

    const dist2 = dx ** 2 + dy ** 2;
    const dist2Prev = dxPrev ** 2 + dyPrev ** 2;
    const dist2Next = dxNext ** 2 + dyNext ** 2;

    const dotNext = dxNext * dx + dyNext * dy;
    const cosNext = dotNext / sqrt(dist2Next * dist2);

    const dotPrev = dx * dxPrev + dy * dyPrev;
    const cosPrev = dotPrev / sqrt(dist2 * dist2Prev);

    let a = (cosNext + 1) * (cosPrev + 1) * 0.25;

    const value = currentSeg.score / dist2;
    computeScore.cache[cacheKey] = value;
  }
  
  let value = computeScore.cache[cacheKey];
  
  // collision penalty
  const { iterPath } = context;
  const n = segments.length;
  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    if (seg === currentSeg || seg === testSeg) continue;
    if (intersectsSeg(seg, current.x, current.y, test.x, test.y)) {
      const isPath = iterPath.has(i);
      value -= 1;
      if (isPath) value -= seg.score;
    }
  }

  return value;
}
computeScore.cache = {};

const cacheID = Symbol("cacheID");
let idCounter = 0;
function getCacheID(obj) {
  if (cacheID in obj) return obj[cacheID];
  const id = idCounter++;
  obj[cacheID] = id;
  return id;
}

function intersectsSeg(seg, x0, y0, x1, y1) {
  const segMidX = (seg.a.x + seg.b.x + seg.c.x) / 3;
  const segMidY = (seg.a.y + seg.b.y + seg.c.y) / 3;
  return (
    intersectsLine(x0, y0, x1, y1, seg.a.x, seg.a.y, segMidX, segMidY) ||
    intersectsLine(x0, y0, x1, y1, seg.b.x, seg.b.y, segMidX, segMidY)
  );
}

function intersectsLine(aX0, aY0, aX1, aY1, bX0, bY0, bX1, bY1) {
  const adx = aX1 - aX0;
  const ady = aY1 - aY0;
  const bdx = bX1 - bX0;
  const bdy = bY1 - bY0;

  const s = (-ady * (aX0 - bX0) + adx * (aY0 - bY0)) / (-bdx * ady + adx * bdy);
  const t = (bdx * (aY0 - bY0) - bdy * (aX0 - bX0)) / (-bdx * ady + adx * bdy);

  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

function transformSegs(segs, x, y, w, h) {
  return segs.map((s) => ({
    ...s,
    a: transformPoint(s.a, x, y, w, h),
    b: transformPoint(s.b, x, y, w, h),
    c: transformPoint(s.c, x, y, w, h),
  }));
}

function transformPoint(point, x, y, w, h) {
  return { x: x + point.x * (w / 2), y: y + point.y * (h / 2), z: point.z };
}

function mirrorX(segs) {
  return [
    ...segs,
    ...segs.map((s) => ({
      ...s,
      a: { x: -s.a.x, y: s.a.y, z: s.a.z },
      b: { x: -s.b.x, y: s.b.y, z: s.b.z },
      c: { x: -s.c.x, y: s.c.y, z: s.c.z },
    })),
  ];
}

function eyeSegs() {
  return [
    // brow
    {
      score: 0.5,
      a: { x: -1, y: 0.1, z: 0.2 },
      c: { x: 0, y: -1, z: 0.2 },
      b: { x: 1, y: 0.1, z: 0.2 },
    },
    ...mirrorX([
      // top edge
      {
        score: 3,
        a: { x: -1, y: 0.55, z: 0.15 },
        c: { x: -0.6, y: 0.2, z: 0.2 },
        b: { x: -0.05, y: 0.2, z: 0.25 },
      },
      // bottom edge
      {
        score: 0.5,
        a: { x: -1, y: 0.65, z: 0.15 },
        c: { x: -0.6, y: 1, z: 0.2 },
        b: { x: -0.05, y: 1, z: 0.25 },
      },
      // iris
      {
        score: 1,
        a: { x: -0.1, y: 0.3, z: 0.2 },
        c: { x: -0.4, y: 0.55, z: 0.22 },
        b: { x: -0.1, y: 0.9, z: 0.2 },
      },
    ]),
  ];
}

function noseSegs() {
  return [
    // ridge
    {
      score: 1,
      a: { x: 0, y: -1, z: 0.4 },
      c: { x: 0, y: 0, z: 0.4 },
      b: { x: 0, y: 0.9, z: 0.6 },
    },
    ...mirrorX([
      // side
      {
        score: 3,
        a: { x: -0.7, y: -0.4, z: 0.3 },
        c: { x: -0.7, y: -0.3, z: 0.3 },
        b: { x: -1, y: 0.8, z: 0.4 },
      },
      // base
      {
        score: 1,
        a: { x: -0.9, y: 1, z: 0.4 },
        c: { x: -0.5, y: 1, z: 0.5 },
        b: { x: -0.1, y: 1, z: 0.6 },
      },
    ]),
  ];
}

function lipsSegs() {
  return [
    // mouth
    {
      score: 2,
      a: { x: -0.9, y: 0, z: 0.2 },
      c: { x: 0, y: 0.05, z: 0.4 },
      b: { x: 0.9, y: 0, z: 0.2 },
    },
    ...mirrorX([
      // top lip
      {
        score: 1,
        a: { x: -1, y: -0.1, z: 0.2 },
        c: { x: -0.5, y: -1, z: 0.4 },
        b: { x: -0.3, y: -1, z: 0.4 },
      },
      {
        score: 1,
        a: { x: -0.2, y: -0.95, z: 0.4 },
        c: { x: -0.15, y: -0.8, z: 0.35 },
        b: { x: -0.05, y: -0.7, z: 0.4 },
      },
      // bottom lip
      {
        score: 1,
        a: { x: -1, y: 0.1, z: 0.2 },
        c: { x: -0.5, y: 1, z: 0.3 },
        b: { x: -0.1, y: 1, z: 0.3 },
      },
    ]),
  ];
}

function jawSegs() {
  return [
    ...mirrorX([
      {
        score: 0.1,
        a: { x: -1, y: -1, z: 0 },
        c: { x: -0.8, y: 0.8, z: 0 },
        b: { x: -0.1, y: 1, z: 0 },
      },
    ]),
  ];
}

function cheekSegs() {
  return [
    ...mirrorX([
      {
        score: 0.1,
        a: { x: -1, y: -1, z: 0.15 },
        c: { x: -0.8, y: -0.8, z: 0.15 },
        b: { x: -0.7, y: 1, z: 0.1 },
      },
    ]),
  ];
}
