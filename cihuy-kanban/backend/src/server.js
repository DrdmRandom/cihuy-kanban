require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('./db');
const initDb = require('./init-db');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3012;
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '7d';
const DONE_KEYWORDS = ['done', 'selesai', 'complete', 'completed', 'finished'];

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

initDb();

db.pragma('foreign_keys = ON');

const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const normalizedOrigins = new Set(configuredOrigins);
configuredOrigins.forEach((origin) => {
  if (origin.includes('localhost')) {
    normalizedOrigins.add(origin.replace('localhost', '127.0.0.1'));
  }
  if (origin.includes('127.0.0.1')) {
    normalizedOrigins.add(origin.replace('127.0.0.1', 'localhost'));
  }
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || normalizedOrigins.size === 0 || normalizedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

function getSetupStatus() {
  const row = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").get();
  return row.total === 0;
}

function safeDate(dateInput) {
  if (!dateInput) {
    return null;
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toDateKey(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return value.slice(0, 10);
}

function parseColumnId(input) {
  if (input === undefined || input === null || input === '') {
    return null;
  }

  const value = Number(input);
  if (!Number.isInteger(value) || value <= 0) {
    return Number.NaN;
  }

  return value;
}

function isDoneColumn(columnName) {
  if (!columnName) {
    return false;
  }

  const lowered = String(columnName).toLowerCase();
  return DONE_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

function userPublic(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'cihuy-kanban-backend' });
});

app.get('/api/setup/status', (req, res) => {
  res.json({ needsSetup: getSetupStatus() });
});

app.post('/api/setup/admin', (req, res) => {
  if (!getSetupStatus()) {
    return res.status(400).json({ message: 'Admin already exists. Setup is closed.' });
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email.toLowerCase(), passwordHash, 'admin');

  return res.status(201).json({
    message: 'Admin account created',
    userId: result.lastInsertRowid,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );

  return res.json({
    token,
    expiresIn: TOKEN_EXPIRES_IN,
    user: userPublic(user),
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(user);
});

app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all();
  return res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, password are required' });
  }

  const safeRole = role === 'admin' ? 'admin' : 'user';

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already in use' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email.toLowerCase(), passwordHash, safeRole);

  return res.status(201).json({
    id: result.lastInsertRowid,
    name,
    email: email.toLowerCase(),
    role: safeRole,
  });
});

app.get('/api/projects', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as created_by_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL) as task_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NOT NULL) as archived_task_count,
      (SELECT COUNT(*) FROM board_columns bc WHERE bc.project_id = p.id AND bc.archived_at IS NULL) as column_count,
      (SELECT COUNT(*) FROM board_columns bc WHERE bc.project_id = p.id AND bc.archived_at IS NOT NULL) as archived_column_count
    FROM projects p
    LEFT JOIN users u ON u.id = p.created_by
    ORDER BY p.created_at DESC
  `).all();

  return res.json(projects);
});

app.post('/api/projects', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  const result = db
    .prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)')
    .run(name, description || null, req.user.id);

  return res.status(201).json({
    id: result.lastInsertRowid,
    name,
    description: description || null,
  });
});

app.put('/api/projects/:projectId', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const { name, description } = req.body;

  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!existing) {
    return res.status(404).json({ message: 'Project not found' });
  }

  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description || null, projectId);

  return res.json({ message: 'Project updated' });
});

app.delete('/api/projects/:projectId', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!existing) {
    return res.status(404).json({ message: 'Project not found' });
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  return res.json({ message: 'Project deleted' });
});

app.get('/api/projects/:projectId/columns', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const columns = db.prepare(`
    SELECT id, project_id, name, order_index, archived_at, updated_at, created_at
    FROM board_columns
    WHERE project_id = ?
      AND (? = 1 OR archived_at IS NULL)
    ORDER BY archived_at IS NOT NULL ASC, order_index ASC, id ASC
  `).all(projectId, includeArchived ? 1 : 0);

  return res.json(columns);
});

app.post('/api/projects/:projectId/columns', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const orderRow = db
    .prepare('SELECT COALESCE(MAX(order_index), 0) AS max_order FROM board_columns WHERE project_id = ?')
    .get(projectId);

  const result = db
    .prepare("INSERT INTO board_columns (project_id, name, order_index, updated_at) VALUES (?, ?, ?, datetime('now'))")
    .run(projectId, String(name).trim(), orderRow.max_order + 1);

  return res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/columns/:columnId', requireAuth, (req, res) => {
  const columnId = Number(req.params.columnId);
  const { name, order_index } = req.body;

  const column = db.prepare('SELECT * FROM board_columns WHERE id = ?').get(columnId);
  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  const nextName = name ? String(name).trim() : column.name;
  const nextOrder = Number.isInteger(Number(order_index)) ? Number(order_index) : column.order_index;

  db.prepare(`
    UPDATE board_columns
    SET name = ?, order_index = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextName, nextOrder, columnId);

  return res.json({ message: 'Column updated' });
});

app.patch('/api/columns/:columnId/archive', requireAuth, (req, res) => {
  const columnId = Number(req.params.columnId);

  const column = db.prepare('SELECT id, archived_at FROM board_columns WHERE id = ?').get(columnId);
  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  if (column.archived_at) {
    return res.json({ message: 'Column already archived' });
  }

  db.prepare("UPDATE board_columns SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(columnId);
  return res.json({ message: 'Column archived' });
});

app.patch('/api/columns/:columnId/restore', requireAuth, (req, res) => {
  const columnId = Number(req.params.columnId);

  const column = db.prepare('SELECT id, archived_at FROM board_columns WHERE id = ?').get(columnId);
  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  if (!column.archived_at) {
    return res.json({ message: 'Column already active' });
  }

  db.prepare('UPDATE board_columns SET archived_at = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(columnId);
  return res.json({ message: 'Column restored' });
});

app.delete('/api/columns/:columnId', requireAuth, (req, res) => {
  const columnId = Number(req.params.columnId);

  const column = db.prepare('SELECT id FROM board_columns WHERE id = ?').get(columnId);
  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  db.prepare('DELETE FROM board_columns WHERE id = ?').run(columnId);
  return res.json({ message: 'Column deleted' });
});

app.get('/api/projects/:projectId/tasks', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, bc.name as column_name, bc.order_index as column_order
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN board_columns bc ON bc.id = t.column_id
    WHERE t.project_id = ?
      AND (? = 1 OR t.archived_at IS NULL)
    ORDER BY t.archived_at IS NOT NULL ASC, COALESCE(bc.order_index, 9999) ASC, t.created_at DESC
  `).all(projectId, includeArchived ? 1 : 0);

  return res.json(tasks);
});

app.post('/api/projects/:projectId/tasks', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const {
    title,
    description,
    start_date,
    end_date,
    deadline_date,
    note,
    assignee_id,
    column_id,
    status,
  } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const parsedColumnId = parseColumnId(column_id);
  if (Number.isNaN(parsedColumnId)) {
    return res.status(400).json({ message: 'column_id is invalid' });
  }

  let selectedColumn = null;
  if (parsedColumnId !== null) {
    selectedColumn = db
      .prepare('SELECT id, name, archived_at FROM board_columns WHERE id = ? AND project_id = ?')
      .get(parsedColumnId, projectId);

    if (!selectedColumn) {
      return res.status(400).json({ message: 'Column not found in this project' });
    }

    if (selectedColumn.archived_at) {
      return res.status(400).json({ message: 'Cannot assign task to archived column' });
    }
  }

  const isCompleted = isDoneColumn(selectedColumn?.name) || status === 'done';
  const doneAt = isCompleted ? new Date().toISOString() : null;

  const result = db.prepare(`
    INSERT INTO tasks (
      project_id, title, description, status, start_date, end_date, deadline_date, note, assignee_id, done_at, created_by, column_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    title,
    description || null,
    isCompleted ? 'done' : 'todo',
    safeDate(start_date),
    safeDate(end_date),
    safeDate(deadline_date),
    note || null,
    assignee_id || null,
    doneAt,
    req.user.id,
    parsedColumnId
  );

  return res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/tasks/:taskId', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const {
    title,
    description,
    status,
    start_date,
    end_date,
    deadline_date,
    note,
    assignee_id,
    column_id,
  } = req.body;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const hasColumnUpdate = Object.prototype.hasOwnProperty.call(req.body, 'column_id');
  let nextColumnId = existing.column_id;

  if (hasColumnUpdate) {
    const parsedColumnId = parseColumnId(column_id);
    if (Number.isNaN(parsedColumnId)) {
      return res.status(400).json({ message: 'column_id is invalid' });
    }
    nextColumnId = parsedColumnId;
  }

  let selectedColumn = null;
  if (nextColumnId !== null) {
    selectedColumn = db
      .prepare('SELECT id, name, archived_at FROM board_columns WHERE id = ? AND project_id = ?')
      .get(nextColumnId, existing.project_id);

    if (!selectedColumn) {
      return res.status(400).json({ message: 'Column not found in this project' });
    }

    if (selectedColumn.archived_at) {
      return res.status(400).json({ message: 'Cannot assign task to archived column' });
    }
  }

  const isCompleted = isDoneColumn(selectedColumn?.name) || status === 'done';
  let doneAt = existing.done_at;

  if (isCompleted && !existing.done_at) {
    doneAt = new Date().toISOString();
  }
  if (!isCompleted) {
    doneAt = null;
  }

  db.prepare(`
    UPDATE tasks
    SET
      title = ?,
      description = ?,
      status = ?,
      start_date = ?,
      end_date = ?,
      deadline_date = ?,
      note = ?,
      assignee_id = ?,
      done_at = ?,
      column_id = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || existing.title,
    description ?? existing.description,
    isCompleted ? 'done' : 'todo',
    safeDate(start_date) ?? existing.start_date,
    safeDate(end_date) ?? existing.end_date,
    safeDate(deadline_date) ?? existing.deadline_date,
    note ?? existing.note,
    assignee_id ?? existing.assignee_id,
    doneAt,
    nextColumnId,
    taskId
  );

  return res.json({ message: 'Task updated' });
});

app.patch('/api/tasks/:taskId/archive', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.prepare('SELECT id, archived_at FROM tasks WHERE id = ?').get(taskId);

  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (existing.archived_at) {
    return res.json({ message: 'Task already archived' });
  }

  db.prepare("UPDATE tasks SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(taskId);
  return res.json({ message: 'Task archived' });
});

app.patch('/api/tasks/:taskId/restore', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.prepare('SELECT id, archived_at FROM tasks WHERE id = ?').get(taskId);

  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (!existing.archived_at) {
    return res.json({ message: 'Task already active' });
  }

  db.prepare("UPDATE tasks SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?").run(taskId);
  return res.json({ message: 'Task restored' });
});

app.delete('/api/tasks/:taskId', requireAuth, (req, res) => {
  const taskId = Number(req.params.taskId);
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);

  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  return res.json({ message: 'Task deleted' });
});

app.get('/api/projects/:projectId/analytics/s-curve', requireAuth, (req, res) => {
  const projectId = Number(req.params.projectId);
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const tasks = db.prepare('SELECT end_date, done_at FROM tasks WHERE project_id = ? AND archived_at IS NULL').all(projectId);

  if (tasks.length === 0) {
    return res.json({ points: [] });
  }

  const plannedMap = {};
  const actualMap = {};
  const allDates = [];

  tasks.forEach((task) => {
    const plannedDate = toDateKey(task.end_date);
    if (plannedDate) {
      plannedMap[plannedDate] = (plannedMap[plannedDate] || 0) + 1;
      allDates.push(plannedDate);
    }

    const doneDate = toDateKey(task.done_at);
    if (doneDate) {
      actualMap[doneDate] = (actualMap[doneDate] || 0) + 1;
      allDates.push(doneDate);
    }
  });

  if (allDates.length === 0) {
    return res.json({ points: [] });
  }

  allDates.sort();
  const firstDate = new Date(`${allDates[0]}T00:00:00Z`);
  const lastDate = new Date(`${allDates[allDates.length - 1]}T00:00:00Z`);

  const points = [];
  let plannedCumulative = 0;
  let actualCumulative = 0;

  for (
    let cursor = new Date(firstDate);
    cursor <= lastDate;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const dateKey = cursor.toISOString().slice(0, 10);
    plannedCumulative += plannedMap[dateKey] || 0;
    actualCumulative += actualMap[dateKey] || 0;

    points.push({
      date: dateKey,
      planned: plannedCumulative,
      actual: actualCumulative,
    });
  }

  return res.json({ points });
});

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`cihuy-kanban backend running on port ${PORT}`);
});

