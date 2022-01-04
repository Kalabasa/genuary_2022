p5.disableFriendlyErrors = true;

let globalSeed = Math.floor(Math.random() * 10000);

function commonSetup(
  canvas,
  name = window.location.pathname.replace(/\//g, '')
) {
  setupSeed(name);
  setupDownloader(canvas, name);
}

function setupSeed(name) {
  const params = new URLSearchParams(window.location.search);
  if (params.has('s')) {
    globalSeed = Number.parseInt(params.get('s'));
  }

  randomSeed(globalSeed);
  noiseSeed(globalSeed);

  document.title = `${name} #${globalSeed}`;
  window.history.replaceState(undefined, undefined, `?s=${globalSeed}`);

  document.addEventListener('keyup', (e) => {
    if (e.key !== ' ') return;
    window.location.search = '';
  });
}

function setupDownloader(canvas, name) {
  document.addEventListener('keyup', (e) => {
    if (e.key !== 's') return;
    saveCanvas(canvas, `${name} #${globalSeed}`, 'png');
  });
}
