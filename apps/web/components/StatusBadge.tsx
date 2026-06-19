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
  const className = DONE_STATUSES.has(status)
    ? "bg-gray-100 text-gray-700"
    : ACTIVE_COLOR_STATUSES.has(status)
      ? "bg-amber-100 text-amber-800"
      : "bg-green-50 text-green-700";

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
