import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkEnvFile, parseEnvFile, requiredKeys, PLACEHOLDER_VALUES } from './envFile.js';

// ── The configuration file, checked as part of the test suite ───────────────
// This exists because of a real incident: `apps/api/.env` was tracked in git, a
// `git stash` on the server restored the repository's development copy over it,
// and the deploy carried on. The database URL, the signing secret and both
// Telegram bot tokens were gone, and nothing said so — the API kept serving
// from its old process environment until it was restarted.
//
// deploy.sh runs this suite with VMENU_DEPLOY=1, before the migrations and
// before pm2 is restarted, so the strict half below now stands between that
// state and a deploy.

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENV_FILE = join(API_DIR, '.env');
const EXAMPLE_FILE = join(API_DIR, '.env.example');

const REAL = /** the file this machine actually has */ existsSync(ENV_FILE)
  ? readFileSync(ENV_FILE, 'utf8')
  : null;
const EXAMPLE = readFileSync(EXAMPLE_FILE, 'utf8');

/** deploy.sh sets this. A developer's machine is meant to hold the dev values. */
const DEPLOYING = process.env.VMENU_DEPLOY === '1';

const GOOD = [
  'DATABASE_URL="postgresql://vmenu:secret@localhost:5432/vmenu"',
  'PORT=4000',
  'JWT_SECRET="a-real-secret-that-is-long-enough-xxxx"',
  'TELEGRAM_BOT_TOKEN="123:abc"',
  'TELEGRAM_WEBHOOK_SECRET="hook-secret"',
  'TELEGRAM_PUBLIC_URL="https://event.v-menu.uz"',
].join('\n');

const check = (text: string, deployment = false) =>
  checkEnvFile(parseEnvFile(text), { deployment, required: requiredKeys(EXAMPLE) });
const messages = (text: string, deployment = false) => check(text, deployment).map((p) => p.message).join(' | ');

describe('parsing a .env file', () => {
  it('reads the ordinary shape', () => {
    const { values } = parseEnvFile('DATABASE_URL=postgresql://a/b\nPORT=4000');
    expect(values).toEqual({ DATABASE_URL: 'postgresql://a/b', PORT: '4000' });
  });

  it('accepts the shapes a hand-edited file actually turns up in', () => {
    const { values, malformed } = parseEnvFile([
      'DATABASE_URL="postgresql://a/b"',
      "JWT_SECRET='single-quoted'",
      '  export PORT = 4000',
      '',
      '# a comment',
    ].join('\n'));
    expect(values.DATABASE_URL).toBe('postgresql://a/b');
    expect(values.JWT_SECRET).toBe('single-quoted');
    expect(values.PORT).toBe('4000');
    expect(malformed).toEqual([]);
  });

  it('survives CRLF line endings', () => {
    const { values, malformed } = parseEnvFile('DATABASE_URL="postgresql://a/b"\r\nPORT=4000\r\n');
    // A \r welded onto the database name is a connection failure with a
    // baffling message, so it must not survive the parse.
    expect(values.DATABASE_URL).toBe('postgresql://a/b');
    expect(malformed).toEqual([]);
  });

  it('reports a pm2-format paste rather than silently ignoring it', () => {
    // `pm2 env` prints "KEY: value". Pasted into a .env, dotenv reads nothing
    // at all and the API starts with no configuration.
    const { values, malformed } = parseEnvFile('DATABASE_URL: postgresql://a/b\nJWT_SECRET: abc');
    expect(values).toEqual({});
    expect(malformed).toEqual([1, 2]);
    expect(messages('DATABASE_URL: postgresql://a/b')).toContain('KEY=VALUE');
  });

  it('flags a key set twice, where the last line silently wins', () => {
    const { values, duplicates } = parseEnvFile('PORT=4000\nPORT=5000');
    expect(values.PORT).toBe('5000');
    expect(duplicates).toEqual(['PORT']);
    expect(messages('PORT=4000\nPORT=5000')).toContain('more than once');
  });
});

describe('what every machine must have', () => {
  it('accepts a well-formed file', () => {
    expect(check(GOOD)).toEqual([]);
  });

  it('accepts the local development file', () => {
    // The SQLite URL and the placeholder secret are correct on a laptop; only a
    // deploy refuses them.
    expect(check('DATABASE_URL="file:./dev.db"\nJWT_SECRET="replace-with-at-least-32-random-characters"')).toEqual([]);
  });

  it('catches a missing database URL or signing secret', () => {
    expect(messages('PORT=4000')).toContain('DATABASE_URL is missing');
    expect(messages('PORT=4000')).toContain('JWT_SECRET is missing');
  });

  it('catches an empty value, not just an absent key', () => {
    expect(messages('DATABASE_URL=\nJWT_SECRET=""')).toContain('DATABASE_URL is missing or empty');
  });

  it('catches a signing secret too short for env.ts to accept', () => {
    // Otherwise this fails at boot — after the migrations have run.
    expect(messages('DATABASE_URL=postgresql://a/b\nJWT_SECRET="tooshort"')).toContain('32 characters');
  });
});

describe('the Telegram bots go silent without a word', () => {
  // registerWebhook() returns early when the URL or the secret is missing. The
  // API boots, the logs look normal, and no message ever arrives again.
  const base = 'DATABASE_URL=postgresql://a/b\nJWT_SECRET="a-real-secret-that-is-long-enough-xxxx"\n';

  it('flags a bot token with no webhook secret', () => {
    expect(messages(base + 'TELEGRAM_BOT_TOKEN="123:abc"\nTELEGRAM_PUBLIC_URL="https://x.uz"'))
      .toContain('the webhook is never registered');
  });

  it('flags a bot token with nowhere to deliver to', () => {
    expect(messages(base + 'TELEGRAM_BOT_TOKEN="123:abc"\nTELEGRAM_WEBHOOK_SECRET="s"'))
      .toContain('nowhere to deliver');
  });

  it('flags the invitation bot the same way', () => {
    expect(messages(base + 'TELEGRAM_INVITE_BOT_TOKEN="123:abc"'))
      .toContain("invitation bot's webhook is never registered");
  });

  it('accepts the invitation bot borrowing the main webhook secret', () => {
    // TELEGRAM_INVITE_WEBHOOK_SECRET falls back to the main one by design.
    expect(check(GOOD + '\nTELEGRAM_INVITE_BOT_TOKEN="456:def"')).toEqual([]);
  });

  it('requires an absolute origin, since Telegram is told where to POST', () => {
    expect(messages(base + 'TELEGRAM_BOT_TOKEN="1"\nTELEGRAM_WEBHOOK_SECRET="s"\nTELEGRAM_PUBLIC_URL="event.v-menu.uz"'))
      .toContain('absolute https:// origin');
  });

  it('says nothing when no bot is configured at all', () => {
    // Telegram is optional by design; only a HALF-configured bot is a bug.
    expect(check(base)).toEqual([]);
  });
});

describe('deploying', () => {
  it('accepts a real server file', () => {
    expect(check(GOOD, true)).toEqual([]);
  });

  it('REFUSES the repository\'s development file', () => {
    // The incident, as a test: this is exactly what a `git stash` leaves behind.
    const stashed = [
      'DATABASE_URL="file:./dev.db"',
      'PORT=4000',
      'JWT_SECRET="replace-with-at-least-32-random-characters"',
    ].join('\n');
    const problems = check(stashed, true);
    expect(problems.length).toBeGreaterThan(0);
    const text = problems.map((p) => p.message).join(' | ');
    expect(text).toContain('the server\'s file was replaced');
    expect(text).toContain('example value');
  });

  it('refuses a database that is not postgres', () => {
    expect(messages('DATABASE_URL="mysql://a/b"\nJWT_SECRET="a-real-secret-that-is-long-enough-xxxx"', true))
      .toContain('not a postgres URL');
  });

  it('refuses any value still carrying an example from .env.example', () => {
    for (const placeholder of PLACEHOLDER_VALUES) {
      const text = `DATABASE_URL="postgresql://${placeholder === 'user:password' ? placeholder : 'a:b'}@h/db"\n`
        + `JWT_SECRET="${placeholder === 'user:password' ? 'a-real-secret-that-is-long-enough-xxxx' : placeholder}"`;
      expect(messages(text, true)).toContain('example value');
    }
  });

  it('enforces every key .env.example marks "# required"', () => {
    const required = requiredKeys(EXAMPLE);
    expect(required).toContain('DATABASE_URL');
    expect(required).toContain('JWT_SECRET');
    // The Telegram trio is what went missing and was not noticed for days.
    expect(required).toContain('TELEGRAM_BOT_TOKEN');
    expect(required).toContain('TELEGRAM_WEBHOOK_SECRET');
    expect(required).toContain('TELEGRAM_PUBLIC_URL');

    const withoutBots = 'DATABASE_URL="postgresql://a/b"\nJWT_SECRET="a-real-secret-that-is-long-enough-xxxx"';
    expect(messages(withoutBots, true)).toContain('TELEGRAM_BOT_TOKEN');
  });

  it('does not treat an optional key as required', () => {
    const required = requiredKeys(EXAMPLE);
    // These fall back or switch a feature off; a deploy must not need them.
    for (const key of ['PORT', 'ADMIN_API_KEY', 'GOOGLE_CLIENT_ID', 'TELEGRAM_INVITE_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME']) {
      expect(required).not.toContain(key);
    }
  });

  it('reports keys, never values — this output reaches logs and screenshots', () => {
    const secretish = 'DATABASE_URL="postgresql://vmenu:hunter2@localhost:5432/vmenu"\nJWT_SECRET="short"';
    const text = JSON.stringify(check(secretish, true));
    expect(text).not.toContain('hunter2');
  });
});

// ── The file this machine actually has ──────────────────────────────────────
describe(`the real apps/api/.env${DEPLOYING ? ' (deployment)' : ''}`, () => {
  it('exists', () => {
    // On a server this means the deploy would have started the API with no
    // configuration at all.
    expect(REAL, `${ENV_FILE} is missing — copy it from .env.example and fill it in`).not.toBeNull();
  });

  it('has no structural problems and no half-configured bot', () => {
    if (REAL === null) return;
    const problems = checkEnvFile(parseEnvFile(REAL), {
      deployment: DEPLOYING,
      required: requiredKeys(EXAMPLE),
    });
    // Keys and explanations only; the values never leave the machine.
    expect(problems.map((p) => p.message), problems.map((p) => `\n  · ${p.message}`).join('')).toEqual([]);
  });
});
