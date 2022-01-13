/// <reference path="../node_modules/@types/p5/global.d.ts" />

let recordVideo = new URLSearchParams(window.location.search).has("r");

const neurons = [];

const threshold = 1;
const decay = 0.02;
const perturbation = 0.001;

let radius = 80;
let colorScale;

let capturer;
let canvas;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "Neurons");
  
  capturer = new CCapture({ format: "webm" });

  colorScale = chroma
    .scale([
      chroma(randomGaussian(32, 8), randomGaussian(32, 8), randomGaussian(32, 8)).luminance(0.006),
      chroma(
        randomGaussian(255, 128),
        randomGaussian(255, 128),
        randomGaussian(255, 128)
      ).luminance(0.5),
    ])
    .mode("hsl");

  radius = randomGaussian(90, 10);
  const noiseScale = Math.max(randomGaussian(0.01, 0.01), 1e-4);
  const margin = 10;

  const cooldownMean = randomGaussian(30, 20);
  const speedMultiplier = Math.max(randomGaussian(0.06, 0.03), 1e-4);

  const grid = Math.max(round(randomGaussian(19, 2)), 0);
  const count = grid * grid + Math.max(round(randomGaussian(50, 25)), 0);
  for (let i = 0; i < count; i++) {
    let x, y;
    if (i < grid * grid) {
      const cellWidth = (width - margin * 2) / grid;
      const cellHeight = (height - margin * 2) / grid;
      x = margin + (i % grid) * cellWidth + random(cellWidth);
      y = margin + floor(i / grid) * cellHeight + random(cellHeight);
    } else {
      x = margin + random(width - margin * 2);
      y = margin + random(height - margin * 2);
    }
    neurons.push({
      x,
      y,
      potential: random() * 1.06,
      cooldown: 0,
      cooldownDuration: Math.max(randomGaussian(cooldownMean, 3), 0),
      inputs: [],
      outputs: [],
    });
  }

  neurons.sort((a, b) => a.x - b.x);

  let min = 0;
  let max = 0;
  for (let i = 0; i < neurons.length; i++) {
    const n = neurons[i];

    while (max < neurons.length && neurons[max].x < n.x + radius) max++;
    while (min < neurons.length && neurons[min].x < n.x - radius) min++;

    for (let j = min; j < max; j++) {
      if (i === j) continue;

      const m = neurons[j];

      const dx = m.x - n.x;
      const dy = m.y - n.y;
      const distance = Math.hypot(dx, dy);

      if (distance > radius) continue;
      if (m.inputs.some((d) => d.sender === n)) continue;
      if (m.outputs.some((d) => d.receiver === n)) continue;

      const dirBiasX = noise(n.x * noiseScale, n.y * noiseScale) * 2 - 1;
      const dirBiasY = noise(n.x * noiseScale, n.y * noiseScale, 4) * 2 - 1;
      const dot = dx * dirBiasX + dy * dirBiasY;
      const cosVal = dot / (Math.hypot(dx, dy) * Math.hypot(dirBiasX, dirBiasY));

      const flow = random() < (cosVal * 0.8 + 1) / 2;
      const sender = flow ? m : n;
      const receiver = flow ? n : m;

      const dendrite = {
        sender,
        receiver,
        delay: Math.max(randomGaussian(distance * speedMultiplier, 2), 0),
        bias: randomGaussian(-decay, 0.2),
        weight: constrain(randomGaussian(0.5, 0.5), 0, 1),
        signals: [],
      };
      sender.outputs.push(dendrite);
      receiver.inputs.push(dendrite);
    }
  }
}

function draw() {
  if (recordVideo && frameCount === 1) {
    capturer.start();
  }

  background(0);

  for (const neuron of neurons) {
    neuron.potential += randomGaussian(perturbation, 0.001);

    let received = false;
    for (const input of neuron.inputs) {
      while (input.signals.length) {
        const next = input.signals[0];
        if (next.time <= frameCount) {
          input.signals.shift();
          neuron.potential += next.amount;
          received = true;
        } else {
          break;
        }
      }
    }

    if (
      (received || frameCount < 10 || random() < 0.04) &&
      neuron.cooldown <= frameCount &&
      neuron.potential >= threshold
    ) {
      let totalWeight = 0;
      for (let output of neuron.outputs) {
        totalWeight += output.weight;
      }

      for (let output of neuron.outputs) {
        const amount = output.bias + neuron.potential * (output.weight / totalWeight);
        if (amount > 0) {
          output.signals.push({
            time: frameCount + output.delay,
            amount: amount,
          });
        }
      }

      neuron.potential = 0;
      neuron.cooldown = frameCount + neuron.cooldownDuration;
    }
  }

  for (const neuron of neurons) {
    for (const output of neuron.outputs) {
      const weight = 1 + 3 * output.weight ** 2;

      stroke(...colorScale(0).rgb());
      strokeWeight(weight);
      strokeCap(SQUARE);
      line(neuron.x, neuron.y, output.receiver.x, output.receiver.y);

      for (const signal of output.signals) {
        const t = constrain((signal.time - frameCount) / output.delay, 0, 1);
        const x = lerp(output.receiver.x, neuron.x, t);
        const y = lerp(output.receiver.y, neuron.y, t);

        const t2 = constrain((signal.time - frameCount - 1) / output.delay, 0, 1);
        const x2 = lerp(output.receiver.x, neuron.x, t2);
        const y2 = lerp(output.receiver.y, neuron.y, t2);

        stroke(...colorScale(signal.amount / threshold).rgb());
        strokeWeight(weight + 1);
        line(x, y, x2, y2);
      }
    }
  }

  for (const neuron of neurons) {
    const t = Math.max(
      ((neuron.potential / threshold) * 0.5) ** 4,
      (neuron.cooldown - frameCount) / neuron.cooldownDuration
    );
    const ts = constrain(t, 0, 1) ** 4;
    noStroke();
    fill(...colorScale(ts).rgb());
    circle(neuron.x, neuron.y, lerp(6, 8, ts));
  }

  if (recordVideo) {
    capturer.capture(canvas.elt);
    if (frameCount > 300) {
      recordVideo = false;
      capturer.stop();
      capturer.save((blob) => {
        const a = document.createElement("a");
        document.body.appendChild(a);
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = document.title + ".webm";
        a.click();
        window.URL.revokeObjectURL(url);
        setTimeout(() => a.remove());
      });
    }
  }
}
