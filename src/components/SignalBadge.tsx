"use client";

interface Props {
  unreadCount: number;
  maxUrgency: 1 | 2 | 3 | null;
  onClick?: (e: React.MouseEvent) => void;
}

const URGENCY_STYLE: Record<1 | 2 | 3, { bg: string; text: string; pulse: boolean }> = {
  3: { bg: "#ef4444", text: "#fff", pulse: true },
  2: { bg: "#f59e0b", text: "#fff", pulse: false },
  1: { bg: "#6b7280", text: "#fff", pulse: false },
};

export default function SignalBadge({ unreadCount, maxUrgency, onClick }: Props) {
  if (!unreadCount || !maxUrgency) return null;

  const style = URGENCY_STYLE[maxUrgency];

  return (
    <button
      onClick={onClick}
      title={`${unreadCount} new signal${unreadCount > 1 ? "s" : ""}`}
      className={`relative inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.pulse ? "animate-pulse" : ""}`}
      style={{ background: style.bg, color: style.text, lineHeight: 1 }}
    >
      ⚡ {unreadCount}
    </button>
  );
}
