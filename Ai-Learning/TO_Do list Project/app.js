/**
 * ============================================================================
 * TaskFlow — Modern To-Do List Application
 * ============================================================================
 * 
 * Key Web Development Concepts Demonstrated Here:
 * 1. State Management: Keeping an array of task objects in memory.
 * 2. Persistence: Using `localStorage` to save tasks across browser refreshes.
 * 3. DOM Manipulation: Dynamically creating and updating HTML elements.
 * 4. Event Handling: Listening for clicks, form submits, and keyboard inputs.
 * 5. Array Methods: Using `.filter()`, `.map()`, `.find()`, and `.findIndex()`.
 */

// ============================================================================
// 1. Initial State & Storage Configuration
// ============================================================================

const STORAGE_KEY = 'taskflow_tasks_v1';
const USER_STORAGE_KEY = 'taskflow_user';
const THEME_KEY = 'taskflow_theme';

// Default starter tasks for first-time visitors
const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Welcome to TaskFlow! Complete this task by clicking the checkbox',
    completed: false,
    priority: 'high',
    category: 'General',
    dueDate: new Date().toISOString().split('T')[0], // today
    createdAt: Date.now()
  },
  {
    id: 'task-2',
    title: 'Learn HTML & CSS basics (inspect index.html and style.css)',
    completed: false,
    priority: 'medium',
    category: 'Web Dev',
    dueDate: '',
    createdAt: Date.now() - 1000
  },
  {
    id: 'task-3',
    title: 'Understand JavaScript DOM manipulation (explore app.js)',
    completed: false,
    priority: 'high',
    category: 'Learning',
    dueDate: '',
    createdAt: Date.now() - 2000
  }
];

// Load tasks from LocalStorage or fall back to default tasks
let tasks = loadTasksFromStorage();
let currentFilter = 'all'; // 'all' | 'active' | 'completed'
let searchQuery = '';

// ============================================================================
// 2. DOM Elements
// ============================================================================

const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const categorySelect = document.getElementById('categorySelect');
const dueDateInput = document.getElementById('dueDateInput');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const itemsLeftCount = document.getElementById('itemsLeftCount');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const userNameEl = document.getElementById('userName');
const authActionBtn = document.getElementById('authActionBtn');
const dbStatusBadge = document.getElementById('dbStatusBadge');
const dbStatusText = document.getElementById('dbStatusText');

// Real Database connection state
let isDbConnected = false;
let currentUsername = '@tul';

// ============================================================================
// 3. Storage Functions
// ============================================================================

function loadTasksFromStorage() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (rawData) {
      return JSON.parse(rawData);
    }
  } catch (error) {
    console.error('Failed to load tasks from localStorage:', error);
  }
  return DEFAULT_TASKS;
}

function saveTasksToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Failed to save tasks to localStorage:', error);
  }
}

// ============================================================================
// 4. Real Database Connection & Task Operations (CRUD via SQLite API)
// ============================================================================

async function checkDbConnection() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      isDbConnected = true;
      if (dbStatusBadge && dbStatusText) {
        dbStatusBadge.className = 'db-badge connected';
        dbStatusText.textContent = 'SQLite DB';
        dbStatusBadge.title = `Connected to Real Database: ${data.database}`;
      }
      await loadTasksFromDb();
      return;
    }
  } catch (err) {
    console.log('[TaskFlow] Server API offline, using local storage:', err.message);
  }

  // Offline or opened via file://
  isDbConnected = false;
  if (dbStatusBadge && dbStatusText) {
    dbStatusBadge.className = 'db-badge offline';
    dbStatusText.textContent = 'LocalStorage';
    dbStatusBadge.title = 'Running standalone in browser LocalStorage';
  }
}

async function loadTasksFromDb() {
  try {
    const res = await fetch(`/api/tasks?username=${encodeURIComponent(currentUsername)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tasks) && data.tasks.length > 0) {
        tasks = data.tasks;
        saveTasksToStorage();
        renderTasks();
      }
    }
  } catch (err) {
    console.error('[TaskFlow] Error loading tasks from SQLite:', err);
  }
}

/**
 * Add a new task (Inserts into SQLite DB via API when connected)
 */
async function addTask(title, priority, category, dueDate) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  if (isDbConnected) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUsername,
          title: cleanTitle,
          priority: priority || 'medium',
          category: category || 'General',
          dueDate: dueDate || ''
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.task) {
          tasks.unshift(data.task);
          saveTasksToStorage();
          renderTasks();
          return;
        }
      }
    } catch (err) {
      console.error('[TaskFlow] Failed to write task to SQLite:', err);
    }
  }

  // Fallback to local storage
  const newTask = {
    id: 'task-' + Date.now(),
    title: cleanTitle,
    completed: false,
    priority: priority || 'medium',
    category: category || 'General',
    dueDate: dueDate || '',
    createdAt: Date.now()
  };

  tasks.unshift(newTask);
  saveTasksToStorage();
  renderTasks();
}

/**
 * Toggle task completion status
 */
async function toggleTask(id) {
  const task = tasks.find(t => t.id == id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasksToStorage();
  renderTasks();

  if (isDbConnected) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: task.completed })
      });
    } catch (err) {
      console.error('[TaskFlow] Failed to update task in SQLite:', err);
    }
  }
}

/**
 * Delete a specific task
 */
async function deleteTask(id) {
  tasks = tasks.filter(t => t.id != id);
  saveTasksToStorage();
  renderTasks();

  if (isDbConnected) {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[TaskFlow] Failed to delete task in SQLite:', err);
    }
  }
}

/**
 * Edit a task's title
 */
async function editTask(id) {
  const task = tasks.find(t => t.id == id);
  if (!task) return;

  const updatedTitle = prompt('Edit task title:', task.title);
  if (updatedTitle !== null && updatedTitle.trim() !== '') {
    task.title = updatedTitle.trim();
    saveTasksToStorage();
    renderTasks();

    if (isDbConnected) {
      try {
        await fetch(`/api/tasks/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: task.title })
        });
      } catch (err) {
        console.error('[TaskFlow] Failed to update task title in SQLite:', err);
      }
    }
  }
}

/**
 * Clear all completed tasks
 */
async function clearCompleted() {
  const completedCount = tasks.filter(t => t.completed).length;
  if (completedCount === 0) return;

  if (confirm(`Clear ${completedCount} completed task(s)?`)) {
    tasks = tasks.filter(t => !t.completed);
    saveTasksToStorage();
    renderTasks();

    if (isDbConnected) {
      try {
        await fetch(`/api/tasks/completed?username=${encodeURIComponent(currentUsername)}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.error('[TaskFlow] Failed to clear completed tasks in SQLite:', err);
      }
    }
  }
}

// ============================================================================
// 5. Render & UI Updates
// ============================================================================

/**
 * Filter and search tasks based on active state and query
 */
function getFilteredTasks() {
  return tasks.filter(task => {
    // 1. Filter condition
    if (currentFilter === 'active' && task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;

    // 2. Search query match
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchCategory = task.category.toLowerCase().includes(q);
      return matchTitle || matchCategory;
    }

    return true;
  });
}

/**
 * Format due date for friendly display
 */
function formatDueDate(dateString) {
  if (!dateString) return '';
  const today = new Date().toISOString().split('T')[0];
  if (dateString === today) {
    return '📅 Today';
  }
  const date = new Date(dateString + 'T00:00:00');
  return '📅 ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Render the list of tasks to the DOM
 */
function renderTasks() {
  const filteredTasks = getFilteredTasks();
  taskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');

    filteredTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      li.setAttribute('data-id', task.id);

      // Check if overdue
      const today = new Date().toISOString().split('T')[0];
      const isOverdue = !task.completed && task.dueDate && task.dueDate < today;

      li.innerHTML = `
        <div class="task-main">
          <input 
            type="checkbox" 
            class="custom-checkbox" 
            ${task.completed ? 'checked' : ''} 
            title="Mark as complete"
          />
          <div class="task-content">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <div class="task-meta">
              <span class="badge badge-${task.priority}">${task.priority.toUpperCase()}</span>
              <span class="badge badge-category">${escapeHtml(task.category)}</span>
              ${task.dueDate ? `
                <span class="task-date ${isOverdue ? 'overdue' : ''}">
                  ${formatDueDate(task.dueDate)} ${isOverdue ? '(Overdue)' : ''}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="task-actions">
          <button class="action-btn edit-btn" title="Edit Task" aria-label="Edit Task">✏️</button>
          <button class="action-btn delete-btn" title="Delete Task" aria-label="Delete Task">🗑️</button>
        </div>
      `;

      // Event Listeners for individual task actions
      const checkbox = li.querySelector('.custom-checkbox');
      checkbox.addEventListener('change', () => toggleTask(task.id));

      const editBtn = li.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => editTask(task.id));

      const deleteBtn = li.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deleteTask(task.id));

      taskList.appendChild(li);
    });
  }

  updateProgress();
}

/**
 * Update the progress bar and counter stats
 */
function updateProgress() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const remaining = total - completed;

  // Update text counters
  progressText.textContent = `${completed} of ${total} completed`;
  itemsLeftCount.textContent = `${remaining} item${remaining === 1 ? '' : 's'} remaining`;

  // Update progress bar percentage
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressBar.style.width = `${percentage}%`;
}

/**
 * Helper to prevent XSS (Cross-Site Scripting)
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// 6. Theme Switcher (Dark / Light Mode)
// ============================================================================

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.textContent = '☀️';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    themeIcon.textContent = '🌙';
  }
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, newTheme);
});

// ============================================================================
// 7. Event Listeners
// ============================================================================

// Form Submission (Add Task)
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;

  const priority = prioritySelect.value;
  const category = categorySelect.value;
  const dueDate = dueDateInput.value;

  addTask(title, priority, category, dueDate);

  // Reset form inputs
  taskInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  categorySelect.value = 'General';
  taskInput.focus();
});

// Filter Tabs (All, Active, Completed)
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.getAttribute('data-filter');
    renderTasks();
  });
});

// Search Input Listener
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderTasks();
});

// Clear Completed Tasks Button
clearCompletedBtn.addEventListener('click', clearCompleted);

// ============================================================================
// 8. User Session Management
// ============================================================================

function initUserSession() {
  if (!userNameEl || !authActionBtn) return;

  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  let user = null;

  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch (e) {
      console.error('Failed to parse user session:', e);
    }
  }

  if (user && !user.isGuest && user.username) {
    currentUsername = user.username;
    userNameEl.textContent = user.username;
    authActionBtn.textContent = 'Log Out';
    authActionBtn.title = 'Sign out of your account';
    authActionBtn.onclick = () => {
      if (confirm('Are you sure you want to log out?')) {
        localStorage.removeItem(USER_STORAGE_KEY);
        window.location.href = 'login.html';
      }
    };
  } else if (user && user.isGuest) {
    currentUsername = 'Guest';
    userNameEl.textContent = 'Guest';
    authActionBtn.textContent = 'Log In';
    authActionBtn.title = 'Sign in with an account';
    authActionBtn.onclick = () => {
      window.location.href = 'login.html';
    };
  } else {
    // No session at all - default to Guest
    currentUsername = 'Guest';
    userNameEl.textContent = 'Guest';
    authActionBtn.textContent = 'Log In';
    authActionBtn.title = 'Sign in with an account';
    authActionBtn.onclick = () => {
      window.location.href = 'login.html';
    };
  }
}

// ============================================================================
// 9. Initialization
// ============================================================================

initTheme();
initUserSession();
renderTasks();
checkDbConnection();
