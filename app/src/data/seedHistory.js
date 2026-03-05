// Seed workout history for week of March 1-5, 2026
// Week 1 loading: 3x5 @ 70%. 1RMs: Bench 245, Squat 325, Pull-up 115
export const SEED_HISTORY = [
  // Monday March 2 - STR A
  {
    date: '2026-03-02T16:30:00.000Z',
    workoutName: 'TB Operator + Accessories A',
    type: 'strength',
    details: {
      lifts: [
        { name: 'Bench Press', weight: 195, reps: 5, setsCompleted: 3 },
        { name: 'Back Squat', weight: 228, reps: 5, setsCompleted: 3 },
        { name: 'Weighted Pull-up', weight: 81, reps: 5, setsCompleted: 3 },
      ],
      accessories: [
        { name: 'Incline DB Press', weight: 55, reps: 8, setsCompleted: 3 },
        { name: 'Weighted Dips', weight: 45, reps: 6, setsCompleted: 3 },
        { name: 'Cable Flye', weight: 30, reps: 10, setsCompleted: 3 },
        { name: 'Hanging Leg Raise', weight: 0, reps: 8, setsCompleted: 3 },
        { name: 'Ab Rollout', weight: 0, reps: 8, setsCompleted: 3 },
      ],
      loading: { sets: 3, reps: 5, percentage: 70 },
    },
  },

  // Tuesday March 3 - Bike + HIC
  {
    date: '2026-03-03T17:00:00.000Z',
    workoutName: 'Swim or Bike + HIC',
    type: 'tri',
    details: {
      cardio: {
        name: 'Turbo Trainer - Sprint Pyramid',
        metrics: {
          avgPower: '185',
          maxPower: '340',
          distance: '12.5',
          totalTime: '45',
          avgHR: '148',
          notes: 'Felt strong on the sprints. Legs fresh.',
        },
      },
      hic: {
        name: 'Meat Eater II',
        category: 'Aerobic-Anaerobic',
        metrics: {
          kbWeight: '53',
          rounds: '10',
          totalTime: '18',
          notes: '10 KB swings + 10 burpees x10 rounds.',
        },
      },
    },
  },

  // Wednesday March 4 - STR B
  {
    date: '2026-03-04T16:15:00.000Z',
    workoutName: 'TB Operator + Accessories B',
    type: 'strength',
    details: {
      lifts: [
        { name: 'Bench Press', weight: 195, reps: 5, setsCompleted: 3 },
        { name: 'Back Squat', weight: 228, reps: 5, setsCompleted: 3 },
        { name: 'Weighted Pull-up', weight: 81, reps: 5, setsCompleted: 3 },
      ],
      accessories: [
        { name: 'Barbell Row', weight: 185, reps: 5, setsCompleted: 3 },
        { name: 'Face Pulls', weight: 40, reps: 15, setsCompleted: 3 },
        { name: 'Barbell Curl', weight: 85, reps: 6, setsCompleted: 3 },
        { name: 'Tricep Pushdown', weight: 60, reps: 8, setsCompleted: 3 },
        { name: 'Hanging Knee Raise', weight: 0, reps: 8, setsCompleted: 3 },
      ],
      loading: { sets: 3, reps: 5, percentage: 70 },
    },
  },

  // Thursday March 5 - Run + HIC
  {
    date: '2026-03-05T16:00:00.000Z',
    workoutName: 'Run + HIC',
    type: 'tri',
    details: {
      cardio: {
        name: 'Track Reps - 1200m',
        metrics: {
          reps: '3',
          bestSplit: '4:42',
          avgPace: '6:15',
          avgHR: '162',
          distance: '3.5',
          totalTime: '42',
          notes: 'Good track session. Hit target paces on all 3 reps.',
        },
      },
      hic: {
        name: 'GC 2 Descending Ladder',
        category: 'General Conditioning',
        metrics: {
          rounds: '10',
          totalTime: '22',
          notes: 'Pull-ups/burpees/squat jumps/plyo push-ups 10-to-1. Finished in 22 min.',
        },
      },
    },
  },
];
