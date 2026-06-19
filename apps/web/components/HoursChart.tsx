import type { EquipmentHourReading } from "@proven-power/shared-types";

const CHART_HEIGHT = 140;
const CHART_PADDING = 16;

export function HoursChart({ readings }: { readings: EquipmentHourReading[] }) {
  if (readings.length < 2) {
    return <p className="text-sm text-gray-700">Log at least two readings to see a usage chart.</p>;
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const hoursValues = sorted.map((r) => r.hours);
  const minHours = Math.min(...hoursValues);
  const maxHours = Math.max(...hoursValues);
  const range = maxHours - minHours || 1;

  const points = sorted
    .map((reading, index) => {
      const x = (index / (sorted.length - 1)) * 300;
      const y = CHART_HEIGHT - CHART_PADDING - ((reading.hours - minHours) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
      return { x, y, id: reading.id };
    });

  return (
    <div className="w-full">
      <svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 300 ${CHART_HEIGHT}`} preserveAspectRatio="none">
        <line x1={0} y1={CHART_HEIGHT - CHART_PADDING} x2={300} y2={CHART_HEIGHT - CHART_PADDING} stroke="#c9c9c9" strokeWidth={1} />
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2d7a3a" strokeWidth={3} />
        {points.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={4} fill="#1d4f26" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-700 mt-1">
        <span>{minHours} hrs</span>
        <span>{maxHours} hrs</span>
      </div>
    </div>
  );
}
