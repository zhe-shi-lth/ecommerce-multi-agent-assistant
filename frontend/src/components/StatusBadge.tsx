interface Props {
  status: string;
}

// 简单状态色标：SUCCESS/ENOUGH/READY_TO_SHIP 绿；FAILED/RISK/NEEDS_REVIEW/LOW 红/橙；其余灰。
function colorOf(status: string): string {
  const s = status.toUpperCase();
  if (["SUCCESS", "ENOUGH", "READY_TO_SHIP", "ANALYZED"].includes(s)) return "ok";
  if (["FAILED", "RISK", "NEEDS_REVIEW", "INSUFFICIENT_STOCK"].includes(s)) return "bad";
  if (["LOW", "PENDING_ANALYSIS", "DRAFT"].includes(s)) return "warn";
  return "neutral";
}

export default function StatusBadge({ status }: Props) {
  return <span className={`badge badge-${colorOf(status)}`}>{status}</span>;
}
