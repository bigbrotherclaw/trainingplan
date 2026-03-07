/**
 * Custom sport icons matching lucide-react style:
 * - 24x24 viewBox
 * - stroke-based (no fill)
 * - strokeWidth={2} by default
 * - strokeLinecap="round" strokeLinejoin="round"
 * - Accept size, color, strokeWidth, className props like lucide icons
 */

// Pickleball paddle + ball
export function PickleballIcon({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Paddle head (oval) */}
      <ellipse cx="10" cy="9" rx="6" ry="7" />
      {/* Paddle handle */}
      <line x1="14" y1="14" x2="19" y2="19" />
      <line x1="17" y1="17" x2="19.5" y2="19.5" />
      {/* Holes on paddle face */}
      <circle cx="8" cy="7" r="0.8" fill={color} stroke="none" />
      <circle cx="11" cy="7" r="0.8" fill={color} stroke="none" />
      <circle cx="8" cy="10" r="0.8" fill={color} stroke="none" />
      <circle cx="11" cy="10" r="0.8" fill={color} stroke="none" />
      {/* Ball */}
      <circle cx="20" cy="5" r="2" />
    </svg>
  );
}

// Barbell / weightlifting icon (more distinctive than lucide's dumbbell)
export function WeightliftingIcon({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Bar */}
      <line x1="2" y1="12" x2="22" y2="12" />
      {/* Left weight plates */}
      <rect x="3" y="6" width="2.5" height="12" rx="0.8" />
      <rect x="6" y="8" width="2" height="8" rx="0.5" />
      {/* Right weight plates */}
      <rect x="18.5" y="6" width="2.5" height="12" rx="0.8" />
      <rect x="16" y="8" width="2" height="8" rx="0.5" />
    </svg>
  );
}

// Tennis/racquet icon (for racquet sports)
export function RacquetIcon({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Racquet head */}
      <ellipse cx="11" cy="8" rx="5.5" ry="6.5" />
      {/* Strings horizontal */}
      <line x1="6.5" y1="6" x2="15.5" y2="6" />
      <line x1="5.8" y1="9" x2="16.2" y2="9" />
      {/* Strings vertical */}
      <line x1="9" y1="2" x2="9" y2="14" />
      <line x1="13" y1="2" x2="13" y2="14" />
      {/* Handle */}
      <line x1="11" y1="14.5" x2="11" y2="22" />
      <line x1="9.5" y1="18" x2="12.5" y2="18" />
    </svg>
  );
}

// Basketball icon
export function BasketballIcon({ size = 24, color = 'currentColor', strokeWidth = 2, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      {/* Horizontal seam */}
      <line x1="2" y1="12" x2="22" y2="12" />
      {/* Vertical seam */}
      <line x1="12" y1="2" x2="12" y2="22" />
      {/* Curved seams */}
      <path d="M5.5 5.5 C 9 8, 9 16, 5.5 18.5" />
      <path d="M18.5 5.5 C 15 8, 15 16, 18.5 18.5" />
    </svg>
  );
}
