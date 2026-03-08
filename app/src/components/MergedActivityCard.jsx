import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getGarminActivityIcon, getGarminActivityColor, formatGarminDuration } from '../utils/garminSports';
import { getSportName, getSportIcon, getSportColor } from '../utils/whoopSports';
import {
  formatPace,
  formatSwimPace,
  formatDistance,
  formatDurationCompact,
  formatSplitPace,
  calcSwimPace,
} from '../utils/mergeActivities';

const SWIM_TYPES = new Set(['lap_swimming', 'open_water_swimming', 'pool_swimming', 'swimming']);
const RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running', 'track_running']);

export default function MergedActivityCard({ activity }) {
  const [splitsOpen, setSplitsOpen] = useState(false);

  const {
    source, type, name, color, startTime, duration, distance, calories,
    avgHR, maxHR, garmin, whoop, sharedSessionId, sharedSessionCount,
  } = activity;

  // Resolve display values
  const isSwim = SWIM_TYPES.has(type);
  const isRun = RUN_TYPES.has(type);
  const accentColor = garmin ? (getGarminActivityColor({ activityType: { typeKey: type } })) : (color || '#44b700');

  // Icon
  let Icon, iconColor;
  if (garmin) {
    Icon = getGarminActivityIcon({ activityType: { typeKey: type } });
    iconColor = accentColor;
  } else if (whoop?.rawWorkout) {
    Icon = getSportIcon(whoop.sportId, whoop.rawWorkout);
    iconColor = getSportColor(whoop.sportId);
  } else {
    Icon = getSportIcon(whoop?.sportId);
    iconColor = '#44b700';
  }

  // Name fallback
  const displayName = name || (whoop?.rawWorkout ? getSportName(whoop.sportId, whoop.rawWorkout) : 'Workout');

  // Duration string
  const durationStr = formatDurationCompact(duration);

  // Start time display
  const startTimeStr = startTime ? (() => {
    const d = new Date(startTime);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })() : null;

  // Pace
  const paceStr = garmin?.pace?.avg
    ? (isSwim ? formatSwimPace(calcSwimPace(distance, duration)) : formatPace(garmin.pace.avg))
    : null;

  // Splits
  const splits = garmin?.splits || [];
  const hasSplits = splits.length > 0;

  return (
    <div className="bg-[#1A1A1A] rounded-xl p-3.5 border border-white/[0.08]" style={{ borderColor: accentColor + '30' }}>
      {/* Header: Name + Duration */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '15' }}>
            <Icon size={16} color={accentColor} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-medium text-white truncate">{displayName}</span>
              {/* Source badges */}
              <div className="flex gap-0.5 shrink-0">
                {garmin && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">G</span>
                )}
                {whoop && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#44b700]/20 text-[#44b700]">W</span>
                )}
              </div>
            </div>
            {startTimeStr && <span className="text-[11px] text-[#555]">{startTimeStr}</span>}
          </div>
        </div>
        <span className="text-[14px] font-semibold text-[#999] shrink-0 ml-2">{durationStr}</span>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {distance > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Distance</div>
            <div className="text-[15px] font-semibold text-white">{formatDistance(distance, type)}</div>
          </div>
        )}
        {paceStr && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Pace</div>
            <div className="text-[15px] font-semibold text-white">{paceStr}</div>
          </div>
        )}
        {avgHR > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg HR</div>
            <div className="text-[15px] font-semibold text-white">{avgHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {maxHR > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Max HR</div>
            <div className="text-[15px] font-semibold text-white">{maxHR} <span className="text-[11px] text-[#666]">bpm</span></div>
          </div>
        )}
        {calories > 0 && (
          <div>
            <div className="text-[10px] uppercase text-[#555] mb-0.5">Calories</div>
            <div className="text-[15px] font-semibold text-white">{calories} <span className="text-[11px] text-[#666]">kcal</span></div>
          </div>
        )}
      </div>

      {/* Garmin Extended Metrics */}
      {garmin && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {isRun && garmin.cadence > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">Cadence</div>
              <div className="text-[15px] font-semibold text-white">{Math.round(garmin.cadence)} <span className="text-[11px] text-[#666]">spm</span></div>
            </div>
          )}
          {garmin.elevationGain > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">Elevation</div>
              <div className="text-[15px] font-semibold text-white">+{Math.round(garmin.elevationGain * 3.28084)} <span className="text-[11px] text-[#666]">ft</span></div>
            </div>
          )}
          {garmin.vO2Max > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">VO2 Max</div>
              <div className="text-[15px] font-semibold text-white">{garmin.vO2Max}</div>
            </div>
          )}
          {garmin.trainingEffect && typeof garmin.trainingEffect === 'number' && garmin.trainingEffect > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">Training Effect</div>
              <div className="text-[15px] font-semibold text-white">{garmin.trainingEffect.toFixed(1)}</div>
            </div>
          )}
          {isSwim && garmin.strokeCount > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">Strokes</div>
              <div className="text-[15px] font-semibold text-white">{garmin.strokeCount}</div>
            </div>
          )}
          {isSwim && garmin.swolf > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">SWOLF</div>
              <div className="text-[15px] font-semibold text-white">{Math.round(garmin.swolf)}</div>
            </div>
          )}
          {garmin.avgPower > 0 && (
            <div>
              <div className="text-[10px] uppercase text-[#555] mb-0.5">Avg Power</div>
              <div className="text-[15px] font-semibold text-white">{Math.round(garmin.avgPower)} <span className="text-[11px] text-[#666]">W</span></div>
            </div>
          )}
        </div>
      )}

      {/* Splits (collapsible) */}
      {hasSplits && (
        <div className="mb-3">
          <button
            onClick={() => setSplitsOpen(!splitsOpen)}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#555] font-semibold w-full"
          >
            Splits ({splits.length})
            {splitsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {splitsOpen && (
            <div className="mt-2 space-y-1">
              {splits.map((split, i) => {
                const splitPace = formatSplitPace(split, type);
                const splitHR = split.averageHR || split.averageHeartRate || 0;
                const splitDist = split.distance || 0;
                return (
                  <div key={i} className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-[12px]">
                    <span className="text-[#555] w-5 text-right font-medium">{i + 1}</span>
                    <span className="text-white flex-1 font-medium">{splitPace}</span>
                    {splitDist > 0 && (
                      <span className="text-[#666]">{formatDistance(splitDist, type)}</span>
                    )}
                    {splitHR > 0 && (
                      <span className="text-[#666]">{splitHR} bpm</span>
                    )}
                    {isSwim && split.averageSwolf > 0 && (
                      <span className="text-[#666]">SWOLF {Math.round(split.averageSwolf)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Whoop Strain Footer */}
      {whoop && !sharedSessionId && (
        <div className="flex items-center gap-4 px-2.5 py-2 rounded-lg bg-[#44b700]/8 border border-[#44b700]/15">
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#44b700]/20 text-[#44b700]">W</span>
          {whoop.strain > 0 && (
            <span className="text-[12px] font-semibold text-[#44b700]">{whoop.strain.toFixed(1)} strain</span>
          )}
          {whoop.calories > 0 && (
            <span className="text-[12px] text-[#777]">{whoop.calories} cal</span>
          )}
          {whoop.avgHR > 0 && avgHR !== whoop.avgHR && (
            <span className="text-[12px] text-[#777]">{whoop.avgHR} bpm</span>
          )}
        </div>
      )}
    </div>
  );
}
