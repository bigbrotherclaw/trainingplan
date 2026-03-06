# Dúnedain App Roadmap

## Priority 1 — NOW (UI fixes + core UX)

### 1a. Workout Page Redesign — Focus on Today
- Move recovery score + intelligent recommendations to the Workout page (not Dashboard)
- The Workout page should be THE place where Whoop data meets today's training
- Show: recovery score → suggested adjustments → today's workout details
- Remove clutter, focus the page on what you're doing RIGHT NOW

### 1b. Calendar — Drag-to-Swap + Insert Rest Days  
- Calendar page should let you easily move workouts around
- **Insert Rest Day feature**: tap a day → "Insert Rest Day" → all workouts from that day forward shift one day right
- Example: rested Thursday instead of training → mark Thursday as rest → Fri/Sat/Sun workouts all shift right by 1
- Visual: draggable workout cards, clear rest day indicators

### 1c. App Icon
- Source image: `app-icon-source.jpg` (epic arm wrestling painting)
- Generate all required iOS icon sizes from this image
- Update Xcode asset catalog

## Priority 2 — Whoop Activity Import + Strain Correlation

### 2a. Import Whoop Activities
- Pull Whoop workout/activity data (already syncing via whoop-sync)
- Display imported activities alongside logged training plan workouts
- Tie Whoop strain scores to specific workout types (strength, swim, run, HIC)

### 2b. Strain-Workout Correlation Engine
- Build a data model: workout_type + exercises → expected strain
- Over time, learn from personal data: "Your strength days average 12.3 strain"
- Use this to predict strain for upcoming workouts
- Eventually: auto-adjust weekly plan to hit optimal weekly strain targets

## Priority 3 — Garmin Integration
- Similar OAuth flow to Whoop
- Import Garmin workout data (runs, swims, bikes with GPS/pace/HR)
- Merge with Whoop data for comprehensive activity picture
- Garmin API: health.garmin.com developer portal

## Priority 4 — ML-Based Plan Adjustment
- Use accumulated Whoop + Garmin + training log data
- Predict recovery based on planned workouts
- Auto-suggest weekly schedule modifications
- "You have a hard strength day tomorrow and your strain trend is climbing — consider swapping Thursday to Zone 2"
