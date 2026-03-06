# Whoop API Research — Findings & Issues

## Whoop API v2 Endpoints (current)

### Recovery: `GET /v2/recovery`
```json
{
  "records": [{
    "cycle_id": 93845,
    "sleep_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": 10129,
    "created_at": "2022-04-24T11:25:44.774Z",
    "updated_at": "2022-04-24T14:25:44.774Z",
    "score_state": "SCORED",
    "score": {
      "user_calibrating": false,
      "recovery_score": 44,
      "resting_heart_rate": 64,
      "hrv_rmssd_milli": 31.813562,
      "spo2_percentage": 95.6875,
      "skin_temp_celsius": 33.7
    }
  }],
  "next_token": "MTIzOjEyMzEyMw"
}
```

### Sleep: `GET /v2/activity/sleep`
```json
{
  "records": [{
    "id": "ecfc6a15-4661-442f-a9a4-f160dd7a5930",
    "cycle_id": 93845,
    "user_id": 10129,
    "created_at": "2022-04-24T11:25:44.774Z",
    "start": "2022-04-24T02:25:44.774Z",
    "end": "2022-04-24T10:25:44.774Z",
    "score_state": "SCORED",
    "score": {
      "stage_summary": {
        "total_in_bed_time_milli": 30272735,
        "total_awake_time_milli": 1403507,
        "total_no_data_time_milli": 0,
        "total_light_sleep_time_milli": 16359285,
        "total_slow_wave_sleep_time_milli": 6630370,
        "total_rem_sleep_time_milli": 5879573,
        "sleep_cycle_count": 3,
        "disturbance_count": 12
      },
      "sleep_needed": {
        "baseline_milli": 27395716,
        "need_from_sleep_debt_milli": 352230,
        "need_from_recent_strain_milli": 208595,
        "need_from_recent_nap_milli": -12312
      },
      "respiratory_rate": 16.11328125,
      "sleep_performance_percentage": 98,
      "sleep_consistency_percentage": 90,
      "sleep_efficiency_percentage": 91.56
    }
  }]
}
```

### Cycle (Strain): `GET /v2/cycle`
```json
{
  "records": [{
    "id": 93845,
    "user_id": 10129,
    "created_at": "2022-04-24T11:25:44.774Z",
    "start": "2022-04-24T02:25:44.774Z",
    "end": "2022-04-25T02:25:44.774Z",
    "score_state": "SCORED",
    "score": {
      "strain": 5.2951527,
      "kilojoule": 8288.297,
      "average_heart_rate": 68,
      "max_heart_rate": 141
    }
  }]
}
```

### Workout: `GET /v2/activity/workout`
```json
{
  "records": [{
    "id": "ecfc6a15-4661-442f-a9a4-f160dd7a5930",
    "user_id": 10129,
    "start": "2022-04-24T02:25:44.774Z",
    "end": "2022-04-24T03:25:44.774Z",
    "sport_id": 1,
    "score_state": "SCORED",
    "score": {
      "strain": 8.2463,
      "average_heart_rate": 123,
      "max_heart_rate": 146,
      "kilojoule": 1569.34,
      "percent_recorded": 100,
      "distance_meter": 1772.77,
      "altitude_gain_meter": 46.64,
      "altitude_change_meter": -0.781
    }
  }]
}
```

## Issues Found in Current Code

### 1. **CRITICAL: whoop-sync uses v1 API paths**
File: `supabase/functions/whoop-sync/index.ts`
- Uses `/v1/recovery`, `/v1/activity/sleep`, `/v1/cycle`, `/v1/activity/workout`
- Should be `/v2/recovery`, `/v2/activity/sleep`, `/v2/cycle`, `/v2/activity/workout`

### 2. **CRITICAL: recoveryAdvisor.js uses wrong field names**
File: `app/src/utils/recoveryAdvisor.js`
- Uses `latestRecovery.score` — should be `latestRecovery.score.recovery_score`
- Uses `latestRecovery.hrv` — should be `latestRecovery.score.hrv_rmssd_milli`
- Uses `latestSleep.score` (as number) — should be `latestSleep.score.sleep_performance_percentage`
- Uses `latestSleep.qualityDuration` or `latestSleep.duration` — should use `latestSleep.score.stage_summary.total_in_bed_time_milli - total_awake_time_milli`

### 3. **Data shape mismatch in useWhoop.js**
The hook reads `data.recovery[last]` etc and passes it to the advisor as `latestRecovery`.
But the cached records in Supabase store the entire Whoop API record including `score_state`, `score`, etc.
The advisor needs to account for this nested structure.

### 4. **Query params differ between v1 and v2**
v2 uses `start` and `end` as ISO timestamps, `limit` as integer (max 25)
Current code appears to use v1-style params.
