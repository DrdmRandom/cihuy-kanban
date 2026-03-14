import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3012/api';
const TOKEN_KEY = 'cihuy_token';
const THEME_KEY = 'cihuy_theme';

const emptyTaskForm = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  deadline_date: '',
  assignee_id: '',
  note: '',
};

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function toInputDate(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.slice(0, 10);
}

function App() {
  const [needsSetup, setNeedsSetup] = useState(true);
  const [setupChecked, setSetupChecked] = useState(false);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [activeMainTab, setActiveMainTab] = useState('dashboard');
  const [projectViewTab, setProjectViewTab] = useState('kanban');
  const [columns, setColumns] = useState([]);
  const [archivedColumns, setArchivedColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [sCurvePoints, setSCurvePoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [newColumnName, setNewColumnName] = useState('');
  const [taskForms, setTaskForms] = useState({});
  const [openTaskFormColumnId, setOpenTaskFormColumnId] = useState(null);
  const [showArchivedColumns, setShowArchivedColumns] = useState(false);
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [editColumnForm, setEditColumnForm] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme());

  const client = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE });

    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (err) => {
        if (err?.response?.status === 401 && token) {
          logout('Sesi habis. Silakan login lagi.');
        }
        return Promise.reject(err);
      }
    );

    return instance;
  }, [token]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  async function checkSetupStatus() {
    try {
      const response = await axios.get(`${API_BASE}/setup/status`);
      setNeedsSetup(response.data.needsSetup);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal cek status setup backend');
    } finally {
      setSetupChecked(true);
    }
  }

  async function loadAuthedData() {
    setLoading(true);
    setError('');

    try {
      const [meResp, usersResp, projectsResp] = await Promise.all([
        client.get('/me'),
        client.get('/users'),
        client.get('/projects'),
      ]);

      setUser(meResp.data);
      setUsers(usersResp.data || []);
      setProjects(projectsResp.data || []);

      if (!selectedProjectId && projectsResp.data.length > 0) {
        setSelectedProjectId(projectsResp.data[0].id);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal load data awal');
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectData(projectId) {
    if (!projectId) {
      setColumns([]);
      setArchivedColumns([]);
      setTasks([]);
      setArchivedTasks([]);
      setSCurvePoints([]);
      return;
    }

    try {
      const [columnsResp, tasksResp, chartResp] = await Promise.all([
        client.get(`/projects/${projectId}/columns`, { params: { includeArchived: 1 } }),
        client.get(`/projects/${projectId}/tasks`, { params: { includeArchived: 1 } }),
        client.get(`/projects/${projectId}/analytics/s-curve`),
      ]);

      const allColumns = columnsResp.data || [];
      setColumns(allColumns.filter((column) => !column.archived_at));
      setArchivedColumns(allColumns.filter((column) => Boolean(column.archived_at)));
      const allTasks = tasksResp.data || [];
      setTasks(allTasks.filter((task) => !task.archived_at));
      setArchivedTasks(allTasks.filter((task) => Boolean(task.archived_at)));
      setSCurvePoints(chartResp.data?.points || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal load data project');
    }
  }

  function openProjectTab(projectId) {
    setSelectedProjectId(projectId);
    setActiveMainTab(`project:${projectId}`);
    setProjectViewTab('kanban');
  }

  function logout(message = '') {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUser(null);
    setUsers([]);
    setProjects([]);
    setSelectedProjectId(null);
    setActiveMainTab('dashboard');
    setProjectViewTab('kanban');
    setColumns([]);
    setArchivedColumns([]);
    setTasks([]);
    setArchivedTasks([]);
    setShowArchivedColumns(false);
    setShowArchivedTasks(false);
    setEditColumnForm(null);
    setEditTaskForm(null);
    setSCurvePoints([]);
    if (message) {
      setInfo(message);
    }
  }

  async function handleSetupAdmin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setError('');
      setInfo('');
      await axios.post(`${API_BASE}/setup/admin`, {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
      });
      setInfo('Admin berhasil dibuat. Silakan login.');
      await checkSetupStatus();
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal membuat admin');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setError('');
      setInfo('');
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: formData.get('email'),
        password: formData.get('password'),
      });

      const nextToken = response.data.token;
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      setInfo(`Login berhasil. Token berlaku ${response.data.expiresIn}.`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Login gagal');
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    try {
      setError('');
      await client.post('/users', newUserForm);
      setNewUserForm({ name: '', email: '', password: '', role: 'user' });
      const usersResp = await client.get('/users');
      setUsers(usersResp.data || []);
      setInfo('User baru berhasil dibuat.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal buat user');
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    if (!projectForm.name) {
      return;
    }

    try {
      setError('');
      const created = await client.post('/projects', projectForm);
      setProjectForm({ name: '', description: '' });

      const projectsResp = await client.get('/projects');
      setProjects(projectsResp.data || []);

      if (created.data?.id) {
        openProjectTab(created.data.id);
      }

      setInfo('Project dibuat.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal buat project');
    }
  }

  async function handleCreateColumn(event) {
    event.preventDefault();
    if (!selectedProjectId || !newColumnName.trim()) {
      return;
    }

    try {
      setError('');
      await client.post(`/projects/${selectedProjectId}/columns`, { name: newColumnName.trim() });
      setNewColumnName('');
      await loadProjectData(selectedProjectId);
      setInfo('Card/list kanban berhasil dibuat.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal buat card/list kanban');
    }
  }

  function handleEditColumn(columnId) {
    const target = [...columns, ...archivedColumns].find((column) => column.id === columnId);
    if (!target) {
      return;
    }

    setEditColumnForm({
      id: target.id,
      name: target.name || '',
    });
    setError('');
  }

  async function submitEditColumn(event) {
    event.preventDefault();
    if (!editColumnForm) {
      return;
    }

    const trimmedName = String(editColumnForm.name || '').trim();
    if (!trimmedName) {
      setError('Nama card/list tidak boleh kosong.');
      return;
    }

    try {
      setError('');
      await client.put(`/columns/${editColumnForm.id}`, { name: trimmedName });
      setEditColumnForm(null);
      await loadProjectData(selectedProjectId);
      setInfo('Nama card/list berhasil diubah.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal edit card/list');
    }
  }

  async function handleArchiveColumn(columnId) {
    try {
      setError('');
      await client.patch(`/columns/${columnId}/archive`);
      if (openTaskFormColumnId === columnId) {
        setOpenTaskFormColumnId(null);
      }
      await loadProjectData(selectedProjectId);
      setInfo('Card/list berhasil di-archive.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal archive card/list');
    }
  }

  async function handleRestoreColumn(columnId) {
    try {
      setError('');
      await client.patch(`/columns/${columnId}/restore`);
      await loadProjectData(selectedProjectId);
      setInfo('Card/list berhasil di-restore.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal restore card/list');
    }
  }

  async function handleDeleteColumn(columnId) {
    const confirmed = window.confirm('Delete permanen card/list ini? Aksi ini tidak bisa di-restore.');
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await client.delete(`/columns/${columnId}`);
      if (openTaskFormColumnId === columnId) {
        setOpenTaskFormColumnId(null);
      }
      await loadProjectData(selectedProjectId);
      setInfo('Card/list dihapus permanen. Tidak bisa di-restore.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal hapus card/list');
    }
  }

  function toggleTaskForm(columnId) {
    setOpenTaskFormColumnId((prev) => (prev === columnId ? null : columnId));

    setTaskForms((prev) => {
      if (prev[columnId]) {
        return prev;
      }
      return {
        ...prev,
        [columnId]: { ...emptyTaskForm },
      };
    });
  }

  function updateTaskForm(columnId, field, value) {
    setTaskForms((prev) => ({
      ...prev,
      [columnId]: {
        ...(prev[columnId] || emptyTaskForm),
        [field]: value,
      },
    }));
  }

  async function handleCreateTask(columnId, event) {
    event.preventDefault();
    if (!selectedProjectId) {
      return;
    }

    const form = taskForms[columnId] || emptyTaskForm;
    if (!form.title) {
      return;
    }

    try {
      setError('');
      await client.post(`/projects/${selectedProjectId}/tasks`, {
        ...form,
        column_id: Number(columnId),
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      });

      setTaskForms((prev) => ({
        ...prev,
        [columnId]: { ...emptyTaskForm },
      }));

      setOpenTaskFormColumnId(null);
      await loadProjectData(selectedProjectId);
      setInfo('Task ditambahkan ke card/list.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal tambah task');
    }
  }

  async function updateTask(taskId, partialData) {
    const current = tasks.find((task) => task.id === taskId);
    if (!current) {
      return;
    }

    try {
      setError('');
      await client.put(`/tasks/${taskId}`, {
        title: partialData.title ?? current.title,
        description: partialData.description ?? current.description,
        start_date: partialData.start_date ?? toInputDate(current.start_date),
        end_date: partialData.end_date ?? toInputDate(current.end_date),
        deadline_date: partialData.deadline_date ?? toInputDate(current.deadline_date),
        note: partialData.note ?? current.note,
        assignee_id: partialData.assignee_id !== undefined
          ? (partialData.assignee_id ? Number(partialData.assignee_id) : null)
          : current.assignee_id,
        column_id: partialData.column_id !== undefined
          ? (partialData.column_id ? Number(partialData.column_id) : null)
          : current.column_id,
        status: partialData.status ?? (current.done_at ? 'done' : 'todo'),
      });
      await loadProjectData(selectedProjectId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal update task');
    }
  }

  function handleEditTask(taskId) {
    const current = [...tasks, ...archivedTasks].find((task) => task.id === taskId);
    if (!current) {
      return;
    }

    setEditTaskForm({
      id: current.id,
      title: current.title || '',
      description: current.description || '',
      start_date: toInputDate(current.start_date),
      end_date: toInputDate(current.end_date),
      deadline_date: toInputDate(current.deadline_date),
      assignee_id: current.assignee_id ? String(current.assignee_id) : '',
      note: current.note || '',
      column_id: current.column_id ? String(current.column_id) : '',
      status: current.done_at ? 'done' : 'todo',
    });
    setError('');
  }

  async function submitEditTask(event) {
    event.preventDefault();
    if (!editTaskForm) {
      return;
    }

    const trimmedTitle = String(editTaskForm.title || '').trim();
    if (!trimmedTitle) {
      setError('Judul task tidak boleh kosong.');
      return;
    }

    try {
      setError('');
      await client.put(`/tasks/${editTaskForm.id}`, {
        title: trimmedTitle,
        description: editTaskForm.description || null,
        start_date: editTaskForm.start_date || null,
        end_date: editTaskForm.end_date || null,
        deadline_date: editTaskForm.deadline_date || null,
        note: editTaskForm.note || null,
        assignee_id: editTaskForm.assignee_id ? Number(editTaskForm.assignee_id) : null,
        column_id: editTaskForm.column_id ? Number(editTaskForm.column_id) : null,
        status: editTaskForm.status,
      });
      setEditTaskForm(null);
      await loadProjectData(selectedProjectId);
      setInfo('Task berhasil di-edit.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal edit task');
    }
  }

  async function handleArchiveTask(taskId) {
    const confirmed = window.confirm('Archive task ini?');
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await client.patch(`/tasks/${taskId}/archive`);
      await loadProjectData(selectedProjectId);
      setInfo('Task berhasil di-archive.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal archive task');
    }
  }

  async function handleRestoreTask(taskId) {
    try {
      setError('');
      await client.patch(`/tasks/${taskId}/restore`);
      await loadProjectData(selectedProjectId);
      setInfo('Task berhasil di-restore.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal restore task');
    }
  }

  async function deleteTask(taskId) {
    const confirmed = window.confirm('Delete permanen task ini? Aksi ini tidak bisa di-restore.');
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      await client.delete(`/tasks/${taskId}`);
      await loadProjectData(selectedProjectId);
      setInfo('Task dihapus permanen.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal hapus task');
    }
  }

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    if (!setupChecked || needsSetup || !token) {
      return;
    }

    loadAuthedData();
  }, [setupChecked, needsSetup, token]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      return;
    }

    loadProjectData(selectedProjectId);
  }, [token, selectedProjectId]);

  useEffect(() => {
    if (!activeMainTab.startsWith('project:')) {
      return;
    }

    const tabProjectId = Number(activeMainTab.slice('project:'.length));
    const exists = projects.some((project) => project.id === tabProjectId);

    if (!exists) {
      setActiveMainTab('dashboard');
      return;
    }

    if (selectedProjectId !== tabProjectId) {
      setSelectedProjectId(tabProjectId);
    }
  }, [activeMainTab, projects, selectedProjectId]);

  useEffect(() => {
    setShowArchivedColumns(false);
    setShowArchivedTasks(false);
    setEditColumnForm(null);
    setEditTaskForm(null);
    setOpenTaskFormColumnId(null);
  }, [selectedProjectId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const tasksByColumn = useMemo(() => {
    const grouped = {};
    tasks.forEach((task) => {
      const key = task.column_id || 'unassigned';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const ganttData = useMemo(() => {
    const source = tasks
      .map((task) => {
        const start = task.start_date ? new Date(task.start_date) : null;
        const endCandidate = task.end_date || task.deadline_date;
        const end = endCandidate ? new Date(endCandidate) : null;

        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return null;
        }

        const normalizedEnd = end < start ? new Date(start) : end;
        return {
          id: task.id,
          title: task.title,
          completed: Boolean(task.done_at),
          start,
          end: normalizedEnd,
        };
      })
      .filter(Boolean);

    if (source.length === 0) {
      return null;
    }

    const starts = source.map((item) => item.start.getTime());
    const ends = source.map((item) => item.end.getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const totalDays = Math.max(1, Math.ceil((max - min) / 86400000) + 1);

    const rows = source.map((item) => {
      const startOffset = Math.floor((item.start.getTime() - min) / 86400000);
      const duration = Math.max(1, Math.ceil((item.end.getTime() - item.start.getTime()) / 86400000) + 1);

      return {
        ...item,
        left: (startOffset / totalDays) * 100,
        width: (duration / totalDays) * 100,
      };
    });

    return {
      rows,
      rangeLabel: `${new Date(min).toISOString().slice(0, 10)} -> ${new Date(max).toISOString().slice(0, 10)}`,
    };
  }, [tasks]);

  const sCurveChartData = useMemo(() => {
    return {
      labels: sCurvePoints.map((point) => point.date),
      datasets: [
        {
          label: 'Planned',
          data: sCurvePoints.map((point) => point.planned),
          borderColor: '#d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.2)',
          tension: 0.25,
        },
        {
          label: 'Actual',
          data: sCurvePoints.map((point) => point.actual),
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.2)',
          tension: 0.25,
        },
      ],
    };
  }, [sCurvePoints]);

  function renderTaskCard(task) {
    return (
      <div key={task.id} className={`task-card ${task.done_at ? 'task-card-done' : ''}`}>
        <div className="task-card-head">
          <strong>{task.title}</strong>
          <details className="task-menu-wrap">
            <summary className="icon-menu-btn task-menu-btn" aria-label="Task menu">...</summary>
            <div className="column-menu task-menu">
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  handleEditTask(task.id);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  handleArchiveTask(task.id);
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className="danger-item"
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  deleteTask(task.id);
                }}
              >
                Delete Permanen
              </button>
            </div>
          </details>
        </div>

        <p>{task.description || '-'}</p>
        <p><b>Assignee:</b> {task.assignee_name || 'Unassigned'}</p>
        <p><b>Start:</b> {toInputDate(task.start_date) || '-'}</p>
        <p><b>End:</b> {toInputDate(task.end_date) || '-'}</p>
        <p><b>Deadline:</b> {toInputDate(task.deadline_date) || '-'}</p>
        <p><b>Note:</b> {task.note || '-'}</p>

        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(task.done_at)}
            onChange={(e) => updateTask(task.id, { status: e.target.checked ? 'done' : 'todo' })}
          />
          Mark as Done
        </label>

        <select
          value={task.column_id || ''}
          onChange={(e) => updateTask(task.id, { column_id: e.target.value || null })}
        >
          <option value="">Tanpa Card</option>
          {columns.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name}</option>
          ))}
        </select>
      </div>
    );
  }

  if (!setupChecked) {
    return <div className="center">Memuat setup status...</div>;
  }

  if (needsSetup) {
    return (
      <div className="auth-wrapper">
        <h1>cihuy-kanban</h1>
        <p>Setup awal: buat akun admin dulu.</p>
        <form className="card" onSubmit={handleSetupAdmin}>
          <label>
            Nama
            <input name="name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" minLength={6} required />
          </label>
          <button type="submit">Buat Admin</button>
        </form>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="auth-wrapper">
        <h1>cihuy-kanban</h1>
        <p>Login untuk lanjut (token auto-expire 7 hari).</p>
        <form className="card" onSubmit={handleLogin}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button type="submit">Login</button>
        </form>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <section className="card top-shell">
        <header className="topbar topbar-merged">
          <div>
            <h1>cihuy-kanban</h1>
            <p>{user ? `${user.name} (${user.role})` : 'Loading user...'}</p>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className={`theme-switch ${theme === 'dark' ? 'is-dark' : ''}`}
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="theme-switch-track">
                <span className="theme-switch-thumb" />
              </span>
            </button>
            <button type="button" onClick={() => logout()}>Logout</button>
          </div>
        </header>

        <nav className="main-tabs">
          <button
            className={`main-tab-btn ${activeMainTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('dashboard')}
          >
            dashboard
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`main-tab-btn ${activeMainTab === `project:${project.id}` ? 'active' : ''}`}
              onClick={() => openProjectTab(project.id)}
            >
              {`project_${project.name}`}
            </button>
          ))}
        </nav>
      </section>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      {loading && <p>Loading...</p>}

      {activeMainTab === 'dashboard' && (
        <>
          <section className="grid-two">
            <form className="card" onSubmit={handleCreateProject}>
              <h3>Buat Project</h3>
              <label>
                Nama Project
                <input
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Deskripsi
                <textarea
                  rows={2}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <button type="submit">Tambah Project</button>
            </form>

            {user?.role === 'admin' && (
              <form className="card" onSubmit={handleCreateUser}>
                <h3>Buat User</h3>
                <label>
                  Nama
                  <input
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    minLength={6}
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Role
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button type="submit">Tambah User</button>
              </form>
            )}
          </section>

          <section className="card">
            <h3>Daftar Project</h3>
            {projects.length === 0 && <p>Belum ada project.</p>}
            <div className="dashboard-projects">
              {projects.map((project) => (
                <div key={project.id} className="dashboard-project-card">
                  <h4>{project.name}</h4>
                  <p>{project.description || 'Tanpa deskripsi'}</p>
                  <p>{`Task: ${project.task_count || 0} | List aktif: ${project.column_count || 0}`}</p>
                  <p>{`Archived list: ${project.archived_column_count || 0}`}</p>
                  <button type="button" onClick={() => openProjectTab(project.id)}>Buka Project</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeMainTab.startsWith('project:') && selectedProject && (
        <>
          <section className="card project-shell">
            <div className="project-header">
              <h3>{`project_${selectedProject.name}`}</h3>
              <p>{selectedProject.description || 'Tanpa deskripsi project.'}</p>
            </div>

            <nav className="sub-tabs project-sub-tabs">
              <button
                className={`sub-tab-btn ${projectViewTab === 'kanban' ? 'active' : ''}`}
                onClick={() => setProjectViewTab('kanban')}
              >
                Card/List Kanban
              </button>
              <button
                className={`sub-tab-btn ${projectViewTab === 'gantt' ? 'active' : ''}`}
                onClick={() => setProjectViewTab('gantt')}
              >
                Gantt View
              </button>
              <button
                className={`sub-tab-btn ${projectViewTab === 's_curve' ? 'active' : ''}`}
                onClick={() => setProjectViewTab('s_curve')}
              >
                S-Chart (Planned vs Actual)
              </button>
            </nav>
          </section>

          {projectViewTab === 'kanban' && (
            <>
              <section className="card">
                <h3>Buat Card/List Kanban</h3>
                <form className="create-column" onSubmit={handleCreateColumn}>
                  <input
                    placeholder="Contoh: Backlog, Review, QA, Deploy"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    required
                  />
                  <button type="submit">Tambah Card/List</button>
                </form>

                <div className="archive-toolbar">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setShowArchivedColumns((prev) => !prev)}
                  >
                    {showArchivedColumns ? 'Sembunyikan Archived List' : `Lihat Archived List (${archivedColumns.length})`}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setShowArchivedTasks((prev) => !prev)}
                  >
                    {showArchivedTasks ? 'Sembunyikan Archived Task' : `Lihat Archived Task (${archivedTasks.length})`}
                  </button>
                </div>

                {showArchivedColumns && (
                  <div className="archived-panel">
                    {archivedColumns.length === 0 && <p>Belum ada card/list yang di-archive.</p>}
                    {archivedColumns.map((column) => (
                      <div key={column.id} className="archived-item">
                        <div>
                          <strong>{column.name}</strong>
                          <p>{`Diarsipkan: ${toInputDate(column.archived_at) || '-'}`}</p>
                        </div>
                        <div className="archived-actions">
                          <button type="button" className="ghost" onClick={() => handleRestoreColumn(column.id)}>
                            Restore
                          </button>
                          <button type="button" className="ghost danger" onClick={() => handleDeleteColumn(column.id)}>
                            Delete Permanen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showArchivedTasks && (
                  <div className="archived-panel">
                    {archivedTasks.length === 0 && <p>Belum ada task yang di-archive.</p>}
                    {archivedTasks.map((task) => (
                      <div key={task.id} className="archived-item">
                        <div>
                          <strong>{task.title}</strong>
                          <p>{`Card: ${task.column_name || 'Tanpa Card'} | Assignee: ${task.assignee_name || 'Unassigned'}`}</p>
                        </div>
                        <div className="archived-actions">
                          <button type="button" className="ghost" onClick={() => handleRestoreTask(task.id)}>
                            Restore
                          </button>
                          <button type="button" className="ghost danger" onClick={() => deleteTask(task.id)}>
                            Delete Permanen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {columns.length === 0 && <p>Belum ada card/list aktif. Buat dulu sesuai workflow tim kamu.</p>}
              </section>

              <section className="kanban-scroll">
                {columns.map((column) => (
                  <div key={column.id} className="kanban-col">
                    <div className="column-header">
                      <h4>{column.name}</h4>
                      <details className="column-menu-wrap">
                        <summary className="icon-menu-btn" aria-label="Column menu">...</summary>
                        <div className="column-menu">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              handleEditColumn(column.id);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              handleArchiveColumn(column.id);
                            }}
                          >
                            Archive
                          </button>
                          <button
                            type="button"
                            className="danger-item"
                            onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open');
                              handleDeleteColumn(column.id);
                            }}
                          >
                            Delete Permanen
                          </button>
                        </div>
                      </details>
                    </div>

                    <button type="button" className="ghost add-task" onClick={() => toggleTaskForm(column.id)}>
                      {openTaskFormColumnId === column.id ? 'Tutup Form Task' : '+ Add Task'}
                    </button>

                    {openTaskFormColumnId === column.id && (
                      <form className="inline-task-form" onSubmit={(event) => handleCreateTask(column.id, event)}>
                        <input
                          placeholder="Judul task"
                          value={taskForms[column.id]?.title || ''}
                          onChange={(e) => updateTaskForm(column.id, 'title', e.target.value)}
                          required
                        />
                        <textarea
                          rows={2}
                          placeholder="Deskripsi"
                          value={taskForms[column.id]?.description || ''}
                          onChange={(e) => updateTaskForm(column.id, 'description', e.target.value)}
                        />
                        <select
                          value={taskForms[column.id]?.assignee_id || ''}
                          onChange={(e) => updateTaskForm(column.id, 'assignee_id', e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {users.map((entry) => (
                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={taskForms[column.id]?.start_date || ''}
                          onChange={(e) => updateTaskForm(column.id, 'start_date', e.target.value)}
                        />
                        <input
                          type="date"
                          value={taskForms[column.id]?.end_date || ''}
                          onChange={(e) => updateTaskForm(column.id, 'end_date', e.target.value)}
                        />
                        <input
                          type="date"
                          value={taskForms[column.id]?.deadline_date || ''}
                          onChange={(e) => updateTaskForm(column.id, 'deadline_date', e.target.value)}
                        />
                        <textarea
                          rows={2}
                          placeholder="Note"
                          value={taskForms[column.id]?.note || ''}
                          onChange={(e) => updateTaskForm(column.id, 'note', e.target.value)}
                        />
                        <button type="submit">Simpan Task</button>
                      </form>
                    )}

                    <div className="task-list">
                      {(tasksByColumn[column.id] || []).map((task) => renderTaskCard(task))}
                    </div>
                  </div>
                ))}

                {(tasksByColumn.unassigned || []).length > 0 && (
                  <div className="kanban-col unassigned">
                    <h4>Tanpa Card</h4>
                    <div className="task-list">
                      {tasksByColumn.unassigned.map((task) => renderTaskCard(task))}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {projectViewTab === 'gantt' && (
            <section className="card">
              <h3>Gantt View</h3>
              {!ganttData && <p>Isi start/end task untuk menampilkan gantt.</p>}
              {ganttData && (
                <>
                  <p>Range: {ganttData.rangeLabel}</p>
                  <div className="gantt-wrapper">
                    {ganttData.rows.map((row) => (
                      <div key={row.id} className="gantt-row">
                        <div className="gantt-label">{row.title}</div>
                        <div className="gantt-track">
                          <div
                            className={`gantt-bar ${row.completed ? 'status-done' : 'status-todo'}`}
                            style={{ left: `${row.left}%`, width: `${row.width}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {projectViewTab === 's_curve' && (
            <section className="card">
              <h3>S-Chart (Planned vs Actual)</h3>
              {sCurvePoints.length === 0 && <p>Belum ada data timeline untuk dihitung.</p>}
              {sCurvePoints.length > 0 && (
                <Line
                  data={sCurveChartData}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: 'top' },
                      title: { display: true, text: 'S-Curve Progress' },
                    },
                  }}
                />
              )}
            </section>
          )}
        </>
      )}

      {editColumnForm && (
        <div className="modal-backdrop" onClick={() => setEditColumnForm(null)}>
          <form className="hero-edit-card" onClick={(event) => event.stopPropagation()} onSubmit={submitEditColumn}>
            <p className="hero-eyebrow">Edit Card/List</p>
            <h3>Perbarui Nama List</h3>
            <label>
              Nama List
              <input
                value={editColumnForm.name}
                onChange={(event) => setEditColumnForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                autoFocus
              />
            </label>
            <div className="hero-actions">
              <button type="button" className="ghost" onClick={() => setEditColumnForm(null)}>Batal</button>
              <button type="submit">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      )}

      {editTaskForm && (
        <div className="modal-backdrop" onClick={() => setEditTaskForm(null)}>
          <form className="hero-edit-card" onClick={(event) => event.stopPropagation()} onSubmit={submitEditTask}>
            <p className="hero-eyebrow">Edit Task</p>
            <h3>Perbarui Detail Task</h3>
            <div className="hero-edit-grid">
              <label>
                Judul
                <input
                  value={editTaskForm.title}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Assignee
                <select
                  value={editTaskForm.assignee_id}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {users.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label className="hero-span-2">
                Deskripsi
                <textarea
                  rows={3}
                  value={editTaskForm.description}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label>
                Start Date
                <input
                  type="date"
                  value={editTaskForm.start_date}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, start_date: event.target.value }))}
                />
              </label>
              <label>
                End Date
                <input
                  type="date"
                  value={editTaskForm.end_date}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, end_date: event.target.value }))}
                />
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  value={editTaskForm.deadline_date}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, deadline_date: event.target.value }))}
                />
              </label>
              <label>
                Status
                <select
                  value={editTaskForm.status}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="todo">To Do</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                Card/List
                <select
                  value={editTaskForm.column_id}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, column_id: event.target.value }))}
                >
                  <option value="">Tanpa Card</option>
                  {columns.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label className="hero-span-2">
                Note
                <textarea
                  rows={3}
                  value={editTaskForm.note}
                  onChange={(event) => setEditTaskForm((prev) => ({ ...prev, note: event.target.value }))}
                />
              </label>
            </div>
            <div className="hero-actions">
              <button type="button" className="ghost" onClick={() => setEditTaskForm(null)}>Batal</button>
              <button type="submit">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;













