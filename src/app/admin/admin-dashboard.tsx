"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export type Member = {
  id: number;
  telegramId: string;
  username: string | null;
  displayName: string;
  role: "admin" | "member";
  active: boolean;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "doing" | "blocked" | "done";
  priority: "low" | "normal" | "high" | "urgent";
  assigneeId: number | null;
  dueAt: string | null;
  blockedReason: string | null;
  assignee: Member | null;
};

export type Settings = {
  chatId: string | null;
  topicId: number | null;
  timezone: string;
  digestEnabled: boolean;
  standupEnabled: boolean;
  remindersEnabled: boolean;
};

export type Overview = {
  settings: Settings;
  members: Member[];
  tasks: Task[];
  counts: Record<string, number>;
};

const tabs = ["Overview", "Members", "Tasks", "Settings"] as const;

export function AdminDashboard({ initialData }: { initialData: Overview }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [data, setData] = useState(initialData);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/overview");
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) {
      setError("Couldn't load the board.");
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const openTasks = data.tasks.filter((task) => task.status !== "done");

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-5xl tracking-tight md:text-6xl">
            taptopia
          </p>
          <p className="mt-2 max-w-xl text-muted">
            Members, tasks, and board settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            onClick={() => void logout()}
            className="rounded-full bg-ink px-4 py-2 text-sm text-accent"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              tab === item
                ? "bg-ink text-accent"
                : "border border-line bg-white/60 text-ink"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      {notice ? (
        <p className="mb-4 rounded-2xl border border-line bg-accent/30 px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-2xl border border-danger/30 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {tab === "Overview" ? (
        <OverviewPanel data={data} openCount={openTasks.length} />
      ) : null}
      {tab === "Members" ? (
        <MembersPanel
          members={data.members}
          onChange={async () => {
            setNotice("");
            await load();
          }}
          onNotice={setNotice}
        />
      ) : null}
      {tab === "Tasks" ? (
        <TasksPanel
          tasks={data.tasks}
          members={data.members.filter((member) => member.active)}
          onChange={async () => {
            setNotice("");
            await load();
          }}
          onNotice={setNotice}
        />
      ) : null}
      {tab === "Settings" ? (
        <SettingsPanel
          key={[
            data.settings.chatId,
            data.settings.topicId,
            data.settings.timezone,
            data.settings.digestEnabled,
            data.settings.standupEnabled,
            data.settings.remindersEnabled,
          ].join("|")}
          settings={data.settings}
          onChange={async () => {
            setNotice("");
            await load();
          }}
          onNotice={setNotice}
        />
      ) : null}
    </main>
  );
}

function OverviewPanel({
  data,
  openCount,
}: {
  data: Overview;
  openCount: number;
}) {
  const cards = [
    { label: "Open", value: openCount },
    { label: "Doing", value: data.counts.doing ?? 0 },
    { label: "Blocked", value: data.counts.blocked ?? 0 },
    { label: "Members", value: data.members.filter((m) => m.active).length },
  ];

  return (
    <section className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[24px] border border-line bg-panel p-5 backdrop-blur"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-muted">
              {card.label}
            </p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-4xl">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] border border-line bg-panel p-6 backdrop-blur">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Live slice
        </h2>
        <div className="mt-5 space-y-3">
          {data.tasks
            .filter((task) => task.status !== "done")
            .slice(0, 8)
            .map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-1 border-b border-line/70 py-3 last:border-none md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    #{task.id} {task.title}
                  </p>
                  <p className="text-sm text-muted">
                    {task.status}
                    {task.assignee
                      ? ` · ${task.assignee.displayName}`
                      : " · unassigned"}
                    {task.blockedReason ? ` · ${task.blockedReason}` : ""}
                  </p>
                </div>
                <span className="text-sm uppercase tracking-[0.14em] text-muted">
                  {task.priority}
                </span>
              </div>
            ))}
          {openCount === 0 ? (
            <p className="text-muted">No open tasks.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MembersPanel({
  members,
  onChange,
  onNotice,
}: {
  members: Member[];
  onChange: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [telegramId, setTelegramId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ telegramId, displayName, username, role }),
    });
    if (!response.ok) {
      onNotice("Couldn't add that member.");
      return;
    }
    setTelegramId("");
    setDisplayName("");
    setUsername("");
    setRole("member");
    onNotice("Member saved.");
    await onChange();
  }

  async function patch(id: number, body: Record<string, unknown>) {
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await onChange();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <form
        onSubmit={onSubmit}
        className="h-fit space-y-4 rounded-[28px] border border-line bg-panel p-6 backdrop-blur"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Add member
        </h2>
        <Field
          label="Telegram ID"
          value={telegramId}
          onChange={setTelegramId}
          required
        />
        <Field
          label="Display name"
          value={displayName}
          onChange={setDisplayName}
          required
        />
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="optional"
        />
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            Role
          </span>
          <select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "admin" | "member")
            }
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-accent">
          Save member
        </button>
      </form>

      <div className="rounded-[28px] border border-line bg-panel p-6 backdrop-blur">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Team</h2>
        <div className="mt-5 space-y-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 border-b border-line/70 pb-4 last:border-none md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">{member.displayName}</p>
                <p className="text-sm text-muted">
                  {member.telegramId}
                  {member.username ? ` · @${member.username}` : ""}
                  {member.active ? "" : " · inactive"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    void patch(member.id, {
                      role: member.role === "admin" ? "member" : "admin",
                    })
                  }
                  className="rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  {member.role === "admin" ? "Make member" : "Make admin"}
                </button>
                <button
                  onClick={() =>
                    void patch(member.id, { active: !member.active })
                  }
                  className="rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  {member.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TasksPanel({
  tasks,
  members,
  onChange,
  onNotice,
}: {
  tasks: Task[];
  members: Member[];
  onChange: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        dueAt: dueAt || null,
      }),
    });
    if (!response.ok) {
      onNotice("Couldn't create task.");
      return;
    }
    setTitle("");
    setDescription("");
    setPriority("normal");
    setAssigneeId("");
    setDueAt("");
    onNotice("Task created.");
    await onChange();
  }

  async function patch(id: number, body: Record<string, unknown>) {
    await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await onChange();
  }

  async function remove(id: number) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onNotice("Task deleted.");
    await onChange();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <form
        onSubmit={onSubmit}
        className="h-fit space-y-4 rounded-[28px] border border-line bg-panel p-6 backdrop-blur"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          New task
        </h2>
        <Field label="Title" value={title} onChange={setTitle} required />
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-line bg-white/80 px-4 py-3"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            Priority
          </span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            Assignee
          </span>
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <Field label="Due date" value={dueAt} onChange={setDueAt} type="date" />
        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-accent">
          Create task
        </button>
      </form>

      <div className="rounded-[28px] border border-line bg-panel p-6 backdrop-blur">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Tasks</h2>
        <div className="mt-5 space-y-5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="border-b border-line/70 pb-5 last:border-none"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium">
                    #{task.id} {task.title}
                  </p>
                  <p className="text-sm text-muted">
                    {task.description || "No description"}
                  </p>
                </div>
                <button
                  onClick={() => void remove(task.id)}
                  className="self-start text-sm text-danger"
                >
                  Delete
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["todo", "doing", "blocked", "done"] as const).map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => void patch(task.id, { status })}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        task.status === status
                          ? "bg-ink text-accent"
                          : "border border-line"
                      }`}
                    >
                      {status}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({
  settings,
  onChange,
  onNotice,
}: {
  settings: Settings;
  onChange: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const [chatId, setChatId] = useState(settings.chatId ?? "");
  const [topicId, setTopicId] = useState(
    settings.topicId != null ? String(settings.topicId) : "",
  );
  const [timezone, setTimezone] = useState(settings.timezone);
  const [digestEnabled, setDigestEnabled] = useState(settings.digestEnabled);
  const [standupEnabled, setStandupEnabled] = useState(settings.standupEnabled);
  const [remindersEnabled, setRemindersEnabled] = useState(
    settings.remindersEnabled,
  );

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: chatId || null,
        topicId: topicId ? Number(topicId) : null,
        timezone,
        digestEnabled,
        standupEnabled,
        remindersEnabled,
      }),
    });
    if (!response.ok) {
      onNotice("Couldn't save settings.");
      return;
    }
    onNotice("Settings saved.");
    await onChange();
  }

  async function setWebhook() {
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setWebhook" }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      onNotice(
        result.error ||
          result.result?.description ||
          "Webhook setup failed.",
      );
      return;
    }
    onNotice(`Webhook set → ${result.webhookUrl}`);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={save}
        className="space-y-4 rounded-[28px] border border-line bg-panel p-6 backdrop-blur"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Board room
        </h2>
        <Field
          label="Chat ID"
          value={chatId}
          onChange={setChatId}
          placeholder="from /bind or Telegram"
        />
        <Field
          label="Topic ID"
          value={topicId}
          onChange={setTopicId}
          placeholder="forum topic id"
        />
        <Field
          label="Timezone"
          value={timezone}
          onChange={setTimezone}
          placeholder="Europe/Istanbul"
        />

        <Toggle
          label="Reminders"
          checked={remindersEnabled}
          onChange={setRemindersEnabled}
        />
        <Toggle
          label="Morning pulse"
          checked={standupEnabled}
          onChange={setStandupEnabled}
        />
        <Toggle
          label="Weekly digest"
          checked={digestEnabled}
          onChange={setDigestEnabled}
        />

        <button className="w-full rounded-2xl bg-ink px-4 py-3 text-accent">
          Save settings
        </button>
      </form>

      <div className="space-y-4 rounded-[28px] border border-line bg-panel p-6 backdrop-blur">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Telegram hook
        </h2>
        <p className="text-muted">
          Register the Telegram webhook for this deployment, then run /bind in
          the team topic.
        </p>
        <button
          onClick={() => void setWebhook()}
          className="rounded-2xl border border-line bg-white/80 px-4 py-3"
        >
          Set webhook
        </button>
        <div className="rounded-2xl bg-mist/80 p-4 text-sm text-muted">
          <p>Cron expects Authorization: Bearer CRON_SECRET</p>
          <p className="mt-2">/api/cron/daily · 08:00 UTC</p>
          <p>Reminders every day · pulse on weekdays · digest on Friday</p>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none ring-accent focus:ring-2"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/60 px-4 py-3">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--ink)]"
      />
    </label>
  );
}
