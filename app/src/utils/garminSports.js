import {
  Footprints,
  Bike,
  Waves,
  Zap,
  PersonStanding,
  Activity,
  HeartPulse,
  Mountain,
  Target,
  Dumbbell,
} from 'lucide-react';

// Garmin typeKey → human-readable name
const TYPE_KEY_NAME_MAP = {
  running: 'Run',
  trail_running: 'Trail Run',
  treadmill_running: 'Treadmill Run',
  track_running: 'Track Run',
  cycling: 'Ride',
  indoor_cycling: 'Indoor Ride',
  mountain_biking: 'Mountain Bike',
  lap_swimming: 'Swim',
  open_water_swimming: 'Open Water Swim',
  pool_swimming: 'Swim',
  strength_training: 'Strength',
  hiking: 'Hike',
  walking: 'Walk',
  yoga: 'Yoga',
  pilates: 'Pilates',
  elliptical: 'Elliptical',
  stair_climbing: 'Stair Climb',
  rowing: 'Row',
  indoor_rowing: 'Indoor Row',
  swimming: 'Swim',
  triathlon: 'Triathlon',
  multisport: 'Multisport',
  cross_country_skiing: 'XC Ski',
  downhill_skiing: 'Ski',
  snowboarding: 'Snowboard',
  rock_climbing: 'Climb',
  bouldering: 'Boulder',
  kickboxing: 'Kickboxing',
  boxing: 'Boxing',
  surfing: 'Surf',
  paddleboarding: 'SUP',
  kayaking: 'Kayak',
  tennis: 'Tennis',
  pickleball: 'Pickleball',
  basketball: 'Basketball',
  soccer: 'Soccer',
  golf: 'Golf',
  hiit: 'HIIT',
  cardio: 'Cardio',
  breathwork: 'Breathwork',
  meditation: 'Meditation',
  other: 'Activity',
  fitness_equipment: 'Gym',
  navigate: 'Navigate',
};

// Garmin typeKey → icon component
const TYPE_KEY_ICON_MAP = {
  running: Footprints,
  trail_running: Mountain,
  treadmill_running: Footprints,
  track_running: Footprints,
  cycling: Bike,
  indoor_cycling: Bike,
  mountain_biking: Bike,
  lap_swimming: Waves,
  open_water_swimming: Waves,
  pool_swimming: Waves,
  swimming: Waves,
  strength_training: Dumbbell,
  hiking: Mountain,
  walking: Footprints,
  yoga: PersonStanding,
  pilates: PersonStanding,
  elliptical: Activity,
  rowing: Waves,
  indoor_rowing: Waves,
  rock_climbing: Mountain,
  bouldering: Mountain,
  boxing: Target,
  kickboxing: Target,
  surfing: Waves,
  paddleboarding: Waves,
  kayaking: Waves,
  hiit: Zap,
  cardio: HeartPulse,
  meditation: PersonStanding,
};

// Garmin typeKey → accent color
const TYPE_KEY_COLOR_MAP = {
  running: '#34D399',
  trail_running: '#34D399',
  treadmill_running: '#34D399',
  track_running: '#34D399',
  cycling: '#60A5FA',
  indoor_cycling: '#60A5FA',
  mountain_biking: '#60A5FA',
  lap_swimming: '#22D3EE',
  open_water_swimming: '#22D3EE',
  pool_swimming: '#22D3EE',
  swimming: '#22D3EE',
  strength_training: '#FBBF24',
  hiking: '#34D399',
  walking: '#34D399',
  yoga: '#A78BFA',
  pilates: '#A78BFA',
  elliptical: '#60A5FA',
  rowing: '#2DD4BF',
  indoor_rowing: '#2DD4BF',
  rock_climbing: '#F59E0B',
  bouldering: '#F59E0B',
  boxing: '#F87171',
  kickboxing: '#F87171',
  surfing: '#22D3EE',
  paddleboarding: '#22D3EE',
  kayaking: '#22D3EE',
  hiit: '#F87171',
  cardio: '#F87171',
  meditation: '#A78BFA',
};

/**
 * Get human-readable name for a Garmin activity.
 * Uses activityName from the activity if meaningful, otherwise maps typeKey.
 */
export function getGarminActivityName(activity) {
  const typeKey = activity?.activityType?.typeKey;
  // If the activity has a custom name that's different from the type, prefer it
  if (activity?.activityName && activity.activityName !== 'Untitled') {
    return activity.activityName;
  }
  return TYPE_KEY_NAME_MAP[typeKey] || 'Activity';
}

/**
 * Returns the icon component for a Garmin activity typeKey.
 * Usage: const Icon = getGarminActivityIcon(activity); <Icon size={18} />
 */
export function getGarminActivityIcon(activity) {
  const typeKey = activity?.activityType?.typeKey;
  return TYPE_KEY_ICON_MAP[typeKey] || HeartPulse;
}

/**
 * Returns the accent color for a Garmin activity typeKey.
 */
export function getGarminActivityColor(activity) {
  const typeKey = activity?.activityType?.typeKey;
  return TYPE_KEY_COLOR_MAP[typeKey] || '#007dff';
}

/**
 * Format duration in seconds to human-readable.
 */
export function formatGarminDuration(seconds) {
  if (!seconds) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Convert meters to miles, 1 decimal.
 */
export function garminMetersToMiles(meters) {
  if (!meters) return null;
  return (meters * 0.000621371).toFixed(1);
}
