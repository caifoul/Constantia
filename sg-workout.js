import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, setDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMotivationalMessage, getMotivationStyle } from './motivation.js';
import { showWarmup } from './warmup.js';
import { initSetRows, renderSetRows, readSetDetails, summarizeSets } from './set-rows.js';
import { startWorkoutTimer, stopWorkoutTimer, restoreWorkoutTimer } from './workout-timer.js';
import { attachAutocomplete } from './exercise-autocomplete.js';

const storageKey = 'strengthTrackerExercises';
let workouts = [];
let currentUser = null;

// ── Local data helpers ────────────────────────────────────────────
function loadWorkouts() {
  try {
    workouts = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(workouts)) workouts = [];
  } catch (_) { workouts = []; }
}

function saveWorkouts() {
  try { localStorage.setItem(storageKey, JSON.stringify(workouts)); } catch (_) {}
}

async function saveWorkoutToFirestore(session) {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, 'users', currentUser.uid, 'workouts', session.id), session);
  } catch (e) { console.error('Firestore save failed:', e); }
}

async function loadWorkoutsFromFirestore(uid) {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'workouts'));
    const data = snap.docs.map(d => d.data());
    if (data.length) {
      workouts = data;
      saveWorkouts();
    } else {
      loadWorkouts();
    }
  } catch (_) { loadWorkouts(); }
}

// ── Coach state ───────────────────────────────────────────────────
let coachState = {
  currentWorkout: null,
  currentSession: null,
  currentExerciseIndex: 0,
  loggedExercises: new Set(),
  missedExercises: new Set(),
};

const NOTEBOOK_SESSION_KEY = 'notebookActiveSession';

function persistNotebookSession() {
  if (!coachState.currentWorkout) { clearNotebookSession(); return; }
  try {
    localStorage.setItem(NOTEBOOK_SESSION_KEY, JSON.stringify({
      currentWorkout:       coachState.currentWorkout,
      currentSession:       coachState.currentSession,
      currentExerciseIndex: coachState.currentExerciseIndex,
      loggedExercises:      Array.from(coachState.loggedExercises),
      missedExercises:      Array.from(coachState.missedExercises),
    }));
  } catch (_) {}
}

function restoreNotebookSession() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s?.currentWorkout) return false;
    coachState.currentWorkout       = s.currentWorkout;
    coachState.currentSession       = s.currentSession;
    coachState.currentExerciseIndex = s.currentExerciseIndex || 0;
    coachState.loggedExercises      = new Set(s.loggedExercises || []);
    coachState.missedExercises      = new Set(s.missedExercises || []);
    return true;
  } catch (_) { return false; }
}

function clearNotebookSession() {
  localStorage.removeItem(NOTEBOOK_SESSION_KEY);
}

function showScreen(screenId) {
  document.querySelectorAll('.coach-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

function getFavoriteWorkouts() {
  return workouts.filter(s => s.favorite);
}

function getLastExerciseLogForName(name) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    for (const ex of (workouts[i].exercises || [])) {
      if (ex.name === name) return ex;
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

function getSmartDefaults(exerciseName) {
  const last  = getLastExerciseLogForName(exerciseName);
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

function renderFavoriteWorkouts() {
  const container = document.getElementById('favorite-workouts');
  const favorites = getFavoriteWorkouts();

  if (!favorites.length) {
    container.innerHTML = '<p class="empty-state">No favorite workouts yet. Create one in Log Workout first!</p>';
    return;
  }

  container.innerHTML = favorites.map(workout => `
    <div class="workout-card coach-workout-card">
      <h3>${workout.name}</h3>
      <p>${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}</p>
      <button type="button" class="btn-primary start-favorite-workout" data-session-id="${workout.id}">Start</button>
    </div>
  `).join('');
}

function startFavoriteWorkout(sessionId) {
  const template = workouts.find(w => w.id === sessionId);
  if (!template) return;

  showWarmup(() => {
    coachState = {
      currentWorkout: template,
      currentSession: { workoutName: template.name, startTime: Date.now(), exercises: [] },
      currentExerciseIndex: 0,
      loggedExercises: new Set(),
      missedExercises: new Set(),
    };
    persistNotebookSession();
    startWorkoutTimer();
    showExerciseSelection();
  });
}

function createNewWorkout(workoutName) {
  showWarmup(() => {
    coachState = {
      currentWorkout: { name: workoutName, exercises: [] },
      currentSession: { workoutName, startTime: Date.now(), exercises: [] },
      currentExerciseIndex: 0,
      loggedExercises: new Set(),
      missedExercises: new Set(),
    };
    persistNotebookSession();
    startWorkoutTimer();
    showScreen('start-workout-screen');
    document.getElementById('workout-title').textContent = workoutName;
    document.getElementById('exercises-list').innerHTML =
      '<p class="empty-state">New workout created! Add exercises first in the Log Workout section.</p>';
  });
}

function showExerciseSelection() {
  showScreen('start-workout-screen');
  document.getElementById('workout-title').textContent = coachState.currentWorkout.name;
  renderExercisesSelection();
}

function renderExercisesSelection() {
  const container = document.getElementById('exercises-list');
  const exercises = coachState.currentWorkout.exercises;

  if (!exercises.length) {
    container.innerHTML = '<p class="empty-state">No exercises in this workout.</p>';
    return;
  }

  container.innerHTML = exercises.map((exercise, index) => {
    const isLogged = coachState.loggedExercises.has(index);
    const isMissed = coachState.missedExercises.has(index);
    const status = isLogged ? '✓ Logged' : isMissed ? '◌ Skipped' : '';
    const cls    = isLogged ? 'logged' : isMissed ? 'missed' : '';

    return `
      <div class="exercise-selection-item ${cls}" data-ex-index="${index}">
        <div class="exercise-selection-info">
          <strong>${exercise.name}</strong>
          <span>${exercise.sets}×${exercise.reps} @ ${exercise.weight} lbs</span>
          ${status ? `<span class="status">${status}</span>` : ''}
        </div>
        <div class="ex-select-actions">
          ${!isLogged ? `<button type="button" class="secondary-button edit-exercise-target" data-index="${index}" title="Edit targets">Edit</button>` : ''}
          <button type="button" class="btn-primary select-exercise" data-index="${index}">
            ${isLogged ? 'Re-log' : 'Log'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateProgress();
}

function toggleExerciseEditRow(index) {
  const item = document.querySelector(`.exercise-selection-item[data-ex-index="${index}"]`);
  if (!item) return;

  const existing = item.querySelector('.ex-inline-edit');
  if (existing) { existing.remove(); return; }

  // Close any other open inline edits
  document.querySelectorAll('.ex-inline-edit').forEach(el => el.remove());

  const ex = coachState.currentWorkout.exercises[index];
  const row = document.createElement('div');
  row.className = 'ex-inline-edit';
  row.innerHTML = `
    <div class="ex-edit-name-wrap"><input class="ex-edit-name" type="text" value="${ex.name}" placeholder="Exercise name" autocomplete="off" /></div>
    <label>Sets<input class="ex-edit-sets" type="number" min="1" value="${ex.sets}" /></label>
    <label>Reps<input class="ex-edit-reps" type="number" min="1" value="${ex.reps}" /></label>
    <label>Weight<input class="ex-edit-weight" type="number" min="0" value="${ex.weight}" /></label>
    <div class="ex-inline-edit-actions">
      <button type="button" class="btn-primary ex-edit-save" data-index="${index}">Save</button>
      <button type="button" class="secondary-button ex-edit-cancel">Cancel</button>
    </div>
  `;
  item.appendChild(row);
  const nameInput = row.querySelector('.ex-edit-name');
  attachAutocomplete(nameInput, () => {});
  nameInput.focus();
}

function saveExerciseTargetEdit(index) {
  const item = document.querySelector(`.exercise-selection-item[data-ex-index="${index}"]`);
  const row  = item?.querySelector('.ex-inline-edit');
  if (!row) return;

  const name   = row.querySelector('.ex-edit-name').value.trim();
  const sets   = parseInt(row.querySelector('.ex-edit-sets').value)   || 1;
  const reps   = parseInt(row.querySelector('.ex-edit-reps').value)   || 1;
  const weight = parseFloat(row.querySelector('.ex-edit-weight').value) || 0;
  if (!name) { row.querySelector('.ex-edit-name').focus(); return; }

  coachState.currentWorkout.exercises[index] = {
    ...coachState.currentWorkout.exercises[index],
    name, sets, reps, weight,
  };
  renderExercisesSelection();
}

function updateProgress() {
  const total   = coachState.currentWorkout.exercises.length;
  const logged  = coachState.loggedExercises.size;
  const percent = total > 0 ? (logged / total) * 100 : 0;
  document.getElementById('progress-text').textContent = `${logged} of ${total} exercises logged`;
  document.getElementById('progress-fill').style.width = `${percent}%`;
}

function logExerciseForIndex(index) {
  const exercise = coachState.currentWorkout.exercises[index];
  if (!exercise) return;

  const isEditing = coachState.loggedExercises.has(index);
  const prev = isEditing
    ? coachState.currentSession.exercises.find(ex => ex.exerciseIndex === index)
    : null;

  const vals = prev
    ? { sets: prev.sets, reps: prev.reps, weight: prev.weight }
    : getSmartDefaults(exercise.name);

  document.getElementById('exercise-name-display').textContent = exercise.name;
  document.getElementById('log-sets').value = vals.sets;
  initSetRows(document.getElementById('log-sets-detail'), vals.sets, vals.reps, vals.weight);
  document.getElementById('log-notes').value = prev ? (prev.notes || '') : '';
  document.getElementById('exercise-log-form').dataset.exerciseIndex = index;

  showScreen('log-exercise-screen');
}

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

function submitExerciseLog() {
  const form       = document.getElementById('exercise-log-form');
  const index      = parseInt(form.dataset.exerciseIndex);
  const sets       = parseInt(document.getElementById('log-sets').value);
  const setDetails = readSetDetails(document.getElementById('log-sets-detail'));

  if (!sets || setDetails.some(d => d.reps < 1)) {
    alert('Please fill in all fields correctly.');
    return;
  }

  const { reps, weight } = summarizeSets(setDetails);
  const exercise = coachState.currentWorkout.exercises[index];
  const notes    = document.getElementById('log-notes').value.trim();

  const doLog = (regressionReason) => {
    const entry = {
      exerciseIndex: index, name: exercise.name, sets, reps, weight, setDetails, notes, timestamp: Date.now(),
      ...(regressionReason ? { regressionReason } : {}),
    };
    const existingIdx = coachState.currentSession.exercises.findIndex(ex => ex.exerciseIndex === index);
    if (existingIdx !== -1) coachState.currentSession.exercises[existingIdx] = entry;
    else coachState.currentSession.exercises.push(entry);

    coachState.loggedExercises.add(index);
    coachState.missedExercises.delete(index);
    persistNotebookSession();

    const total = coachState.currentWorkout.exercises.length;
    if (coachState.loggedExercises.size === total) showWorkoutComplete();
    else showExerciseSelection();
  };

  const last = getLastExerciseLogForName(exercise.name);
  if (last && (weight < last.weight || reps < last.reps)) {
    showRegressionModal(doLog);
  } else {
    doLog(null);
  }
}

function skipExercise() {
  const index = parseInt(document.getElementById('exercise-log-form').dataset.exerciseIndex);
  coachState.missedExercises.add(index);
  persistNotebookSession();
  const total = coachState.currentWorkout.exercises.length;
  if (coachState.loggedExercises.size === total) showWorkoutComplete();
  else showExerciseSelection();
}

function showWorkoutComplete() {
  showScreen('workout-complete-screen');
  const logged = coachState.loggedExercises.size;
  const total  = coachState.currentWorkout.exercises.length;
  const missed = coachState.missedExercises.size;

  let html = `<div class="summary-stats"><p><strong>${logged} of ${total}</strong> exercises completed</p>`;
  if (missed > 0) html += `<p><strong>${missed}</strong> exercises skipped</p>`;
  html += '</div>';
  document.getElementById('workout-summary').innerHTML = html;

  const missedSection = document.getElementById('missed-exercises');
  if (missed > 0) {
    missedSection.classList.remove('hidden');
    const exercises = coachState.currentWorkout.exercises;
    document.getElementById('missed-list').innerHTML = Array.from(coachState.missedExercises).map(i => `
      <div class="exercise-selection-item">
        <div class="exercise-selection-info">
          <strong>${exercises[i].name}</strong>
          <span>${exercises[i].sets}x${exercises[i].reps} @ ${exercises[i].weight} lbs</span>
        </div>
        <button type="button" class="secondary-button select-missed-exercise" data-index="${i}">Log</button>
      </div>
    `).join('');
  } else {
    missedSection.classList.add('hidden');
  }

  saveSession(); // auto-save on complete
}

function showAddExercisePanel() {
  const saveBtn = document.getElementById('add-and-save-btn');
  saveBtn.style.display = coachState.currentWorkout?.id ? '' : 'none';
  ['add-ex-name', 'add-ex-sets', 'add-ex-reps', 'add-ex-weight'].forEach(id => {
    const el = document.getElementById(id);
    el.value = id === 'add-ex-name' ? '' : id === 'add-ex-sets' ? '3' : id === 'add-ex-reps' ? '8' : '100';
  });
  document.getElementById('add-exercise-panel').classList.remove('hidden');
  document.getElementById('add-exercise-btn').classList.add('hidden');
  document.getElementById('add-ex-name').focus();
}

function hideAddExercisePanel() {
  document.getElementById('add-exercise-panel').classList.add('hidden');
  document.getElementById('add-exercise-btn').classList.remove('hidden');
}

function addMidSessionExercise(saveToWorkout) {
  const name   = document.getElementById('add-ex-name').value.trim();
  const sets   = parseInt(document.getElementById('add-ex-sets').value);
  const reps   = parseInt(document.getElementById('add-ex-reps').value);
  const weight = parseInt(document.getElementById('add-ex-weight').value);

  if (!name || !sets || !reps || weight < 0) {
    alert('Please fill in all fields correctly.');
    return;
  }

  const newEx = { name, sets, reps, weight };
  coachState.currentWorkout.exercises.push(newEx);
  persistNotebookSession();

  if (saveToWorkout && coachState.currentWorkout.id) {
    const idx = workouts.findIndex(w => w.id === coachState.currentWorkout.id);
    if (idx !== -1) {
      workouts[idx].exercises.push({ ...newEx });
      saveWorkouts();
      saveWorkoutToFirestore(workouts[idx]);
    }
  }

  hideAddExercisePanel();
  renderExercisesSelection();
}

async function saveSession() {
  if (coachState.loggedExercises.size === 0) return;
  clearNotebookSession();
  stopWorkoutTimer();

  const sessionId = coachState.currentWorkout?.id || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Preserve original exercise order; update reps/weight for logged ones;
  // keep skipped exercises so they aren't removed from the template.
  const originalExs = coachState.currentWorkout.exercises || [];
  const originalLength = originalExs.length;
  const exercises = originalExs.map((orig, i) => {
    const logged = coachState.currentSession.exercises.find(ex => ex.exerciseIndex === i);
    if (logged) {
      return {
        id: `exercise-${logged.timestamp}-${Math.random().toString(36).slice(2)}`,
        name: logged.name, sets: logged.sets, reps: logged.reps, weight: logged.weight,
        setDetails: logged.setDetails, notes: logged.notes || '', favorite: false,
      };
    }
    return { ...orig, id: orig.id || `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  });
  // Append any mid-session added exercises that were actually logged
  coachState.currentSession.exercises
    .filter(ex => ex.exerciseIndex >= originalLength)
    .forEach(ex => exercises.push({
      id: `exercise-${ex.timestamp}-${Math.random().toString(36).slice(2)}`,
      name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight,
      setDetails: ex.setDetails, notes: ex.notes || '', favorite: false,
    }));

  const session = {
    id: sessionId,
    name: coachState.currentSession.workoutName,
    favorite: coachState.currentWorkout?.favorite || false,
    timestamp: Date.now(),
    exercises,
  };

  loadWorkouts();
  const idx = workouts.findIndex(s => s.id === sessionId);
  if (idx !== -1) workouts.splice(idx, 1, session);
  else workouts.push(session);
  saveWorkouts();
  await saveWorkoutToFirestore(session);
}

async function endWorkout() {
  await saveSession();
  location.reload();
}

// ── End early ─────────────────────────────────────────────────────
function showSgQuitPanel() {
  const tease = getMotivationalMessage('quit');
  const teaseEl = document.getElementById('sg-quit-tease');
  teaseEl.textContent = tease || '';
  teaseEl.style.display = tease ? '' : 'none';
  document.getElementById('sg-quit-panel').classList.remove('hidden');
}

function hideSgQuitPanel() {
  document.getElementById('sg-quit-panel').classList.add('hidden');
}

async function endEarly() {
  hideSgQuitPanel();
  if (coachState.loggedExercises.size === 0) {
    clearNotebookSession();
    stopWorkoutTimer();
    coachState = { currentWorkout: null, currentSession: null, currentExerciseIndex: 0, loggedExercises: new Set(), missedExercises: new Set() };
    showScreen('select-workout-screen');
    return;
  }
  await saveSession();
  location.reload();
}

// ── Events ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const repHint = document.querySelector('.rep-hint');
  if (repHint) {
    try {
      const profile = JSON.parse(localStorage.getItem('strengthTrackerProfile') || '{}');
      const range   = profile.preferredRepRange || profile.hypertrophy?.preferredRepRange;
      if (range) repHint.textContent = `Only log reps in your desired range of motion (target: ${range}).`;
    } catch (_) {}
  }

  document.getElementById('favorite-workouts').addEventListener('click', e => {
    if (e.target.matches('.start-favorite-workout'))
      startFavoriteWorkout(e.target.dataset.sessionId);
  });

  document.getElementById('new-workout-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('new-workout-name').value.trim();
    if (name) { createNewWorkout(name); document.getElementById('new-workout-name').value = ''; }
  });

  document.getElementById('back-to-select').addEventListener('click', () => {
    if (coachState.currentWorkout && (coachState.loggedExercises.size > 0 || coachState.currentSession?.exercises?.length > 0)) {
      if (!confirm('Leave this workout? Any unsaved progress will be lost.')) return;
    }
    coachState = { currentWorkout: null, currentSession: null, currentExerciseIndex: 0, loggedExercises: new Set(), missedExercises: new Set() };
    clearNotebookSession();
    stopWorkoutTimer();
    showScreen('select-workout-screen');
  });

  document.getElementById('exercises-list').addEventListener('click', e => {
    if (e.target.matches('.select-exercise'))
      logExerciseForIndex(parseInt(e.target.dataset.index));
    if (e.target.matches('.edit-exercise-target'))
      toggleExerciseEditRow(parseInt(e.target.dataset.index));
    if (e.target.matches('.ex-edit-save'))
      saveExerciseTargetEdit(parseInt(e.target.dataset.index));
    if (e.target.matches('.ex-edit-cancel'))
      e.target.closest('.ex-inline-edit').remove();
  });

  document.getElementById('add-exercise-btn').addEventListener('click', showAddExercisePanel);
  document.getElementById('cancel-add-exercise-btn').addEventListener('click', hideAddExercisePanel);
  document.getElementById('add-session-only-btn').addEventListener('click', () => addMidSessionExercise(false));
  document.getElementById('add-and-save-btn').addEventListener('click', () => addMidSessionExercise(true));
  attachAutocomplete(document.getElementById('add-ex-name'), name => {
    const def = getSmartDefaults(name);
    document.getElementById('add-ex-sets').value   = def.sets;
    document.getElementById('add-ex-reps').value   = def.reps;
    document.getElementById('add-ex-weight').value = def.weight;
  });

  document.getElementById('log-sets').addEventListener('input', () => {
    const sets = Math.max(1, parseInt(document.getElementById('log-sets').value) || 1);
    const existing = readSetDetails(document.getElementById('log-sets-detail'));
    const last = existing[existing.length - 1];
    renderSetRows(document.getElementById('log-sets-detail'), sets, last?.reps ?? 8, last?.weight ?? 100, existing);
  });

  document.getElementById('exercise-log-form').addEventListener('submit', e => { e.preventDefault(); submitExerciseLog(); });
  document.getElementById('skip-exercise').addEventListener('click', skipExercise);
  document.getElementById('close-log').addEventListener('click', showExerciseSelection);

  document.getElementById('missed-list').addEventListener('click', e => {
    if (e.target.matches('.select-missed-exercise'))
      logExerciseForIndex(parseInt(e.target.dataset.index));
  });

  document.getElementById('go-back-button').addEventListener('click', showExerciseSelection);
  document.getElementById('end-workout-button').addEventListener('click', endWorkout);

  document.getElementById('sg-end-early-btn').addEventListener('click', showSgQuitPanel);
  document.getElementById('sg-quit-cancel-btn').addEventListener('click', hideSgQuitPanel);
  document.getElementById('sg-quit-confirm-btn').addEventListener('click', endEarly);
});

// ── Guard browser navigation during active workout ────────────────
window.addEventListener('beforeunload', e => {
  if (coachState.currentWorkout && coachState.loggedExercises.size > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Auth ──────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    await loadWorkoutsFromFirestore(user.uid);
    if (restoreNotebookSession()) {
      restoreWorkoutTimer();
      showExerciseSelection();
    } else {
      renderFavoriteWorkouts();
      showScreen('select-workout-screen');
    }
  }
});
