import {
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  Zap,
  PersonStanding,
  Activity,
  HeartPulse,
  Mountain,
  Target,
  CircleDot,
} from 'lucide-react';

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
  85: 'Walking',
  96: 'Hiking',
  126: 'Boxing',
};

// Lucide icon components per sport
const SPORT_ICON_MAP = {
  0: Footprints,       // Running
  1: Bike,             // Cycling
  33: Waves,           // Swimming
  44: Zap,             // Functional Fitness / CrossFit
  48: Zap,             // HIIT
  63: Dumbbell,        // Weightlifting
  71: Bike,            // Spinning
  82: PersonStanding,  // Yoga
  84: Waves,           // Rowing (water-based)
  85: Footprints,      // Walking
  96: Mountain,        // Hiking
  126: Target,         // Boxing
};

// Single cohesive color palette — muted tones that work on dark bg
// All colors from the same family for consistency
const SPORT_COLORS = {
  0: '#34D399',   // running - emerald
  1: '#60A5FA',   // cycling - blue
  33: '#22D3EE',  // swimming - cyan
  44: '#FBBF24',  // functional fitness - amber
  48: '#F87171',  // HIIT - red
  63: '#FBBF24',  // weightlifting - amber
  71: '#60A5FA',  // spinning - blue
  82: '#A78BFA',  // yoga - violet
  84: '#2DD4BF',  // rowing - teal
  85: '#34D399',  // walking - emerald
  96: '#34D399',  // hiking - emerald
  126: '#F87171', // boxing - red
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
  85: 'tri',       // walking
  96: 'tri',       // hiking
  126: 'strength', // boxing
};

export function getSportName(sportId) {
  return SPORT_ID_MAP[sportId] ?? `Activity`;
}

/**
 * Returns the Lucide icon COMPONENT for a sport.
 * Usage: const Icon = getSportIcon(sportId); <Icon size={18} />
 */
export function getSportIcon(sportId) {
  return SPORT_ICON_MAP[sportId] ?? Activity;
}

export function getSportColor(sportId) {
  return SPORT_COLORS[sportId] ?? '#9CA3AF';
}

export function categorizeForTrainingPlan(sportId) {
  return TRAINING_CATEGORY_MAP[sportId] ?? 'other';
}

/**
 * Format duration in milliseconds or minutes to human readable
 */
export function formatDuration(startISO, endISO) {
  if (!startISO || !endISO) return '—';
  const ms = new Date(endISO) - new Date(startISO);
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Convert meters to miles, 1 decimal
 */
export function metersToMiles(meters) {
  if (!meters) return null;
  return (meters * 0.000621371).toFixed(1);
}

/**
 * Convert kilojoules to kcal
 */
export function kjToKcal(kj) {
  if (!kj) return null;
  return Math.round(kj * 0.239006);
}
