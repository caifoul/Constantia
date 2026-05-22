import { auth, db } from './firebase-config.js';
import { initSetRows, renderSetRows, readSetDetails, summarizeSets, formatExerciseStats } from './set-rows.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const exerciseForm = document.getElementById('exercise-form');
const workoutNameInput = document.getElementById('workout-name');
const workoutList = document.getElementById('workout-list');
const currentWorkoutList = document.getElementById('current-workout-list');
const clearLogButton = document.getElementById('clear-log');
const saveWorkoutButton = document.getElementById('save-workout-session');
const clearCurrentWorkoutButton = document.getElementById('clear-current-workout');
const exerciseNameInput = document.getElementById('exercise-name');
const suggestionsList = document.getElementById('exercise-suggestions');
const sessionFavoriteCheckbox = document.getElementById('workout-favorite');
const setsDetailEl = document.getElementById('sets-detail-list');

const storageKey = 'constantiaExercises';
const popularExercises = [
  'Bench Press',
  'Incline Bench Press',
  'Decline Bench Press',
  'Dumbbell Bench Press',
  'Close-Grip Bench Press',
  'Paused Bench Press',
  'Floor Press',
  'Back Squat',
  'Front Squat',
  'Box Squat',
  'Pause Squat',
  'Goblet Squat',
  'Zercher Squat',
  'Overhead Squat',
  'Deadlift',
  'Romanian Deadlift',
  'Sumo Deadlift',
  'Deficit Deadlift',
  'Trap Bar Deadlift',
  'Stiff-Leg Deadlift',
  'Single-Leg Deadlift',
  'Hip Thrust',
  'Glute Bridge',
  'Cable Pull-Through',
  'Good Morning',
  'Glute-Ham Raise',
  'Overhead Press',
  'Seated Dumbbell Press',
  'Push Press',
  'Arnold Press',
  'Military Press',
  'Push-Up',
  'Bench Dip',
  'Incline Push-Up',
  'Decline Push-Up',
  'Pull-Up',
  'Chin-Up',
  'Neutral-Grip Pull-Up',
  'Lat Pulldown',
  'Cable Row',
  'Barbell Row',
  'Pendlay Row',
  'T-Bar Row',
  'Single-Arm Dumbbell Row',
  'Chest Fly',
  'Cable Fly',
  'Pec Deck Fly',
  'Face Pull',
  'Cable Lateral Raise',
  'Dumbbell Lateral Raise',
  'Front Raise',
  'Reverse Fly',
  'Triceps Dip',
  'Tricep Pushdown',
  'Overhead Tricep Extension',
  'Skullcrusher',
  'Diamond Push-Up',
  'Hammer Curl',
  'Bicep Curl',
  'Preacher Curl',
  'Concentration Curl',
  'Cable Curl',
  'Zottman Curl',
  'Leg Press',
  'Leg Extension',
  'Leg Curl',
  'Seated Leg Curl',
  'Standing Leg Curl',
  'Hip Abduction',
  'Hip Adduction',
  'Calf Raise',
  'Seated Calf Raise',
  'Single-Leg Calf Raise',
  'Bulgarian Split Squat',
  'Reverse Lunge',
  'Walking Lunge',
  'Static Lunge',
  'Step-Up',
  'Curtsy Lunge',
  'Sled Push',
  'Farmer Carry',
  'Farmer Walk',
  'Shrug',
  'Dumbbell Shrug',
  'Kettlebell Swing',
  'Turkish Get-Up',
  'Plank',
  'Side Plank',
  'Hanging Knee Raise',
  'Hanging Leg Raise',
  'Russian Twist',
  'Cable Woodchop',
  'Ab Wheel Rollout',
  'Mountain Climber',
  'Single-Leg SLDL',
  'Nordic Hamstring Curl',
  'Cable Pull-Through'
];

const WARMUP_PRESETS = [
  {
    id: 'general',
    name: 'General Athletic',
    duration: '5 min',
    steps: ['Jumping jacks × 30', 'Arm circles × 15 each', 'Leg swings × 10 each', 'Hip circles × 10 each', 'High knees × 20']
  },
  {
    id: 'upper',
    name: 'Upper Body',
    duration: '4 min',
    steps: ['Band pull-aparts × 15', 'Shoulder circles × 10 each', 'Chest stretch 30s each', 'Tricep stretch 20s each', 'Wrist circles × 10']
  },
  {
    id: 'lower',
    name: 'Lower Body',
    duration: '5 min',
    steps: ['Hip flexor stretch 30s each', 'Quad stretch 30s each', 'Hamstring stretch 30s', 'Glute bridge × 15', 'Calf raises × 20']
  },
  {
    id: 'core',
    name: 'Core Activation',
    duration: '4 min',
    steps: ['Cat-cow × 10', 'Dead bugs × 8 each', 'Bird dogs × 8 each', 'Plank 30s', 'Side plank 20s each']
  },
  {
    id: 'dynamic',
    name: 'Full Body Dynamic',
    duration: '6 min',
    steps: ["World's greatest stretch × 5 each", 'Inchworms × 8', 'Spiderman lunges × 6 each', 'T-spine rotations × 10', 'Jump squats × 10']
  }
];

let workouts = [];
let currentWorkoutExercises = [];
let currentUser = null;
let warmupShownThisSession = false;
let pendingExerciseData = null;

// --- Warmup modal ---

function getPreferredWarmup() {
  try {
    const profile = JSON.parse(localStorage.getItem('constantiaProfile') || '{}');
    return profile.preferredWarmup || null;
  } catch { return null; }
}

function showWarmupModal(exerciseData) {
  pendingExerciseData = exerciseData;
  warmupShownThisSession = true;

  const modal = document.getElementById('warmup-modal');
  const selectView = document.getElementById('warmup-select-view');
  const activeView = document.getElementById('warmup-active-view');
  selectView.classList.remove('hidden');
  activeView.classList.add('hidden');

  const preferred = getPreferredWarmup();
  const preferredSection = document.getElementById('warmup-preferred-section');
  if (preferred && preferred.name) {
    preferredSection.classList.remove('hidden');
    const steps = Array.isArray(preferred.steps) ? preferred.steps : [];
    document.getElementById('warmup-preferred-card').innerHTML = `
      <div class="warmup-card-header">
        <strong>${preferred.name}</strong>
        <span class="warmup-duration">${steps.length} steps</span>
      </div>
      <ol class="warmup-steps-preview">${steps.slice(0, 3).map(s => `<li>${s}</li>`).join('')}${steps.length > 3 ? `<li class="warmup-more">+${steps.length - 3} more…</li>` : ''}</ol>
    `;
    document.getElementById('warmup-preferred-card').dataset.warmupId = 'preferred';
  } else {
    preferredSection.classList.add('hidden');
  }

  document.getElementById('warmup-presets-grid').innerHTML = WARMUP_PRESETS.map(p => `
    <div class="warmup-card" data-warmup-id="${p.id}">
      <div class="warmup-card-header">
        <strong>${p.name}</strong>
        <span class="warmup-duration">${p.duration}</span>
      </div>
      <ol class="warmup-steps-preview">${p.steps.slice(0, 3).map(s => `<li>${s}</li>`).join('')}${p.steps.length > 3 ? `<li class="warmup-more">+${p.steps.length - 3} more…</li>` : ''}</ol>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function showActiveWarmup(id) {
  let warmup;
  if (id === 'preferred') {
    const pw = getPreferredWarmup();
    warmup = pw ? { name: pw.name, steps: pw.steps || [] } : null;
  } else {
    warmup = WARMUP_PRESETS.find(p => p.id === id);
  }
  if (!warmup) return;

  document.getElementById('warmup-select-view').classList.add('hidden');
  document.getElementById('warmup-active-view').classList.remove('hidden');
  document.getElementById('warmup-active-name').textContent = warmup.name;
  document.getElementById('warmup-steps-list').innerHTML = warmup.steps.map(s => `<li>${s}</li>`).join('');
}

function closeWarmupAndAdd() {
  document.getElementById('warmup-modal').classList.add('hidden');
  if (pendingExerciseData) {
    commitExercise(pendingExerciseData);
    pendingExerciseData = null;
  }
}

// --- Firestore helpers ---

async function loadWorkoutsFromFirestore(uid) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'workouts'));
  return snapshot.docs.map(d => d.data());
}

async function saveWorkoutToFirestore(session) {
  if (!currentUser) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'workouts', session.id), session);
}

async function updateWorkoutInFirestore(session) {
  if (!currentUser) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'workouts', session.id), session);
}

async function deleteWorkoutFromFirestore(sessionId) {
  if (!currentUser) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'workouts', sessionId));
}

async function clearAllWorkoutsFromFirestore() {
  if (!currentUser) return;
  const snapshot = await getDocs(collection(db, 'users', currentUser.uid, 'workouts'));
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// --- Local helpers ---

function normalizeWorkouts(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (raw[0] && Array.isArray(raw[0].exercises)) {
    return raw;
  }

  return raw.map(item => ({
    id: `session-${item.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: item.name ? `${item.name} Workout` : 'Workout Session',
    timestamp: item.timestamp || Date.now(),
    favorite: !!item.favorite,
    exercises: [
      {
        id: `exercise-${item.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: item.name || 'Exercise',
        sets: item.sets || 1,
        reps: item.reps || 1,
        weight: item.weight || 0,
        favorite: !!item.favorite
      }
    ]
  }));
}

function loadWorkouts() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    workouts = normalizeWorkouts(stored);
  } catch (e) {
    console.warn('Could not load workouts from localStorage');
    workouts = [];
  }
}

function saveWorkouts() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(workouts));
  } catch (e) {
    console.warn('Could not save workouts');
  }
}

function getAllExercises() {
  return workouts.flatMap(session =>
    session.exercises.map(exercise => ({
      ...exercise,
      sessionName: session.name,
      sessionTimestamp: session.timestamp,
      sessionId: session.id
    }))
  );
}

function setSuggestionVisibility(visible) {
  suggestionsList.style.display = visible ? 'block' : 'none';
}

function updateSuggestions(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const recentExercises = {};
  getAllExercises().forEach(exercise => {
    recentExercises[exercise.name] = Math.max(recentExercises[exercise.name] || 0, exercise.sessionTimestamp);
  });
  let matches;

  if (normalizedQuery) {
    const popularMatches = popularExercises.filter(exercise => exercise.toLowerCase().includes(normalizedQuery));
    const loggedMatches = Object.keys(recentExercises).filter(exercise => exercise.toLowerCase().includes(normalizedQuery));
    matches = [...new Set([...popularMatches, ...loggedMatches])].sort();
  } else {
    const loggedNames = Object.keys(recentExercises);
    const recentSorted = loggedNames.sort((a, b) => recentExercises[b] - recentExercises[a]);
    const unloggedPopular = popularExercises.filter(ex => !loggedNames.includes(ex));
    matches = recentSorted.concat(unloggedPopular);
  }

  if (matches.length === 0) {
    suggestionsList.innerHTML = '';
    setSuggestionVisibility(false);
    return;
  }

  suggestionsList.innerHTML = matches
    .map(name => `<li class="suggestion-item" role="option">${name}</li>`)
    .join('');
  setSuggestionVisibility(true);
}

function getPredictedValues(exerciseName) {
  const pastExercises = getAllExercises().filter(ex => ex.name === exerciseName);
  if (pastExercises.length === 0) {
    return { sets: 3, reps: 8, weight: 100 };
  }
  const avgSets = pastExercises.reduce((sum, ex) => sum + ex.sets, 0) / pastExercises.length;
  const avgReps = pastExercises.reduce((sum, ex) => sum + ex.reps, 0) / pastExercises.length;
  const avgWeight = pastExercises.reduce((sum, ex) => sum + ex.weight, 0) / pastExercises.length;
  return {
    sets: Math.round(avgSets),
    reps: Math.round(avgReps),
    weight: Math.round(avgWeight)
  };
}

function renderCurrentWorkout() {
  if (currentWorkoutExercises.length === 0) {
    currentWorkoutList.innerHTML = '<p class="empty-state">Add exercises to build a workout session.</p>';
    return;
  }

  currentWorkoutList.innerHTML = currentWorkoutExercises
    .map((exercise, index) => `
      <article class="exercise-item" data-index="${index}" draggable="true">
        <div class="drag-handle" aria-hidden="true">&#8942;</div>
        <div class="exercise-summary">
          <strong>${exercise.name}</strong>
          ${formatExerciseStats(exercise)}
          ${exercise.notes ? `<p class="exercise-notes">Notes: ${exercise.notes}</p>` : ''}
        </div>
        <button type="button" class="exercise-delete" data-index="${index}">Remove</button>
      </article>
    `)
    .join('');

  initDragAndDrop();
}

function initDragAndDrop() {
  const container = currentWorkoutList;
  const items = Array.from(container.querySelectorAll('.exercise-item[draggable]'));
  let dragSrcIndex = null;

  // ── Desktop (mouse) drag ─────────────────────────────────────
  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrcIndex = Number(item.dataset.index);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('dragging'), 0);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      items.forEach(i => i.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      items.forEach(i => i.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

    item.addEventListener('drop', e => {
      e.preventDefault();
      const dropIndex = Number(item.dataset.index);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      const [moved] = currentWorkoutExercises.splice(dragSrcIndex, 1);
      currentWorkoutExercises.splice(dropIndex, 0, moved);
      dragSrcIndex = null;
      renderCurrentWorkout();
    });
  });

  // ── Touch drag ───────────────────────────────────────────────
  let touchSrcIndex = null;
  let touchStartY = 0;
  let touchDragging = false;

  items.forEach(item => {
    const handle = item.querySelector('.drag-handle') || item;
    handle.addEventListener('touchstart', e => {
      touchSrcIndex = Number(item.dataset.index);
      touchStartY = e.touches[0].clientY;
      touchDragging = false;
    }, { passive: true });
  });

  container.addEventListener('touchmove', e => {
    if (touchSrcIndex === null) return;
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (!touchDragging && dy > 8) {
      touchDragging = true;
      container.querySelector(`.exercise-item[data-index="${touchSrcIndex}"]`)?.classList.add('dragging');
    }
    if (!touchDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const srcItem = container.querySelector(`.exercise-item[data-index="${touchSrcIndex}"]`);
    if (srcItem) srcItem.style.visibility = 'hidden';
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (srcItem) srcItem.style.visibility = '';

    const overItem = target?.closest('.exercise-item[draggable]');
    items.forEach(i => i.classList.remove('drag-over'));
    if (overItem && overItem !== srcItem) overItem.classList.add('drag-over');
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (touchSrcIndex === null) return;
    container.querySelector(`.exercise-item[data-index="${touchSrcIndex}"]`)?.classList.remove('dragging');

    if (touchDragging) {
      const dropItem = container.querySelector('.exercise-item.drag-over');
      if (dropItem) {
        const dropIndex = Number(dropItem.dataset.index);
        if (touchSrcIndex !== dropIndex) {
          const [moved] = currentWorkoutExercises.splice(touchSrcIndex, 1);
          currentWorkoutExercises.splice(dropIndex, 0, moved);
          renderCurrentWorkout();
        }
      }
      items.forEach(i => i.classList.remove('drag-over'));
    }

    touchSrcIndex = null;
    touchDragging = false;
  });
}

function renderWorkoutLog() {
  if (!workoutList) return;
  if (workouts.length === 0) {
    workoutList.innerHTML = '<p class="empty-state">No workouts logged yet.</p>';
    return;
  }

  workoutList.innerHTML = workouts
    .slice()
    .reverse()
    .map(session => `
      <article class="session-card">
        <div class="session-card-header">
          <div>
            <h3>${session.name}</h3>
            <p class="session-meta">${session.exercises.length} exercise${session.exercises.length === 1 ? '' : 's'} • ${new Date(session.timestamp).toLocaleString()}</p>
          </div>
          <button type="button" class="favorite-toggle ${session.favorite ? 'favorite-active' : ''}" data-session-id="${session.id}" aria-label="Toggle favorite">
            ${session.favorite ? '★' : '☆'}
          </button>
        </div>
        <div class="exercise-list">
          ${session.exercises
            .map(exercise => `
              <article class="exercise-item">
                <div class="exercise-summary">
                  <strong>${exercise.name}</strong>
                  ${formatExerciseStats(exercise)}
                  ${exercise.notes ? `<p class="exercise-notes">Notes: ${exercise.notes}</p>` : ''}
                </div>
                <div class="exercise-actions">
                  <button type="button" class="exercise-favorite ${exercise.favorite ? 'favorite-active' : ''}" data-session-id="${session.id}" data-exercise-id="${exercise.id}" aria-label="Toggle favorite">${exercise.favorite ? '★' : '☆'}</button>
                  <button type="button" class="exercise-delete" data-session-id="${session.id}" data-exercise-id="${exercise.id}">Delete</button>
                </div>
              </article>
            `)
            .join('')}
        </div>
      </article>
    `)
    .join('');
}

function addExerciseToCurrentWorkout() {
  const name = exerciseNameInput.value.trim();
  const sets = Number(document.getElementById('exercise-sets').value);
  const notes = document.getElementById('exercise-notes').value.trim();
  const setDetails = readSetDetails(setsDetailEl);

  if (!name || sets < 1 || setDetails.some(d => d.reps < 1)) {
    alert('Please fill in all fields. Name cannot be empty, sets must be at least 1, and each set needs valid reps.');
    return;
  }

  const { reps, weight } = summarizeSets(setDetails);
  const data = {
    id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name, sets, reps, weight, setDetails, notes, favorite: false
  };

  if (currentWorkoutExercises.length === 0 && !warmupShownThisSession) {
    showWarmupModal(data);
  } else {
    commitExercise(data);
  }
}

function commitExercise(data) {
  currentWorkoutExercises.push(data);
  renderCurrentWorkout();
  exerciseNameInput.value = '';
  document.getElementById('exercise-notes').value = '';
  setSuggestionVisibility(false);
  document.getElementById('exercise-sets').value = 3;
  initSetRows(setsDetailEl, 3, 8, 100);
}

async function saveCurrentWorkout() {
  if (currentWorkoutExercises.length === 0) {
    alert('Add at least one exercise before saving the workout session.');
    return;
  }

  const name = workoutNameInput.value.trim();
  if (!name) {
    alert('Please name the workout before saving it.');
    return;
  }

  const session = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    favorite: sessionFavoriteCheckbox.checked,
    timestamp: Date.now(),
    exercises: currentWorkoutExercises
  };

  workouts.push(session);
  saveWorkouts();
  try { await saveWorkoutToFirestore(session); } catch (e) { console.error('Firestore save failed:', e); }

  alert('Workout saved!');
  location.reload();
}

function clearCurrentWorkout() {
  currentWorkoutExercises = [];
  warmupShownThisSession = false;
  renderCurrentWorkout();
}

async function toggleFavorite(sessionId) {
  workouts = workouts.map(session =>
    session.id === sessionId
      ? { ...session, favorite: !session.favorite }
      : session
  );
  saveWorkouts();
  renderWorkoutLog();
  const updated = workouts.find(s => s.id === sessionId);
  if (updated) await updateWorkoutInFirestore(updated);
}

async function toggleExerciseFavorite(sessionId, exerciseId) {
  workouts = workouts.map(session => {
    if (session.id !== sessionId) return session;
    const updatedExercises = session.exercises.map(ex =>
      ex.id === exerciseId
        ? { ...ex, favorite: !ex.favorite }
        : ex
    );
    return { ...session, exercises: updatedExercises };
  });
  saveWorkouts();
  renderWorkoutLog();
  const updated = workouts.find(s => s.id === sessionId);
  if (updated) await updateWorkoutInFirestore(updated);
}

async function deleteExercise(sessionId, exerciseId) {
  workouts = workouts
    .map(session => {
      if (session.id !== sessionId) return session;
      const updatedExercises = session.exercises.filter(ex => ex.id !== exerciseId);
      return { ...session, exercises: updatedExercises };
    })
    .filter(session => session.exercises.length > 0);

  saveWorkouts();
  renderWorkoutLog();

  const stillExists = workouts.find(s => s.id === sessionId);
  if (stillExists) {
    await updateWorkoutInFirestore(stillExists);
  } else {
    await deleteWorkoutFromFirestore(sessionId);
  }
}

function updateRepHint() {
  const hint = document.querySelector('.rep-hint');
  if (!hint) return;
  try {
    const profile = JSON.parse(localStorage.getItem('constantiaProfile') || '{}');
    const range = profile.preferredRepRange || profile.hypertrophy?.preferredRepRange;
    hint.textContent = range
      ? `Keep reps in your preferred range: ${range}`
      : 'Only count reps completed through your full range of motion.';
  } catch (_) {}
}

window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    loadWorkouts();
    renderWorkoutLog();
  }
});

exerciseForm.addEventListener('submit', event => {
  event.preventDefault();
  addExerciseToCurrentWorkout();
});

exerciseNameInput.addEventListener('input', event => {
  updateSuggestions(event.target.value);
});

exerciseNameInput.addEventListener('blur', () => {
  const name = exerciseNameInput.value.trim();
  if (name && getAllExercises().some(ex => ex.name === name)) {
    const predicted = getPredictedValues(name);
    document.getElementById('exercise-sets').value = predicted.sets;
    initSetRows(setsDetailEl, predicted.sets, predicted.reps, predicted.weight);
  }
});

suggestionsList.addEventListener('click', event => {
  if (!event.target.matches('.suggestion-item')) {
    return;
  }

  const selectedExercise = event.target.textContent;
  exerciseNameInput.value = selectedExercise;
  setSuggestionVisibility(false);
  exerciseNameInput.focus();

  const predicted = getPredictedValues(selectedExercise);
  document.getElementById('exercise-sets').value = predicted.sets;
  initSetRows(setsDetailEl, predicted.sets, predicted.reps, predicted.weight);
});

document.addEventListener('click', async event => {
  if (!event.target.closest('.autocomplete')) {
    setSuggestionVisibility(false);
  }

  if (event.target.matches('.favorite-toggle')) {
    const sessionId = event.target.dataset.sessionId;
    await toggleFavorite(sessionId);
  }

  if (event.target.matches('.exercise-favorite')) {
    const sessionId = event.target.dataset.sessionId;
    const exerciseId = event.target.dataset.exerciseId;
    await toggleExerciseFavorite(sessionId, exerciseId);
  }

  if (event.target.matches('.exercise-delete') && event.target.dataset.sessionId) {
    const sessionId = event.target.dataset.sessionId;
    const exerciseId = event.target.dataset.exerciseId;
    await deleteExercise(sessionId, exerciseId);
  }

if (event.target.matches('.exercise-delete') && event.target.dataset.index) {
    const index = Number(event.target.dataset.index);
    currentWorkoutExercises.splice(index, 1);
    renderCurrentWorkout();
  }
});

// Initialize set rows on load
initSetRows(setsDetailEl, 3, 8, 100);

// Re-render rows when sets count changes
document.getElementById('exercise-sets').addEventListener('input', () => {
  const sets = Math.max(1, parseInt(document.getElementById('exercise-sets').value) || 1);
  const existing = readSetDetails(setsDetailEl);
  const last = existing[existing.length - 1];
  renderSetRows(setsDetailEl, sets, last?.reps ?? 8, last?.weight ?? 100, existing);
});

saveWorkoutButton.addEventListener('click', saveCurrentWorkout);
clearCurrentWorkoutButton.addEventListener('click', clearCurrentWorkout);

document.getElementById('warmup-skip').addEventListener('click', closeWarmupAndAdd);
document.getElementById('warmup-skip-x').addEventListener('click', closeWarmupAndAdd);
document.getElementById('warmup-done').addEventListener('click', closeWarmupAndAdd);

document.getElementById('warmup-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('warmup-modal')) closeWarmupAndAdd();
});

document.getElementById('warmup-presets-grid').addEventListener('click', e => {
  const card = e.target.closest('.warmup-card[data-warmup-id]');
  if (card) showActiveWarmup(card.dataset.warmupId);
});

document.getElementById('warmup-preferred-card').addEventListener('click', () => {
  showActiveWarmup('preferred');
});

clearLogButton.addEventListener('click', async () => {
  workouts = [];
  saveWorkouts();
  await clearAllWorkoutsFromFirestore();
  renderWorkoutLog();
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    const firestoreWorkouts = await loadWorkoutsFromFirestore(user.uid);
    if (firestoreWorkouts.length > 0) {
      workouts = normalizeWorkouts(firestoreWorkouts);
      saveWorkouts();
    } else {
      // Firestore is empty — migrate any existing localStorage data up
      loadWorkouts();
      if (workouts.length > 0) {
        const batch = writeBatch(db);
        workouts.forEach(session => {
          batch.set(doc(db, 'users', user.uid, 'workouts', session.id), session);
        });
        await batch.commit();
      }
    }
  } else {
    loadWorkouts();
  }
  renderCurrentWorkout();
  renderWorkoutLog();
  updateRepHint();
});
