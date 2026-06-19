import { View, Text } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { colors, spacing, typeScale } from "@proven-power/ui-tokens";
import type { EquipmentHourReading } from "@proven-power/shared-types";

const CHART_HEIGHT = 140;
const CHART_PADDING = 16;

export function HoursChart({ readings }: { readings: EquipmentHourReading[] }) {
  if (readings.length < 2) {
    return (
      <Text style={{ color: colors.gray[700], fontSize: typeScale.sm }}>
        Log at least two readings to see a usage chart.
      </Text>
    );
  }

  // Oldest first for left-to-right chronological plotting.
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const hoursValues = sorted.map((r) => r.hours);
  const minHours = Math.min(...hoursValues);
  const maxHours = Math.max(...hoursValues);
  const range = maxHours - minHours || 1;

  return (
    <View style={{ width: "100%" }}>
      <ChartSvg sorted={sorted} minHours={minHours} range={range} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs }}>
        <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>{minHours} hrs</Text>
        <Text style={{ fontSize: typeScale.xs, color: colors.gray[700] }}>{maxHours} hrs</Text>
      </View>
    </View>
  );
}

function ChartSvg({
  sorted,
  minHours,
  range,
}: {
  sorted: EquipmentHourReading[];
  minHours: number;
  range: number;
}) {
  return (
    <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 300 ${CHART_HEIGHT}`} preserveAspectRatio="none">
      <Line x1={0} y1={CHART_HEIGHT - CHART_PADDING} x2={300} y2={CHART_HEIGHT - CHART_PADDING} stroke={colors.gray[300]} strokeWidth={1} />
      <Polyline
        points={sorted
          .map((reading, index) => {
            const x = (index / (sorted.length - 1)) * 300;
            const y = CHART_HEIGHT - CHART_PADDING - ((reading.hours - minHours) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
            return `${x},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke={colors.green[500]}
        strokeWidth={3}
      />
      {sorted.map((reading, index) => {
        const x = (index / (sorted.length - 1)) * 300;
        const y = CHART_HEIGHT - CHART_PADDING - ((reading.hours - minHours) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
        return <Circle key={reading.id} cx={x} cy={y} r={4} fill={colors.green[700]} />;
      })}
    </Svg>
  );
}
