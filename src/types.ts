export type DuckMode = "gentle" | "tough";

export type OutputFormat = "text" | "jsonl" | "json";

export type Role = "user" | "duck";

export interface SessionMessage {
  role: Role;
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  messages: SessionMessage[];
  startedAt: number;
  mode: DuckMode;
}

export interface SessionSummary {
  id: string;
  startedAt: number;
  updatedAt: number;
  mode: DuckMode;
  messageCount: number;
}

export interface Stats {
  problemsSolved: number;
  ahaMoments: number;
  totalSessions: number;
  lastSolvedAt: number | null;
  currentStreak: number;
  mode: DuckMode;
}

export interface PersistedState {
  configVersion: number;
  session: Session | null;
  stats: Stats;
  sessions: SessionSummary[];
}

export interface AskOptions {
  userInput: string;
  mode: DuckMode;
  sessionHistory?: string;
  context?: string;
}

export interface AskResult {
  text: string;
  source: "provider" | "fallback";
  reason?: "spawn_error" | "timeout" | "nonzero_exit" | "empty_output";
}

export interface GiveUpResult extends AskResult {}

export interface DuckProvider {
  askSocraticQuestion(options: AskOptions): Promise<AskResult>;
  giveUpAndGetAnswer(userInput: string, sessionHistory?: string): Promise<GiveUpResult>;
}

export interface RunResult {
  ok: boolean;
  code: number;
  response?: string;
  error?: string;
}
