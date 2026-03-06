# Design Spec V2 — Novel Visualizations + Whoop Data

## Research Sources
- **Nivo** (nivo.rocks): 30+ chart types including RadialBar, Stream, Bump, AreaBump, Calendar heatmap, Waffle, Swarm, TimeRange
- **Visx** (Airbnb): Low-level D3+React primitives for fully custom viz, gradient defs, threshold areas, radial charts
- **React Graph Gallery**: "Viz from the future" patterns — glowing edges, neon gradients, animated paths, CSS filter glow
- **Recharts** (current): Good for standard line/bar/area, but limited for novel viz
- **Apple Fitness+**: Concentric activity rings, gradient fills, weekly trend sparklines
- **Whoop App**: Recovery gauge (green/yellow/red gradient), strain day gauge (0-21), sleep architecture stacked bars
- **Oura Ring**: Readiness score with radial progress, sleep stages timeline, trend arrows
- **Strava**: Sparklines on activity cards, elevation gradient fills, relative effort zones

## Library Recommendation

### Keep: Recharts (for standard charts)
- E1RM line charts, volume bars, basic trends — already working

### Add: @nivo/radial-bar + @nivo/calendar + @nivo/stream
- **RadialBar**: Perfect for Recovery score gauge (0-100%), sleep score, strain level
- **Calendar**: GitHub-style heatmap but with Whoop recovery color coding (green→yellow→red)
- **Stream**: Stacked area showing training load distribution over time (strength vs cardio vs HIC)

### Add: Custom SVG + Framer Motion (already have Framer)
- Animated gauge needles, glowing arcs, pulsing dots
- CSS filter: `drop-shadow(0 0 8px rgba(59,130,246,0.5))` for glow effects
- SVG gradient definitions for premium feel

---

## Novel Visualization Concepts

### 1. Recovery Gauge (Whoop Data)
**Inspiration**: Whoop app's color-coded recovery, car speedometer gauges
**Implementation**: Custom SVG arc (180° or 270°) with gradient stroke:
- 0-33%: Red (#EF4444) → Orange 
- 34-66%: Orange → Yellow (#F59E0B)
- 67-100%: Yellow → Green (#10B981)
- Animated needle/pointer using Framer Motion
- Big centered number: "78%" with color matching zone
- Below: "HRV: 65ms | RHR: 52bpm"
- Subtle glow effect on the arc using CSS filter

### 2. Sleep Architecture Timeline (Whoop Data)
**Inspiration**: Whoop/Oura sleep stage visualizations, EEG hypnograms
**Implementation**: Horizontal stacked timeline showing a single night:
- Y-axis (inverted): Awake → REM → Light → Deep (top to bottom)
- X-axis: Time (11pm → 7am)
- Color blocks: Awake=#EF4444, REM=#8B5CF6 (purple), Light=#3B82F6 (blue), Deep=#1E3A5F (dark blue)
- Smooth curved transitions between stages (not harsh rectangles)
- Below: duration bars showing time in each stage
- **Novel touch**: Add a subtle "sleep quality gradient" background — darker = deeper sleep

### 3. Readiness Score Ring (Composite)
**Inspiration**: Apple Fitness+ activity rings, Oura readiness
**Implementation**: Concentric rings showing 3 dimensions:
- Outer ring: Recovery % (Whoop) — green/yellow/red gradient
- Middle ring: Sleep quality % — blue gradient  
- Inner ring: Training readiness (computed from recovery + yesterday's strain) — accent blue
- Each ring animated from 0 to value on mount
- Center: Overall readiness score with emoji indicator
- Tap to expand into detailed breakdown

### 4. Training Load Stream Chart (Novel)
**Inspiration**: Nivo StreamChart, Strava fitness/freshness
**Implementation**: 30-day stream/area chart showing:
- Layers: Strength volume, Cardio distance, HIC intensity, Recovery days
- Each layer flows organically (stream chart, not stacked bars)
- Hover/tap a day to see breakdown
- Rolling 7-day average line overlay
- **Novel touch**: Opacity of each stream layer tied to strain level — heavier training = more opaque

### 5. HRV Trend with Threshold Zones (Whoop Data)
**Inspiration**: Visx threshold chart, medical vital sign monitors
**Implementation**: Line chart of daily HRV with colored background zones:
- Green zone: Above personal baseline (good recovery)
- Yellow zone: Near baseline
- Red zone: Below baseline (stressed/overtrained)
- The area between the line and baseline filled with gradient (green above, red below)
- 7-day rolling average as a thicker overlay line
- Annotations: "Heavy training day" markers, "Rest day" markers

### 6. Weekly Pulse Grid (Novel)
**Inspiration**: GitHub contribution heatmap × Apple Watch activity
**Implementation**: 12-week grid (rows=weeks, cols=days):
- Each cell is a small circle (not square)
- Color: workout type color (amber/teal/purple/green)
- Size: proportional to effort/strain (bigger = harder workout)
- Empty cells: tiny gray dot
- Current week highlighted with a subtle row glow
- **Novel touch**: Connect consecutive workout days with thin lines showing "streaks"

### 7. Strain vs Recovery Scatter (Whoop Data)
**Inspiration**: Scientific scatter plots, sports science load monitoring
**Implementation**: 
- X-axis: Previous day's strain (0-21)
- Y-axis: Next day's recovery (0-100%)
- Each dot = one day, colored by workout type
- Quadrants labeled: "Optimal" (high strain, high recovery), "Overreaching" (high strain, low recovery), etc.
- Trend line showing personal strain-recovery relationship
- **Novel touch**: Dots pulse/glow based on recency — recent data is bright, old data fades

### 8. Body Battery Timeline (Composite)
**Inspiration**: Garmin Body Battery, energy management science
**Implementation**: 24-hour timeline showing estimated energy:
- Starts at recovery % in the morning
- Drops during workouts (proportional to strain)
- Recovers during rest/sleep
- Gradient fill: green (high energy) → red (depleted)
- Workout blocks overlaid as colored markers
- **Novel touch**: Predictive "ghost line" showing expected energy if today's workout is completed

---

## Implementation Priority

### Phase 1: Whoop Connection (Backend)
1. Supabase Edge Functions for OAuth
2. DB schema for tokens + cached data
3. Settings UI: "Connect Whoop" button
4. Data sync hook

### Phase 2: Core Whoop Visualizations
5. Recovery Gauge (custom SVG)
6. Sleep Architecture Timeline
7. HRV Trend with Threshold Zones
8. New "Recovery" tab or section on Dashboard

### Phase 3: Novel Composite Visualizations  
9. Readiness Score Ring (composite)
10. Training Load Stream (Nivo)
11. Strain vs Recovery Scatter
12. Weekly Pulse Grid (enhanced heatmap)

### Phase 4: Advanced
13. Body Battery Timeline
14. Predictive modeling (when to rest, when to push)
15. Social comparisons (anonymized)

---

## New Dependencies
```
@nivo/core @nivo/radial-bar @nivo/stream @nivo/calendar
```
Bundle impact: ~80-120KB gzipped (significant but worth it for the viz quality)
Could mitigate with dynamic imports — only load Nivo on Stats page.
