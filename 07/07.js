/// <reference path="../node_modules/@types/p5/global.d.ts" />

const recordVideo = new URLSearchParams(window.location.search).has('r');

// fake import for jsdoc lol
const p5 = require("p5");
function require() {}

/**
 * @typedef {{
 *  depth: number,
 *  x: number,
 *  y: number,
 *  w: number,
 *  h: number,
 *  index: number,
 *  total: number,
 *  leftDist: number,
 *  rightDist: number,
 *  topDist: number,
 *  bottomDist: number,
 * }} Part
 */

/**
 * @typedef {{
 *  part: Part,
 *  graphics: p5.Graphics,
 *  drawParts: (
 *    columns: Array<{ start: number, end: number }>,
 *    rows: Array<{ start: number, end: number }>,
 *  ) => void,
 * }} Context
 */

/**
 * @typedef {{
 *  name: string,
 *  describe: (params: object, partName: string) => string,
 *  nameSubPart?: (params: object) => string?,
 *  generateParams: () => object,
 *  draw: (context: Context, params: object) => void,
 * }} Instruction
 */

const palette = {
  black: "#222222",
  red: "#d43d2a",
  yellow: "#d5b758",
  blue: "#2aa9be",
  green: "#9cb27a",
};

const direction = {
  horizontal: { x: 1, y: 0 },
  vertical: { x: 0, y: 1 },
  diagonal0: { x: 1, y: 1 },
  diagonal1: { x: 1, y: -1 },
};

const shapes = ["square", "triangle", "circle"];

/** @type {Instruction[]>}*/
let instructions;

let thicknessBias;

const splitX = 360;
const charWidth = 12;
const lineHeight = 20;

let typeCursorX = 0;
let typeCursorY = 0;
const textBlockWidth = (splitX - 30) / charWidth;

let capturer;
let canvas;

/**
 * @type {Array<{
 *  start: number,
 *  end: number,
 *  command: () => void
 * }>}
 * */
let timeline = [];
let timeCursor = 0;
let timeDuration = 0;

const timedCommands = [
  "fill",
  "noFill",
  "stroke",
  "strokeWeight",
  "noStroke",
  "image",
  "rect",
  "quad",
  "circle",
  "text",
  "textFont",
  "textSize",
];
const commandsWithDuration = ["image", "rect", "quad", "circle", "text"];

function createTimedGraphics(graphics) {
  const dummyGraphics = createGraphics(1, 1);

  return new Proxy(graphics, {
    get: (target, key, receiver) => {
      if (key in dummyGraphics && timedCommands.includes(key) && typeof target[key] === "function") {
        return (...args) => {
          addTimedCommand(() => graphics[key](...args), commandsWithDuration.includes(key));
        };
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

function addTimedCommand(command, hasDuration) {
  const duration = hasDuration ? timeDuration : 0;
  timeline.push({ start: timeCursor, end: timeCursor + duration, command });
  timeCursor += duration;
}

function draw() {
  if (recordVideo && frameCount === 1) {
    capturer.start();
  }

  while (timeline.length && timeline[0].start <= frameCount) {
    timeline[0].command();
    timeline.shift();
  }

  if (recordVideo) capturer.capture(canvas);

  if (!timeline.length) {
    noLoop();

    if (recordVideo) {
      for (let i = 0; i < 24; i++) capturer.capture(canvas);
      capturer.stop();
      capturer.save();
    }
  }
}

function generateInstructions() {
  const instructions = [];

  let canSubdivide = true;
  let canDrawInnerShapes = true;
  let canDrawBands = true;

  while (true) {
    if (canSubdivide && random() < 0.9) {
      instructions.push(createSubdivisionInstruction());
      canSubdivide = false;
    }

    let hasContent = false;

    if (random() < 0.3) {
      instructions.push(createSolidFillInstruction());
      hasContent = true;
    }

    if (canDrawBands && (!hasContent || random() < 0.4)) {
      if (!hasContent && random() < 0.1) {
        instructions.push(createBandsInstruction());
      }
      instructions.push(createBandsInstruction());
      canDrawBands = false;
      hasContent = true;
    }

    if (canDrawInnerShapes && random() < 0.3) {
      instructions.push(createInnerSquareInstruction());
      canDrawInnerShapes = false;
      continue;
    }

    if (canDrawInnerShapes && random() < 0.3) {
      instructions.push(createInnerShapeInstruction());
      canDrawInnerShapes = false;
    }

    if (!canSubdivide) break;
  }

  return instructions;
}

function setup() {
  pixelDensity(1);
  const c = createCanvas(1080, 675);
  commonSetup(c, "Bot Lewitt");

  capturer = new CCapture({ format: "webm" });
  canvas = c.elt;

  thicknessBias = randomGaussian(15, 10);
  instructions = generateInstructions();
  const graphics = createTimedGraphics(this);

  background(240);

  timeDuration = 1;
  typeString(graphics, `Drawing algorithm #${floor(random(1e4, 1e5))}\n\n\n`);
  timeCursor += 16;

  let depth = 0;
  let nextPartName = "the surface";

  let currentParts = [
    {
      depth,
      x: splitX,
      y: 0,
      w: width - splitX,
      h: height,
      leftDist: 0,
      rightDist: 0,
      topDist: 0,
      bottomDist: 0,
    },
  ];

  for (let i = 0; i < instructions.length; i++) {
    const instruction = instructions[i];
    const params = instruction.generateParams();

    const desc = instruction.describe(params, nextPartName);
    timeDuration = 1;
    typeString(graphics, desc + ".\n\n");
    timeCursor += 30;

    const nextParts = [];
    const drawParts = (columns, rows) => {
      nextParts.push(...createSubParts(columns, rows, depth));
    };

    for (const part of currentParts) {
      /** @type {Context} */
      const context = {
        part,
        graphics,
        drawParts,
      };

      instruction.draw(context, params);
    }

    if (nextParts.length) {
      currentParts = nextParts;
      nextPartName = (instruction.nameSubPart && instruction.nameSubPart(params)) || "each part";
    } else {
      depth++;
      for (const part of currentParts) {
        part.depth = depth;
      }
    }
  }

  timeCursor += 40;
  timeDuration = 2;
  typeCursorX = 0;
  typeCursorY = (height - 40) / lineHeight - 2;
  typeString(graphics, "BOT LE WITT\n");
  timeCursor += 20;
  const date = moment().format("MMMM, YYYY");
  typeString(graphics, date);
}

function typeString(graphics, string) {
  for (const word of string.split(/(\S+\s+)/)) {
    if (typeCursorX + word.length >= textBlockWidth) {
      typeChar(graphics, "\n");
    }
    for (const char of word) {
      typeChar(graphics, char);
    }
  }
}

function typeChar(graphics, char) {
  graphics.textFont("monospace");
  graphics.textSize(18);
  graphics.noStroke();

  const colour = color(palette.black);
  colour.setAlpha(randomGaussian(240, 64));
  graphics.fill(colour);

  let rand = ((globalSeed + char.charCodeAt(0) * 16809) * 16807) % 2147483647;
  const randX = (rand - 1) / 2147483647;
  rand = (rand * 16807) % 2147483647;
  const randY = (rand - 1) / 2147483647;

  const x = 20 + typeCursorX * charWidth + randomGaussian(0, 0.25) + randX ** 64 * 4;
  const y = 40 + typeCursorY * lineHeight + randY ** 64 * 6;
  if (char !== " " || char !== "\n") {
    const weight = max(floor(randomGaussian(1, 1)), 1);
    const origDuration = timeDuration;
    for (let i = 0; i < weight; i++) {
      graphics.text(char, x, y);
      timeDuration = 0;
    }
    timeDuration = origDuration;
  }

  typeCursorX++;
  if (char === "\n" || typeCursorX > textBlockWidth) {
    typeCursorX = random() ** 2 * 0.2;
    typeCursorY += 1 + random() ** 2 * 0.2;
  }
}

function createSubParts(columns, rows, depth) {
  const result = [];

  for (let r = 0; r < rows.length; r++) {
    const { start: startY, end: endY } = rows[r];

    for (let c = 0; c < columns.length; c++) {
      const { start: startX, end: endX } = columns[c];

      result.push({
        depth,
        x: startX,
        y: startY,
        w: endX - startX,
        h: endY - startY,
        index: r * columns.length + c,
        total: rows.length * columns.length,
        leftDist: r,
        rightDist: rows.length - 1 - r,
        topDist: c,
        bottomDist: columns.length - 1 - c,
      });
    }
  }

  return result;
}

// ====================================================================================================================
// --------------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------
//
// Instruction modules
//
// --------------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------
// ====================================================================================================================

function createInnerSquareInstruction() {
  return {
    name: "inner square",
    describe: (params, partName) => {
      return `Inside ${partName}, draw a square`;
    },
    nameSubPart: (params) => {
      return "each inner square";
    },
    generateParams: () => ({
      size: constrain(randomGaussian(0.8, 0.2), 0.4, 0.9),
      border: round(max(randomGaussian(min(thicknessBias, 30), 4), 8)),
    }),
    draw: (context, params) => {
      const { part, graphics } = context;
      timeDuration = 2;

      graphics.noStroke();
      graphics.fill(palette.black);

      let squareSize = min(part.w, part.h) * params.size;
      if (squareSize < 100) {
        squareSize = Math.min(part.w, part.h, 100);
      }
      squareSize = round(squareSize);

      const left = part.x + (part.w - squareSize) / 2;
      const right = part.x + (part.w + squareSize) / 2;
      const top = part.y + (part.h - squareSize) / 2;
      const bottom = part.y + (part.h + squareSize) / 2;

      graphics.rect(left, top, params.border, squareSize);
      graphics.rect(left, top, squareSize, params.border);
      graphics.rect(right - params.border, top, params.border, squareSize);
      graphics.rect(left, bottom - params.border, squareSize, params.border);

      context.drawParts(
        [
          {
            start: left + params.border,
            end: right - params.border,
          },
        ],
        [
          {
            start: top + params.border,
            end: bottom - params.border,
          },
        ]
      );
    },
  };
}

function createInnerShapeInstruction() {
  return {
    name: "inner shape",
    describe: (params, partName) => {
      return `Inside ${partName}, draw a shape`;
    },
    generateParams: () => ({
      size: constrain(randomGaussian(0.8, 0.2), 0.4, 0.9),
      border: round(max(randomGaussian(min(thicknessBias, 30), 4), 8)),
    }),
    draw: (context, params) => {
      const { part, graphics } = context;
      timeDuration = 2;

      let shapeSize = min(part.w, part.h) * params.size;
      if (shapeSize < 100) {
        shapeSize = Math.min(part.w, part.h, 100);
      }
      shapeSize = round(shapeSize);

      const left = part.x + (part.w - shapeSize) / 2;
      const right = part.x + (part.w + shapeSize) / 2;
      const top = part.y + (part.h - shapeSize) / 2;
      const bottom = part.y + (part.h + shapeSize) / 2;

      const shape = pick(shapes);

      switch (shape) {
        case "square":
          graphics.noStroke();
          graphics.fill(palette.black);
          graphics.rect(left, top, params.border, shapeSize);
          graphics.rect(left, top, shapeSize, params.border);
          graphics.rect(right - params.border, top, params.border, shapeSize);
          graphics.rect(left, bottom - params.border, shapeSize, params.border);
          break;
        case "circle":
          graphics.noFill();
          graphics.stroke(palette.black);
          graphics.strokeWeight(params.border);
          graphics.circle((left + right) / 2, (top + bottom) / 2, shapeSize - params.border);
          break;
        case "triangle":
          graphics.noStroke();
          graphics.fill(palette.black);
          graphics.quad(
            left,
            bottom,
            (left + right) / 2,
            top,
            (left + right) / 2 + 1,
            top + params.border * (7 / 3),
            left + params.border * (4 / 3),
            bottom
          );
          graphics.quad(
            right,
            bottom,
            (left + right) / 2,
            top,
            (left + right) / 2 - 1,
            top + params.border * (7 / 3),
            right - params.border * (4 / 3),
            bottom
          );
          graphics.quad(
            left,
            bottom,
            left + params.border,
            bottom - params.border,
            right - params.border,
            bottom - params.border,
            right,
            bottom
          );
          break;
      }
    },
  };
}

function createBandsInstruction() {
  return {
    name: "bands",
    describe: (params, partName) => {
      const colorDesc = params.mono ? "India ink" : "color ink";
      return `Within ${partName}, draw alternating bands of ${colorDesc}`;
    },
    generateParams: () => ({
      thickness: max(randomGaussian(thicknessBias, 4), 10),
      mono: random() < 0.2,
    }),
    draw: (context, params) => {
      const { part, graphics } = context;
      timeDuration = 1;

      const color = params.mono
        ? palette.black
        : pick(
            Object.values(palette).filter((c) => c !== palette.black),
            context
          );

      const dir = pick(Object.values(direction), context);
      const ortho = dir.x * dir.y === 0;

      let stepY = dir.x;
      let stepX = -dir.y;

      const w = part.w + 1;
      const h = part.h + 1;
      let thickness = params.thickness;

      // adjust thickness to round the amount of bands
      const period = params.thickness;
      if (ortho) {
        if (dir.y !== 0) {
          thickness = w / round(w / period);
        } else {
          thickness = h / round(h / period);
        }
      } else {
        const l = max(w, h) * Math.SQRT2;
        thickness = l / round(l / period);
      }

      const div = Math.hypot(stepX, stepY);
      stepX = (stepX / div) * thickness;
      stepY = (stepY / div) * thickness;

      const buffer = createTimedGraphics(createGraphics(w, h));
      buffer.noStroke();
      buffer.fill(color);

      const overfill = thickness;
      const left = -overfill;
      const right = w + overfill;
      const top = -overfill;
      const bottom = h + overfill;

      let filled = true;
      let lastX0, lastY0, lastX1, lastY1;
      for (let x = stepX < 0 ? right : left, y = stepY < 0 ? bottom : top; true; x += stepX, y += stepY) {
        const topX = x + ((top - y) * dir.x) / dir.y;
        const bottomX = x + ((bottom - y) * dir.x) / dir.y;
        const leftY = y + ((left - x) * dir.y) / dir.x;
        const rightY = y + ((right - x) * dir.y) / dir.x;

        let x0 = topX;
        let x1 = bottomX;
        let y0 = dir.y >= 0 ? leftY : rightY;
        let y1 = dir.y >= 0 ? rightY : leftY;

        if (x0 < left) x0 = left;
        if (y0 < top) y0 = top;
        if (x0 > right) x0 = right;
        if (y0 > bottom) y0 = bottom;
        if (x1 < left) x1 = left;
        if (y1 < top) y1 = top;
        if (x1 > right) x1 = right;
        if (y1 > bottom) y1 = bottom;

        if (lastX0 !== undefined && lastY0 !== undefined && lastX1 !== undefined && lastY1 !== undefined) {
          if (filled) {
            buffer.clear();
            buffer.quad(
              round(lastX0),
              round(lastY0),
              round(lastX1),
              round(lastY1),
              round(x1),
              round(y1),
              round(x0),
              round(y0)
            );
            graphics.image(buffer, part.x, part.y, part.w + 0.5, part.h + 0.5, 0, 0, part.w + 0.5, part.h + 0.5);
          }

          if (
            (stepX < 0 && topX < left && bottomX < left) ||
            (stepX > 0 && topX > right && bottomX > right) ||
            (stepY < 0 && leftY < top && rightY < top) ||
            (stepY > 0 && leftY > bottom && rightY > bottom)
          ) {
            break;
          }
        }

        filled = !filled;
        lastX0 = x0;
        lastY0 = y0;
        lastX1 = x1;
        lastY1 = y1;
      }
    },
  };
}

function createSolidFillInstruction() {
  return {
    name: "solid fill",
    describe: (params, partName) => `Fill ${partName} with color ink`,
    generateParams: () => null,
    draw: (context, params) => {
      const { part, graphics } = context;
      timeDuration = 10;

      const color = pick(
        Object.values(palette).filter((c) => c !== palette.black),
        context
      );

      graphics.strokeWeight(0.5);
      graphics.stroke(color);
      graphics.fill(color);
      graphics.rect(part.x, part.y, part.w, part.h);
    },
  };
}

function createSubdivisionInstruction() {
  return {
    name: "equal subdivision",
    describe: (params, partName) => {
      let sizeText;
      if (params.rows === 1) {
        sizeText = `Divide ${partName} horizontally into ${formatNum(params.columns)} equal parts`;
      } else if (params.columns === 1) {
        sizeText = `Divide ${partName} vertically into ${formatNum(params.rows)} equal parts`;
      } else {
        const n = params.columns * params.rows;
        const subPartName = params.columns === params.rows ? "squares" : "parts";
        const divideText =
          n < 10
            ? `Divide ${partName} horizontally and vertically into ${formatNum(n)} equal ${subPartName}`
            : `Divide ${partName} horizontally and vertically into equal ${subPartName}`;

        const dimensionsText =
          n > 9 || params.columns !== params.rows
            ? `, ${formatNum(params.rows)} high and ${formatNum(params.columns)} wide`
            : "";

        sizeText = divideText + dimensionsText;
      }

      const borderText =
        params.border > 30
          ? ", " + (params.fillBorder ? "with thick black borders" : "with a wide gap between each part")
          : params.border > 20
          ? ", " + (params.fillBorder ? "bordered by black bands" : "with a small gap between each part")
          : params.fillBorder && params.border > 0
          ? ", outlined in black"
          : "";

      return sizeText + borderText;
    },
    nameSubPart: (params) => {
      if (params.rows === 1) {
        return "each column";
      } else if (params.columns === 1) {
        return "each row";
      }

      if (params.rows === params.columns) {
        return "each square";
      }
    },
    generateParams: () => {
      const minSide = floor(random(3));

      let border = max(randomGaussian(thicknessBias - 8, 4), 0);
      if (border > 0) border += 8;

      return {
        columns: max(1 + minSide, round(randomGaussian(1, 0.1) ** 4)),
        rows: max(1 + (2 - minSide), round(randomGaussian(1, 0.1) ** 4)),
        border,
        fillBorder: border > 0 && random() < 0.8,
      };
    },
    draw: (context, params) => {
      const { part, graphics } = context;
      timeDuration = 5;

      const columnEnds = [];
      const rowEnds = [];

      graphics.noStroke();
      graphics.fill(palette.black);

      const halfBorder = params.border / 2;
      const left = part.x + halfBorder;
      const right = part.x + part.w - halfBorder;
      const top = part.y + halfBorder;
      const bottom = part.y + part.h - halfBorder;

      if (params.fillBorder) {
        graphics.rect(part.x, part.y, halfBorder + 1, part.h);
        graphics.rect(right - 1, part.y, halfBorder + 1, part.h);
        graphics.rect(part.x, part.y, part.w, halfBorder + 1);
        graphics.rect(part.x, bottom - 1, part.w, halfBorder + 1);
      }

      for (let i = 0; i < params.columns; i++) {
        const divStart = round(lerp(left, right, i / params.columns));
        const divEnd = round(lerp(left, right, (i + 1) / params.columns));

        if (params.fillBorder) {
          graphics.rect(divStart - 1, part.y, halfBorder + 1, part.h);
          graphics.rect(divEnd - halfBorder, part.y, halfBorder + 1, part.h);
        }

        columnEnds.push({
          start: divStart + halfBorder,
          end: divEnd - halfBorder,
        });
      }

      for (let i = 0; i < params.rows; i++) {
        const divStart = round(lerp(top, bottom, i / params.rows));
        const divEnd = round(lerp(top, bottom, (i + 1) / params.rows));

        if (params.fillBorder) {
          graphics.rect(part.x, divStart - 1, part.w, halfBorder + 1);
          graphics.rect(part.x, divEnd - halfBorder, part.w, halfBorder + 1);
        }

        rowEnds.push({
          start: divStart + halfBorder,
          end: divEnd - halfBorder,
        });
      }

      context.drawParts(columnEnds, rowEnds);
    },
  };
}

/**
 * @param {any[]} selections
 * @param {Context?} context
 */
function pick(selections, context) {
  const n = selections.length;

  if (context) {
    const offset = globalSeed % n;

    const n1 = floor(n / 2);
    const n2 = n - n1;

    const c = (context.part.leftDist + context.part.topDist + context.part.depth) % 2;
    const index = floor(random(n1)) * (1 - c) + floor(n1 + random(n2)) * c;

    return shuffled(selections)[(index + offset) % n];
  } else {
    return selections[floor(random(n))];
  }
}

function shuffled(array) {
  const result = [...array];
  const n = array.length;

  let rand = globalSeed;

  for (let i = 0; i < n; i++) {
    rand = (rand * 16807) % 2147483647;
    const swap = floor(i + 1 * ((rand - 1) / 2147483646));
    result[i] = result[swap];
    result[swap] = array[i];
  }

  return result;
}

function formatNum(n) {
  switch (n) {
    case 0:
      return "zero";
    case 1:
      return "one";
    case 2:
      return "two";
    case 3:
      return "three";
    case 4:
      return "four";
    case 5:
      return "five";
    case 6:
      return "six";
    case 7:
      return "seven";
    case 8:
      return "eight";
    case 9:
      return "nine";
  }
  return n.toString();
}
