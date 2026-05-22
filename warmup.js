const WARMUP_PRESETS = [
  {
    id: 'general',
    name: 'General Athletic',
    duration: '5 min',
    steps: ['Jumping jacks × 30', 'Arm circles × 15 each', 'Leg swings × 10 each', 'Hip circles × 10 each', 'High knees × 20'],
  },
  {
    id: 'upper',
    name: 'Upper Body',
    duration: '4 min',
    steps: ['Band pull-aparts × 15', 'Shoulder circles × 10 each', 'Chest stretch 30s each', 'Tricep stretch 20s each', 'Wrist circles × 10'],
  },
  {
    id: 'lower',
    name: 'Lower Body',
    duration: '5 min',
    steps: ['Hip flexor stretch 30s each', 'Quad stretch 30s each', 'Hamstring stretch 30s', 'Glute bridge × 15', 'Calf raises × 20'],
  },
  {
    id: 'core',
    name: 'Core Activation',
    duration: '4 min',
    steps: ['Cat-cow × 10', 'Dead bugs × 8 each', 'Bird dogs × 8 each', 'Plank 30s', 'Side plank 20s each'],
  },
  {
    id: 'dynamic',
    name: 'Full Body Dynamic',
    duration: '6 min',
    steps: ["World's greatest stretch × 5 each", 'Inchworms × 8', 'Spiderman lunges × 6 each', 'T-spine rotations × 10', 'Jump squats × 10'],
  },
];

function getPreferredWarmup() {
  try {
    const profile = JSON.parse(localStorage.getItem('constantiaProfile') || '{}');
    return profile.preferredWarmup || null;
  } catch (_) { return null; }
}

export function showWarmup(onComplete) {
  const modal = document.getElementById('warmup-modal');
  if (!modal) { onComplete(); return; }

  const selectView = document.getElementById('warmup-select-view');
  const activeView = document.getElementById('warmup-active-view');

  selectView.classList.remove('hidden');
  activeView.classList.add('hidden');

  // Preferred warmup
  const preferred = getPreferredWarmup();
  const preferredSection = document.getElementById('warmup-preferred-section');
  const preferredCard   = document.getElementById('warmup-preferred-card');
  if (preferred && preferred.name) {
    preferredSection.classList.remove('hidden');
    const steps = Array.isArray(preferred.steps) ? preferred.steps : [];
    preferredCard.innerHTML = `
      <div class="warmup-card-header">
        <strong>${preferred.name}</strong>
        <span class="warmup-duration">${steps.length} steps</span>
      </div>
      <ol class="warmup-steps-preview">
        ${steps.slice(0, 3).map(s => `<li>${s}</li>`).join('')}
        ${steps.length > 3 ? `<li class="warmup-more">+${steps.length - 3} more…</li>` : ''}
      </ol>`;
    preferredCard.dataset.warmupId = 'preferred';
  } else {
    preferredSection.classList.add('hidden');
  }

  // Presets
  document.getElementById('warmup-presets-grid').innerHTML = WARMUP_PRESETS.map(p => `
    <div class="warmup-card" data-warmup-id="${p.id}">
      <div class="warmup-card-header">
        <strong>${p.name}</strong>
        <span class="warmup-duration">${p.duration}</span>
      </div>
      <ol class="warmup-steps-preview">
        ${p.steps.slice(0, 3).map(s => `<li>${s}</li>`).join('')}
        ${p.steps.length > 3 ? `<li class="warmup-more">+${p.steps.length - 3} more…</li>` : ''}
      </ol>
    </div>`).join('');

  modal.classList.remove('hidden');

  function showActiveWarmup(id) {
    let warmup;
    if (id === 'preferred') {
      const pw = getPreferredWarmup();
      warmup = pw ? { name: pw.name, steps: pw.steps || [] } : null;
    } else {
      warmup = WARMUP_PRESETS.find(p => p.id === id);
    }
    if (!warmup) return;
    selectView.classList.add('hidden');
    activeView.classList.remove('hidden');
    document.getElementById('warmup-active-name').textContent = warmup.name;
    document.getElementById('warmup-steps-list').innerHTML = warmup.steps.map(s => `<li>${s}</li>`).join('');
  }

  function close() {
    modal.classList.add('hidden');
    cleanup();
    onComplete();
  }

  function onPresetClick(e) {
    const card = e.target.closest('.warmup-card[data-warmup-id]');
    if (card) showActiveWarmup(card.dataset.warmupId);
  }

  function onOverlayClick(e) {
    if (e.target === modal) close();
  }

  function cleanup() {
    document.getElementById('warmup-skip').removeEventListener('click', close);
    document.getElementById('warmup-skip-x').removeEventListener('click', close);
    document.getElementById('warmup-done').removeEventListener('click', close);
    document.getElementById('warmup-presets-grid').removeEventListener('click', onPresetClick);
    preferredCard.removeEventListener('click', () => showActiveWarmup('preferred'));
    modal.removeEventListener('click', onOverlayClick);
  }

  document.getElementById('warmup-skip').addEventListener('click', close);
  document.getElementById('warmup-skip-x').addEventListener('click', close);
  document.getElementById('warmup-done').addEventListener('click', close);
  document.getElementById('warmup-presets-grid').addEventListener('click', onPresetClick);
  preferredCard.addEventListener('click', () => showActiveWarmup('preferred'));
  modal.addEventListener('click', onOverlayClick);
}
