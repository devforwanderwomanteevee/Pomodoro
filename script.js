const TOTAL_MS = 25 * 60 * 1000;

const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const barEl = document.getElementById('bar');
const barFillEl = barEl.firstElementChild;
const mainBtn = document.getElementById('main-btn');
const resetBtn = document.getElementById('reset-btn');

let state = 'idle'; // idle, running or paused
let remainingMs = TOTAL_MS;
let endTime = 0;
let intervalId = null;

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}

function render() {
  const ms = state === 'running' ? Math.max(0, endTime - performance.now()) : remainingMs;
  timeEl.textContent = formatTime(Math.ceil(ms / 1000));
  barFillEl.style.width = ((TOTAL_MS - ms) / TOTAL_MS) * 100 + '%';

  statusEl.textContent = state === 'idle' ? 'Ready' : 'Focus';
  barEl.hidden = state === 'idle';
  mainBtn.textContent = state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : 'Start';
  mainBtn.disabled = state === 'running' && ms === 0;
}

function tick() {
  if (endTime - performance.now() <= 0) {
    clearInterval(intervalId);
    remainingMs = 0;
  }
  render();
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

// Catch up straight away when the tab comes back to the front
document.addEventListener('visibilitychange', () => {
  if (state === 'running') tick();
});
