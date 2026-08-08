export const STATUS_LABEL: Record<string, string> = {
  todo: "📋 Todo",
  doing: "🔵 Doing",
  blocked: "🔴 Blocked",
  done: "✅ Done",
};

export const STATUS_EMOJI: Record<string, string> = {
  todo: "📋",
  doing: "🔵",
  blocked: "🔴",
  done: "✅",
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "⬇️ Low",
  normal: "➖ Normal",
  high: "⬆️ High",
  urgent: "🔥 Urgent",
};

export const PRIORITY_EMOJI: Record<string, string> = {
  low: "⬇️",
  normal: "➖",
  high: "⬆️",
  urgent: "🔥",
};

export const STATUS_ORDER = ["doing", "blocked", "todo", "done"] as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function mention(member: {
  username: string | null;
  displayName: string;
  telegramId: string;
}): string {
  if (member.username) return `@${escapeHtml(member.username)}`;
  return `<a href="tg://user?id=${member.telegramId}">${escapeHtml(member.displayName)}</a>`;
}

export function taskRef(id: number): string {
  return `#${id}`;
}
