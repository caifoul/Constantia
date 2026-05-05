const TIMER_KEY = 'workoutTimerEndTime';
let _tick    = null;
let _warned  = false;

function getConfiguredSeconds() {
  try {
    const profile = JSON.parse(localStorage.getItem('strengthTrackerProfile') || '{}');
    const raw = profile.workoutTimerMinutes;
    if (!raw || raw === 'off') return null;
    const mins = parseFloat(raw);
    return isNaN(mins) || mins <= 0 ? null : Math.round(mins * 60);
  } catch (_) { return null; }
}

function persist(endTime) {
  try {
    if (endTime == null) localStorage.removeItem(TIMER_KEY);
    else localStorage.setItem(TIMER_KEY, String(endTime));
  } catch (_) {}
}

function savedEndTime() {
  try {
    const v = localStorage.getItem(TIMER_KEY);
    return v ? parseInt(v) : null;
  } catch (_) { return null; }
}

function fmt(s) {
  s = Math.max(0, s);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function showPickYourSong() {
  if (document.getElementById('pick-song-overlay')) return;
  const el = document.createElement('div');
  el.id        = 'pick-song-overlay';
  el.className = 'pick-song-overlay';
  el.innerHTML = `
    <div class="pick-song-content">
      <p class="pick-song-text">PICK YOUR SONG!</p>
      <p class="pick-song-sub">Tap to dismiss</p>
    </div>
  `;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

function startTick(endTime) {
  if (_tick) clearInterval(_tick);
  _warned = Math.floor((endTime - Date.now()) / 1000) <= 10;

  function tick() {
    const remaining = Math.floor((endTime - Date.now()) / 1000);
    const widget    = document.getElementById('workout-timer-widget');
    if (!widget) return;

    if (remaining <= 0) {
      clearInterval(_tick);
      _tick = null;
      persist(null);
      widget.innerHTML = '<div class="timer-display timer-done">⏱ Done!</div>';
      document.getElementById('pick-song-overlay')?.remove();
      return;
    }

    if (remaining <= 10 && !_warned) {
      _warned = true;
      showPickYourSong();
    }

    const cls = remaining <= 10 ? 'timer-critical' : remaining <= 60 ? 'timer-low' : '';
    widget.innerHTML = `<div class="timer-display ${cls}">⏱ ${fmt(remaining)}</div>`;
  }

  tick();
  _tick = setInterval(tick, 500);
}

export function startWorkoutTimer() {
  const secs = getConfiguredSeconds();
  if (!secs) return;
  const endTime = Date.now() + secs * 1000;
  persist(endTime);
  _warned = false;
  startTick(endTime);
}

export function stopWorkoutTimer() {
  if (_tick) { clearInterval(_tick); _tick = null; }
  persist(null);
  const widget = document.getElementById('workout-timer-widget');
  if (widget) widget.innerHTML = '';
  document.getElementById('pick-song-overlay')?.remove();
}

export function restoreWorkoutTimer() {
  const endTime = savedEndTime();
  if (!endTime) return;
  const remaining = Math.floor((endTime - Date.now()) / 1000);
  if (remaining <= 0) { persist(null); return; }
  startTick(endTime);
}
