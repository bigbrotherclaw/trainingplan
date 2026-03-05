export const WEEKLY_TEMPLATE = {
  0: { name: 'Rest', type: 'rest', short: 'Rest', label: 'REST' },
  1: { name: 'TB Operator + Accessories A', type: 'strength', short: 'STR A', label: 'STRENGTH', accessories: 'A' },
  2: { name: 'Swim or Bike + HIC', type: 'tri', short: 'Swim+HIC', label: 'TRI' },
  3: { name: 'TB Operator + Accessories B', type: 'strength', short: 'STR B', label: 'STRENGTH', accessories: 'B' },
  4: { name: 'Run + HIC', type: 'tri', short: 'Run+HIC', label: 'TRI' },
  5: { name: 'TB Operator + Accessories C', type: 'strength', short: 'STR C', label: 'STRENGTH', accessories: 'C' },
  6: { name: 'Long Tri Session', type: 'long', short: 'Long Tri', label: 'LONG' },
};

export const OPERATOR_LOADING = [
  { week: 1, sets: 3, reps: 5, percentage: 70, restMin: '2 min', restMax: '3 min' },
  { week: 2, sets: 3, reps: 5, percentage: 80, restMin: '2 min', restMax: '3 min' },
  { week: 3, sets: 3, reps: 3, percentage: 90, restMin: '3 min', restMax: '5 min' },
  { week: 4, sets: 3, reps: 5, percentage: 75, restMin: '2 min', restMax: '3 min' },
  { week: 5, sets: 3, reps: 5, percentage: 85, restMin: '3 min', restMax: '5 min' },
  { week: 6, sets: 3, reps: 3, percentage: 90, restMin: '3 min', restMax: '5 min' },
];

export const OPERATOR_LIFTS = [
  { name: 'Bench Press', settingsKey: 'benchPress1RM' },
  { name: 'Back Squat', settingsKey: 'squat1RM' },
  { name: 'Weighted Pull-up', settingsKey: 'weightedPullup1RM' },
];

export const ACCESSORIES = {
  A: [
    { name: 'Incline DB Press', sets: 3, reps: 8, category: 'Chest' },
    { name: 'Weighted Dips', sets: 3, reps: 6, category: 'Chest' },
    { name: 'Cable Flye', sets: 3, reps: 10, category: 'Chest' },
    { name: 'Hanging Leg Raise', sets: 3, reps: 8, category: 'Abs' },
    { name: 'Ab Rollout', sets: 3, reps: 8, category: 'Abs' },
  ],
  B: [
    { name: 'Barbell Row', sets: 3, reps: 5, category: 'Back' },
    { name: 'Face Pulls', sets: 3, reps: 15, category: 'Back' },
    { name: 'Barbell Curl', sets: 3, reps: 6, category: 'Arms' },
    { name: 'Tricep Pushdown', sets: 3, reps: 8, category: 'Arms' },
    { name: 'Hanging Knee Raise', sets: 3, reps: 8, category: 'Abs' },
  ],
  C: [
    { name: 'DB Shoulder Press', sets: 3, reps: 8, category: 'Shoulders' },
    { name: 'Lateral Raise', sets: 3, reps: 12, category: 'Shoulders' },
    { name: 'Incline DB Flye', sets: 3, reps: 10, category: 'Chest' },
    { name: 'Cable Crunch', sets: 3, reps: 12, category: 'Abs' },
    { name: 'Pallof Press', sets: 3, reps: 8, category: 'Abs' },
  ],
};

export const EXERCISE_MUSCLE_MAP = {
  'Bench Press': { chest: 3, shoulders: 2, triceps: 2 },
  'Back Squat': { quads: 3, glutes: 2, hamstrings: 2, core: 1, lowerBack: 1 },
  'Weighted Pull-up': { lats: 3, biceps: 2, traps: 2, forearms: 1 },
  'Incline DB Press': { chest: 2, shoulders: 1, triceps: 1 },
  'Weighted Dips': { chest: 3, triceps: 2, shoulders: 1 },
  'Cable Flye': { chest: 2, shoulders: 1 },
  'Hanging Leg Raise': { core: 3 },
  'Ab Rollout': { core: 3 },
  'Barbell Row': { lats: 3, biceps: 1, traps: 2 },
  'Face Pulls': { traps: 2, shoulders: 1, biceps: 1 },
  'Barbell Curl': { biceps: 3, forearms: 1 },
  'Tricep Pushdown': { triceps: 3 },
  'Hanging Knee Raise': { core: 3 },
  'DB Shoulder Press': { shoulders: 3, triceps: 1 },
  'Lateral Raise': { shoulders: 2 },
  'Incline DB Flye': { chest: 2, shoulders: 1 },
  'Cable Crunch': { core: 3 },
  'Pallof Press': { core: 3, obliques: 2 },
};

export const DEFAULT_SETTINGS = {
  name: 'Luke',
  benchPress1RM: 225,
  squat1RM: 315,
  weightedPullup1RM: 135,
  block: 1,
  week: 1,
  runLTPace: 0,
  runLTHR: 0,
  bikeFTP: 0,
  bikeLTHR: 0,
};
