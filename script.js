const SEARCH_URL = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?medium=Paintings&hasImages=true&isHighlight=true';
const OBJECT_URL = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';

// Paintings that would lose more than this share of the picture to cropping are passed over
const MAX_CROP = 0.1;

// Give up on a request after 10 seconds, and on finding a painting after 5 tries
const REQUEST_TIMEOUT_MS = 10 * 1000;
const MAX_TRIES = 5;
const RETRY_PAUSE_MS = 1000;
const FRIENDLY_MESSAGE = "We couldn't load a painting this time.";

const TOTAL_MS = 25 * 60 * 1000;

// Starting blur, as a share of the screen's longer side
const BLUR_SHARE = 0.06;

const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const barEl = document.getElementById('bar');
const barFillEl = barEl.firstElementChild;
const actionsEl = document.getElementById('actions');
const mainBtn = document.getElementById('main-btn');
const resetBtn = document.getElementById('reset-btn');
const restartBtn = document.getElementById('restart-btn');
const photoEl = document.getElementById('photo');
const loadingEl = document.getElementById('loading');
const noticeEl = document.getElementById('notice');
const retryBtn = document.getElementById('retry-btn');

let state = 'idle'; // idle, running, paused or finished
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;
let frameId = null;
let detailsEl = null;
let paintingIds = [];
let currentId = null;
let currentPainting = null;
let currentImage = null;
let loadRun = 0;

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}

// The details only exist on the page while the session is finished
function showDetails() {
  if (detailsEl) return;
  if (!currentPainting) {
    detailsEl = document.createElement('div');
    detailsEl.className = 'details';
    const message = document.createElement('p');
    message.className = 'message';
    message.textContent = FRIENDLY_MESSAGE;
    detailsEl.append(message);
    actionsEl.before(detailsEl);
    return;
  }
  const title = (currentPainting.title || '').trim();
  const artist = (currentPainting.artistDisplayName || '').trim();
  const year = (currentPainting.objectDate || '').trim();
  const url = (currentPainting.objectURL || '').trim();

  detailsEl = document.createElement('div');
  detailsEl.className = 'details';
  const name = document.createElement('p');
  name.className = 'name';
  name.textContent = title || 'Untitled';
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [artist || 'Unknown artist', year].filter(Boolean).join(' · ');
  detailsEl.append(name, meta);

  if (url.startsWith('https://')) {
    const link = document.createElement('a');
    link.className = 'link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View on the Met website';
    detailsEl.append(link);
  }
  actionsEl.before(detailsEl);
}

function hideDetails() {
  if (!detailsEl) return;
  detailsEl.remove();
  detailsEl = null;
}

function currentMs() {
  return state === 'running' ? Math.max(0, endTime - performance.now()) : remainingMs;
}

// The blur is strongest with all the time left and gone at 00:00
function updateBlur(ms) {
  const px = Math.max(window.innerWidth, window.innerHeight) * BLUR_SHARE * (ms / TOTAL_MS);
  photoEl.style.setProperty('--blur', px.toFixed(2) + 'px');
}

function animateBlur() {
  if (state !== 'running') return;
  updateBlur(currentMs());
  frameId = requestAnimationFrame(animateBlur);
}

function render() {
  const ms = currentMs();
  updateBlur(ms);
  timeEl.textContent = formatTime(Math.ceil(ms / 1000));
  barFillEl.style.width = ((TOTAL_MS - ms) / TOTAL_MS) * 100 + '%';

  statusEl.textContent = state === 'idle' ? 'Ready' : state === 'finished' ? 'Session complete' : 'Focus';
  barEl.hidden = state === 'idle' || state === 'finished';
  mainBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Start';
  mainBtn.hidden = state === 'finished';
  resetBtn.hidden = state === 'finished';
  restartBtn.hidden = state !== 'finished';

  if (state === 'finished') showDetails();
  else hideDetails();
}

function finish() {
  clearInterval(intervalId);
  remainingMs = 0;
  state = 'finished';
  render();
}

function tick() {
  if (endTime - performance.now() <= 0) finish();
  else render();
}

function start() {
  state = 'running';
  endTime = performance.now() + remainingMs;
  intervalId = setInterval(tick, 200);
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(animateBlur);
  render();
}

function pause() {
  clearInterval(intervalId);
  remainingMs = Math.max(0, endTime - performance.now());
  if (remainingMs === 0) {
    finish();
    return;
  }
  state = 'paused';
  render();
}

function reset() {
  clearInterval(intervalId);
  state = 'idle';
  remainingMs = TOTAL_MS;
  render();
}

mainBtn.addEventListener('click', () => {
  if (state === 'running') pause();
  else start();
});
resetBtn.addEventListener('click', reset);
restartBtn.addEventListener('click', reset);

window.addEventListener('resize', () => {
  updateBlur(currentMs());
  drawPhoto();
});

// Catch up straight away when the tab comes back to the front
document.addEventListener('visibilitychange', () => {
  if (state === 'running') tick();
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ask the museum for JSON; any problem (no answer, too slow, an error reply) gives null
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Load a picture; if it fails or takes more than 10 seconds, the answer is null
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      img.src = '';
      resolve(null);
    }, REQUEST_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

// How much of the picture gets trimmed when it fills the screen (0 = none, 0.5 = half)
function cropAmount(img) {
  const imageShape = img.naturalWidth / img.naturalHeight;
  const screenShape = window.innerWidth / window.innerHeight;
  return 1 - Math.min(imageShape, screenShape) / Math.max(imageShape, screenShape);
}

// Draw the painting filling the screen, plus a margin of mirrored picture around it.
// The blur then fades into the mirrored picture instead of into nothing, so the visible edges stay clean.
function drawPhoto() {
  if (!currentImage) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const margin = Math.ceil(Math.max(width, height) * BLUR_SHARE * 2.5);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  photoEl.style.left = -margin + 'px';
  photoEl.style.top = -margin + 'px';
  photoEl.style.width = width + margin * 2 + 'px';
  photoEl.style.height = height + margin * 2 + 'px';
  photoEl.width = Math.round((width + margin * 2) * ratio);
  photoEl.height = Math.round((height + margin * 2) * ratio);

  const scale = Math.max(width / currentImage.naturalWidth, height / currentImage.naturalHeight);
  const drawWidth = currentImage.naturalWidth * scale;
  const drawHeight = currentImage.naturalHeight * scale;
  const context = photoEl.getContext('2d');
  context.scale(ratio, ratio);

  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      context.save();
      // The middle tile is the picture itself; the tiles around it are mirrored copies
      context.translate(col === 0 ? margin : margin + (col + 1) * width, row === 0 ? margin : margin + (row + 1) * height);
      context.scale(col === 0 ? 1 : -1, row === 0 ? 1 : -1);
      context.beginPath();
      context.rect(0, 0, width, height);
      context.clip();
      context.drawImage(currentImage, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    }
  }
}

function showPainting(id, painting, img) {
  currentId = id;
  currentPainting = painting;
  currentImage = img;
  drawPhoto();
  photoEl.classList.add('ready');
  if (state === 'finished') {
    hideDetails();
    showDetails();
  }
}

function isPainting(painting) {
  const kind = (painting.classification || '').trim();
  return kind === '' || /paint/i.test(kind);
}

// One try: pick a painting we haven't tried, and return it with its picture, or null if anything is wrong
async function fetchCandidate(tried) {
  if (paintingIds.length === 0) {
    const search = await getJson(SEARCH_URL);
    if (!search || !Array.isArray(search.objectIDs) || search.objectIDs.length === 0) return null;
    paintingIds = search.objectIDs;
  }
  const choices = paintingIds.filter((id) => id !== currentId && !tried.has(id));
  if (choices.length === 0) return null;
  const id = choices[Math.floor(Math.random() * choices.length)];
  tried.add(id);

  const painting = await getJson(OBJECT_URL + id);
  if (!painting || !isPainting(painting)) return null;
  const photoUrl = painting.primaryImageSmall;
  if (typeof photoUrl !== 'string' || !photoUrl.startsWith('https://')) return null;
  const img = await loadImage(photoUrl);
  if (!img) return null;
  return { id, painting, img, crop: cropAmount(img) };
}

// With no painting to show, go back to the placeholder and say so kindly
function showNoPainting() {
  currentId = null;
  currentPainting = null;
  currentImage = null;
  photoEl.classList.remove('ready');
  noticeEl.hidden = false;
  if (state === 'finished') {
    hideDetails();
    showDetails();
  }
}

// Try up to 5 times to find a painting that has a photo and fits the screen
async function loadPainting() {
  const run = ++loadRun;
  noticeEl.hidden = true;
  loadingEl.hidden = false;
  const tried = new Set();
  let best = null;
  let pause = false;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (pause) {
      await wait(RETRY_PAUSE_MS);
      if (run !== loadRun) return;
    }
    pause = true;
    const candidate = await fetchCandidate(tried);
    if (run !== loadRun) return;
    if (!candidate) continue;
    pause = false;
    if (!best || candidate.crop < best.crop) best = candidate;
    if (candidate.crop <= MAX_CROP) break;
  }
  loadingEl.hidden = true;
  if (best) showPainting(best.id, best.painting, best.img);
  else showNoPainting();
}

restartBtn.addEventListener('click', loadPainting);
retryBtn.addEventListener('click', () => {
  paintingIds = [];
  loadPainting();
});
updateBlur(TOTAL_MS);
loadPainting();
