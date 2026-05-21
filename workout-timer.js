// Rest timer — counts down between exercises/sets
// Options: Off, 30s, 69s, 108s, … (start 30, step +39)

const TIMER_KEY = 'restTimerEndTime';
export const REST_OPTIONS = [30, 69, 108, 147, 186, 225, 264, 303]; // seconds

let _tick = null;

export function fmtSecs(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0
    ? `${m}:${String(sec).padStart(2, '0')}`
    : `${sec}s`;
}

function getConfiguredSeconds() {
  try {
    const profile = JSON.parse(localStorage.getItem('strengthTrackerProfile') || '{}');
    const v = profile.restTimerSeconds;
    if (!v || v === 'off') return null;
    const n = parseInt(v);
    return isNaN(n) || n <= 0 ? null : n;
  } catch (_) { return null; }
}

function persist(endTime) {
  try {
    if (endTime == null) localStorage.removeItem(TIMER_KEY);
    else localStorage.setItem(TIMER_KEY, String(endTime));
  } catch (_) {}
}

function getSavedEndTime() {
  try {
    const v = localStorage.getItem(TIMER_KEY);
    return v ? parseInt(v) : null;
  } catch (_) { return null; }
}

function startTick(endTime) {
  if (_tick) clearInterval(_tick);

  function tick() {
    const remaining = Math.floor((endTime - Date.now()) / 1000);
    const widget = document.getElementById('workout-timer-widget');
    if (!widget) return;

    if (remaining <= 0) {
      clearInterval(_tick);
      _tick = null;
      persist(null);
      widget.innerHTML = '<div class="timer-display timer-done">✓ Rest over!</div>';
      setTimeout(() => {
        const w = document.getElementById('workout-timer-widget');
        if (w) w.innerHTML = '';
      }, 4000);
      return;
    }

    const cls = remaining <= 5 ? 'timer-critical' : remaining <= 15 ? 'timer-low' : '';
    widget.innerHTML = `<div class="timer-display ${cls}">Rest ${fmtSecs(remaining)}</div>`;
  }

  tick();
  _tick = setInterval(tick, 500);
}

export function startRestTimer() {
  const secs = getConfiguredSeconds();
  if (!secs) return;
  const endTime = Date.now() + secs * 1000;
  persist(endTime);
  startTick(endTime);
}

export function stopRestTimer() {
  if (_tick) { clearInterval(_tick); _tick = null; }
  persist(null);
  const widget = document.getElementById('workout-timer-widget');
  if (widget) widget.innerHTML = '';
}

export function restoreRestTimer() {
  const endTime = getSavedEndTime();
  if (!endTime) return;
  const remaining = Math.floor((endTime - Date.now()) / 1000);
  if (remaining <= 0) { persist(null); return; }
  startTick(endTime);
}
