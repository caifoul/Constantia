import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initSetRows, renderSetRows, readSetDetails, summarizeSets } from './set-rows.js';

const storageKey = 'strengthTrackerExercises';
const favoritesList = document.getElementById('favorites-list');
const clearFavoritesButton = document.getElementById('clear-favorites');

let workouts = [];
let currentUser = null;

async function loadWorkoutsFromFirestore(uid) {
  const snapshot = await getDocs(collection(db, 'users', uid, 'workouts'));
  return snapshot.docs.map(d => d.data());
}

async function updateWorkoutInFirestore(session) {
  if (!currentUser) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'workouts', session.id), session);
}

async function deleteWorkoutFromFirestore(sessionId) {
  if (!currentUser) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'workouts', sessionId));
}

function normalizeWorkouts(raw) {
  if (!Array.isArray(raw)) return [];
  if (raw.length === 0) return [];
  if (raw[0] && Array.isArray(raw[0].exercises)) return raw;
  return raw.map(item => ({
    id: `session-${item.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: item.name ? `${item.name} Workout` : 'Workout Session',
    timestamp: item.timestamp || Date.now(),
    favorite: !!item.favorite,
    exercises: [{
      id: `exercise-${item.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: item.name || 'Exercise',
      sets: item.sets || 1,
      reps: item.reps || 1,
      weight: item.weight || 0,
    }],
  }));
}

function setStorage(data) {
  try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (_) {}
}

// ── Render ────────────────────────────────────────────────────────
function renderFavorites() {
  if (!favoritesList) return;

  if (!workouts.length) {
    favoritesList.innerHTML = '<p class="empty-state">No workouts saved yet. Go to <a href="index.html">Log Workout</a> to create one.</p>';
    return;
  }

  const sorted = workouts.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  favoritesList.innerHTML = sorted.map(workout => `
    <article class="session-card" data-workout-id="${workout.id}">
      <div class="session-card-header">
        <div>
          <h3>${workout.name}</h3>
          <p class="session-meta">${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'} • ${new Date(workout.timestamp).toLocaleString()}</p>
        </div>
        <div class="fav-card-actions">
          <button type="button"
            class="favorite-toggle ${workout.favorite ? 'favorite-active' : ''}"
            data-action="star"
            data-session-id="${workout.id}"
            title="${workout.favorite ? 'Remove from Coach' : 'Star to use in Coach'}">
            ${workout.favorite ? '★' : '☆'}
          </button>
          <button type="button" class="fav-rename-btn" data-action="rename" data-session-id="${workout.id}">Rename</button>
          <button type="button" class="fav-rename-btn" data-action="edit" data-session-id="${workout.id}">Edit</button>
          <button type="button" class="fav-delete-btn" data-action="delete" data-session-id="${workout.id}">Delete</button>
        </div>
      </div>
      <div class="exercise-list">
        ${workout.exercises.map(ex => `
          <div class="exercise-item">
            <div class="exercise-summary">
              <strong>${ex.name}</strong>
              <span>Sets: ${ex.sets}</span>
              <span>Reps: ${ex.reps}</span>
              <span>Weight: ${ex.weight} lbs</span>
            </div>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');
}

// ── Edit panel ────────────────────────────────────────────────────
function buildExerciseRow(ex) {
  const sets       = ex?.sets       ?? 3;
  const reps       = ex?.reps       ?? 8;
  const weight     = ex?.weight     ?? 100;
  const notes      = ex?.notes      ?? '';
  const setDetails = ex?.setDetails ?? [];

  const div = document.createElement('div');
  div.className  = 'fav-edit-row';
  div.draggable  = true;

  div.innerHTML = `
    <div class="fav-edit-row-header">
      <span class="fav-drag-handle" title="Drag to reorder">⠿</span>
      <input class="fav-edit-name" type="text" value="${ex?.name || ''}" placeholder="Exercise name" />
      <button type="button" class="fav-delete-ex-btn" data-action="remove-ex" title="Remove">✕</button>
    </div>
    <div class="fav-edit-row-body">
      <div class="row">
        <label>Sets<input class="fav-edit-sets" type="number" min="1" value="${sets}" /></label>
      </div>
      <div class="sets-detail-list fav-sets-detail"></div>
      <label>Notes<textarea class="fav-edit-notes" rows="2" placeholder="Optional…">${notes}</textarea></label>
    </div>
  `;

  // Initialise per-set rows
  const setsEl = div.querySelector('.fav-sets-detail');
  if (setDetails.length) {
    renderSetRows(setsEl, sets, reps, weight, setDetails);
  } else {
    initSetRows(setsEl, sets, reps, weight);
  }

  // Keep rows in sync when sets count changes
  div.querySelector('.fav-edit-sets').addEventListener('input', () => {
    const n        = Math.max(1, parseInt(div.querySelector('.fav-edit-sets').value) || 1);
    const existing = readSetDetails(setsEl);
    const last     = existing[existing.length - 1];
    renderSetRows(setsEl, n, last?.reps ?? reps, last?.weight ?? weight, existing);
  });

  return div;
}

function initEditDragAndDrop(container) {
  let dragSrc = null;
  let touchSrc = null;
  let touchStartY = 0;
  let touchDragging = false;

  function getRows() { return Array.from(container.querySelectorAll('.fav-edit-row')); }

  function attachRow(row) {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      getRows().forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      getRows().forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row) return;
      const rows = getRows();
      const srcIdx  = rows.indexOf(dragSrc);
      const dropIdx = rows.indexOf(row);
      if (srcIdx < dropIdx) row.after(dragSrc);
      else row.before(dragSrc);
      getRows().forEach(r => r.classList.remove('drag-over'));
      dragSrc = null;
    });

    const handle = row.querySelector('.fav-drag-handle') || row;
    handle.addEventListener('touchstart', e => {
      touchSrc = row;
      touchStartY = e.touches[0].clientY;
      touchDragging = false;
    }, { passive: true });
  }

  container.addEventListener('touchmove', e => {
    if (!touchSrc) return;
    if (!touchDragging && Math.abs(e.touches[0].clientY - touchStartY) > 8) {
      touchDragging = true;
      touchSrc.classList.add('dragging');
    }
    if (!touchDragging) return;
    e.preventDefault();
    touchSrc.style.visibility = 'hidden';
    const over = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY)?.closest('.fav-edit-row');
    touchSrc.style.visibility = '';
    getRows().forEach(r => r.classList.remove('drag-over'));
    if (over && over !== touchSrc) over.classList.add('drag-over');
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (!touchSrc) return;
    touchSrc.classList.remove('dragging');
    if (touchDragging) {
      const over = container.querySelector('.fav-edit-row.drag-over');
      if (over && over !== touchSrc) {
        const rows = getRows();
        if (rows.indexOf(touchSrc) < rows.indexOf(over)) over.after(touchSrc);
        else over.before(touchSrc);
      }
      getRows().forEach(r => r.classList.remove('drag-over'));
    }
    touchSrc = null;
    touchDragging = false;
  });

  // Wire existing rows and observe new ones
  getRows().forEach(attachRow);
  new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(n => {
      if (n.classList?.contains('fav-edit-row')) attachRow(n);
    }));
  }).observe(container, { childList: true });
}

function openEditPanel(sessionId) {
  const article = favoritesList.querySelector(`[data-workout-id="${sessionId}"]`);
  if (!article) return;

  // Toggle off if already open
  const existing = article.querySelector('.fav-edit-panel');
  if (existing) { existing.remove(); return; }

  // Close any other open panel
  favoritesList.querySelectorAll('.fav-edit-panel').forEach(p => p.remove());

  const workout = workouts.find(w => w.id === sessionId);
  if (!workout) return;

  const panel = document.createElement('div');
  panel.className = 'fav-edit-panel';

  const exContainer = document.createElement('div');
  exContainer.className = 'fav-edit-exercises';
  workout.exercises.forEach(ex => exContainer.appendChild(buildExerciseRow(ex)));

  const footer = document.createElement('div');
  footer.className = 'fav-edit-footer';
  footer.innerHTML = `
    <button type="button" class="secondary-button" data-action="add-ex" data-session-id="${sessionId}">+ Add Exercise</button>
    <div class="fav-edit-actions">
      <button type="button" class="btn-primary" data-action="save-edit" data-session-id="${sessionId}">Save Changes</button>
      <button type="button" class="secondary-button" data-action="cancel-edit">Cancel</button>
    </div>
  `;

  panel.appendChild(exContainer);
  panel.appendChild(footer);
  article.appendChild(panel);
  initEditDragAndDrop(exContainer);
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function readEditPanel(panel) {
  return Array.from(panel.querySelectorAll('.fav-edit-row')).map(row => {
    const name       = row.querySelector('.fav-edit-name').value.trim();
    const sets       = parseInt(row.querySelector('.fav-edit-sets').value) || 1;
    const setsEl     = row.querySelector('.fav-sets-detail');
    const setDetails = readSetDetails(setsEl);
    const { reps, weight } = summarizeSets(setDetails);
    const notes      = row.querySelector('.fav-edit-notes')?.value.trim() || '';
    return { name, sets, reps, weight, setDetails, notes };
  }).filter(ex => ex.name);
}

async function saveEdit(sessionId) {
  const panel = favoritesList.querySelector(`[data-workout-id="${sessionId}"] .fav-edit-panel`);
  if (!panel) return;

  const exercises = readEditPanel(panel);
  if (!exercises.length) { alert('Add at least one exercise.'); return; }

  const original = workouts.find(w => w.id === sessionId);
  workouts = workouts.map(w => {
    if (w.id !== sessionId) return w;
    return {
      ...w,
      exercises: exercises.map((ex, i) => ({
        id:         original.exercises[i]?.id || `exercise-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
        name:       ex.name,
        sets:       ex.sets,
        reps:       ex.reps,
        weight:     ex.weight,
        setDetails: ex.setDetails,
        notes:      ex.notes,
        favorite:   original.exercises[i]?.favorite || false,
      })),
    };
  });

  setStorage(workouts);
  const updated = workouts.find(w => w.id === sessionId);
  if (updated) await updateWorkoutInFirestore(updated);
  renderFavorites();
}

// ── Actions ───────────────────────────────────────────────────────
async function toggleStar(sessionId) {
  workouts = workouts.map(w => w.id === sessionId ? { ...w, favorite: !w.favorite } : w);
  setStorage(workouts);
  renderFavorites();
  const updated = workouts.find(w => w.id === sessionId);
  if (updated) await updateWorkoutInFirestore(updated);
}

async function renameWorkout(sessionId) {
  const workout = workouts.find(w => w.id === sessionId);
  if (!workout) return;
  const newName = prompt('Rename workout:', workout.name);
  if (!newName || newName.trim() === workout.name) return;
  workouts = workouts.map(w => w.id === sessionId ? { ...w, name: newName.trim() } : w);
  setStorage(workouts);
  renderFavorites();
  const updated = workouts.find(w => w.id === sessionId);
  if (updated) await updateWorkoutInFirestore(updated);
}

async function deleteWorkout(sessionId) {
  if (!confirm('Delete this workout? This cannot be undone.')) return;
  workouts = workouts.filter(w => w.id !== sessionId);
  setStorage(workouts);
  renderFavorites();
  await deleteWorkoutFromFirestore(sessionId);
}

async function unstarAll() {
  const hadFavorites = workouts.some(w => w.favorite);
  if (!hadFavorites) return;
  workouts = workouts.map(w => ({ ...w, favorite: false }));
  setStorage(workouts);
  renderFavorites();
  if (currentUser) {
    const batch = writeBatch(db);
    workouts.forEach(w => batch.set(doc(db, 'users', currentUser.uid, 'workouts', w.id), w));
    await batch.commit();
  }
}

// ── Events ────────────────────────────────────────────────────────
favoritesList.addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, sessionId } = btn.dataset;

  if (action === 'star')        { await toggleStar(sessionId); return; }
  if (action === 'rename')      { await renameWorkout(sessionId); return; }
  if (action === 'delete')      { await deleteWorkout(sessionId); return; }
  if (action === 'edit')        { openEditPanel(sessionId); return; }
  if (action === 'save-edit')   { await saveEdit(sessionId); return; }
  if (action === 'cancel-edit') { btn.closest('.fav-edit-panel').remove(); return; }
  if (action === 'remove-ex')   { btn.closest('.fav-edit-row').remove(); return; }
  if (action === 'add-ex') {
    const container = btn.closest('.fav-edit-panel').querySelector('.fav-edit-exercises');
    const row = buildExerciseRow(null);
    container.appendChild(row);
    row.querySelector('.fav-edit-name').focus();
    return;
  }
});

clearFavoritesButton.addEventListener('click', unstarAll);

window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    try { workouts = normalizeWorkouts(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch (_) { workouts = []; }
    renderFavorites();
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    try {
      const firestoreWorkouts = await loadWorkoutsFromFirestore(user.uid);
      if (firestoreWorkouts.length > 0) {
        workouts = normalizeWorkouts(firestoreWorkouts);
        setStorage(workouts);
      } else {
        try { workouts = normalizeWorkouts(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
        catch (_) { workouts = []; }
      }
    } catch (_) {
      try { workouts = normalizeWorkouts(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
      catch (__) { workouts = []; }
    }
  } else {
    try { workouts = normalizeWorkouts(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch (_) { workouts = []; }
  }
  renderFavorites();
});
