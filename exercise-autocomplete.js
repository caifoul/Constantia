const POPULAR_EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Dumbbell Bench Press',
  'Close-Grip Bench Press', 'Paused Bench Press', 'Floor Press',
  'Back Squat', 'Front Squat', 'Box Squat', 'Pause Squat', 'Goblet Squat',
  'Zercher Squat', 'Overhead Squat',
  'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Deficit Deadlift',
  'Trap Bar Deadlift', 'Stiff-Leg Deadlift', 'Single-Leg Deadlift',
  'Hip Thrust', 'Glute Bridge', 'Cable Pull-Through', 'Good Morning', 'Glute-Ham Raise',
  'Overhead Press', 'Seated Dumbbell Press', 'Push Press', 'Arnold Press',
  'Military Press', 'Push-Up', 'Bench Dip', 'Incline Push-Up', 'Decline Push-Up',
  'Pull-Up', 'Chin-Up', 'Neutral-Grip Pull-Up', 'Lat Pulldown',
  'Cable Row', 'Barbell Row', 'Pendlay Row', 'T-Bar Row', 'Single-Arm Dumbbell Row',
  'Chest Fly', 'Cable Fly', 'Pec Deck Fly',
  'Face Pull', 'Cable Lateral Raise', 'Dumbbell Lateral Raise', 'Front Raise', 'Reverse Fly',
  'Triceps Dip', 'Tricep Pushdown', 'Overhead Tricep Extension', 'Skullcrusher', 'Diamond Push-Up',
  'Hammer Curl', 'Bicep Curl', 'Preacher Curl', 'Concentration Curl', 'Cable Curl', 'Zottman Curl',
  'Leg Press', 'Leg Extension', 'Leg Curl', 'Seated Leg Curl', 'Standing Leg Curl',
  'Hip Abduction', 'Hip Adduction', 'Calf Raise', 'Seated Calf Raise', 'Single-Leg Calf Raise',
  'Bulgarian Split Squat', 'Reverse Lunge', 'Walking Lunge', 'Static Lunge', 'Step-Up', 'Curtsy Lunge',
  'Sled Push', 'Farmer Carry', 'Farmer Walk', 'Shrug', 'Dumbbell Shrug',
  'Kettlebell Swing', 'Turkish Get-Up',
  'Plank', 'Side Plank', 'Hanging Knee Raise', 'Hanging Leg Raise',
  'Russian Twist', 'Cable Woodchop', 'Ab Wheel Rollout', 'Mountain Climber',
  'Single-Leg SLDL', 'Nordic Hamstring Curl',
];

function getRecentExerciseNames() {
  try {
    const workouts = JSON.parse(localStorage.getItem('strengthTrackerExercises') || '[]');
    const seen = new Map();
    workouts.forEach(w => {
      (w.exercises || []).forEach(ex => {
        if (!seen.has(ex.name) || (w.timestamp || 0) > seen.get(ex.name)) {
          seen.set(ex.name, w.timestamp || 0);
        }
      });
    });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  } catch (_) { return []; }
}

function getSuggestions(query) {
  const recent = getRecentExerciseNames();
  const q = query.trim().toLowerCase();
  if (q) {
    const popMatches = POPULAR_EXERCISES.filter(e => e.toLowerCase().includes(q));
    const recMatches = recent.filter(e => e.toLowerCase().includes(q));
    return [...new Set([...popMatches, ...recMatches])].sort();
  }
  const recentSet = new Set(recent);
  return [...recent, ...POPULAR_EXERCISES.filter(e => !recentSet.has(e))];
}

// Attach autocomplete to an input. onSelect(name) is called when a suggestion is picked.
export function attachAutocomplete(inputEl, onSelect = () => {}) {
  const list = document.createElement('ul');
  list.className = 'suggestion-list';

  const parent = inputEl.parentElement;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  inputEl.insertAdjacentElement('afterend', list);

  function show(query) {
    const matches = getSuggestions(query).slice(0, 12);
    if (!matches.length) { list.style.display = 'none'; return; }
    list.innerHTML = matches.map(n => `<li class="suggestion-item">${n}</li>`).join('');
    list.style.display = 'block';
  }

  inputEl.addEventListener('input', () => show(inputEl.value));
  inputEl.addEventListener('focus',  () => show(inputEl.value));
  inputEl.addEventListener('blur',   () => setTimeout(() => { list.style.display = 'none'; }, 150));

  list.addEventListener('mousedown', e => {
    const item = e.target.closest('.suggestion-item');
    if (!item) return;
    e.preventDefault();
    inputEl.value = item.textContent;
    list.style.display = 'none';
    onSelect(item.textContent);
    inputEl.focus();
  });
}
