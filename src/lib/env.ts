function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  telegramBotToken: () => required("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: () => optional("TELEGRAM_WEBHOOK_SECRET"),
  adminSecret: () => required("ADMIN_SECRET"),
  sessionSecret: () => required("SESSION_SECRET"),
  tursoDatabaseUrl: () => required("TURSO_DATABASE_URL"),
  tursoAuthToken: () => optional("TURSO_AUTH_TOKEN"),
  cronSecret: () => optional("CRON_SECRET"),
  appUrl: () => optional("NEXT_PUBLIC_APP_URL"),
};
