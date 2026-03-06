# TB Operator — iOS Design Spec v2
## Based on: Apple HIG, Hevy, Strava, Apple Fitness+, Strong App

---

## Research Sources
- **Apple HIG Layout**: 16pt standard margins, safe area insets mandatory, 44pt min touch targets
- **Apple HIG Typography**: SF Pro, Large Title 34pt, Title 28pt, Headline 17pt Bold, Body 17pt, Subhead 15pt, Caption 12pt, Tab bar labels 10pt
- **Hevy App** (top workout tracker): Dark cards with subtle elevation, generous 16-20px card padding, each exercise in its own card, set/rep inputs in a clean table grid, frosted glass nav
- **Strava**: Hero stats up top (big numbers), activity cards with generous whitespace, accent color pops on dark bg, smooth micro-animations
- **Apple Fitness+**: Ring visualizations (thin, elegant), gradient accent colors, full-bleed hero cards, rounded 16pt corners, summary stats in horizontal scroll chips
- **Strong App Redesign Case Study**: Exercise cards with clear visual hierarchy, bold exercise names, muted set metadata, proper spacing between sets

---

## Typography Scale (iOS points → CSS px at 1x)

| Style | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| Large Title | 34px | Bold | 41px | Page titles |
| Title 1 | 28px | Bold | 34px | Section titles |
| Title 2 | 22px | Bold | 28px | Card titles |
| Headline | 17px | Semibold | 22px | List item titles |
| Body | 17px | Regular | 22px | Default text |
| Subhead | 15px | Regular | 20px | Secondary text |
| Footnote | 13px | Regular | 18px | Tertiary info |
| Caption | 12px | Regular | 16px | Labels, metadata |
| Tab Label | 10px | Medium | — | Tab bar |

**Current app uses text-sm (14px) for almost everything.** Need to bump to 17px body, 15px secondary.

---

## Spacing System (8pt grid)

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Inline spacing, icon gaps |
| sm | 8px | Between related items |
| md | 12px | Between list rows |
| lg | 16px | Card internal padding, section gaps |
| xl | 20px | Page side margins, card-to-card gaps |
| 2xl | 24px | Section separators |
| 3xl | 32px | Major section breaks |

**Current app uses ~8-12px everywhere.** Need 20px side margins, 16-20px card padding, 16-20px card gaps.

---

## Card System

### Primary Card (main content blocks)
```
bg-[#111111]
rounded-2xl (16px)
border border-white/[0.06]
p-5 (20px internal padding)
```

### Secondary Card (nested within primary, or list items)
```
bg-[#1A1A1A]
rounded-xl (12px)
p-4 (16px internal padding)
```

### Elevated Card (hero/featured content)
```
bg-[#111111]  
rounded-2xl
border border-white/[0.08]
p-6 (24px internal padding)
shadow-lg shadow-black/20
```

---

## Touch Targets
- **Minimum**: 44x44px for all interactive elements
- **Preferred**: 48x48px for primary actions
- **Buttons**: min-h-[48px] with rounded-xl
- **Primary CTA**: min-h-[52px] with rounded-2xl, font-semibold text-base
- **Tab bar items**: min-h-[48px], icon 24px, label 10px

---

## Navigation

### Header (sticky top)
- Height: 44px + safe area inset
- Background: bg-black/80 backdrop-blur-xl
- Title: 17px semibold (not large title — save space)
- Subtitle: 13px text-[#666666]
- Right accessory: 32x32 avatar circle

### Tab Bar (fixed bottom)
- 5 tabs max (Home, Workout, Calendar, Stats, Settings)
- Height: 49px + safe area bottom
- Icon: 24px, label: 10px
- Active: accent blue, Inactive: #666666
- Background: bg-black border-t border-white/[0.06]

---

## Page Layout Template
```jsx
<div className="min-h-screen bg-black">
  {/* Content area */}
  <div className="px-5 pt-4 pb-28 space-y-5">
    {/* Page title */}
    <h1 className="text-[28px] font-bold text-white">Dashboard</h1>
    
    {/* Cards */}
    <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5">
      <h2 className="text-xs uppercase tracking-widest text-[#555555] font-semibold mb-4">
        YOUR WEEK
      </h2>
      {/* Content */}
    </div>
  </div>
</div>
```

---

## Dashboard Design (from Strava + Apple Fitness+)

### Hero Card: Today's Workout
- Full-width elevated card
- Workout type color accent stripe on left edge
- Large workout name (22px bold)
- Date below (15px, #666)
- Big "Start Workout >" CTA (52px height, accent blue, full width)

### Your Week (from Apple Fitness+ rings)
- 7 day circles in a row, evenly spaced
- Today's circle: larger (44px), pulsing accent ring
- Completed: filled with workout type color
- Future: subtle outline ring
- Below: "3 of 6 complete" in 15px

### Stats Row (from Strava)
- Horizontal row of 2-3 stat cards
- Each: big number (28px bold) + small label (12px uppercase)
- Streak | Total Workouts | Compliance %

### Compliance Ring
- Smaller (120x120px), thin elegant stroke
- Centered percentage number
- Below: "This Week" label

---

## Workout Page Design (from Hevy + Strong)

### Overview Mode
- Today's workout as hero card (same as dashboard)
- "Next 5 Workouts" section
- Each upcoming workout in a card with:
  - Day + Date on left (bold day, muted date)
  - Workout type badge on right (colored pill)
  - Exercise list below: • Exercise Name (15px, white)
  - Between cards: 12px gap

### Logging Mode  
- Each exercise in its own card (bg-[#111111])
- Exercise name: 17px semibold
- Set table: clean grid with columns (Set # | Weight | Reps | ✓)
- Each row: 48px height, alternating bg-[#0D0D0D] / bg-[#111111]
- Input fields: bg-[#1A1A1A] rounded-lg px-3 py-2, centered text
- "Add Set" button: text button, accent blue, 44px height

---

## Color Refinement
- Primary BG: #000000
- Card BG: #111111
- Input BG: #1A1A1A
- Elevated BG: #0D0D0D (for alternating rows)
- Border: white/6% (#FFFFFF10)
- Text Primary: #FFFFFF
- Text Secondary: #A0A0A0 (was #B3B3B3 — too bright)
- Text Tertiary: #666666
- Text Muted: #444444
- Accent Blue: #3B82F6
- Strength: #F59E0B
- Cardio/Tri: #14B8A6
- HIC: #8B5CF6
- Long: #10B981
- Rest: #555555
