"use client";

import { useRouter } from "next/navigation";

interface Props {
  unreadCount: number;
  maxUrgency: 1 | 2 | 3 | null;
}

const URGENCY_STYLE: Record<1 | 2 | 3, { bg: string; text: string; pulse: boolean }> = {
  3: { bg: "#ef4444", text: "#fff", pulse: true },
  2: { bg: "#f59e0b", text: "#fff", pulse: false },
  1: { bg: "#6b7280", text: "#fff", pulse: false },
};

export default function SignalBadge({ unreadCount, maxUrgency }: Props) {
  const router = useRouter();

  if (!unreadCount || !maxUrgency) return null;

  const style = URGENCY_STYLE[maxUrgency];

  return (
    <button
      onClick={e => { e.stopPropagation(); router.push("/signals"); }}
      title={`${unreadCount} new signal${unreadCount > 1 ? "s" : ""} — view signals`}
      className={`relative inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.pulse ? "animate-pulse" : ""}`}
      style={{ background: style.bg, color: style.text, lineHeight: 1 }}
    >
      ⚡ {unreadCount}
    </button>
  );
}
