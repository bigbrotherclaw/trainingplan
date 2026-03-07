import {
  Footprints,
  Bike,
  Waves,
  Zap,
  PersonStanding,
  Activity,
  HeartPulse,
  Mountain,
  CircleDot,
  Target,
} from 'lucide-react';
import { PickleballIcon, WeightliftingIcon, RacquetIcon, BasketballIcon } from '../components/SportIcons';

export const SPORT_ID_MAP = {
  '-1': 'Activity',
  0: 'Running',
  1: 'Cycling',
  2: 'Baseball',
  3: 'Basketball',
  4: 'Cricket',
  5: 'Field Hockey',
  6: 'Football',
  7: 'Golf',
  8: 'Ice Hockey',
  9: 'Lacrosse',
  10: 'Rugby',
  11: 'Soccer',
  12: 'Softball',
  13: 'Tennis',
  14: 'Volleyball',
  15: 'Water Polo',
  16: 'Wrestling',
  17: 'Surfing',
  18: 'Snowboarding',
  19: 'Skiing',
  20: 'Skating',
  21: 'Rock Climbing',
  22: 'Martial Arts',
  23: 'Gymnastics',
  24: 'Dance',
  25: 'Fencing',
  26: 'Horseback Riding',
  27: 'Sailing',
  28: 'Diving',
  29: 'Kayaking',
  30: 'Motocross',
  31: 'Racquetball',
  32: 'Squash',
  33: 'Swimming',
  34: 'Table Tennis',
  35: 'Triathlon',
  36: 'Badminton',
  37: 'Bowling',
  38: 'Pilates',
  39: 'CrossFit',
  40: 'Elliptical',
  41: 'Stairmaster',
  42: 'Meditation',
  43: 'Other',
  44: 'Functional Fitness',
  45: 'Duathlon',
  46: 'Obstacle Course',
  47: 'Rowing',
  48: 'HIIT',
  49: 'Canoeing',
  50: 'Paddleboarding',
  51: 'Pickup',
  52: 'Jump Rope',
  63: 'Weightlifting',
  64: 'Pickleball',
  71: 'Spinning',
  82: 'Yoga',
  84: 'Rowing',
  85: 'Walking',
  87: 'Barre',
  96: 'Hiking',
  126: 'Boxing',
};

// Lucide icon components per sport
const SPORT_ICON_MAP = {
  0: Footprints,       // Running
  1: Bike,             // Cycling
  3: BasketballIcon,   // Basketball
  6: Activity,         // Football
  7: Activity,         // Golf
  11: Activity,        // Soccer
  13: RacquetIcon,     // Tennis
  14: Activity,        // Volleyball
  17: Waves,           // Surfing
  19: Mountain,        // Skiing
  21: Mountain,        // Rock Climbing
  22: Zap,             // Martial Arts
  24: PersonStanding,  // Dance
  29: Waves,           // Kayaking
  33: Waves,           // Swimming
  38: PersonStanding,  // Pilates
  39: Zap,             // CrossFit
  40: Activity,        // Elliptical
  42: PersonStanding,  // Meditation
  43: HeartPulse,      // Other
  44: Zap,             // Functional Fitness
  47: Waves,           // Rowing
  48: Zap,             // HIIT
  50: Waves,           // Paddleboarding
  52: Zap,             // Jump Rope
  63: WeightliftingIcon, // Weightlifting
  64: PickleballIcon,  // Pickleball
  71: Bike,            // Spinning
  82: PersonStanding,  // Yoga
  84: Waves,           // Rowing (water-based)
  85: Footprints,      // Walking
  87: PersonStanding,  // Barre
  96: Mountain,        // Hiking
  126: Target,         // Boxing
};

// Single cohesive color palette — muted tones that work on dark bg
const SPORT_COLORS = {
  0: '#34D399',   // running - emerald
  1: '#60A5FA',   // cycling - blue
  3: '#F59E0B',   // basketball - amber
  6: '#F59E0B',   // football - amber
  7: '#34D399',   // golf - emerald
  11: '#34D399',  // soccer - emerald
  13: '#60A5FA',  // tennis - blue
  14: '#F59E0B',  // volleyball - amber
  17: '#22D3EE',  // surfing - cyan
  19: '#60A5FA',  // skiing - blue
  21: '#F59E0B',  // rock climbing - amber
  22: '#F87171',  // martial arts - red
  24: '#A78BFA',  // dance - violet
  29: '#22D3EE',  // kayaking - cyan
  33: '#22D3EE',  // swimming - cyan
  38: '#A78BFA',  // pilates - violet
  39: '#F87171',  // crossfit - red
  40: '#60A5FA',  // elliptical - blue
  42: '#A78BFA',  // meditation - violet
  43: '#9CA3AF',  // other - gray
  44: '#FBBF24',  // functional fitness - amber
  47: '#2DD4BF',  // rowing - teal
  48: '#F87171',  // HIIT - red
  50: '#22D3EE',  // paddleboarding - cyan
  52: '#F87171',  // jump rope - red
  63: '#FBBF24',  // weightlifting - amber
  64: '#60A5FA',  // pickleball - blue
  71: '#60A5FA',  // spinning - blue
  82: '#A78BFA',  // yoga - violet
  84: '#2DD4BF',  // rowing - teal
  85: '#34D399',  // walking - emerald
  87: '#A78BFA',  // barre - violet
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

/**
 * Get sport name. Prefers the Whoop-provided sport_name (user label),
 * falls back to our sport_id mapping.
 * Can be called as getSportName(sportId) or getSportName(sportId, record)
 */
export function getSportName(sportId, record) {
  // If the raw Whoop record has sport_name, use it (this is what the user labeled it)
  if (record?.sport_name && record.sport_name.toLowerCase() !== 'activity') {
    // Capitalize first letter of each word
    return record.sport_name
      .split(/[\s_]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  // Check our mapping
  const mapped = SPORT_ID_MAP[sportId];
  if (mapped && mapped !== 'Activity') return mapped;
  // Fallback: try to infer from metrics
  if (record?.score?.distance_meter > 500) return 'Cardio';
  return 'Workout';
}

// Name-based icon fallback for when sport_id doesn't match but sport_name does
const SPORT_NAME_ICON_MAP = {
  'running': Footprints,
  'cycling': Bike,
  'swimming': Waves,
  'weightlifting': WeightliftingIcon,
  'weight training': WeightliftingIcon,
  'functional fitness': Zap,
  'pickleball': PickleballIcon,
  'tennis': RacquetIcon,
  'basketball': BasketballIcon,
  'hiit': Zap,
  'crossfit': Zap,
  'yoga': PersonStanding,
  'pilates': PersonStanding,
  'hiking': Mountain,
  'walking': Footprints,
  'spinning': Bike,
  'rowing': Waves,
  'boxing': Target,
};

/**
 * Returns the icon COMPONENT for a sport.
 * Usage: const Icon = getSportIcon(sportId, record); <Icon size={18} />
 */
export function getSportIcon(sportId, record) {
  // Try sport_id first
  if (SPORT_ICON_MAP[sportId]) return SPORT_ICON_MAP[sportId];
  // Try sport_name fallback
  if (record?.sport_name) {
    const name = record.sport_name.toLowerCase();
    for (const [key, icon] of Object.entries(SPORT_NAME_ICON_MAP)) {
      if (name.includes(key)) return icon;
    }
  }
  return HeartPulse;
}

export function getSportColor(sportId) {
  return SPORT_COLORS[sportId] ?? '#60A5FA';
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
