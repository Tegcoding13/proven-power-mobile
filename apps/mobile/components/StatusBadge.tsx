import { View, Text } from "react-native";
import { colors, spacing, radii, typeScale } from "@proven-power/ui-tokens";

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  completed: "Completed",
  cancelled: "Cancelled",
  researching: "Researching",
  in_stock: "In Stock",
  ordered: "Ordered",
  ready_for_pickup: "Ready for Pickup",
  fulfilled: "Fulfilled",
};

const ACTIVE_COLOR_STATUSES = new Set(["awaiting_approval", "in_stock", "ready_for_pickup"]);
const DONE_STATUSES = new Set(["completed", "fulfilled", "cancelled"]);

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const backgroundColor = DONE_STATUSES.has(status)
    ? colors.gray[100]
    : ACTIVE_COLOR_STATUSES.has(status)
      ? "#FCE8CC"
      : colors.green[50];
  const textColor = DONE_STATUSES.has(status)
    ? colors.gray[700]
    : ACTIVE_COLOR_STATUSES.has(status)
      ? colors.status.warning
      : colors.green[700];

  return (
    <View style={{ backgroundColor, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill, alignSelf: "flex-start" }}>
      <Text style={{ color: textColor, fontSize: typeScale.xs, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
