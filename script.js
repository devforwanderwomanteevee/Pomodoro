const TOTAL_MS = 25 * 60 * 1000;

// Made-up details for now; shown only when the timer reaches 00:00
const PAINTING = { name: 'The Amber Harbor', artist: 'Elena Marlowe', year: '1887' };

const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const barEl = document.getElementById('bar');
const barFillEl = barEl.firstElementChild;
const actionsEl = document.getElementById('actions');
const mainBtn = document.getElementById('main-btn');
const resetBtn = document.getElementById('reset-btn');
const restartBtn = document.getElementById('restart-btn');

let state = 'idle'; // idle, running, paused or finished
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;
let detailsEl = null;

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}

// The details only exist on the page while the session is finished
function showDetails() {
  if (detailsEl) return;
  detailsEl = document.createElement('div');
  detailsEl.className = 'details';
  const name = document.createElement('p');
  name.className = 'name';
  name.textContent = PAINTING.name;
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = PAINTING.artist + ' · ' + PAINTING.year;
  detailsEl.append(name, meta);
  actionsEl.before(detailsEl);
}

function hideDetails() {
  if (!detailsEl) return;
  detailsEl.remove();
  detailsEl = null;
}

function render() {
  const ms = state === 'running' ? Math.max(0, endTime - performance.now()) : remainingMs;
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

// Catch up straight away when the tab comes back to the front
document.addEventListener('visibilitychange', () => {
  if (state === 'running') tick();
});
