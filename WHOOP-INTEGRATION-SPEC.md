# Whoop Recovery Integration — Design Spec

## Overview
Integrate Whoop recovery data into the app's core flow. Recovery data should inform — not dictate — the daily workout. Users see smart suggestions they can accept or dismiss.

## Recovery Advisor Engine (`src/utils/recoveryAdvisor.js`)

### Input
- `latestRecovery` — Whoop recovery object (score 0-100, HRV, resting HR)
- `latestSleep` — Whoop sleep object (sleep score, duration, stages)
- `latestCycle` — Whoop cycle/strain object (day strain, calories)
- `todayWorkout` — The scheduled workout from WEEKLY_TEMPLATE
- `workoutHistory` — Recent workout history (for load context)
- `settings` — User settings (1RMs, week, block)

### Recovery Zones
- **Green (67-100%)**: Full send. No modifications needed.
- **Yellow (34-66%)**: Moderate recovery. Suggest intensity reduction.
- **Red (0-33%)**: Poor recovery. Suggest significant modification or swap.

### Output: `RecoverySuggestion` object
```js
{
  zone: 'green' | 'yellow' | 'red',
  score: number,           // 0-100 recovery score
  hrv: number,             // HRV value
  sleepScore: number,      // 0-100
  headline: string,        // e.g. "Recovery is low — consider scaling back"
  suggestion: string,      // Detailed suggestion text
  modifications: {
    type: 'none' | 'reduce_intensity' | 'reduce_volume' | 'swap_to_cardio' | 'swap_to_recovery',
    intensityMultiplier: number,  // e.g. 0.85 for 85%
    volumeMultiplier: number,     // e.g. 0.6 for 60% sets
    suggestedEnergyLevel: string, // maps to existing energy levels: 'ready'|'good'|'low'|'recovery'
  },
  dismissed: false,        // user can dismiss
}
```

### Logic Rules

**Strength days:**
- Green: "You're recovered. Full intensity today." → no changes
- Yellow (50-66): "Recovery is moderate. Consider dropping to 85% intensity." → intensityMultiplier: 0.85, suggestedEnergyLevel: 'good'
- Yellow (34-49): "Recovery is below average. Reduce volume — 2 main lifts, lighter load." → intensityMultiplier: 0.75, volumeMultiplier: 0.66, suggestedEnergyLevel: 'low'
- Red: "Recovery is poor. Swap to active recovery or light cardio." → suggestedEnergyLevel: 'recovery'

**Tri/cardio days:**
- Green: Full prescribed workout
- Yellow: "Scale cardio effort to Zone 2, skip or lighten HIC"
- Red: "Swap to easy 30-min walk or full rest"

**Rest days:**
- Green with 3+ consecutive rest-ish days: "Recovery is high — you could add a light session if you want"
- Otherwise: "Good call resting. Recovery score: X%"

**Sleep factor:**
- Sleep score < 50 bumps suggestion one tier more conservative regardless of recovery
- Sleep < 6 hours: always suggest at minimum 'good' energy level

**Consecutive strain:**
- If last 3 days all had workouts logged AND recovery < 60: prioritize rest suggestion

### Export
```js
export function getRecoverySuggestion({ latestRecovery, latestSleep, latestCycle, todayWorkout, workoutHistory, settings })
```

---

## Dashboard Redesign (`src/pages/Dashboard.jsx`)

### New Layout (top to bottom):

1. **Recovery Banner** (NEW — only when Whoop connected)
   - Full-width card at the very top
   - Left side: large recovery score number with colored arc/ring (green/yellow/red)
   - Right side: HRV value, sleep score, strain from yesterday
   - Subtle gradient background matching recovery zone color
   - Tap to expand → shows more detail (sleep duration, RHR, etc.)

2. **Recovery Suggestion Card** (NEW — only when suggestion.type !== 'none')
   - Appears below recovery banner
   - Shows headline + suggestion text
   - Two buttons: "Accept" (applies modifications) and "Dismiss" (keeps original workout)
   - Accept stores the suggestion in state; Workout page reads it
   - Animated entrance, can be swiped away

3. **Your Week** (existing, unchanged)

4. **Today's Workout** (existing, modified)
   - If suggestion was accepted, show modified workout details with a small "Recovery adjusted" badge
   - "Start Workout" button still works the same

5. **Stats Row** (existing, unchanged)

6. **Weekly Compliance** (existing, can remove — redundant with week strip)

### Whoop Data Display Style:
- Recovery score: large number, colored by zone
- HRV: small label + value
- Sleep: small label + value + optional "X hrs Y min" duration
- Use existing card style: `bg-[#141414] rounded-2xl border border-white/[0.10]`
- Recovery zone colors: green=#10B981, yellow=#F59E0B, red=#EF4444

---

## Workout Page Integration (`src/pages/Workout.jsx`)

### Changes:
1. When Whoop data available AND suggestion was accepted on Dashboard:
   - Pre-select the suggested energy level in the energy modal
   - Show a small banner: "Adjusted based on your Whoop recovery (67%)"
   - Apply intensity/volume multipliers to the prescribed workout

2. If suggestion was NOT accepted (dismissed or no Whoop):
   - Everything works exactly as before (manual energy selection)

3. The existing energy modal still appears — Whoop just pre-selects one option
   - User can always override the suggestion

### State Management:
- Store accepted suggestion in AppContext (or a new WhoopContext)
- `acceptedSuggestion` — the RecoverySuggestion if user tapped "Accept"
- Clear it at end of day or after workout is logged

---

## Files to Create/Modify:
- CREATE: `src/utils/recoveryAdvisor.js` — the brain
- MODIFY: `src/pages/Dashboard.jsx` — add recovery banner + suggestion card
- MODIFY: `src/pages/Workout.jsx` — read accepted suggestion, pre-fill energy
- MODIFY: `src/context/AppContext.jsx` — add acceptedSuggestion state
- KEEP: `src/hooks/useWhoop.js` — already done, provides all data
- KEEP: `src/pages/SettingsPage.jsx` — Whoop connect/disconnect stays here
