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

export function mention(member: {
  username: string | null;
  displayName: string;
  telegramId: string;
}): string {
  if (member.username) return `@${member.username}`;
  return `[${member.displayName}](tg://user?id=${member.telegramId})`;
}

export function taskRef(id: number): string {
  return `#${id}`;
}
