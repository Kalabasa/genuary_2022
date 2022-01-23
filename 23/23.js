/// <reference path="../node_modules/@types/p5/global.d.ts" />
/// <reference path="../node_modules/@types/chroma-js/index.d.ts" />
/// <reference path="../node_modules/tone/build/esm/index.d.ts" />

let recordVideo = new URLSearchParams(window.location.search).has("r");

let capturer;
let canvas;

const chords = [
  ["c4", "e4", "g4", "b4"],
  ["c4", "e4", "g#4", "b4"],
  ["b3", "d4", "f4", "a4"],
  ["b3", "d#4", "f#4", "a#4"],
];
let currentChord = 0;

function setup() {
  pixelDensity(1);
  canvas = createCanvas(1080, 1350);
  commonSetup(canvas, "M");

  capturer = new CCapture({ format: "webm" });

  const synth = new Tone.PolySynth().toDestination();

  Tone.Transport.bpm.value = 90;
  Tone.Transport.scheduleRepeat((time) => {
    synth.triggerAttackRelease(chords[currentChord], "1n");
    currentChord = (currentChord + 1) % chords.length;
  }, "1n");
  Tone.Transport.start();
}

function analyzeChord(chord) {
  
}

function draw() {
  if (recordVideo && frameCount === 1) {
    capturer.start();
  }

  background(0);

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
