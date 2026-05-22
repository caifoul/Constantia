export const MOTIVATION_STYLES = {
  harsh:    'Harsh Taunting',
  positive: 'Positive Encouragement',
  moderate: 'Moderate Taunting with Positive Energy',
  sergeant: 'Drill Sergeant',
  silent:   'Silent Mode (No Messages)',
};

const MESSAGES = {
  harsh: {
    quit: [
      'hah, wimp.',
      'the bar is literally still warm.',
      'your future self is embarrassed.',
      'even the dumbbells are laughing.',
      'boldest thing you did today was show up.',
      'rest day? you just had one.',
      'the weights aren\'t going anywhere. you kinda are.',
      'legend. truly.',
      'your protein shake is going to waste.',
      'the machine you skipped just freed up.',
      'called it.',
      'your ancestors did not survive for this.',
      'miles went further. you\'re stopping here.',
    ],
    dashboard: [
      'Everyone wants to be great. Almost nobody does what it takes.',
      'You\'re not here to feel comfortable. You\'re here to get stronger.',
      'Nobody cares about your excuses. The weights don\'t either.',
      'The gym doesn\'t care how tired you are.',
      'Mediocre effort gets mediocre results. Choose accordingly.',
      'You\'re going to regret the workouts you skipped, not the ones you did.',
      'Stop waiting to feel motivated. Motivation is for beginners.',
    ],
    save: [
      'Barely counts. But fine, logged.',
      'You did something. Somehow.',
      'Recorded. Do more next time.',
      'Saved. The weights will still be there tomorrow — heavier.',
      'Session saved. Not impressed, but saved.',
    ],
    complete: [
      'Done. Not your best. But done.',
      'Finished. Could\'ve been harder.',
      'Done. Tomorrow you\'ll try harder. Or you won\'t.',
      'Complete. Now go recover before you embarrass yourself again.',
      'Saved. You were almost impressive today.',
    ],
  },

  positive: {
    quit: [
      'You\'ve already done more than most people today!',
      'Listen to your body — rest is part of the process.',
      'Progress isn\'t always linear. You\'re still moving forward.',
      'Every rep you did today was a win.',
      'Proud of you for showing up. Take the rest if you need it.',
      'Recovery matters. Come back fresh!',
      'You showed up — that\'s already a victory.',
    ],
    dashboard: [
      '"The last three or four reps is what makes the muscle grow." — Arnold Schwarzenegger',
      '"Everybody wants to be a bodybuilder, but nobody wants to lift no heavy-ass weights." — Ronnie Coleman',
      '"Pain is temporary. If I quit, however, it lasts forever." — Lance Armstrong',
      '"The iron never lies to you." — Henry Rollins',
      '"There are no shortcuts." — Frank Zane',
      'You\'re building something great, one session at a time.',
      'Progress is progress, no matter how small.',
      'Every workout is an investment in your future self.',
      'You showed up. That\'s already more than most people did today.',
      'Your dedication is your superpower.',
    ],
    save: [
      'Awesome session! Every rep counts!',
      'Great work today! Keep the momentum going!',
      'Another one in the books! You\'re crushing it!',
      'Saved! Your future self is going to thank you.',
      'Incredible work! You should be proud!',
    ],
    complete: [
      'Incredible work today! You should be proud of yourself!',
      'Another workout done! You\'re getting stronger every day!',
      'Every session brings you closer to your goal.',
      'Fantastic effort! Rest up and come back stronger!',
      'You did it! That\'s what champions are made of.',
    ],
  },

  moderate: {
    quit: [
      'hah, giving up already? okay, but you did get some work in.',
      'the bar\'s barely cooled down, but hey — you showed up.',
      'not your finest hour, but you\'ll come back and crush it.',
      'quitter energy, but at least you tried. that counts for something.',
      'you\'re leaving early, but the fact you came is still a W.',
      'could be worse. could also be better. see you next time.',
      'not bad. not great. but you were here, and that matters.',
    ],
    dashboard: [
      'You\'re not gonna be great at this. Not today anyway. But keep showing up and you just might surprise yourself.',
      'Not every day is your best day. That\'s fine. Show up anyway.',
      'You\'ll feel better after. You always do. Go.',
      'Every session is a vote for who you\'re becoming. Vote wisely.',
      'You\'re not a champion yet. But you could be. It starts with today.',
      '"Ain\'t nothin\' but a peanut." — Ronnie Coleman',
      '"Don\'t have $100 shoes and a 10 cent squat." — Louie Simmons',
      '"When you hit failure, your workout has just begun." — Ronnie Coleman',
    ],
    save: [
      'Workout saved! Not bad... could be worse.',
      'Logged! You actually did it. Respect.',
      'Saved! Now go eat something decent.',
      'Recorded! You\'re making progress — just not fast enough to be cocky about it yet.',
      'Session saved. You earned a break. See you next time.',
    ],
    complete: [
      'Workout done! Not gonna lie, you had some moments out there.',
      'Session complete! You pushed through — that\'s what matters.',
      'Done! Could\'ve skipped it, but you didn\'t. Respect.',
      'Finished! Now go fuel up and do it again tomorrow.',
      'Not bad. Not bad at all. Rest up.',
    ],
  },

  sergeant: {
    quit: [
      'THAT\'S IT?! FALL BACK IN LINE, SOLDIER!',
      'YOU CALL THAT A WORKOUT?! MY GRANDMOTHER TRAINS HARDER!',
      'QUITTERS DON\'T GET STRONGER! MOVE IT!',
      'THIS ISN\'T A SPA! GET BACK TO WORK!',
      'ARE YOU SERIOUS RIGHT NOW?! TEN-HUT!',
      'NO EARLY EXITS IN THIS GYM! CARRY ON!',
      'DISMISSED! ...JUST KIDDING. GET BACK THERE!',
    ],
    dashboard: [
      'ATTENTION! Today you will train. There is no alternative.',
      'THE ONLY EASY DAY WAS YESTERDAY. Move.',
      'EXCUSES ARE FOR PEOPLE WHO DON\'T WANT IT BADLY ENOUGH.',
      'GET UP. SHOW UP. LIFT. REPEAT. That\'s the mission.',
      'DISCIPLINE EQUALS FREEDOM. Now pick up that bar.',
      'PAIN IS WEAKNESS LEAVING THE BODY. Embrace it.',
    ],
    save: [
      'MISSION COMPLETE! Report back tomorrow!',
      'LOGGED! Good work, soldier. Dismissed... for now.',
      'SESSION SAVED! You will do better tomorrow. That\'s an order.',
      'RECORDED! Now go recover. That\'s also an order.',
      'WORKOUT FILED! Outstanding execution. Fall out!',
    ],
    complete: [
      'WORKOUT COMPLETE! Outstanding, soldier!',
      'MISSION ACCOMPLISHED! Fall out and recover!',
      'YOU SURVIVED! Same time tomorrow, soldier!',
      'EXCELLENT EXECUTION! Now go fuel up for the next mission!',
    ],
  },

  silent: {
    quit:      [],
    dashboard: [],
    save:      [],
    complete:  [],
  },
};

export function getMotivationStyle() {
  try {
    const profile = JSON.parse(localStorage.getItem('constantiaProfile') || '{}');
    return profile.motivationStyle || 'moderate';
  } catch (_) {
    return 'moderate';
  }
}

const _lastShown = new Map();

export function getMotivationalMessage(context) {
  const style = getMotivationStyle();
  const bank = MESSAGES[style]?.[context] || MESSAGES.moderate[context] || [];
  if (!bank.length) return null;
  if (bank.length === 1) return bank[0];
  const key = `${style}:${context}`;
  const last = _lastShown.get(key);
  let idx;
  do { idx = Math.floor(Math.random() * bank.length); } while (idx === last);
  _lastShown.set(key, idx);
  return bank[idx];
}
