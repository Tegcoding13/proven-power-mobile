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
  open: "Open",
  closed: "Closed",
};

const STATUS_STYLES: Record<string, string> = {
  submitted:          "bg-red-50 text-red-700 ring-1 ring-red-200",
  acknowledged:       "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  scheduled:          "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  in_progress:        "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  awaiting_approval:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  approved:           "bg-green-50 text-green-700 ring-1 ring-green-200",
  completed:          "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  cancelled:          "bg-gray-100 text-gray-400 ring-1 ring-gray-200",
  researching:        "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  in_stock:           "bg-green-50 text-green-700 ring-1 ring-green-200",
  ordered:            "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  ready_for_pickup:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  fulfilled:          "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
  open:               "bg-green-50 text-green-700 ring-1 ring-green-200",
  closed:             "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

const STATUS_DOTS: Record<string, string> = {
  submitted: "bg-red-500",
  acknowledged: "bg-blue-500",
  scheduled: "bg-indigo-500",
  in_progress: "bg-purple-500",
  awaiting_approval: "bg-amber-500",
  approved: "bg-green-500",
  completed: "bg-gray-400",
  cancelled: "bg-gray-300",
  open: "bg-green-500",
  closed: "bg-gray-400",
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
  const dot = STATUS_DOTS[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
      {label}
    </span>
  );
}
