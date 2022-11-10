/// <reference path="../node_modules/@types/p5/global.d.ts" />

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ score: number, a: Point, b: Point, c: Point } | { score: number, a: Point, b: Point, c1: Point, c2: Point }} Segment
 * @typedef {{index: number, entryKey: 'a'|'b'}} EndPoint
 */

/** @type {Segment[]} */
let segments = [];
/** @type {Segment[]} */
let sourceSegments = [];
/** @type {Array<{ a: EndPoint[], b: EndPoint[] }>} */
let sourceNeighbors;

let strokeFriction;
let strokeAcceleration;
let strokeTremor;
let strokeStyle;

let globalRotation;

function setup() {
  noLoop();
  pixelDensity(2);
  const c = createCanvas(1080, 1080);
  commonSetup(c, "Line*");

  strokeFriction = constrain(randomGaussian(0.94, 0.01), 0, 0.998);
  strokeAcceleration = max(randomGaussian(0.12, 0.02), 0.002);
  strokeTremor = randomGaussian(0, 0.01);
  strokeStyle = random();

  globalRotation = randomGaussian(0, 0.06);

  const cx = width / 2;
  const cy = height / 3;

  const headWidth = 800;
  const headHeight = 1200;

  const eyeWidth = headWidth * 0.24 + randomGaussian(0, 10);
  const eyeHeight = eyeWidth * (4 / 5) + randomGaussian(0, 10);
  const eyeSpan = headWidth * 0.23 + randomGaussian(0, 10);
  const leftEyeX = -eyeSpan;
  const rightEyeX = eyeSpan;
  const eyeY = 0;

  const eyeProps = {
    closed: random() < 0.4,
    browTilt: randomGaussian(0.25, 0.5),
  };
  const leftEyeProps = {
    ...eyeProps,
  };
  const rightEyeProps = {
    ...eyeProps,
    browTilt: -eyeProps.browTilt,
  };

  const noseX = 0;
  const noseY = headHeight * 0.14 + randomGaussian(0, 10);
  const noseWidth = headWidth * 0.16 + randomGaussian(0, 10);
  const noseHeight = headHeight * 0.18 + randomGaussian(0, 10);

  const lipsX = 0;
  const lipsY = headHeight * 0.34 + randomGaussian(0, 2);
  const lipsWidth = headWidth * 0.3 + randomGaussian(0, 20);
  const lipsHeight = headHeight * 0.08 + randomGaussian(0, 5);

  const lipsProps = {
    smile: randomGaussian(0, 0.5),
    bite: constrain(randomGaussian(0, 1), 0, 1),
  };

  const jawX = 0;
  const jawY = headHeight * 0.3 + randomGaussian(0, 5);
  const jawWidth = headWidth * 0.9 + randomGaussian(0, 5);
  const jawHeight = headHeight * 0.4 + randomGaussian(0, 5);

  const cheekX = 0;
  const cheekY = headHeight * 0.2 + randomGaussian(0, 5);
  const cheekWidth = headWidth * 0.7 + randomGaussian(0, 5);
  const cheekHeight = headHeight * 0.1 + randomGaussian(0, 5);

  const foreheadX = 0;
  const foreheadY = headHeight * -0.1;
  const foreheadWidth = headWidth * 0.86;
  const foreheadHeight = headHeight * 0.2;

  const chinX = 0;
  const chinBottom = headHeight / 2 - 30;
  const chinTop = lerp(lipsY + lipsHeight / 2, chinBottom, 0.8);

  const foreheadMidX = 0;
  const foreheadMidTop = foreheadY - foreheadHeight / 2 + 30;
  const foreheadMidBottom = noseY - noseHeight / 2 - 100;

  segments.push(
    ...transformSegs(eyeSegs(leftEyeProps), cx + leftEyeX, cy + eyeY, eyeWidth, eyeHeight),
    ...transformSegs(eyeSegs(rightEyeProps), cx + rightEyeX, cy + eyeY, eyeWidth, eyeHeight),
    ...transformSegs(noseSegs(), cx + noseX, cy + noseY, noseWidth, noseHeight),
    ...transformSegs(lipsSegs(lipsProps), cx + lipsX, cy + lipsY, lipsWidth, lipsHeight),
    ...transformSegs(jawSegs(), cx + jawX, cy + jawY, jawWidth, jawHeight),
    ...transformSegs(cheekSegs(), cx + cheekX, cy + cheekY, cheekWidth, cheekHeight),
    ...transformSegs(foreheadSegs(), cx + foreheadX, cy + foreheadY, foreheadWidth, foreheadHeight),
    // forehead mid
    {
      score: 1,
      a: { x: cx + foreheadMidX, y: cy + foreheadMidTop, z: 0.1 },
      c: { x: cx + foreheadMidX, y: cy + lerp(foreheadMidTop, foreheadMidBottom, 0.3), z: 0.4 },
      b: { x: cx + foreheadMidX, y: cy + foreheadMidBottom, z: 0.4 },
    },
    // chin
    {
      score: 1,
      a: { x: cx + chinX, y: cy + chinTop, z: 0.3 },
      c: { x: cx + chinX, y: cy + lerp(chinTop, chinBottom, 0.8), z: 0.25 },
      b: { x: cx + chinX, y: cy + chinBottom, z: 0.1 },
    }
  );

  const shadeSide = random() < 0.5 ? -1 : 1;
  for (const s of segments) {
    if (Math.sign(s.a.x - cx) === shadeSide && Math.sign(s.b.x - cx) === shadeSide) {
      s.score = Math.log1p(s.score) * 1e-6;
    }
  }

  // pseudo-3d
  const angle = random(0, TWO_PI);
  const tilt = randomGaussian(200, 50);
  const angleX = cos(angle) * tilt;
  const angleY = sin(angle) * tilt;
  for (const s of segments) {
    s.a.x += s.a.z * angleX;
    s.a.y += s.a.z * angleY;
    s.b.x += s.b.z * angleX;
    s.b.y += s.b.z * angleY;
    if (s.c) {
      s.c.x += s.c.z * angleX;
      s.c.y += s.c.z * angleY;
    } else {
      s.c1.x += s.c1.z * angleX;
      s.c1.y += s.c1.z * angleY;
      s.c2.x += s.c2.z * angleX;
      s.c2.y += s.c2.z * angleY;
    }
  }

  sourceSegments = [...segments];
  sourceNeighbors = computeNeighbors();

  const startSideX = (-shadeSide + 1) * 0.5 * width;
  const sortedIndices = segments
    .map((s, i) => [i, s])
    .sort(
      ([, s0], [, s1]) =>
        min(abs(s0.a.x - startSideX), abs(s0.b.x - startSideX)) / (2 + s0.score) -
        min(abs(s1.a.x - startSideX), abs(s1.b.x - startSideX)) / (2 + s1.score)
    )
    .map(([i]) => i);

  const maxAttempts = 4;
  let attempts = maxAttempts;
  while (attempts > 0) {
    const choice =
      attempts < maxAttempts
        ? maxAttempts - 1 - attempts
        : floor(constrain(randomGaussian(1, 2), 0, segments.length - 1));

    const startIndex = sortedIndices[choice];
    const startSeg = segments[startIndex];
    const startEntryKey =
      abs(startSeg.a.x - startSideX) < abs(startSeg.b.x - startSideX) ? "a" : "b";

    const path = findPath(startIndex, startEntryKey, 1500);

    if (!path.length) {
      attempts--;
      continue;
    }

    const pathSegments = [];
    for (const node of path) {
      let seg = segments[node.index];
      if (node.entryKey === "b") {
        seg = {
          a: seg.b, // swapped
          b: seg.a, // swapped
          c: seg.c,
          c1: seg.c2, // swapped
          c2: seg.c1, // swapped
        };
      }
      pathSegments.push(seg);
    }
    segments = pathSegments;

    break;
  }
}

function draw() {
  drawBackground();
  // drawSourceSegments();

  if (!segments.length) return;

  translate(width / 2, height / 2);
  rotate(globalRotation);
  translate(-width / 2, -height / 2);

  let l = 0;
  let x = segments[0].a.x;
  let y = segments[0].a.y;
  let vx = 0;
  let vy = 0;

  const step = 4;
  const acc = strokeAcceleration;
  const fric = strokeFriction;

  noFill();
  strokeJoin(ROUND);

  const dt = 0.001;

  for (const s of segments) {
    for (let t = 0; t < 1; t += dt) {
      const p = segPoint(s, t);

      const dx = p.x - x - vx * 8;
      const dy = p.y - y - vy * 8;
      const d = Math.hypot(dx, dy);

      if (d < step) continue;
      else if (d > step * 2) t -= dt * 0.1;

      vx += acc * (dx / d);
      vy += acc * (dy / d);
      const tremorAcc = min(strokeTremor * 0.6, acc * 0.8);
      const tremorDir = Math.sign(strokeTremor);
      vx += sin(l * tremorDir * 0.02) * tremorAcc;
      vy += cos(l * tremorDir * 0.02) * tremorAcc;

      vx *= fric;
      vy *= fric;

      stroke(0);
      const speed = Math.hypot(vx, vy);
      const weight = (60 * (speed / 2) ** strokeStyle) / (3 + speed ** (1 - strokeStyle));
      strokeWeight(weight + randomGaussian(0, 0.3));
      line(x, y, x + vx, y + vy);

      x += vx;
      y += vy;
      l += speed;

      if (l > 2000) return;
    }
  }
}

function drawSourceSegments() {
  noFill();

  for (let i = 0; i < sourceSegments.length; i++) {
    const seg = sourceSegments[i];

    for (const key of ["a", "b"]) {
      for (const n of sourceNeighbors[i][key]) {
        const p = sourceSegments[n.index][n.entryKey];

        stroke(0, 192, 128, 8);
        strokeWeight(4);
        line(seg[key].x, seg[key].y, p.x, p.y);
      }
    }

    stroke(0, 96, 255, 32 + seg.score * 16);
    strokeWeight(8);
    beginShape();
    vertex(seg.a.x, seg.a.y);
    if (seg.c) {
      quadraticVertex(seg.c.x, seg.c.y, seg.b.x, seg.b.y);
    } else {
      bezierVertex(seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.b.x, seg.b.y);
    }
    endShape();
  }
}

function drawBackground() {
  background(255);
}

function segPoint(seg, t) {
  if (seg.c) {
    const c0x = lerp(seg.a.x, seg.c.x, t);
    const c0y = lerp(seg.a.y, seg.c.y, t);
    const c1x = lerp(seg.c.x, seg.b.x, t);
    const c1y = lerp(seg.c.y, seg.b.y, t);
    return {
      x: lerp(c0x, c1x, t),
      y: lerp(c0y, c1y, t),
    };
  } else {
    const c0x = lerp(seg.a.x, seg.c1.x, t);
    const c0y = lerp(seg.a.y, seg.c1.y, t);
    const c1x = lerp(seg.c1.x, seg.c2.x, t);
    const c1y = lerp(seg.c1.y, seg.c2.y, t);
    const c2x = lerp(seg.c2.x, seg.b.x, t);
    const c2y = lerp(seg.c2.y, seg.b.y, t);
    const cc0x = lerp(c0x, c1x, t);
    const cc0y = lerp(c0y, c1y, t);
    const cc1x = lerp(c1x, c2x, t);
    const cc1y = lerp(c1y, c2y, t);
    return {
      x: lerp(cc0x, cc1x, t),
      y: lerp(cc0y, cc1y, t),
    };
  }
}

function findPath(startIndex, entryKey, maxLength) {
  const best = { score: 0, fullScore: 0, path: [] };
  iterateFindPath(startIndex, entryKey, maxLength, 0, 0, [], best);
  return best.path;
}

function iterateFindPath(
  index,
  entryKey,
  maxLength,
  currentLength,
  currentScore,
  currentPath,
  currentBest
) {
  if (currentPath.length > 0) {
    if (currentScore < currentBest.score * (currentPath.length / (currentPath.length + 5))) {
      return;
    } else if (currentScore > currentBest.score) {
      currentBest.score = currentScore;
    }
  }

  const seg = segments[index];
  const exitKey = entryKey === "a" ? "b" : "a";
  const exit = seg[exitKey];
  const preExitControl = seg.c ?? (exitKey === "a" ? seg.c1 : seg.c2);

  currentPath.push({ index, entryKey });

  if (currentLength >= maxLength) {
    if (currentScore > currentBest.fullScore) {
      currentBest.fullScore = currentScore;
      currentBest.path = [...currentPath.values()];
    }
    currentPath.pop();
    return;
  }

  for (const n of sourceNeighbors[index][exitKey]) {
    if (currentPath.some((node) => node.index === n.index)) continue;

    const nSeg = segments[n.index];
    const nEntry = nSeg[n.entryKey];
    const nExit = nSeg[n.entryKey === "a" ? "b" : "a"];
    const nPostEntryControl = nSeg.c ?? (n.entryKey === "a" ? nSeg.c1 : nSeg.c2);

    const deltaScore = computeScore(seg, nSeg, preExitControl, exit, nEntry, nPostEntryControl, currentPath);

    if (deltaScore <= 0) continue;

    const segLength = computeLength(nEntry, nSeg.c ?? nSeg.c1, nSeg.c2, nExit);
    const distance = Math.hypot(nEntry.x - exit.x, nEntry.y - exit.y);
    const deltaLength = distance + segLength;

    iterateFindPath(
      n.index,
      n.entryKey,
      maxLength,
      currentLength + deltaLength,
      currentScore + deltaScore / (segLength + distance * 2),
      currentPath,
      currentBest
    );
  }

  currentPath.pop();
}

const dist2Cutoff = 120 ** 2;
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

function computeLength(entry, control, control2, exit) {
  const cacheKey = getCacheID(entry) + ":" + getCacheID(control) + (control2 ? ":" + getCacheID(control2) : '') + ":" + getCacheID(exit);
  if (computeLength.cache[cacheKey]) {
    return computeLength.cache[cacheKey];
  }

  let value = 0;
  if (control2) {
    const mid1X = (entry.x + control.x + control2.x) / 3;
    const mid1Y = (entry.y + control.y + control2.y) / 3;
    value += Math.hypot(mid1X - entry.x, mid1Y - entry.y);
    const mid2X = (control.x + control2.x + exit.x) / 3;
    const mid2Y = (control.y + control2.y + exit.y) / 3;
    value += Math.hypot(mid2X - mid1X, mid2Y - mid1Y);
    value += Math.hypot(exit.x - mid2X, exit.y - mid2Y);
  } else {
    const midX = (entry.x + control.x + exit.x) / 3;
    const midY = (entry.y + control.y + exit.y) / 3;
    value += Math.hypot(midX - entry.x, midY - entry.y);
    value += Math.hypot(exit.x - midX, exit.y - midY);
  }

  computeLength.cache[cacheKey] = value;
  return value;
}
computeLength.cache = {};

function computeScore(currentSeg, testSeg, prev, current, test, testNext, currentPath) {
  const cacheKey =
    getCacheID(prev) +
    ":" +
    getCacheID(current) +
    ":" +
    getCacheID(test) +
    ":" +
    getCacheID(testNext);
  if (!computeScore.cache[cacheKey]) {
    const dxPrev = current.x - prev.x;
    const dyPrev = current.y - prev.y;
    const dx = test.x - current.x;
    const dy = test.y - current.y;
    const dxNext = testNext.x - test.x;
    const dyNext = testNext.y - test.y;

    const dist2 = dx ** 2 + dy ** 2;
    const dotPrev = (dx * dxPrev + dy * dyPrev) / (Math.hypot(dx, dy) * Math.hypot(dxPrev, dyPrev));
    const dotNext = (dxNext * dx + dyNext * dy) / (Math.hypot(dx, dy) * Math.hypot(dxNext, dyNext));

    const angleWeight = 0.9;
    let angleMult = lerp(1, (dotNext + 1) * (dotPrev + 1) / 4, angleWeight);

    const distMult = 1 / (1 + sqrt(dist2));

    const segScoreWeight = 0.4;
    const segScore = lerp(1, currentSeg.score, segScoreWeight);

    const value = segScore * angleMult * distMult - 0.001;
    computeScore.cache[cacheKey] = value;
  }

  let value = computeScore.cache[cacheKey];

  // collision penalty
  const n = segments.length;
  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    if (seg === currentSeg || seg === testSeg) continue;
    if (intersectsSeg(seg, current.x, current.y, test.x, test.y)) {
      value -= seg.score * 8;
    }
  }

  let lastExit = undefined;
  for (const node of currentPath) {
    const seg = segments[node.index];
    const entry = seg[node.entryKey];
    const exit = seg[node.entryKey === "b" ? "a" : "b"];

    if (
      lastExit &&
      intersectsLine(lastExit.x, lastExit.y, entry.x, entry.y, current.x, current.y, test.x, test.y)
    ) {
      value -= seg.score * 4;
    }

    lastExit = exit;
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
  if (seg.c != undefined) {
    const segMidX = (seg.a.x + seg.b.x + seg.c.x) / 3;
    const segMidY = (seg.a.y + seg.b.y + seg.c.y) / 3;
    return (
      intersectsLine(x0, y0, x1, y1, seg.a.x, seg.a.y, segMidX, segMidY) ||
      intersectsLine(x0, y0, x1, y1, seg.b.x, seg.b.y, segMidX, segMidY)
    );
  } else {
    const segAX = (seg.a.x + seg.c1.x + seg.c2.x) / 3;
    const segAY = (seg.a.y + seg.c1.y + seg.c2.y) / 3;
    const segBX = (seg.b.x + seg.c1.x + seg.c2.x) / 3;
    const segBY = (seg.b.y + seg.c1.y + seg.c2.y) / 3;
    return (
      intersectsLine(x0, y0, x1, y1, seg.a.x, seg.a.y, segAX, segAY) ||
      intersectsLine(x0, y0, x1, y1, seg.b.x, seg.b.y, segAX, segAY) ||
      intersectsLine(x0, y0, x1, y1, seg.a.x, seg.a.y, segBX, segBY) ||
      intersectsLine(x0, y0, x1, y1, seg.b.x, seg.b.y, segBX, segBY)
    );
  }
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
    c: s.c && transformPoint(s.c, x, y, w, h),
    c1: s.c1 && transformPoint(s.c1, x, y, w, h),
    c2: s.c2 && transformPoint(s.c2, x, y, w, h),
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
      c: s.c && { x: -s.c.x, y: s.c.y, z: s.c.z },
      c1: s.c1 && { x: -s.c1.x, y: s.c1.y, z: s.c1.z },
      c2: s.c2 && { x: -s.c2.x, y: s.c2.y, z: s.c2.z },
    })),
  ];
}

function eyeSegs({ closed, browTilt }) {
  return [
    // brow
    {
      score: 0.5,
      a: { x: -1, y: lerp(-0.2, -0.6, browTilt), z: 0.2 },
      c: { x: 0, y: -1, z: 0.2 },
      b: { x: 1, y: lerp(-0.2, -0.6, -browTilt), z: 0.2 },
    },
    // eyelid
    ...(closed
      ? [
        {
          score: 8,
          a: { x: -1, y: 0.6, z: 0.15 },
          c: { x: 0, y: 0.9, z: 0.22 },
          b: { x: 1, y: 0.6, z: 0.15 },
        },
      ]
      : []),
    ...mirrorX([
      // top edge
      {
        score: 12,
        a: { x: -1, y: 0.55, z: 0.15 },
        c: { x: -0.6, y: 0.2, z: 0.25 },
        b: { x: -0.05, y: 0.2, z: 0.25 },
      },
      // bottom edge
      {
        score: 8,
        a: { x: -1, y: 0.65, z: 0.15 },
        c: { x: -0.6, y: 1, z: 0.25 },
        b: { x: -0.05, y: 1, z: 0.25 },
      },
      // iris
      ...(closed
        ? []
        : [
          {
            score: 16,
            a: { x: -0.05, y: 0.2, z: 0.25 },
            c1: { x: -0.5, y: 0.2, z: 0.25 },
            c2: { x: -0.5, y: 0.8, z: 0.25 },
            b: { x: -0.05, y: 0.85, z: 0.25 },
          },
        ]),
    ]),
  ];
}

function noseSegs() {
  return [
    // ridge
    {
      score: 8,
      a: { x: 0, y: -1, z: 0.4 },
      c: { x: 0, y: 0, z: 0.4 },
      b: { x: 0, y: 0.9, z: 0.6 },
    },
    ...mirrorX([
      // side
      {
        score: 8,
        a: { x: -0.7, y: -0.4, z: 0.3 },
        c: { x: -0.7, y: -0.3, z: 0.3 },
        b: { x: -1, y: 0.8, z: 0.36 },
      },
      // base
      {
        score: 12,
        a: { x: -0.9, y: 1, z: 0.38 },
        c: { x: -0.5, y: 1, z: 0.5 },
        b: { x: -0.1, y: 1, z: 0.6 },
      },
    ]),
  ];
}

function lipsSegs({ smile, bite }) {
  return [
    // mouth
    {
      score: 8,
      a: { x: lerp(-1, -1.1, smile), y: lerp(0, -0.4, smile), z: 0.2 },
      c: { x: 0, y: lerp(0, 0.8, smile), z: 0.3 },
      b: { x: lerp(1, 1.1, smile), y: lerp(0, -0.4, smile), z: 0.2 },
    },
    ...mirrorX([
      // top lip
      {
        score: 10,
        a: { x: lerp(-0.9, -0.99, smile), y: lerp(-0.3, -0.7, smile), z: 0.2 },
        c: { x: -0.5, y: -1, z: 0.3 },
        b: { x: -0.3, y: -1, z: 0.3 },
      },
      {
        score: 10,
        a: { x: -0.2, y: -0.95, z: 0.3 },
        c: { x: -0.15, y: -0.8, z: 0.3 },
        b: { x: -0.05, y: -0.7, z: 0.3 },
      },
      // bottom lip
      {
        score: 10,
        a: { x: lerp(-0.9, -0.99, smile), y: lerp(0.3, -0.1, smile), z: 0.2 },
        c: { x: -0.5, y: lerp(1, 0.5, bite), z: 0.3 },
        b: { x: -0.1, y: lerp(1, 0.3, bite), z: 0.3 },
      },
    ]),
  ];
}

function jawSegs() {
  return [
    ...mirrorX([
      {
        score: 0.001,
        a: { x: -1, y: -1, z: -0.1 },
        c: { x: -0.95, y: -0.5, z: -0.2 },
        b: { x: -0.85, y: -0.1, z: -0.1 },
      },
      {
        score: 0.01,
        a: { x: -0.75, y: 0.15, z: -0.1 },
        c: { x: -0.4, y: 0.9, z: 0 },
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
        a: { x: -1, y: -1, z: 0.2 },
        c: { x: -0.9, y: -0.4, z: 0.3 },
        b: { x: -0.8, y: 1, z: 0.2 },
      },
    ]),
  ];
}

function foreheadSegs() {
  return [
    ...mirrorX([
      {
        score: 0.001,
        a: { x: -1, y: 1, z: 0 },
        c: { x: -0.8, y: -1, z: 0 },
        b: { x: -0.5, y: -1, z: 0 },
      },
    ]),
  ];
}
