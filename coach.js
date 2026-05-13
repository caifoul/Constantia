import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, setDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMotivationalMessage, getMotivationStyle } from './motivation.js';
import { showWarmup } from './warmup.js';
import { initSetRows, renderSetRows, readSetDetails, summarizeSets } from './set-rows.js';
import { startWorkoutTimer, stopWorkoutTimer, restoreWorkoutTimer } from './workout-timer.js';
import { attachAutocomplete } from './exercise-autocomplete.js';

// ── Exercise alternatives ─────────────────────────────────────────
const ALTERNATIVES = {
  'Bench Press':             ['Dumbbell Bench Press', 'Floor Press', 'Cable Fly', 'Push-Up'],
  'Incline Bench Press':     ['Incline Dumbbell Press', 'Cable Fly', 'Incline Push-Up'],
  'Decline Bench Press':     ['Dumbbell Bench Press', 'Cable Fly', 'Push-Up'],
  'Dumbbell Bench Press':    ['Bench Press', 'Floor Press', 'Cable Fly', 'Push-Up'],
  'Close-Grip Bench Press':  ['Tricep Pushdown', 'Skullcrusher', 'Diamond Push-Up'],
  'Back Squat':              ['Leg Press', 'Goblet Squat', 'Bulgarian Split Squat', 'Front Squat'],
  'Front Squat':             ['Back Squat', 'Goblet Squat', 'Leg Press'],
  'Goblet Squat':            ['Leg Press', 'Back Squat', 'Bulgarian Split Squat'],
  'Bulgarian Split Squat':   ['Reverse Lunge', 'Walking Lunge', 'Leg Press', 'Step-Up'],
  'Deadlift':                ['Romanian Deadlift', 'Trap Bar Deadlift', 'Good Morning', 'Stiff-Leg Deadlift'],
  'Romanian Deadlift':       ['Stiff-Leg Deadlift', 'Good Morning', 'Leg Curl', 'Cable Pull-Through'],
  'Sumo Deadlift':           ['Deadlift', 'Trap Bar Deadlift', 'Romanian Deadlift'],
  'Trap Bar Deadlift':       ['Deadlift', 'Romanian Deadlift', 'Leg Press'],
  'Overhead Press':          ['Seated Dumbbell Press', 'Arnold Press', 'Push Press', 'Dumbbell Lateral Raise'],
  'Seated Dumbbell Press':   ['Overhead Press', 'Arnold Press', 'Cable Lateral Raise'],
  'Push Press':              ['Overhead Press', 'Seated Dumbbell Press', 'Arnold Press'],
  'Arnold Press':            ['Overhead Press', 'Seated Dumbbell Press', 'Push Press'],
  'Pull-Up':                 ['Lat Pulldown', 'Cable Row', 'Single-Arm Dumbbell Row', 'Chin-Up'],
  'Chin-Up':                 ['Pull-Up', 'Lat Pulldown', 'Cable Row'],
  'Lat Pulldown':            ['Pull-Up', 'Chin-Up', 'Cable Row', 'Single-Arm Dumbbell Row'],
  'Barbell Row':             ['Cable Row', 'Single-Arm Dumbbell Row', 'T-Bar Row', 'Pendlay Row'],
  'Cable Row':               ['Barbell Row', 'Single-Arm Dumbbell Row', 'T-Bar Row'],
  'Single-Arm Dumbbell Row': ['Cable Row', 'Barbell Row', 'T-Bar Row'],
  'T-Bar Row':               ['Barbell Row', 'Cable Row', 'Single-Arm Dumbbell Row'],
  'Leg Press':               ['Back Squat', 'Bulgarian Split Squat', 'Goblet Squat', 'Leg Extension'],
  'Leg Extension':           ['Leg Press', 'Bulgarian Split Squat', 'Step-Up'],
  'Leg Curl':                ['Romanian Deadlift', 'Stiff-Leg Deadlift', 'Good Morning'],
  'Seated Leg Curl':         ['Leg Curl', 'Romanian Deadlift', 'Stiff-Leg Deadlift'],
  'Hip Thrust':              ['Glute Bridge', 'Cable Pull-Through', 'Romanian Deadlift'],
  'Glute Bridge':            ['Hip Thrust', 'Cable Pull-Through', 'Romanian Deadlift'],
  'Calf Raise':              ['Seated Calf Raise', 'Single-Leg Calf Raise'],
  'Seated Calf Raise':       ['Calf Raise', 'Single-Leg Calf Raise'],
  'Tricep Pushdown':         ['Skullcrusher', 'Overhead Tricep Extension', 'Diamond Push-Up', 'Triceps Dip'],
  'Skullcrusher':            ['Overhead Tricep Extension', 'Tricep Pushdown', 'Close-Grip Bench Press'],
  'Overhead Tricep Extension':['Skullcrusher', 'Tricep Pushdown', 'Diamond Push-Up'],
  'Triceps Dip':             ['Tricep Pushdown', 'Diamond Push-Up', 'Close-Grip Bench Press'],
  'Bicep Curl':              ['Hammer Curl', 'Preacher Curl', 'Cable Curl', 'Concentration Curl'],
  'Hammer Curl':             ['Bicep Curl', 'Cable Curl', 'Zottman Curl'],
  'Preacher Curl':           ['Bicep Curl', 'Concentration Curl', 'Cable Curl'],
  'Concentration Curl':      ['Bicep Curl', 'Preacher Curl', 'Hammer Curl'],
  'Dumbbell Lateral Raise':  ['Cable Lateral Raise', 'Overhead Press', 'Face Pull'],
  'Cable Lateral Raise':     ['Dumbbell Lateral Raise', 'Overhead Press', 'Face Pull'],
  'Face Pull':               ['Reverse Fly', 'Cable Lateral Raise', 'Dumbbell Lateral Raise'],
  'Reverse Fly':             ['Face Pull', 'Cable Lateral Raise', 'Dumbbell Lateral Raise'],
  'Chest Fly':               ['Cable Fly', 'Bench Press', 'Dumbbell Bench Press'],
  'Cable Fly':               ['Chest Fly', 'Bench Press', 'Dumbbell Bench Press'],
  'Plank':                   ['Side Plank', 'Ab Wheel Rollout', 'Dead Bug'],
  'Hanging Leg Raise':       ['Hanging Knee Raise', 'Ab Wheel Rollout', 'Russian Twist'],
};

// ── State ─────────────────────────────────────────────────────────
const state = {
  allWorkouts:    [],
  currentWorkout: null,
  exerciseQueue:  [],
  currentIndex:   0,
  logged:         [],
  skipped:        new Set(),
  currentUser:    null,
};

const COACH_SESSION_KEY = 'coachActiveSession';

function persistCoachSession() {
  if (!state.currentWorkout) { clearCoachSession(); return; }
  try {
    localStorage.setItem(COACH_SESSION_KEY, JSON.stringify({
      currentWorkout: state.currentWorkout,
      exerciseQueue:  state.exerciseQueue,
      currentIndex:   state.currentIndex,
      logged:         state.logged,
      skipped:        Array.from(state.skipped),
    }));
  } catch (_) {}
}

function restoreCoachSession() {
  try {
    const raw = localStorage.getItem(COACH_SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.currentWorkout) return false;
    state.currentWorkout = s.currentWorkout;
    state.exerciseQueue  = s.exerciseQueue  || [];
    state.currentIndex   = s.currentIndex   || 0;
    state.logged         = s.logged         || [];
    state.skipped        = new Set(s.skipped || []);
    return true;
  } catch (_) { return false; }
}

function clearCoachSession() {
  localStorage.removeItem(COACH_SESSION_KEY);
}

// ── DOM helpers ───────────────────────────────────────────────────
const qs = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.coach-screen').forEach(s => s.classList.add('hidden'));
  qs(id).classList.remove('hidden');
}

// ── Data helpers ──────────────────────────────────────────────────
function getLastLog(exerciseName) {
  for (let i = state.allWorkouts.length - 1; i >= 0; i--) {
    for (const ex of (state.allWorkouts[i].exercises || [])) {
      if (ex.name === exerciseName) return ex;
    }
  }
  return null;
}

function getRepRange() {
  try {
    const profile = JSON.parse(localStorage.getItem('strengthTrackerProfile') || '{}');
    const raw = profile.preferredRepRange || profile.hypertrophy?.preferredRepRange || '';
    const m = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return { min: parseInt(m[1]), max: parseInt(m[2]) };
  } catch (_) {}
  return null;
}

function getSmartDefault(exerciseName) {
  const last  = getLastLog(exerciseName);
  if (!last) return { sets: 3, reps: 8, weight: 100 };

  const range = getRepRange();
  if (range) {
    if (last.reps >= range.max) {
      return { sets: last.sets, reps: range.min, weight: last.weight + 10 };
    }
    if (last.reps < range.min) {
      return { sets: last.sets, reps: range.min, weight: Math.max(0, last.weight - 5) };
    }
  }
  return { sets: last.sets, reps: last.reps + 1, weight: last.weight };
}

// ── Workout suggestion ────────────────────────────────────────────
function suggestWorkout() {
  const favorites = state.allWorkouts.filter(w => w.favorite);
  if (!favorites.length) return null;

  const lastDoneAt = {};
  state.allWorkouts.forEach(s => {
    if (!lastDoneAt[s.name] || s.timestamp > lastDoneAt[s.name])
      lastDoneAt[s.name] = s.timestamp;
  });

  return favorites.slice().sort(
    (a, b) => (lastDoneAt[a.name] || 0) - (lastDoneAt[b.name] || 0)
  )[0];
}

function daysSince(ts) {
  if (!ts) return 'never';
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

// ── Render home ───────────────────────────────────────────────────
function renderHome() {
  const s = suggestWorkout();

  if (!s) {
    qs('suggested-workout-name').textContent = 'No favorites yet';
    qs('suggested-workout-meta').textContent = '';
    qs('suggested-exercises-preview').textContent = '';
    qs('start-suggested-btn').style.display = 'none';
    qs('choose-different-btn').style.display = 'none';
    qs('coach-no-favorites').classList.remove('hidden');
    showScreen('screen-home');
    return;
  }

  qs('coach-no-favorites').classList.add('hidden');
  qs('start-suggested-btn').style.display = '';
  qs('choose-different-btn').style.display = '';

  const lastDoneAt = {};
  state.allWorkouts.forEach(w => {
    if (!lastDoneAt[w.name] || w.timestamp > lastDoneAt[w.name])
      lastDoneAt[w.name] = w.timestamp;
  });

  const preview = s.exercises.slice(0, 4).map(e => e.name).join(', ');
  const extra   = s.exercises.length - 4;

  qs('suggested-workout-name').textContent        = s.name;
  qs('suggested-workout-meta').textContent        = `${s.exercises.length} exercises • last done ${daysSince(lastDoneAt[s.name])}`;
  qs('suggested-exercises-preview').textContent   = preview + (extra > 0 ? ` +${extra} more` : '');
  qs('start-suggested-btn').dataset.workoutId     = s.id || '';

  showScreen('screen-home');
}

// ── Render choose screen ──────────────────────────────────────────
function renderChooseScreen() {
  const favorites = state.allWorkouts.filter(w => w.favorite);
  const container = qs('choose-workouts-list');

  if (!favorites.length) {
    container.innerHTML = '<p class="empty-state">No favorite workouts. Go to Log Workout, save a session, and star it.</p>';
  } else {
    container.innerHTML = favorites.map(w => `
      <button class="coach-choose-card" data-workout-id="${w.id}">
        <strong>${w.name}</strong>
        <span>${w.exercises.length} exercise${w.exercises.length !== 1 ? 's' : ''}</span>
      </button>
    `).join('');
  }

  showScreen('screen-choose');
}

// ── Start workout ─────────────────────────────────────────────────
function startWorkout(workoutId) {
  const workout = workoutId
    ? state.allWorkouts.find(w => w.id === workoutId)
    : suggestWorkout();
  if (!workout) return;

  showWarmup(() => {
    state.currentWorkout = workout;
    state.exerciseQueue  = workout.exercises.map(e => ({ ...e }));
    state.currentIndex   = 0;
    state.logged         = [];
    state.skipped        = new Set();
    persistCoachSession();
    startWorkoutTimer();
    showExercise(0);
  });
}

// ── Show exercise ─────────────────────────────────────────────────
function showExercise(index, prefill = null) {
  // Skip over already-logged indices if we're cycling back
  while (index < state.exerciseQueue.length && state.logged.some(l => l._queueIndex === index)) {
    index++;
  }

  if (index >= state.exerciseQueue.length) {
    // Check if anything's left that isn't logged or skipped
    const remaining = state.exerciseQueue.findIndex(
      (_, i) => !state.logged.some(l => l._queueIndex === i) && !state.skipped.has(i)
    );
    if (remaining === -1) { showComplete(); return; }
    index = remaining;
  }

  state.currentIndex = index;
  const ex    = state.exerciseQueue[index];
  const total = state.exerciseQueue.length;
  const done  = state.logged.length;
  const pct   = total > 0 ? (done / total) * 100 : 0;

  qs('active-progress-bar').style.width    = `${pct}%`;
  qs('active-progress-label').textContent  = `${done} of ${total} done`;
  qs('active-exercise-name').textContent   = ex.name;

  const def  = getSmartDefault(ex.name);
  const last = getLastLog(ex.name);

  qs('active-target').textContent    = `Target: ${def.sets} sets × ${def.reps} reps @ ${def.weight} lbs`;
  qs('active-last-time').textContent = last
    ? `Last time: ${last.sets}×${last.reps} @ ${last.weight} lbs`
    : 'First time doing this one!';

  const fillSets   = prefill?.sets   ?? def.sets;
  const fillReps   = prefill?.reps   ?? def.reps;
  const fillWeight = prefill?.weight ?? def.weight;
  qs('active-sets').value = fillSets;
  initSetRows(qs('active-sets-detail'), fillSets, fillReps, fillWeight, prefill?.setDetails ?? null);
  qs('active-notes').value = prefill?.notes ?? '';

  qs('machine-taken-panel').classList.add('hidden');
  qs('quit-panel').classList.add('hidden');
  updateUndoBtn();
  showScreen('screen-active');
}

// ── Undo last log ─────────────────────────────────────────────────
function updateUndoBtn() {
  const btn = qs('undo-last-btn');
  if (!btn) return;
  if (state.logged.length > 0) {
    const name = state.logged[state.logged.length - 1].name;
    btn.textContent = `↩ Undo: ${name}`;
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function undoLastLog() {
  if (!state.logged.length) return;
  const last = state.logged.pop();
  persistCoachSession();
  showExercise(last._queueIndex, {
    sets:       last.sets,
    reps:       last.reps,
    weight:     last.weight,
    setDetails: last.setDetails,
    notes:      last.notes,
  });
}

// ── Machine taken panel ───────────────────────────────────────────
function showMachineTaken() {
  const ex      = state.exerciseQueue[state.currentIndex];
  const panel   = qs('machine-taken-panel');
  const content = panel.querySelector('.mt-content');

  // Upcoming exercises not yet done or skipped
  const upcoming = [];
  for (let i = state.currentIndex + 1; i < state.exerciseQueue.length; i++) {
    if (!state.logged.some(l => l._queueIndex === i) && !state.skipped.has(i)) {
      upcoming.push({ index: i, name: state.exerciseQueue[i].name });
    }
    if (upcoming.length >= 3) break;
  }

  const alts = (ALTERNATIVES[ex.name] || []).slice(0, 3);

  const upcomingHtml = upcoming.length
    ? `<p class="mt-label">Jump ahead to:</p>` +
      upcoming.map(u => `<button class="coach-alt-btn jump-to-btn" data-index="${u.index}">${u.name}</button>`).join('')
    : '';

  const altsHtml = alts.length
    ? `<p class="mt-label">Or swap with:</p>` +
      alts.map(n => `<button class="coach-alt-btn substitute-btn" data-name="${n}">${n}</button>`).join('')
    : '';

  content.innerHTML = upcomingHtml + altsHtml || '<p class="coach-meta">No alternatives on file for this exercise.</p>';
  panel.classList.remove('hidden');
}

// ── Regression questionnaire ──────────────────────────────────────
function getOtherRegressionLabel() {
  switch (getMotivationStyle()) {
    case 'harsh':    return "I'm just a wimp who didn't push hard enough";
    case 'sergeant': return "Mission fell short. Not enough effort today.";
    case 'positive': return "I was listening to my body and being safe";
    default:         return "Just had a rough day";
  }
}

function showRegressionModal(onSelect) {
  const overlay = document.createElement('div');
  overlay.className = 'regression-overlay';
  overlay.innerHTML = `
    <div class="regression-modal">
      <h3>Why Did You Go Down?</h3>
      <p class="regression-sub">Your reps or weight dropped since last time.</p>
      <div class="regression-options">
        <button class="regression-btn" data-reason="range_of_motion">Better range of motion / form</button>
        <button class="regression-btn" data-reason="poor_recovery">Poor recovery from last session</button>
        <button class="regression-btn" data-reason="other">${getOtherRegressionLabel()}</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => {
    const btn = e.target.closest('.regression-btn');
    if (!btn) return;
    overlay.remove();
    onSelect(btn.dataset.reason);
  });
  document.body.appendChild(overlay);
}

function isRegression(exerciseName, loggedReps, loggedWeight) {
  const last = getLastLog(exerciseName);
  if (!last) return false;
  return loggedWeight < last.weight || loggedReps < last.reps;
}

// ── Log exercise ──────────────────────────────────────────────────
function logCurrentExercise() {
  const sets       = parseInt(qs('active-sets').value);
  const setDetails = readSetDetails(qs('active-sets-detail'));
  const notes      = qs('active-notes').value.trim();

  if (!sets || setDetails.some(d => d.reps < 1)) {
    alert('Fill in sets and reps before continuing.');
    return;
  }

  const { reps, weight } = summarizeSets(setDetails);
  const ex = state.exerciseQueue[state.currentIndex];

  const doLog = (regressionReason) => {
    state.logged.push({
      id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: ex.name,
      sets, reps, weight, setDetails, notes,
      favorite: false,
      _queueIndex: state.currentIndex,
      ...(regressionReason ? { regressionReason } : {}),
    });
    persistCoachSession();

    const next = state.exerciseQueue.findIndex(
      (_, i) => i > state.currentIndex &&
        !state.logged.some(l => l._queueIndex === i) &&
        !state.skipped.has(i)
    );
    if (next === -1) showComplete();
    else showExercise(next);
  };

  if (isRegression(ex.name, reps, weight)) {
    showRegressionModal(doLog);
  } else {
    doLog(null);
  }
}

// ── Add exercise mid-session ──────────────────────────────────────
function showCoachAddPanel() {
  qs('machine-taken-panel').classList.add('hidden');
  qs('quit-panel').classList.add('hidden');
  qs('skipped-panel').classList.add('hidden');
  qs('coach-add-name').value = '';
  qs('coach-add-sets').value = 3;
  qs('coach-add-reps').value = 8;
  qs('coach-add-weight').value = 100;
  qs('coach-add-panel').classList.remove('hidden');
  qs('coach-add-name').focus();
}

function hideCoachAddPanel() {
  qs('coach-add-panel').classList.add('hidden');
}

function addExerciseToQueue() {
  const name   = qs('coach-add-name').value.trim();
  const sets   = parseInt(qs('coach-add-sets').value)   || 3;
  const reps   = parseInt(qs('coach-add-reps').value)   || 8;
  const weight = parseFloat(qs('coach-add-weight').value) || 0;
  if (!name) { qs('coach-add-name').focus(); return; }
  state.exerciseQueue.push({ name, sets, reps, weight });
  persistCoachSession();
  hideCoachAddPanel();
  updateSkippedBtn();
}

// ── Skipped button / panel ────────────────────────────────────────
function updateSkippedBtn() {
  const btn = qs('view-skipped-btn');
  if (!btn) return;
  const count = state.skipped.size;
  if (count === 0) {
    btn.classList.add('hidden');
    qs('skipped-panel').classList.add('hidden');
  } else {
    btn.textContent = `Skipped (${count})`;
    btn.classList.remove('hidden');
    // Refresh panel list if it's open
    if (!qs('skipped-panel').classList.contains('hidden')) {
      renderSkippedPanel();
    }
  }
}

function renderSkippedPanel() {
  const list = qs('skipped-panel-list');
  list.innerHTML = Array.from(state.skipped).map(i => `
    <div class="complete-skipped-item">
      <span>${state.exerciseQueue[i].name}</span>
      <button class="secondary-button do-skipped-btn" data-index="${i}">Do it now</button>
    </div>
  `).join('');
}

function toggleSkippedPanel() {
  const panel = qs('skipped-panel');
  if (panel.classList.contains('hidden')) {
    renderSkippedPanel();
    qs('machine-taken-panel').classList.add('hidden');
    qs('quit-panel').classList.add('hidden');
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    panel.classList.add('hidden');
  }
}

// ── Skip / jump / substitute ──────────────────────────────────────
function skipExercise() {
  state.skipped.add(state.currentIndex);
  qs('machine-taken-panel').classList.add('hidden');
  updateSkippedBtn();
  persistCoachSession();

  const next = state.exerciseQueue.findIndex(
    (_, i) => i > state.currentIndex &&
      !state.logged.some(l => l._queueIndex === i) &&
      !state.skipped.has(i)
  );
  next === -1 ? showComplete() : showExercise(next);
}

function jumpToExercise(targetIndex) {
  state.skipped.add(state.currentIndex);
  qs('machine-taken-panel').classList.add('hidden');
  updateSkippedBtn();
  persistCoachSession();
  showExercise(targetIndex);
}

function substituteExercise(name) {
  state.exerciseQueue[state.currentIndex] = {
    ...state.exerciseQueue[state.currentIndex],
    name,
  };
  qs('machine-taken-panel').classList.add('hidden');
  persistCoachSession();
  showExercise(state.currentIndex);
}

// ── End early ─────────────────────────────────────────────────────
function showQuitPanel() {
  qs('machine-taken-panel').classList.add('hidden');
  const tease = getMotivationalMessage('quit');
  const teaseEl = qs('quit-tease');
  teaseEl.textContent = tease || '';
  teaseEl.style.display = tease ? '' : 'none';
  qs('quit-panel').classList.remove('hidden');
  qs('quit-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideQuitPanel() {
  qs('quit-panel').classList.add('hidden');
}

async function endEarly() {
  hideQuitPanel();
  if (state.logged.length === 0) {
    clearCoachSession();
    stopWorkoutTimer();
    state.currentWorkout = null;
    state.exerciseQueue  = [];
    state.logged         = [];
    state.skipped        = new Set();
    await loadAllWorkouts();
    renderHome();
    return;
  }
  await saveAndEnd();
  location.reload();
}

// ── Complete screen ───────────────────────────────────────────────
function showComplete() {
  qs('complete-stat-done').textContent  = state.logged.length;
  qs('complete-stat-total').textContent = state.exerciseQueue.length;

  const skippedSection = qs('complete-skipped-section');
  const skippedList    = qs('complete-skipped-list');

  const skippedItems = Array.from(state.skipped).map(i => ({
    index: i,
    name:  state.exerciseQueue[i].name,
  }));

  if (skippedItems.length) {
    skippedList.innerHTML = skippedItems.map(s => `
      <div class="complete-skipped-item">
        <span>${s.name}</span>
        <button class="secondary-button do-skipped-btn" data-index="${s.index}">Do it now</button>
      </div>
    `).join('');
    skippedSection.style.display = '';
  } else {
    skippedSection.style.display = 'none';
  }

  const completeMsg = getMotivationalMessage('complete');
  const completeMsgEl = qs('complete-message');
  if (completeMsgEl) {
    completeMsgEl.textContent = completeMsg || '';
    completeMsgEl.style.display = completeMsg ? '' : 'none';
  }

  saveAndEnd(); // auto-save on complete
  showScreen('screen-complete');
}

// ── Save workout ──────────────────────────────────────────────────
async function saveAndEnd() {
  if (!state.logged.length) return;
  clearCoachSession();
  stopWorkoutTimer();

  const sessionId = state.currentWorkout.id || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Preserve original exercise order; update reps/weight for logged ones;
  // keep skipped exercises so they aren't removed from the template.
  const originalLength = state.currentWorkout.exercises.length;
  const exercises = state.currentWorkout.exercises.map((orig, i) => {
    const logged = state.logged.find(l => l._queueIndex === i);
    if (logged) {
      const { _queueIndex, ...data } = logged;
      return data;
    }
    return { ...orig, id: orig.id || `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  });
  // Append any mid-session added exercises that were actually logged
  state.logged
    .filter(l => l._queueIndex >= originalLength)
    .forEach(l => { const { _queueIndex, ...data } = l; exercises.push(data); });

  const session = {
    id: sessionId,
    name: state.currentWorkout.name,
    favorite: state.currentWorkout.favorite || false,
    timestamp: Date.now(),
    exercises,
  };

  try {
    const stored = JSON.parse(localStorage.getItem('strengthTrackerExercises') || '[]');
    const idx = stored.findIndex(s => s.id === sessionId);
    if (idx !== -1) stored.splice(idx, 1, session);
    else stored.push(session);
    localStorage.setItem('strengthTrackerExercises', JSON.stringify(stored));
  } catch (_) {}

  if (state.currentUser) {
    try {
      await setDoc(doc(db, 'users', state.currentUser.uid, 'workouts', sessionId), session);
    } catch (e) {
      console.error('Firestore save failed:', e);
    }
  }
}

// ── Load data ─────────────────────────────────────────────────────
async function loadAllWorkouts() {
  if (!state.currentUser) return;
  try {
    const snap = await getDocs(collection(db, 'users', state.currentUser.uid, 'workouts'));
    state.allWorkouts = snap.docs.map(d => d.data());
  } catch (_) {
    try {
      state.allWorkouts = JSON.parse(localStorage.getItem('strengthTrackerExercises') || '[]');
    } catch (__) {
      state.allWorkouts = [];
    }
  }
}

// ── Events ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Home
  qs('start-suggested-btn').addEventListener('click', () => {
    startWorkout(qs('start-suggested-btn').dataset.workoutId || null);
  });
  qs('choose-different-btn').addEventListener('click', renderChooseScreen);

  // Choose
  qs('back-to-home-btn').addEventListener('click', renderHome);
  qs('choose-workouts-list').addEventListener('click', e => {
    const card = e.target.closest('.coach-choose-card');
    if (card) startWorkout(card.dataset.workoutId);
  });

  // Re-render set rows when sets count changes
  qs('active-sets').addEventListener('input', () => {
    const sets = Math.max(1, parseInt(qs('active-sets').value) || 1);
    const existing = readSetDetails(qs('active-sets-detail'));
    const last = existing[existing.length - 1];
    renderSetRows(qs('active-sets-detail'), sets, last?.reps ?? 8, last?.weight ?? 100, existing);
  });

  // Active
  qs('active-done-btn').addEventListener('click', logCurrentExercise);
  qs('active-machine-taken-btn').addEventListener('click', showMachineTaken);
  qs('undo-last-btn').addEventListener('click', undoLastLog);
  qs('end-early-btn').addEventListener('click', showQuitPanel);
  qs('quit-cancel-btn').addEventListener('click', hideQuitPanel);
  qs('quit-confirm-btn').addEventListener('click', endEarly);

  // Machine taken panel
  qs('machine-taken-panel').addEventListener('click', e => {
    if (e.target.matches('.jump-to-btn'))        jumpToExercise(parseInt(e.target.dataset.index));
    if (e.target.matches('.substitute-btn'))     substituteExercise(e.target.dataset.name);
    if (e.target.id === 'skip-exercise-btn')     skipExercise();
    if (e.target.id === 'cancel-machine-taken-btn') qs('machine-taken-panel').classList.add('hidden');
  });

  // Add exercise
  qs('coach-add-exercise-btn').addEventListener('click', showCoachAddPanel);
  qs('coach-add-cancel-btn').addEventListener('click', hideCoachAddPanel);
  qs('coach-add-confirm-btn').addEventListener('click', addExerciseToQueue);
  qs('coach-add-name').addEventListener('keydown', e => { if (e.key === 'Enter') addExerciseToQueue(); });
  attachAutocomplete(qs('coach-add-name'), name => {
    const def = getSmartDefault(name);
    qs('coach-add-sets').value   = def.sets;
    qs('coach-add-reps').value   = def.reps;
    qs('coach-add-weight').value = def.weight;
  });

  // Skipped panel
  qs('view-skipped-btn').addEventListener('click', toggleSkippedPanel);
  qs('close-skipped-panel-btn').addEventListener('click', () => qs('skipped-panel').classList.add('hidden'));
  qs('skipped-panel-list').addEventListener('click', e => {
    if (e.target.matches('.do-skipped-btn')) {
      const idx = parseInt(e.target.dataset.index);
      state.skipped.delete(idx);
      qs('skipped-panel').classList.add('hidden');
      updateSkippedBtn();
      showExercise(idx);
    }
  });

  // Complete
  qs('save-workout-btn').addEventListener('click', () => location.reload());
  qs('complete-skipped-list').addEventListener('click', e => {
    if (e.target.matches('.do-skipped-btn')) {
      const idx = parseInt(e.target.dataset.index);
      state.skipped.delete(idx);
      showExercise(idx);
    }
  });
});

// ── Guard browser navigation during active workout ────────────────
window.addEventListener('beforeunload', e => {
  if (state.currentWorkout && state.logged.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Auth ──────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  state.currentUser = user;
  if (user) {
    await loadAllWorkouts();
    if (restoreCoachSession()) {
      restoreWorkoutTimer();
      showExercise(state.currentIndex);
    } else {
      renderHome();
    }
  }
});
