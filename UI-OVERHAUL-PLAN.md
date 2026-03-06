# UI Overhaul Plan

## Agent 1: Dashboard — Recovery Data Display + Layout Polish
File: `app/src/pages/Dashboard.jsx`

### Recovery Banner Overhaul
- Show ALL Whoop metrics in expanded view: Recovery %, HRV (rounded to 1 decimal), RHR, Sleep Performance %, Sleep Duration (Xh Xm), Strain, SpO2
- Format HRV: `Math.round(hrv * 10) / 10` (one decimal place)
- Add units/labels: "HRV ms", "Sleep 82%", "RHR 64 bpm", "Strain 5.3"
- Add qualitative zone label next to score: "49% · Fair" / "72% · Good" / "28% · Poor"
- Use subtle colored background gradient based on zone
- Make expanded section a proper 2x3 or 3x2 grid of metric tiles

### Layout Fixes
- All sections wrapped in cards with `bg-[#141414] rounded-2xl border border-white/[0.10]` ✓ (already done)
- Consistent `px-4` on outer container ✓ 
- Week day circles: ensure they fit within card padding, not clipping edges
- Stats row: reduce number font from 28px to 22px when showing zeros (empty state)
- Weekly Compliance ring: reduce from size={100} to size={80}, add compact empty state
- Consistent vertical spacing: `space-y-4` between all cards
- Section headers: unified `text-xs uppercase tracking-widest text-[#555555] font-semibold`

### Suggestion Card
- Keep Accept/Dismiss buttons
- Show what specifically changes: "Reduce to 85% intensity" or "Swap to recovery session"

## Agent 2: Workout Page — Recovery Adjustments Display + Polish  
File: `app/src/pages/Workout.jsx`

### Recovery-Aware Workout Display
- When acceptedSuggestion is active, show a compact recovery banner at top of workout:
  - Zone color dot + "Recovery 49% · Adjusted to 85% intensity"
  - Small dismiss/override button
- For strength workouts with intensity multiplier: show adjusted weights inline
  e.g., "Bench Press: 185 lbs → 157 lbs (85%)"
- For cardio with reduced intensity: show "Zone 2 effort recommended"
- For recovery swap: show the recovery session checklist (already exists)

### Layout Fixes  
- Ensure lift rows have consistent spacing
- Accessories section properly indented
- Energy level selection modal: round the Whoop recovery display values

## Agent 3: Settings Page — Whoop Data Display + Scroll Fix
File: `app/src/pages/SettingsPage.jsx`

### Whoop Section Enhancement
- Show more data when connected: Recovery %, HRV, RHR, Sleep %, Strain
- Use the same metric tile style as Dashboard
- Add "Last synced: X minutes ago" timestamp
- Fix v2 API field access (already partially done)

### Scroll Fix
- Ensure the page scrolls properly on iOS
- Test all cards render without overflow issues
