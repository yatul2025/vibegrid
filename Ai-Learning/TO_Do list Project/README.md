# 📝 TaskFlow — To-Do List Web Application

Welcome to your first web development project! This is a modern, responsive To-Do List site built with clean **HTML5**, **CSS3**, and **JavaScript**.

---

## 🚀 How to Run the Website (Full-Stack with Real Database)

### Option 1: Full-Stack with Real SQLite Database (Recommended!)
Start the Python database backend server:
```bash
cd "TO_Do list Project"
python3 server.py
```
Then visit: **[http://localhost:8000](http://localhost:8000)**
- Connects directly to **`taskflow.db`** (Real SQLite Database).
- Displays `🟢 SQLite DB` in the top header.
- Tasks, users, and password hashes persist directly inside the database file.

### Option 2: Standalone in Browser (Offline Fallback)
Simply open `login.html` directly:
```bash
cd "TO_Do list Project"
open login.html
```
*(Runs in client-side LocalStorage mode without needing a terminal server)*

---

## 📂 Project Structure

```
Ai-Learning/
└── TO_Do list Project/
    ├── taskflow.db  # 🗄️ Real SQLite Relational Database file
    ├── database.py  # ⚙️ SQL operations (Schema, CRUD, password hashing)
    ├── server.py    # 🚀 Python backend server & REST API (GET, POST, PUT, DELETE)
    ├── index.html   # 🖥️ Main App: Task interface, search, filters & DB status badge
    ├── login.html   # 🔐 Sign In Page: Authenticates against SQLite database
    ├── style.css    # 🎨 Styling: Responsive design, Dark/Light mode, badges
    ├── app.js       # 🧠 Frontend Logic: REST API fetch calls & fallback storage
    ├── auth.js      # 🔑 Auth Logic: Validates login with SQLite API
    └── README.md    # 📖 Full documentation and learning guide
```

---

## 🗄️ How the Real Database Works

1. **Database File**: `taskflow.db` is an actual SQLite binary database created on your disk.
2. **Tables**:
   - `users`: Contains `id`, `username`, `password_hash`, `created_at`.
   - `tasks`: Contains `id`, `username`, `title`, `completed`, `priority`, `category`, `due_date`, `created_at`.
3. **Inspect the Database from Terminal**:
   You can query your database using the macOS built-in `sqlite3` CLI tool:
   ```bash
   sqlite3 taskflow.db "SELECT * FROM users;"
   sqlite3 taskflow.db "SELECT id, title, completed, priority FROM tasks;"
   ```

## 🔐 Optional Login Credentials

You can test the login system via [`login.html`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/login.html):
- **Default Username**: `@tul`
- **Default Password**: `Atul`
- **Guest Access**: Click **"Continue as Guest (Skip Login)"** to use the application without credentials!
- **Auto-Fill**: Click the "⚡ Auto-fill for me" button on the login screen for 1-click testing.

---

## 💡 What This Teaches You About Web Development

### 1. HTML5 ([`index.html`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/index.html))
- **Semantic Tags**: Uses `<header>`, `<main>`, `<section>`, `<footer>`, and `<form>` for accessibility and structure.
- **Form Handling**: Captures user inputs like task title, priority dropdown (`<select>`), categories, and due dates (`<input type="date">`).

### 2. CSS3 ([`style.css`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/style.css))
- **CSS Variables (Custom Properties)**: Allows instant Dark/Light mode switching without rewriting CSS rules.
- **Modern Layouts**: Built using CSS Flexbox for clean alignment and responsive spacing.
- **Micro-Interactions**: Hover effects, smooth transitions, and progress bar animations.

### 3. JavaScript ([`app.js`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/app.js))
- **CRUD Operations**: **C**reate tasks, **R**ead/render them, **U**pdate (mark complete/edit title), and **D**elete tasks.
- **DOM Manipulation**: Creating HTML elements dynamically (`document.createElement`) and updating inner content safely (`escapeHtml`).
- **Data Persistence (`localStorage`)**: Saves your tasks in your browser so they remain even after closing or refreshing the tab.
- **Array Methods**: Uses `.filter()`, `.find()`, and `.unshift()` to manipulate lists of task objects.

---

## 🤖 Next Step: How This Connects to AI

Now that you have a working web frontend, here is how web development connects with AI:
1. **Data Representation**: Notice how every task in `app.js` is an object:
   ```javascript
   {
     id: 'task-1',
     title: 'Learn AI basics',
     priority: 'high',
     category: 'Learning'
   }
   ```
   AI models (LLMs like Gemini) receive and return data in this exact JSON format.
2. **Connecting an AI Backend**: When you're ready, we can connect this app to a Python backend (like FastAPI) that calls an AI model to:
   - Break big tasks down into subtasks automatically.
   - Intelligently prioritize your day based on deadlines.
   - Let you type natural speech like *"Remind me to call mom at 6pm"* and parse it into a task.

---

## 🎯 3 Practice Challenges For You

To start learning by doing, try modifying the code:
1. **Add a new Category**: Open [`index.html`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/index.html) and add a `<option value="Fitness">🏋️ Fitness</option>` to the category dropdown.
2. **Change the Accent Color**: Open [`style.css`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/style.css) and change `--primary-color: #4f46e5;` to your favorite color (like `#06b6d4` for cyan or `#ec4899` for pink).
3. **Sound Effect on Complete**: In [`app.js`](file:///Users/atulyadav/Learning/Ai-Learning/TO_Do%20list%20Project/app.js), try playing a short chime sound whenever `toggleTask()` completes a task!
