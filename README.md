# 🏛️ UniProjectHub

A collaborative university project repository for BAIUST students.  
Discover similar projects, build teams, preserve knowledge for future batches.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🔍 **Similarity Engine** | Live Jaccard algorithm finds similar old projects as you type |
| 📁 **Project Workspace** | 6-tab wiki: Overview, Team, Timeline, Notes, Resources, Reviews |
| 👥 **Team Collaboration** | Add/remove members, track activities together |
| 📊 **Admin Analytics** | Charts for projects by department, batch, category, tech |
| 🔒 **Role-based Auth** | Student and Admin roles via Firebase Authentication |

---

## 📂 Project Structure

```
UniProjectHub/
│
├── index.html              ← Smart redirect (login or dashboard)
├── login.html              ← Login page
├── register.html           ← Student registration
├── dashboard.html          ← Student home (stats + recent projects)
├── browse-projects.html    ← Search & filter all projects
├── my-projects.html        ← Student's own projects
├── create-project.html     ← Create project + live similarity panel
├── project.html            ← Project detail (6 tabs)
├── profile.html            ← Student profile editor
├── admin-dashboard.html    ← Admin overview
├── batch-management.html   ← Manage batches & lab groups
├── metadata-management.html← Manage categories, tags, tech stacks
├── analytics.html          ← Charts & statistics
│
├── css/
│   └── styles.css          ← Global styles (Tailwind handles most)
│
└── js/
    ├── firebase.js         ← Firebase initialization (add config here)
    ├── auth.js             ← Login, register, logout, auth guards
    ├── firestore.js        ← ALL database operations
    ├── similarity.js       ← Jaccard similarity algorithm
    ├── utils.js            ← Shared helper functions
    ├── dashboard.js        ← Dashboard page logic
    ├── browse.js           ← Browse page logic
    ├── create-project.js   ← Create project + similarity detection
    ├── project.js          ← Project page (all 6 tabs)
    ├── profile.js          ← Profile page logic
    └── admin.js            ← All admin page logic
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Get the Code
Download or clone this project folder to your computer.

### Step 2 — Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → give it a name (e.g. `unirojecthub-baiust`)
3. Disable Google Analytics (optional) → **Create Project**

### Step 3 — Enable Authentication
1. In Firebase Console → **Authentication** → **Get Started**
2. Click **Email/Password** → Enable it → **Save**

### Step 4 — Create Firestore Database
1. In Firebase Console → **Firestore Database** → **Create Database**
2. Choose **Start in Test Mode** (for development)
3. Pick a server location → **Done**

### Step 5 — Get Your Firebase Config
1. In Firebase Console → **Project Settings** (gear icon)
2. Scroll to **Your Apps** → click **Web** icon (`</>`)
3. Register your app → copy the `firebaseConfig` object

### Step 6 — Paste Config into the Project
Open `js/firebase.js` and fill in your values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

### Step 7 — Run with a Local Server
Because the app uses ES Modules (`import/export`), you **cannot** open HTML files directly with `file://`. You need a local server.

**Option A — VS Code Live Server (Recommended)**
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. App opens at `http://127.0.0.1:5500`

**Option B — Python**
```bash
cd UniProjectHub
python -m http.server 3000
# Open: http://localhost:3000
```

**Option C — Node.js**
```bash
npx serve .
```

### Step 8 — Set Up Admin Account
1. Register a normal student account first
2. In Firebase Console → **Firestore** → `users` collection
3. Find your user document → click **Edit**
4. Add field: `isAdmin` = `true` (boolean)
5. Log out and log back in → you'll see the Admin Panel

---

## 🗄️ Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | Student profiles (name, ID, dept, batch, group, isAdmin) |
| `projects` | All projects (name, desc, dept, members array, techStack) |
| `activityTimeline` | Checklist items per project |
| `notes` | Notes/reflections per project |
| `resources` | Links (repos, docs, tutorials) per project |
| `finalReviews` | One review per member per project |
| `batches` | Admin-managed batch list (e.g. CSE-18) |
| `labGroups` | Admin-managed lab groups per batch |
| `categories` | Project categories (IoT, Web Dev, AI…) |
| `reviewTags` | Tags for final reviews (Beginner Friendly…) |
| `techStacks` | Available tech options (Firebase, React…) |

---

## 💡 Firestore Security Rules (Production)
Replace Test Mode rules with these before deploying:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{uid} {
      allow read:  if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // Anyone logged in can read projects
    // Only project members can write
    match /projects/{projectId} {
      allow read:  if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
        request.auth.uid in resource.data.members.map(m => m.uid);
    }

    // Sub-collections follow similar rules
    match /{collection}/{docId} {
      allow read:  if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 🌐 Deployment (Firebase Hosting)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting in project folder
firebase init hosting
# Public directory: .   (current folder)
# Single page app: No

# Deploy
firebase deploy
```

---

## 🔧 Adding Seed Data (First Time Setup)
After setting up admin, go to **Metadata Management** and add:

**Categories:** AI, IoT, Web Development, Mobile Development, Networking, Research, Embedded Systems, Security, Data Science

**Review Tags:** Good For Evaluation, Beginner Friendly, Research Oriented, Software Heavy, Hardware Heavy, Time Consuming, Strict Evaluation, Good Learning Experience

**Tech Stacks:** HTML, CSS, JavaScript, TailwindCSS, Firebase, React, Python, TensorFlow, ESP32, Arduino, Node.js, MongoDB, MySQL, Flutter, Django

---

## 🔬 How the Similarity Engine Works

Located in `js/similarity.js`:

1. Student types a project name and description
2. System waits 600ms after typing stops (debounced)
3. Text is tokenized — split into meaningful words, stop words removed
4. Each word set is compared to every existing project using **Jaccard Similarity**:
   ```
   Jaccard = (words in common) ÷ (all unique words combined)
   ```
5. Weighted score: Description (70%) + Title (20%) + Tech Stack (10%)
6. Top 5 matches above 10% threshold are shown

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, TailwindCSS (CDN), Vanilla JavaScript ES6 |
| Auth | Firebase Authentication (Email/Password) |
| Database | Cloud Firestore |
| Hosting | Any static host (Firebase Hosting, Netlify, Vercel) |

No Node.js. No build tools. No frameworks. Pure web stack.

---

## 🔮 Future Improvements

- [ ] Firestore pagination for large project lists
- [ ] Email notifications when added to a team
- [ ] Project thumbnail image (via external URL)
- [ ] Export project as PDF
- [ ] Advanced similarity with TF-IDF instead of Jaccard
- [ ] Department-specific admin roles
- [ ] Project archiving after semester ends
- [ ] Comment threads on projects
- [ ] GitHub integration (auto-fetch repo stats)

---

## 👩‍💻 Demo Credentials

> After setup, register with these details to test:
> - Name: Sadia
> - University ID: 1118016
> - Email: sadia@mail.com
> - Batch: CSE-18
> - Group: G1

---

Built for BAIUST · Web Technology Project · 2025
