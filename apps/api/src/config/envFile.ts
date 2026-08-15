// ── Checking the .env file itself ────────────────────────────────────────────
// `env.ts` validates the values the process ended up with. This checks the FILE
// they are supposed to come from, which is a different question and the one
// that has actually bitten us: `apps/api/.env` used to be tracked in git, so a
// `git stash` on the server restored the repository's development copy over it
// and took the database URL, the signing secret and both Telegram bot tokens
// with it. Nothing failed loudly — the API kept running on its old process
// environment until it was restarted.
//
// Everything here is pure and takes the file's text, so the rules can be tested
// against crafted input; `envFile.test.ts` then runs them over the real file.
//
// NOTHING in this module ever puts a VALUE in a message. Problems name keys
// only: the output goes to a terminal, a CI log and possibly a screenshot.

export type EnvProblem = {
  key?: string;
  message: string;
};

export type ParsedEnv = {
  /** Key → value, later duplicates winning, exactly as dotenv resolves them. */
  values: Record<string, string>;
  /** Keys defined more than once. A later line silently beats an earlier one. */
  duplicates: string[];
  /** Line numbers that are neither blank, a comment, nor KEY=VALUE. */
  malformed: number[];
};

/**
 * Parse a .env file the way dotenv does, plus the shapes people actually type.
 *
 * Accepts an `export` prefix, surrounding whitespace, single or double quotes
 * and CRLF endings. Anything else counts as malformed rather than being quietly
 * ignored — which is what dotenv does, and is how a file pasted in pm2's
 * `KEY: value` display format ends up loading no configuration at all.
 */
export function parseEnvFile(text: string): ParsedEnv {
  const values: Record<string, string> = {};
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const malformed: number[] = [];

  text.split('\n').forEach((rawLine, i) => {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) return;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      malformed.push(i + 1);
      return;
    }
    const key = match[1]!;
    let value = match[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    values[key] = value;
  });

  return { values, duplicates, malformed };
}

/**
 * Keys the example file marks `# required`.
 *
 * The marker applies to the next assignment below it, so the example doubles as
 * the deployment checklist — adding a variable the server must have is a matter
 * of marking it there, and removing the bots is a deliberate edit to this file
 * rather than a deploy that fails.
 */
export function requiredKeys(exampleText: string): string[] {
  const keys: string[] = [];
  let armed = false;
  for (const rawLine of exampleText.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim();
    if (!line) continue;
    if (/^#\s*required\s*$/i.test(line)) { armed = true; continue; }
    if (line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) continue;
    if (armed) keys.push(match[1]!);
    armed = false;
  }
  return keys;
}

/**
 * Values this repository ships as examples. Finding one in a real .env means
 * the file IS the repository's copy — the exact state a stash or a checkout
 * leaves behind — not that somebody chose a weak password.
 */
export const PLACEHOLDER_VALUES = [
  'replace-with-at-least-32-random-characters',
  'dev-only-change-this-to-a-long-random-string-32chars',
  'change-me-please',
  'user:password',
];

const TELEGRAM_MAIN = 'TELEGRAM_BOT_TOKEN';
const TELEGRAM_SECRET = 'TELEGRAM_WEBHOOK_SECRET';
const TELEGRAM_URL = 'TELEGRAM_PUBLIC_URL';
const TELEGRAM_INVITE = 'TELEGRAM_INVITE_BOT_TOKEN';

/**
 * Everything wrong with a parsed .env.
 *
 * `deployment: true` adds the rules that only make sense on a server — a real
 * database, no example values, and every key the example marks required. On a
 * developer's machine those would all fail by design, since the local file is
 * meant to hold the SQLite URL and the placeholder secret.
 */
export function checkEnvFile(
  parsed: ParsedEnv,
  options: { deployment?: boolean; required?: string[] } = {},
): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const { values, duplicates, malformed } = parsed;
  const has = (key: string) => typeof values[key] === 'string' && values[key]!.trim() !== '';

  // ── Structure (everywhere) ────────────────────────────────────────────────
  for (const line of malformed) {
    problems.push({
      message: `line ${line} is not KEY=VALUE — dotenv ignores it silently `
        + `(pm2 prints "KEY: value"; a .env needs "KEY=value")`,
    });
  }
  for (const key of duplicates) {
    problems.push({ key, message: `${key} is set more than once — the last line silently wins` });
  }

  // ── Values the process cannot start without ───────────────────────────────
  if (!has('DATABASE_URL')) problems.push({ key: 'DATABASE_URL', message: 'DATABASE_URL is missing or empty' });
  if (!has('JWT_SECRET')) {
    problems.push({ key: 'JWT_SECRET', message: 'JWT_SECRET is missing or empty' });
  } else if (values.JWT_SECRET!.length < 32) {
    // Mirrors the zod rule in env.ts, so this fails at test time rather than at
    // boot — after the migrations have already run.
    problems.push({ key: 'JWT_SECRET', message: 'JWT_SECRET is shorter than the 32 characters env.ts requires' });
  }

  // ── Telegram: a token with nowhere to deliver to ──────────────────────────
  // registerWebhook() returns without a word when either of these is missing,
  // so the bot boots, logs nothing, and never receives another message.
  if (has(TELEGRAM_MAIN)) {
    if (!has(TELEGRAM_SECRET)) {
      problems.push({ key: TELEGRAM_SECRET, message: `${TELEGRAM_MAIN} is set but ${TELEGRAM_SECRET} is not — the webhook is never registered and the bot goes silent` });
    }
    if (!has(TELEGRAM_URL)) {
      problems.push({ key: TELEGRAM_URL, message: `${TELEGRAM_MAIN} is set but ${TELEGRAM_URL} is not — Telegram has nowhere to deliver updates` });
    }
  }
  if (has(TELEGRAM_INVITE) && !has(TELEGRAM_URL)) {
    problems.push({ key: TELEGRAM_URL, message: `${TELEGRAM_INVITE} is set but ${TELEGRAM_URL} is not — the invitation bot's webhook is never registered` });
  }
  if (has(TELEGRAM_URL) && !/^https?:\/\//.test(values[TELEGRAM_URL]!)) {
    problems.push({ key: TELEGRAM_URL, message: `${TELEGRAM_URL} must be an absolute https:// origin` });
  }

  if (!options.deployment) return problems;

  // ── Deployment only ───────────────────────────────────────────────────────
  const url = values.DATABASE_URL ?? '';
  if (url.startsWith('file:')) {
    problems.push({
      key: 'DATABASE_URL',
      message: 'DATABASE_URL is the SQLite development URL. This is the repository\'s own .env — '
        + 'the server\'s file was replaced (a git stash, checkout or reset does this). Restore it.',
    });
  } else if (url && !/^postgres(ql)?:\/\//.test(url)) {
    problems.push({ key: 'DATABASE_URL', message: 'DATABASE_URL is not a postgres URL, but schema.prisma is provider = "postgresql"' });
  }

  for (const [key, value] of Object.entries(values)) {
    if (PLACEHOLDER_VALUES.some((placeholder) => value.includes(placeholder))) {
      problems.push({
        key,
        message: `${key} still holds the example value from .env.example — this file is the repository's copy, not the server's`,
      });
    }
  }

  for (const key of options.required ?? []) {
    if (!has(key)) {
      problems.push({ key, message: `${key} is marked "# required" in .env.example but is missing here` });
    }
  }

  return problems;
}
