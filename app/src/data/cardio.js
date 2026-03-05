export const bikeInputFields = [
  { key: 'avgPower', label: 'Avg Power (W)', type: 'number' },
  { key: 'maxPower', label: 'Max Power (W)', type: 'number' },
  { key: 'distance', label: 'Distance (mi)', type: 'number' },
  { key: 'totalTime', label: 'Total Time (min)', type: 'number' },
  { key: 'avgHR', label: 'Avg HR (bpm)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
]

export const runInputFields = [
  { key: 'reps', label: 'Reps/Intervals', type: 'number' },
  { key: 'bestSplit', label: 'Best Split', type: 'text' },
  { key: 'avgPace', label: 'Avg Pace (min/mi)', type: 'text' },
  { key: 'avgHR', label: 'Avg HR (bpm)', type: 'number' },
  { key: 'distance', label: 'Distance (mi)', type: 'number' },
  { key: 'totalTime', label: 'Total Time (min)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
]

export const swimInputFields = [
  { key: 'totalDistance', label: 'Total Distance (yds)', type: 'number' },
  { key: 'totalTime', label: 'Total Time (min)', type: 'number' },
  { key: 'avgPace', label: 'Avg Pace (sec/100y)', type: 'number' },
  { key: 'notes', label: 'Notes', type: 'text' },
]

export const BIKE_PRESETS = [
  {
    name: 'Turbo Trainer - Sprint Pyramid', category: 'Sprint', week: 1, time: '45 min',
    description: 'WARM UP: 10 min easy pedalling with a few harder efforts.\n\nWORK (RPE9 on / RPE4 off):\n15s on / 45s off\n30s on / 30s off\n45s on / 15s off\n30s on / 30s off\n15s on / 45s off\n2 min easy\n\nRepeat for 2 total circuits.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
  {
    name: 'Turbo Trainer - Sprint Pyramid', category: 'Sprint', week: 2, time: '50 min',
    description: 'WARM UP: 10 min easy pedalling with harder efforts.\n\nWORK (RPE9 on / RPE4 off):\n15s on / 45s off\n30s on / 30s off\n45s on / 15s off\n60s on / 60s off\n45s on / 15s off\n30s on / 30s off\n15s on / 45s off\n2 min easy\n\nRepeat for 3 total circuits.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
  {
    name: 'Turbo Trainer - FTP Intervals', category: 'Threshold', week: 3, time: '55 min',
    description: 'WARM UP: 10 min easy pedalling.\n\nWORK:\n4 min at 100% FTP\n1 min recover\n3 min at 110% FTP\n2 min recover\n2 min at 120% FTP\n3 min recover\n\nRepeat 2x through total.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
  {
    name: 'Turbo Trainer - FTP Intervals', category: 'Threshold', week: 4, time: '60 min',
    description: 'WARM UP: 10 min easy pedalling.\n\nWORK:\n4 min at 100% FTP\n1 min recover\n3 min at 110% FTP\n2 min recover\n2 min at 120% FTP\n3 min recover\n1 min at 130-140% FTP\n4 min recover\n\nRepeat 2x through total.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
  {
    name: 'Turbo Trainer - VO2max Blocks', category: 'Threshold', week: 5, time: '60 min',
    description: 'WARM UP: 10 min easy pedalling.\n\nWORK:\n5 min at 100% FTP\n1 min recover\n4 min at 110% FTP\n2 min recover\n3 min at 120% FTP\n2 min recover\n2 min at 130% FTP\n3 min recover\n1 min all-out\n4 min recover\n\nRepeat 2x through total.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
  {
    name: 'Turbo Trainer - Race Simulation', category: 'Threshold', week: 6, time: '65 min',
    description: 'WARM UP: 10 min easy pedalling.\n\nWORK:\n5 min at 105% FTP\n1 min recover\n4 min at 115% FTP\n1 min recover\n3 min at 125% FTP\n2 min recover\n2 min at 135% FTP\n2 min recover\n1 min all-out\n3 min recover\n\nRepeat 3x through total.\n\nCOOL DOWN: 10 min easy pedalling.',
    inputFields: bikeInputFields,
  },
]

export const BIKE_ENDURANCE_PRESETS = [
  { name: 'Endurance Bike', category: 'Endurance', week: 1, time: '70 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 55 min at 65-80% FTP. Steady effort, conversational pace.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
  { name: 'Endurance Bike', category: 'Endurance', week: 2, time: '80 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 65 min at 65-80% FTP. Steady effort, conversational pace.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
  { name: 'Endurance Bike', category: 'Endurance', week: 3, time: '85 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 70 min at 65-85% FTP. Steady effort.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
  { name: 'Endurance Bike', category: 'Endurance', week: 4, time: '90 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 75 min at 65-85% FTP. Push the duration.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
  { name: 'Endurance Bike', category: 'Endurance', week: 5, time: '100 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 85 min at 65-85% FTP. Longest ride of the block.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
  { name: 'Endurance Bike', category: 'Endurance', week: 6, time: '80 min', description: 'WARM UP: 5 min easy pedalling.\n\nWORK: 65 min at 65-80% FTP. Taper week — maintain fitness, reduce volume.\n\nCOOL DOWN: 10 min easy pedalling.', inputFields: bikeInputFields },
]

export const RUN_PRESETS = [
  {
    name: 'Track Reps - 1200m', category: 'Speed', week: 1, time: '~45 min', distance: '5.6 km',
    description: 'On a track or the road:\n\n1000m warm up with some 50m hard sprints thrown in.\n\n3x1200m hard effort, with equal rest between sets (so if an effort takes 5:00 then you rest 5:00 before the next).\n\nFocus on form/gait throughout!\n\n1000m reallyyyy steady cool down to bring HR back down.\n\nAim to beat your splits from the last time you hit this session.',
    inputFields: runInputFields,
  },
  {
    name: 'Track Reps - 800m', category: 'Speed', week: 2, time: '~40 min', distance: '5.2 km',
    description: 'On a track or the road:\n\n1000m warm up with some 50m hard sprints thrown in.\n\n4x800m hard effort, with equal rest between sets (so if an effort takes 4:00 then you rest 4:00 before the next).\n\nFocus on form/gait throughout!\n\n1000m reallyyyy steady cool down to bring HR back down.\n\nAim to beat your splits from the last time you hit this session.',
    inputFields: runInputFields,
  },
  {
    name: 'Track Reps - 400m', category: 'Speed', week: 3, time: '~35 min', distance: '4.4 km',
    description: 'On a track or the road:\n\n1000m warm up with some 50m hard sprints thrown in.\n\n6x400m hard effort, with equal rest between sets (so if an effort takes 2:00 then you rest 2:00 before the next).\n\nFocus on form/gait throughout!\n\n1000m reallyyyy steady cool down to bring HR back down.\n\nAim to beat your splits from the last time you hit this session.',
    inputFields: runInputFields,
  },
  {
    name: 'Track Reps - 200m', category: 'Speed', week: 4, time: '~30 min', distance: '3.6 km',
    description: 'On a track or the road:\n\n1000m warm up with some 50m hard sprints thrown in.\n\n8x200m hard effort, with equal rest between sets (so if an effort takes 1:00 then you rest 1:00 before the next).\n\nFocus on form/gait throughout!\n\n1000m reallyyyy steady cool down to bring HR back down.\n\nAim to beat your splits from the last time you hit this session.',
    inputFields: runInputFields,
  },
  {
    name: 'Threshold Retest - 30 min TT', category: 'Threshold', week: 5, time: '~55 min', distance: '~6-8 km',
    description: 'Start with a 10-15 minute easy warm up run.\n\n30-MINUTE TIME TRIAL: Go as hard as you can sustain for 30 minutes. This re-establishes your baseline hard effort pace and HR.\n\nWear a HR monitor. After the run, download the data and find your average heart rate for the last 20 minutes — that approximates your LTHR (lactate threshold heart rate).\n\nDo NOT watch your HR during the test. Just go as hard as you can.\n\nCool down: 10-15 min easy jog.\n\nUpdate your LT settings in the app after!',
    inputFields: [...runInputFields, { key: 'lthr', label: 'LTHR Result (bpm)', type: 'number' }, { key: 'ltPace', label: 'LT Pace (min/mi)', type: 'text' }],
  },
  {
    name: 'Track Reps - 1200m (Vol+)', category: 'Speed', week: 6, time: '~50 min', distance: '6.8 km',
    description: "On a track or the road:\n\n1000m warm up with some 50m hard sprints thrown in.\n\n4x1200m hard effort, with equal rest between sets (so if an effort takes 5:00 then you rest 5:00 before the next).\n\nVolume increase from last cycle. Focus on form/gait throughout!\n\n1000m reallyyyy steady cool down to bring HR back down.\n\nAim to beat your splits from last cycle's 1200s.",
    inputFields: runInputFields,
  },
]

export const RUN_ENDURANCE_PRESETS = [
  { name: 'Z2 Run', category: 'Endurance', week: 1, time: '50 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 35 min — keep HR within Z2 for the entirety.\n\nCOOL DOWN: 10 min easy walking, bring HR back down.', inputFields: runInputFields },
  { name: 'Z2 Run', category: 'Endurance', week: 2, time: '55 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 40 min in Z2.\n\nCOOL DOWN: 10 min easy walking.', inputFields: runInputFields },
  { name: 'Z2 Run', category: 'Endurance', week: 3, time: '60 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 45 min in Z2.\n\nCOOL DOWN: 10 min easy walking.', inputFields: runInputFields },
  { name: 'Z2 Run', category: 'Endurance', week: 4, time: '65 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 50 min in Z2.\n\nCOOL DOWN: 10 min easy walking.', inputFields: runInputFields },
  { name: 'Z2 Run', category: 'Endurance', week: 5, time: '75 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 60 min in Z2. Longest run of the block.\n\nCOOL DOWN: 10 min easy walking.', inputFields: runInputFields },
  { name: 'Z2 Run', category: 'Endurance', week: 6, time: '55 min', description: 'WARM UP: Alternate walking and running to bring HR up to Z2.\n\nWORK: 40 min in Z2. Taper week — maintain, reduce volume.\n\nCOOL DOWN: 10 min easy walking.', inputFields: runInputFields },
]

export const SWIM_PRESETS = [
  {
    name: 'Swim - Speed/Build (Short)', category: 'Speed', week: 1, time: '~20 min', distance: '766 yds',
    description: 'WARM UP: 100m Easy Swim.\n\nWORK: 2 Rounds of:\n100m build each 25m @ RPE5-6-7-8\n20s Rest\n50m @ RPE8\n20s Rest\n50m @ RPE6\n20s Rest\n50m @ RPE8\n20s Rest\n\nCOOL DOWN: 100 Easy Pull.',
    inputFields: swimInputFields,
  },
  {
    name: 'Swim - RPE Sets (Short)', category: 'Technique', week: 2, time: '~30 min', distance: '1422 yds',
    description: 'WARM UP: 200 easy swim incorporating 2 x 50 kick work (use float).\n\nWORK: 300m x 3 Sets\nSet 1: Swim at RPE7\nSet 2: Swim at RPE8\nSet 3: Swim at RPE7\n\nCOOL DOWN: 200 pull.',
    inputFields: swimInputFields,
  },
  {
    name: 'Swim - RPE Sets (Long)', category: 'Endurance', week: 3, time: '~40 min', distance: '1531 yds',
    description: 'WARM UP: 100 easy swim incorporating 2 x 25 kick work (use float).\n\nWORK: 400m x 3 Sets\nSet 1: Swim at RPE7\nSet 2: Swim at RPE8\nSet 3: Swim at RPE7\n\nCOOL DOWN: 100 pull.',
    inputFields: swimInputFields,
  },
  {
    name: 'Swim - Threshold Intervals', category: 'Threshold', week: 4, time: '~35 min', distance: '1800 yds',
    description: 'WARM UP: 200 easy swim with 2 x 50 kick.\n\nWORK: 6 x 200m @ RPE8 with 20s rest between reps.\n\nCOOL DOWN: 200 easy pull.',
    inputFields: swimInputFields,
  },
  {
    name: 'Swim - Descending Sets', category: 'Endurance', week: 5, time: '~45 min', distance: '2000 yds',
    description: 'WARM UP: 200 easy swim with 2 x 50 kick.\n\nWORK:\n500m @ RPE6 (30s rest)\n400m @ RPE7 (25s rest)\n300m @ RPE8 (20s rest)\n200m @ RPE8-9 (15s rest)\n100m all-out\n\nCOOL DOWN: 200 easy pull.',
    inputFields: swimInputFields,
  },
  {
    name: 'Swim - Race Pace', category: 'Speed', week: 6, time: '~30 min', distance: '1500 yds',
    description: 'WARM UP: 200 easy swim with 4 x 25 fast.\n\nWORK: 4 x 200m @ race pace with 30s rest.\n\nTaper week — stay sharp.\n\nCOOL DOWN: 200 easy pull.',
    inputFields: swimInputFields,
  },
]

export function getCardioForWeek(presets, week) {
  const idx = Math.min(week - 1, presets.length - 1)
  return presets[idx]
}
