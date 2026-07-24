// ============================================================
// create-project.js — Create New Project Page
// ============================================================
// The key feature here is LIVE SIMILARITY DETECTION:
// As the student types, we search for similar old projects
// and show them in a panel on the right. This helps avoid
// duplicating existing work.
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import { createProject, getCategories, getTechStacks } from './firestore.js';
import { findSimilarProjects } from './similarity.js';
import { showToast, renderSidebarUser, debounce } from './utils.js';

let currentUser     = null;
let currentUserData = null;
let selectedTech    = [];   // Array of chosen tech stack items

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    currentUser     = await requireAuth();
    currentUserData = await getCurrentUserData(currentUser.uid);

    renderSidebarUser(currentUserData);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    await loadFormOptions();
    setupForm();
    setupSimilarityDetection();
  } catch (err) {
    console.error(err);
  }
}

// ── Populate Dropdowns ────────────────────────────────────────
async function loadFormOptions() {
  try {
    const [categories, techStacks] = await Promise.all([
      getCategories(), getTechStacks()
    ]);

    // Category dropdown
    const catSel = document.getElementById('category');
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      catSel.appendChild(opt);
    });

    // Tech stack — render as clickable chips
    renderTechOptions(techStacks);
  } catch (err) {
    console.error('Form options error:', err);
  }
}

// Render tech stack as clickable chips
function renderTechOptions(techStacks) {
  const container = document.getElementById('tech-options');
  if (!container) return;

  container.innerHTML = techStacks.map(t => `
    <button type="button"
            class="tech-chip px-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            data-tech="${t.name}">
      ${t.name}
    </button>
  `).join('');

  // Toggle selection on click
  container.querySelectorAll('.tech-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tech = chip.dataset.tech;
      if (selectedTech.includes(tech)) {
        selectedTech = selectedTech.filter(t => t !== tech);
        chip.classList.remove('bg-blue-500', 'text-white', 'border-blue-500');
        chip.classList.add('border-slate-300', 'text-slate-600');
      } else {
        selectedTech.push(tech);
        chip.classList.add('bg-blue-500', 'text-white', 'border-blue-500');
        chip.classList.remove('border-slate-300', 'text-slate-600', 'hover:border-blue-400', 'hover:bg-blue-50', 'hover:text-blue-700');
      }
      // Trigger similarity check when tech changes
      triggerSimilarityCheck();
    });
  });
}

// ── Similarity Detection ──────────────────────────────────────
// Debounced: waits 600ms after the user stops typing
const triggerSimilarityCheck = debounce(async () => {
  const title = document.getElementById('project-name')?.value.trim()    || '';
  const desc  = document.getElementById('description')?.value.trim()     || '';

  if (title.length < 3 && desc.length < 10) {
    hideSimilarPanel();
    return;
  }

  showSimilarLoading();

  try {
    const results = await findSimilarProjects(title, desc, selectedTech);
    renderSimilarProjects(results);
  } catch (err) {
    console.error('Similarity error:', err);
    hideSimilarPanel();
  }
}, 600);

function setupSimilarityDetection() {
  document.getElementById('project-name')?.addEventListener('input', triggerSimilarityCheck);
  document.getElementById('description')?.addEventListener('input', triggerSimilarityCheck);
}

// Show loading state in similar panel
function showSimilarLoading() {
  const panel = document.getElementById('similar-panel');
  const body  = document.getElementById('similar-body');
  panel.classList.remove('hidden');
  body.innerHTML = `
    <div class="flex items-center gap-2 py-4 text-slate-500 text-sm justify-center">
      <div class="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      Searching similar projects...
    </div>
  `;
}

// Render similar projects or hide panel
function renderSimilarProjects(results) {
  const panel = document.getElementById('similar-panel');
  const body  = document.getElementById('similar-body');

  if (results.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');

  const scoreColor = (score) => {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 40) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  body.innerHTML = results.map(r => `
    <div class="p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-all">
      <div class="flex items-start justify-between gap-2 mb-1">
        <a href="project.html?id=${r.id}" target="_blank"
           class="font-semibold text-sm text-slate-800 hover:text-green-700 hover:underline">
          ${r.name}
        </a>
        <span class="text-xs font-bold px-2 py-0.5 rounded border ${scoreColor(r.score)} whitespace-nowrap">
          ${r.score}%
        </span>
      </div>
      <p class="text-xs text-slate-500 line-clamp-2 mb-1">${r.description || ''}</p>
      <span class="text-xs text-slate-400">${r.department || ''} · ${r.batch || ''}</span>
    </div>
  `).join('');
}

function hideSimilarPanel() {
  document.getElementById('similar-panel')?.classList.add('hidden');
}

// ── Form Submit ───────────────────────────────────────────────
function setupForm() {
  const form = document.getElementById('create-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('project-name').value.trim();
    const desc = document.getElementById('description').value.trim();
    const cat  = document.getElementById('category').value;

    // Validation
    if (!name) { showToast('Project name is required.', 'error'); return; }
    if (!desc) { showToast('Description is required.', 'error'); return; }

    const btn = document.getElementById('submit-btn');
    btn.disabled    = true;
    btn.textContent = 'Creating…';

    try {
      const projectId = await createProject(
        { name, description: desc, category: cat, techStack: selectedTech },
        currentUserData
      );
      showToast('Project created!', 'success');
      setTimeout(() => { window.location.href = `project.html?id=${projectId}`; }, 800);
    } catch (err) {
      console.error('Create project error:', err);
      showToast('Failed to create project. Try again.', 'error');
      btn.disabled    = false;
      btn.textContent = 'Create Project';
    }
  });
}

init();
