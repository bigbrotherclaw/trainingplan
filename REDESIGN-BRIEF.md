# Training App Redesign Brief

## Current Problems
1. Dark mode looks unprofessional — generic dark gray, no personality
2. Data visualizations are confusing rather than helpful
3. No adaptive workout capability
4. No multi-user support
5. No storytelling with data — just charts for the sake of charts

---

## Design Direction: Premium Fitness App

### Visual Identity — Inspired by Hevy, Caliber, WHOOP, Apple Fitness+

**Color System:**
- **Primary background:** True black (#000000) or near-black (#0A0A0A), not slate gray
- **Card surfaces:** Subtle elevated surfaces with ultra-thin borders (#1A1A1A with 1px #ffffff08 border)
- **Accent system:** One primary brand color (electric blue #3B82F6 or vibrant emerald #10B981) used sparingly — buttons, active states, progress indicators
- **Workout type colors:** Muted, sophisticated palette — not garish. Think pastels on dark:
  - Strength: warm amber/gold (#F59E0B)
  - Cardio: cool teal (#14B8A6)
  - HIC: electric purple (#8B5CF6)
  - Rest: soft gray (#6B7280)
- **Text hierarchy:** Pure white for headings, 70% white for body, 40% white for secondary

**Typography:**
- System font (SF Pro on iOS) with clear weight hierarchy
- Large, confident headings (24-28px semibold)
- Generous spacing — let content breathe
- No cramped layouts

**Motion & Feel:**
- Subtle spring animations (not bouncy, just responsive)
- Page transitions: smooth fade + slight slide (200ms)
- Progress rings animate on mount
- Cards have subtle scale-on-press feedback (0.98)

**Layout Principles:**
- Bottom sheet modals instead of full page navigations for quick actions
- Sticky headers that blur-fade the content behind them (frosted glass effect)
- Card-based layout with consistent 16px padding, 12px gaps
- Single-column mobile, no horizontal scrolling

---

## Data Visualization Redesign — Tell a Story, Don't Just Show Numbers

### Key Principle: Every chart should answer ONE question at a glance

**Remove/Replace:**
- Kill the radar chart (nobody reads these intuitively)
- Kill the GitHub-style heatmap (too small on mobile, not actionable)
- Kill the HIC distribution donut (nice-to-have, not useful)
- Simplify the muscle heatmap (cool but too complex)

**Keep & Elevate:**
- E1RM trend lines → Make them THE hero visualization
- Compliance ring → Apple Watch style, front and center on dashboard

**New Data Stories:**

1. **"Your Week" Summary Card** (Dashboard)
   - Simple horizontal progress bar: 4/6 workouts done
   - Color-coded dots for each day (completed = solid, upcoming = outline, missed = red)
   - One motivational stat: "You've lifted 24,500 lbs this week" or "12.5 miles covered"

2. **"Strength Journey" (Stats Hero)**
   - Large, clean line chart — ONE lift at a time (swipeable tabs: Bench | Squat | Pull-up)
   - Show: actual weight dots + E1RM trend line + target line
   - Below: personal best callout card with date
   - Time range toggle: 4W / 3M / 6M / ALL

3. **"Volume This Week" (Simple Bar)**
   - 7 vertical bars (Sun-Sat), height = total tonnage
   - Color = workout type
   - Today's bar highlighted
   - Clean axis labels, no gridlines

4. **"Body Balance" (Simplified Muscle View)**
   - Instead of SVG body diagram: horizontal bar chart of muscle groups
   - Sorted by volume (most trained at top)
   - Color gradient from green (balanced) to yellow (undertrained)
   - Simple, scannable, actionable

5. **"Streak & Consistency"**
   - Current streak number (big, bold)
   - Best streak ever
   - Last 12 weeks as small colored squares (like a mini calendar)

---

## Adaptive Workouts — "I'm Not Feeling It"

### Mood/Energy Check-In
When user opens today's workout, show a quick energy check:

**"How are you feeling?"**
- 🔥 Ready to go (100% intensity)
- 💪 Good but not great (80% intensity)
- 😐 Low energy (60% intensity — deload style)
- 🤕 Recovery day (active recovery alternatives)

### What Changes Per Level:

**Strength at 80%:**
- Same exercises, reduce weight to 85% of programmed
- Drop accessory volume (2 sets instead of 3)

**Strength at 60%:**
- Drop to 2 main lifts instead of 3
- Use lighter loading (week 1 percentages regardless of current week)
- Keep accessories as active recovery (lighter weight, higher reps)

**Recovery Day:**
- Replace strength with: mobility work, foam rolling routine, light cardio
- Replace HIC with: easy 20-min walk/bike
- Provide a structured "recovery workout" template

**Tri/Cardio adjustments:**
- Scale distances/durations down proportionally
- Suggest easier alternatives (bike instead of run, etc.)

### "Swap This Workout" Feature
- Different from energy scaling — this is "I want to do something else entirely"
- Show 3 alternative workouts that maintain weekly balance:
  - Same muscle groups, different exercises
  - Different modality, similar training effect
  - "Make it fun" — suggest a sport/activity that counts

---

## Multi-User / Auth System

### Architecture:
- **Supabase** (free tier) for auth + database
  - Email/password + Google OAuth
  - Row-level security per user
  - PostgreSQL for workout history, settings, user profiles
- **Migration path:** current localStorage data can be "claimed" on first login
- Keep the app working offline (localStorage cache + sync when online)

### User Features:
- Personal profile with avatar
- Own 1RM settings, training preferences, workout history
- Private by default — no social features initially
- Data export per user

### Share Plan Feature (future):
- User can share their training plan template with friends
- Friends can fork it and customize
- Optional: leaderboard within a friend group

---

## Tech Stack Updates
- Keep: React 19, Vite, Tailwind, Framer Motion, Recharts
- Add: Supabase (auth + DB), @supabase/supabase-js
- Replace: @nivo (unused, heavy) → remove
- Replace: @dnd-kit → simpler touch gesture handling for swaps
- Add: Tailwind CSS animate plugin for micro-interactions

---

## Implementation Phases

### Phase 1: Visual Redesign + Data Story
- New color system, typography, spacing
- Dashboard redesign with "Your Week" card
- Strength Journey chart (hero viz)
- Remove confusing charts
- Energy check-in on workout page

### Phase 2: Adaptive Workouts
- Energy-scaled workouts
- "Swap This Workout" alternatives
- Recovery day templates

### Phase 3: Multi-User
- Supabase integration
- Auth flow (sign up, login, forgot password)
- Migrate localStorage to Supabase with offline sync
- User profiles

### Phase 4: Social
- Share plan with friends
- Group leaderboards
- Achievement badges
