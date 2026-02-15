import Conf from "conf";
import type { DuckMode, PersistedState, Session, SessionSummary, Stats } from "./types.js";

const CONFIG_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const WRITE_RETRIES = 2;

const DEFAULT_STATS: Stats = {
  problemsSolved: 0,
  ahaMoments: 0,
  totalSessions: 0,
  lastSolvedAt: null,
  currentStreak: 0,
  mode: "gentle",
};

const config = new Conf({
  projectName: "rubber-duck",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDuckMode(value: unknown): value is DuckMode {
  return value === "gentle" || value === "tough";
}

function isStats(value: unknown): value is Stats {
  if (!isRecord(value)) return false;
  return (
    typeof value.problemsSolved === "number" &&
    typeof value.ahaMoments === "number" &&
    typeof value.totalSessions === "number" &&
    (typeof value.lastSolvedAt === "number" || value.lastSolvedAt === null) &&
    typeof value.currentStreak === "number" &&
    isDuckMode(value.mode)
  );
}

function isSessionMessage(value: unknown): value is Session["messages"][number] {
  if (!isRecord(value)) return false;
  return (
    (value.role === "user" || value.role === "duck") &&
    typeof value.content === "string" &&
    typeof value.timestamp === "number"
  );
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every((msg) => isSessionMessage(msg)) &&
    typeof value.startedAt === "number" &&
    isDuckMode(value.mode)
  );
}

function isSessionSummary(value: unknown): value is SessionSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.startedAt === "number" &&
    typeof value.updatedAt === "number" &&
    isDuckMode(value.mode) &&
    typeof value.messageCount === "number"
  );
}

export function getStateWarnings(): string[] {
  const warnings: string[] = [];
  const rawStats = config.get("stats");
  if (rawStats !== undefined && !isStats(rawStats)) {
    warnings.push("Stats data was invalid and has been reset to defaults.");
  }
  const rawSession = config.get("session");
  if (rawSession !== undefined && rawSession !== null && !isSession(rawSession)) {
    warnings.push("Session data was invalid and has been cleared.");
  }
  const rawSessions = config.get("sessions");
  if (rawSessions !== undefined && (!Array.isArray(rawSessions) || !rawSessions.every((s) => isSessionSummary(s)))) {
    warnings.push("Session list data was invalid and has been reset.");
  }
  return warnings;
}

export function readState(): PersistedState {
  const configVersionRaw = config.get("configVersion");
  const configVersion = typeof configVersionRaw === "number" ? configVersionRaw : CONFIG_VERSION;

  const rawStats = config.get("stats");
  const stats = isStats(rawStats) ? rawStats : DEFAULT_STATS;

  const rawSession = config.get("session");
  const session = isSession(rawSession) ? rawSession : null;

  const rawSessions = config.get("sessions");
  const sessions = Array.isArray(rawSessions) && rawSessions.every((s) => isSessionSummary(s)) ? rawSessions : [];

  if (configVersion !== CONFIG_VERSION || !isStats(rawStats) || (rawSession !== null && rawSession !== undefined && !isSession(rawSession)) || (rawSessions !== undefined && (!Array.isArray(rawSessions) || !rawSessions.every((s) => isSessionSummary(s))))) {
    writeState({ configVersion: CONFIG_VERSION, stats, session, sessions });
  }

  return {
    configVersion: CONFIG_VERSION,
    stats,
    session,
    sessions,
  };
}

export function writeState(state: PersistedState): void {
  for (let i = 0; i <= WRITE_RETRIES; i += 1) {
    try {
      config.set("configVersion", state.configVersion);
      config.set("stats", state.stats);
      config.set("session", state.session);
      config.set("sessions", state.sessions);
      return;
    } catch (error) {
      if (i >= WRITE_RETRIES) {
        throw error;
      }
    }
  }
}

export function updateState(mutator: (state: PersistedState) => PersistedState): PersistedState {
  const current = readState();
  const next = mutator(current);
  writeState(next);
  return next;
}

export function getStats(): Stats {
  return readState().stats;
}

export function setMode(mode: DuckMode): void {
  updateState((state) => ({ ...state, stats: { ...state.stats, mode } }));
}

export function recordSession(session: Session): void {
  updateState((state) => {
    const summary: SessionSummary = {
      id: session.id,
      startedAt: session.startedAt,
      updatedAt: Date.now(),
      mode: session.mode,
      messageCount: session.messages.length,
    };
    const existingIndex = state.sessions.findIndex((s) => s.id === session.id);
    const sessions = [...state.sessions];
    if (existingIndex >= 0) {
      sessions[existingIndex] = summary;
    } else {
      sessions.unshift(summary);
    }
    return {
      ...state,
      stats: { ...state.stats, totalSessions: state.stats.totalSessions + 1 },
      sessions,
      session,
    };
  });
}

export function recordAha(): void {
  updateState((state) => {
    const now = Date.now();
    const lastSolved = state.stats.lastSolvedAt ?? 0;
    const streak = now - lastSolved < 2 * DAY_MS ? state.stats.currentStreak + 1 : 1;
    return {
      ...state,
      stats: {
        ...state.stats,
        problemsSolved: state.stats.problemsSolved + 1,
        ahaMoments: state.stats.ahaMoments + 1,
        lastSolvedAt: now,
        currentStreak: streak,
      },
    };
  });
}

export function resetStats(): void {
  updateState((state) => ({ ...state, stats: { ...DEFAULT_STATS } }));
}

export function getActiveSession(): Session | null {
  return readState().session;
}

export function saveSession(session: Session): void {
  updateState((state) => {
    const sessions = state.sessions.map((s) =>
      s.id === session.id ? { ...s, updatedAt: Date.now(), messageCount: session.messages.length } : s
    );
    return { ...state, session, sessions };
  });
}

export function clearSession(): void {
  updateState((state) => ({ ...state, session: null }));
}

export function clearAllSessions(): void {
  updateState((state) => ({ ...state, session: null, sessions: [] }));
}

export function addToSession(session: Session, role: "user" | "duck", content: string): Session {
  const updated: Session = {
    ...session,
    messages: [...session.messages, { role, content, timestamp: Date.now() }],
  };
  saveSession(updated);
  return updated;
}

export function createSession(mode: DuckMode): Session {
  const session: Session = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    messages: [],
    startedAt: Date.now(),
    mode,
  };
  recordSession(session);
  return session;
}

export function getSessionHistory(session: Session): string {
  return session.messages.map((m) => `${m.role === "user" ? "User" : "Duck"}: ${m.content}`).join("\n\n");
}

export function listSessions(): SessionSummary[] {
  return readState().sessions;
}
