import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createToken, hashPassword, publicUser, verifyPassword } from './auth.js';
import { dbFile, emptyAccount, readDb, updateDb } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(here, '..', 'dist');

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const MAX_TEXT_LENGTH = 2_000_000; // ~2 MB of characters per field
const MAX_TITLE_LENGTH = 300;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// Allow the Vite dev server (or any other origin) to call the API directly.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

function cleanTitle(value) {
  return cleanText(value, MAX_TITLE_LENGTH).trim();
}

function cleanEmail(value) {
  return cleanText(value, 200).trim().toLowerCase();
}

function cleanName(value) {
  return cleanText(value, 80).trim();
}

function publicNote(note) {
  return {
    id: note.id,
    t: note.t,
    x: note.x,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function publicTask(task) {
  return {
    id: task.id,
    t: task.t,
    done: Boolean(task.done),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function cleanDone(value) {
  return typeof value === 'boolean' ? value : undefined;
}

function accountFor(db, userId) {
  return db.accounts[userId] || emptyAccount();
}

function writableAccount(db, userId) {
  if (!db.accounts[userId]) db.accounts[userId] = emptyAccount();
  return db.accounts[userId];
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function authenticate(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Please sign in to continue.' });
      return;
    }

    const db = await readDb();
    const session = db.sessions.find((item) => item.token === token);
    const user = session && db.users.find((item) => item.id === session.userId);
    if (!user) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

function addSession(db, userId) {
  const token = createToken();
  db.sessions.push({ token, userId, createdAt: new Date().toISOString() });
  return token;
}

app.get('/api/health', async (_req, res, next) => {
  try {
    const db = await readDb();
    res.json({ ok: true, users: db.users.length, storage: dbFile });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = cleanEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const name = cleanName(req.body?.name);

    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Use a password of at least 8 characters.' });
      return;
    }

    const result = await updateDb((db) => {
      if (db.users.some((user) => user.email === email)) {
        return { error: 'An account with that email already exists.' };
      }
      const now = new Date().toISOString();
      const user = {
        id: randomUUID(),
        email,
        name,
        passwordHash: hashPassword(password),
        createdAt: now,
      };
      db.users.push(user);
      return { user, token: addSession(db, user.id) };
    });

    if (result.error) {
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(201).json({ token: result.token, user: publicUser(result.user) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = cleanEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const db = await readDb();
    const user = db.users.find((item) => item.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Incorrect email or password.' });
      return;
    }

    const token = await updateDb((current) => addSession(current, user.id));
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', authenticate, async (req, res, next) => {
  try {
    await updateDb((db) => {
      db.sessions = db.sessions.filter((session) => session.token !== req.token);
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/draft', authenticate, async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(accountFor(db, req.user.id).draft);
  } catch (error) {
    next(error);
  }
});

app.put('/api/draft', authenticate, async (req, res, next) => {
  try {
    const t = cleanTitle(req.body?.t);
    const x = cleanText(req.body?.x);
    const updatedAt = new Date().toISOString();

    const draft = await updateDb((db) => {
      const account = writableAccount(db, req.user.id);
      account.draft = { t, x, updatedAt };
      return account.draft;
    });

    res.json(draft);
  } catch (error) {
    next(error);
  }
});

app.get('/api/notes', authenticate, async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(accountFor(db, req.user.id).notes.map(publicNote));
  } catch (error) {
    next(error);
  }
});

app.post('/api/notes', authenticate, async (req, res, next) => {
  try {
    const t = cleanTitle(req.body?.t);
    const x = cleanText(req.body?.x);

    if (!x.trim()) {
      res.status(400).json({ error: 'A note needs some text before it can be saved.' });
      return;
    }

    const now = new Date().toISOString();
    const note = { id: randomUUID(), t, x, createdAt: now, updatedAt: now };

    await updateDb((db) => {
      writableAccount(db, req.user.id).notes.unshift(note);
    });

    res.status(201).json(publicNote(note));
  } catch (error) {
    next(error);
  }
});

app.put('/api/notes/:id', authenticate, async (req, res, next) => {
  try {
    const t = cleanTitle(req.body?.t);
    const x = cleanText(req.body?.x);

    const note = await updateDb((db) => {
      const existing = writableAccount(db, req.user.id).notes.find(
        (item) => item.id === req.params.id
      );
      if (!existing) return null;
      if (req.body?.t !== undefined) existing.t = t;
      if (req.body?.x !== undefined) existing.x = x;
      existing.updatedAt = new Date().toISOString();
      return existing;
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }

    res.json(publicNote(note));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/notes/:id', authenticate, async (req, res, next) => {
  try {
    const removed = await updateDb((db) => {
      const notes = writableAccount(db, req.user.id).notes;
      const index = notes.findIndex((item) => item.id === req.params.id);
      if (index === -1) return false;
      notes.splice(index, 1);
      return true;
    });

    if (!removed) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks', authenticate, async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(accountFor(db, req.user.id).tasks.map(publicTask));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', authenticate, async (req, res, next) => {
  try {
    const t = cleanTitle(req.body?.t);

    if (!t) {
      res.status(400).json({ error: 'A task needs a title before it can be saved.' });
      return;
    }

    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      t,
      done: cleanDone(req.body?.done) ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await updateDb((db) => {
      writableAccount(db, req.user.id).tasks.unshift(task);
    });

    res.status(201).json(publicTask(task));
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', authenticate, async (req, res, next) => {
  try {
    const t = cleanTitle(req.body?.t);
    const done = cleanDone(req.body?.done);

    const task = await updateDb((db) => {
      const existing = writableAccount(db, req.user.id).tasks.find(
        (item) => item.id === req.params.id
      );
      if (!existing) return null;
      if (req.body?.t !== undefined) existing.t = t;
      if (done !== undefined) existing.done = done;
      if (req.body?.t === undefined && done === undefined) return existing;
      existing.updatedAt = new Date().toISOString();
      return existing;
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.json(publicTask(task));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', authenticate, async (req, res, next) => {
  try {
    const removed = await updateDb((db) => {
      const tasks = writableAccount(db, req.user.id).tasks;
      const index = tasks.findIndex((item) => item.id === req.params.id);
      if (index === -1) return false;
      tasks.splice(index, 1);
      return true;
    });

    if (!removed) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Unknown API endpoint.' });
});

// In production the API also serves the built frontend.
if (existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      message:
        'API is running. Run "npm run dev" for the frontend, or "npm run build" then restart to serve it from here.',
    });
  });
}

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed' || error?.status === 400) {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
  console.log(`Data file: ${dbFile}`);
  if (existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.log(`Serving the built frontend from ${DIST_DIR}`);
  }
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
