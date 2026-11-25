import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(here, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export function emptyAccount() {
  return {
    draft: { t: '', x: '', updatedAt: null },
    notes: [],
    tasks: [],
  };
}

const EMPTY_DB = {
  users: [],
  sessions: [],
  accounts: {},
};

let queue = Promise.resolve();

function normalizeAccount(value) {
  const draft = value && typeof value.draft === 'object' && value.draft ? value.draft : {};
  return {
    draft: {
      t: typeof draft.t === 'string' ? draft.t : '',
      x: typeof draft.x === 'string' ? draft.x : '',
      updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : null,
    },
    notes: Array.isArray(value?.notes) ? value.notes : [],
    tasks: Array.isArray(value?.tasks) ? value.tasks : [],
  };
}

function normalizeDb(value) {
  const accounts = value?.accounts && typeof value.accounts === 'object' ? value.accounts : {};
  return {
    users: Array.isArray(value?.users) ? value.users : [],
    sessions: Array.isArray(value?.sessions) ? value.sessions : [],
    accounts: Object.fromEntries(
      Object.entries(accounts).map(([id, account]) => [id, normalizeAccount(account)])
    ),
  };
}

async function readFileDb() {
  try {
    const raw = await readFile(DB_FILE, 'utf8');
    return normalizeDb(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY_DB);
    throw error;
  }
}

async function writeFileDb(db) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  await rename(temp, DB_FILE);
}

/** Read the current database snapshot. */
export function readDb() {
  return queue.then(readFileDb);
}

/**
 * Apply a change to the database and persist it. Writes are serialized so two
 * requests can never overwrite each other's changes.
 */
export function updateDb(mutator) {
  const run = queue.then(async () => {
    const db = await readFileDb();
    const result = await mutator(db);
    await writeFileDb(db);
    return result;
  });

  // Keep the queue alive even if a write fails.
  queue = run.catch(() => {});
  return run;
}

export const dbFile = DB_FILE;
