/**
 * Custom SVG icons for main lifts.
 * Simple, clean silhouettes optimized for small sizes (16-24px).
 */

export function BenchPressIcon({ size = 20, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Bench */}
      <rect x="6" y="16" width="12" height="2" rx="0.5" fill={color} opacity="0.3" />
      <line x1="8" y1="18" x2="8" y2="21" />
      <line x1="16" y1="18" x2="16" y2="21" />
      {/* Person lying down */}
      <circle cx="12" cy="13" r="1.5" fill={color} opacity="0.5" />
      {/* Barbell above */}
      <line x1="2" y1="8" x2="22" y2="8" />
      {/* Plates */}
      <rect x="1" y="5.5" width="2.5" height="5" rx="0.8" fill={color} opacity="0.7" />
      <rect x="20.5" y="5.5" width="2.5" height="5" rx="0.8" fill={color} opacity="0.7" />
      {/* Arms pushing up */}
      <line x1="9" y1="12" x2="7" y2="8" />
      <line x1="15" y1="12" x2="17" y2="8" />
    </svg>
  );
}

export function SquatIcon({ size = 20, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Head */}
      <circle cx="12" cy="4" r="2" fill={color} opacity="0.5" />
      {/* Barbell across shoulders */}
      <line x1="3" y1="8" x2="21" y2="8" />
      {/* Plates */}
      <rect x="1.5" y="5.5" width="2.5" height="5" rx="0.8" fill={color} opacity="0.7" />
      <rect x="20" y="5.5" width="2.5" height="5" rx="0.8" fill={color} opacity="0.7" />
      {/* Torso */}
      <line x1="12" y1="7" x2="12" y2="14" />
      {/* Arms holding bar */}
      <line x1="8" y1="8" x2="10" y2="11" />
      <line x1="16" y1="8" x2="14" y2="11" />
      {/* Legs in squat position */}
      <line x1="12" y1="14" x2="8" y2="18" />
      <line x1="12" y1="14" x2="16" y2="18" />
      {/* Feet */}
      <line x1="8" y1="18" x2="7" y2="21" />
      <line x1="16" y1="18" x2="17" y2="21" />
    </svg>
  );
}

export function PullUpIcon({ size = 20, color = 'currentColor', className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Pull-up bar */}
      <line x1="3" y1="3" x2="21" y2="3" />
      {/* Bar supports */}
      <line x1="4" y1="1" x2="4" y2="5" />
      <line x1="20" y1="1" x2="20" y2="5" />
      {/* Head */}
      <circle cx="12" cy="6.5" r="1.8" fill={color} opacity="0.5" />
      {/* Arms gripping bar */}
      <line x1="8" y1="3" x2="9.5" y2="6" />
      <line x1="16" y1="3" x2="14.5" y2="6" />
      {/* Torso */}
      <line x1="12" y1="8.5" x2="12" y2="16" />
      {/* Legs hanging */}
      <line x1="12" y1="16" x2="10" y2="22" />
      <line x1="12" y1="16" x2="14" y2="22" />
    </svg>
  );
}

// Map lift names to icons
const LIFT_ICON_MAP = {
  'Bench Press': BenchPressIcon,
  'Back Squat': SquatIcon,
  'Weighted Pull-up': PullUpIcon,
};

export function getLiftIcon(liftName) {
  return LIFT_ICON_MAP[liftName] || null;
}

export function LiftIcon({ name, size = 18, color = 'currentColor', className = '' }) {
  const Icon = LIFT_ICON_MAP[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} className={className} />;
}
