import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().profile) {
      window.location.replace('home.html');
      return;
    }
    const startAtStep = localStorage.getItem('startAtStep');
    if (startAtStep) {
      localStorage.removeItem('startAtStep');
      setStep(parseInt(startAtStep));
    } else {
      setStep(1);
    }
  }
});

const signupSteps = document.querySelectorAll('#signup-steps .step');
const stepBack = document.getElementById('step-back');
const stepNext = document.getElementById('step-next');
const createAccountBtn = document.getElementById('create-account-btn');
const googleSignin = document.getElementById('google-signin');
const showSignin = document.getElementById('show-signin');
const signupSummary = document.getElementById('signup-summary');

let currentStep = 0;
let visibleSteps = [];

function getVisibleSteps() {
  const mainGoal = document.getElementById('main-goal')?.value;
  return Array.from(signupSteps).filter(step => {
    const goalFilter = step.dataset.goal;
    if (!goalFilter) return true;
    if (mainGoal === goalFilter) return true;
    return false;
  });
}

function getCurrentStepElement() {
  visibleSteps = getVisibleSteps();
  return visibleSteps[currentStep];
}

function getTotalVisibleSteps() {
  return getVisibleSteps().length;
}

function setStep(index) {
  visibleSteps = getVisibleSteps();
  currentStep = Math.min(Math.max(0, index), visibleSteps.length - 1);

  signupSteps.forEach(step => step.classList.remove('active'));

  const currentStepEl = getCurrentStepElement();
  if (currentStepEl) currentStepEl.classList.add('active');

  const total = getTotalVisibleSteps();
  stepBack.disabled = currentStep === 0;
  stepNext.textContent = currentStep === total - 1 ? 'Finish' : 'Next';

  signupSummary.classList.add('hidden');
}

function validateCurrentStep() {
  const step = getCurrentStepElement();
  if (!step) return true;

  const stepNum = parseInt(step.dataset.step);

  switch (stepNum) {
    case 1: return document.getElementById('age-range').value !== '';
    case 2: return !!document.querySelector('input[name="gender"]:checked');
    case 3: return document.getElementById('main-goal').value !== '';
    case 4: return true;
    case 5: return document.getElementById('training-split').value !== '';
    case 6: {
      const height = document.getElementById('height')?.value;
      const weight = document.getElementById('weight')?.value;
      return !!(height && weight);
    }
    case 7: return document.getElementById('daily-calories')?.value !== '';
    case 8: return document.getElementById('lifting-experience')?.value !== '';
    case 9: {
      const selectedValue = document.getElementById('preferred-reps').value;
      if (selectedValue === 'custom') return document.getElementById('custom-rep-range').value.trim() !== '';
      return selectedValue !== '';
    }
    case 10: return !!document.querySelector('input[name="growth-rate"]:checked');
    default: return true;
  }
}

function gatherProfile() {
  const selectedReps = document.getElementById('preferred-reps').value;
  const customReps = document.getElementById('custom-rep-range').value.trim();
  const preferredRepRange = selectedReps === 'custom' ? customReps : selectedReps;

  const profile = {
    ageRange: document.getElementById('age-range').value,
    gender: document.querySelector('input[name="gender"]:checked')?.value || 'Not specified',
    mainGoal: document.getElementById('main-goal').value,
    trainingSplit: document.getElementById('training-split').value,
    otherGoals: Array.from(document.querySelectorAll('input[name="other-goals"]:checked')).map(
      input => input.parentElement.textContent.trim()
    ),
    preferredRepRange,
  };

  if (profile.mainGoal === 'hypertrophy') {
    profile.hypertrophy = {
      height: document.getElementById('height')?.value,
      weight: document.getElementById('weight')?.value,
      dailyCalories: document.getElementById('daily-calories')?.value,
      liftingExperience: document.getElementById('lifting-experience')?.value,
      preferredRepRange,
      growthRate: document.querySelector('input[name="growth-rate"]:checked')?.value || 'Not specified',
    };
  }

  return profile;
}

async function showSummary() {
  const profile = gatherProfile();
  const savedProfile = { ...profile, createdAt: new Date().toISOString() };

  if (currentUser) {
    await setDoc(doc(db, 'users', currentUser.uid), { profile: savedProfile }, { merge: true });
  }

  localStorage.setItem('constantiaProfile', JSON.stringify(savedProfile));
  window.location.href = 'home.html';
}

createAccountBtn.addEventListener('click', () => {
  window.location.href = 'create-account.html';
});

googleSignin.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        username: null,
        provider: 'google',
        createdAt: new Date().toISOString(),
      });
    }
    // onAuthStateChanged handles navigation
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user') {
      alert('Google sign-in error: ' + error.code + '\n' + error.message);
    }
  }
});

showSignin.addEventListener('click', () => {
  window.location.href = 'signin.html';
});

document.getElementById('main-goal').addEventListener('change', () => {
  if (currentStep > 5) setStep(5);
  else setStep(currentStep);
});

document.getElementById('preferred-reps').addEventListener('change', (e) => {
  const customLabel = document.getElementById('custom-rep-label');
  const customInput = document.getElementById('custom-rep-range');
  if (e.target.value === 'custom') {
    customLabel.style.display = 'block';
    customInput.required = true;
  } else {
    customLabel.style.display = 'none';
    customInput.required = false;
    customInput.value = '';
  }
});

stepBack.addEventListener('click', () => {
  if (currentStep > 0) setStep(currentStep - 1);
});

stepNext.addEventListener('click', () => {
  if (currentStep === 0) {
    setStep(1);
    return;
  }
  if (!validateCurrentStep()) {
    alert('Please complete the current step before continuing.');
    return;
  }
  const total = getTotalVisibleSteps();
  if (currentStep === total - 1) {
    showSummary();
    return;
  }
  setStep(currentStep + 1);
});

document.addEventListener('DOMContentLoaded', () => {
  setStep(0);
});
