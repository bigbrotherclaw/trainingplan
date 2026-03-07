export const SPORT_ID_MAP = {
  0: 'Running',
  1: 'Cycling',
  33: 'Swimming',
  44: 'Functional Fitness',
  48: 'HIIT',
  63: 'Weightlifting',
  71: 'Spinning',
  82: 'Yoga',
  84: 'Rowing',
};

const SPORT_ICONS = {
  0: '\u{1F3C3}',   // running
  1: '\u{1F6B4}',   // cycling
  33: '\u{1F3CA}',  // swimming
  44: '\u{1F4AA}',  // functional fitness
  48: '\u26A1',     // HIIT
  63: '\u{1F3CB}\uFE0F', // weightlifting
  71: '\u{1F6B4}',  // spinning
  82: '\u{1F9D8}',  // yoga
  84: '\u{1F6A3}',  // rowing
};

const SPORT_COLORS = {
  0: '#10B981',   // running - green
  1: '#3B82F6',   // cycling - blue
  33: '#06B6D4',  // swimming - cyan
  44: '#F59E0B',  // functional fitness - amber
  48: '#EF4444',  // HIIT - red
  63: '#F59E0B',  // weightlifting - amber
  71: '#3B82F6',  // spinning - blue
  82: '#8B5CF6',  // yoga - purple
  84: '#14B8A6',  // rowing - teal
};

const TRAINING_CATEGORY_MAP = {
  0: 'tri',        // running
  1: 'tri',        // cycling
  33: 'tri',       // swimming
  44: 'strength',  // functional fitness
  48: 'strength',  // HIIT
  63: 'strength',  // weightlifting
  71: 'tri',       // spinning
  82: 'recovery',  // yoga
  84: 'tri',       // rowing
};

export function getSportName(sportId) {
  return SPORT_ID_MAP[sportId] ?? `Activity (${sportId})`;
}

export function getSportIcon(sportId) {
  return SPORT_ICONS[sportId] ?? '\u{1F4AA}';
}

export function getSportColor(sportId) {
  return SPORT_COLORS[sportId] ?? '#6B7280';
}

export function categorizeForTrainingPlan(sportId) {
  return TRAINING_CATEGORY_MAP[sportId] ?? 'other';
}
