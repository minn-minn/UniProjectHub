// ============================================================
// browse.js — Browse Projects Page
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import { getAllProjects, getCategories, getBatches, getTechStacks } from './firestore.js';
import { showLoading, showEmpty, renderSidebarUser,
         truncate, techBadge, progressBar, debounce } from './utils.js';

let allProjects = []; // Cache all projects locally for instant filtering

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    const user     = await requireAuth();
    const userData = await getCurrentUserData(user.uid);

    renderSidebarUser(userData);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    // Load filter options and projects in parallel
    await Promise.all([
      loadFilterOptions(),
      loadAllProjects()
    ]);

    // Setup search + filter listeners
    setupFilters();
  } catch (err) {
    console.error(err);
  }
}

// ── Load Projects ─────────────────────────────────────────────
async function loadAllProjects() {
  showLoading('projects-grid');
  try {
    allProjects = await getAllProjects();
    renderProjects(allProjects);
    document.getElementById('result-count').textContent = `${allProjects.length} projects`;
  } catch (err) {
    console.error('Browse load error:', err);
    showEmpty('projects-grid', 'Could not load projects.', 'Check your connection.');
  }
}

// ── Load Filter Dropdowns ─────────────────────────────────────
async function loadFilterOptions() {
  try {
    const [categories, batches, techStacks] = await Promise.all([
      getCategories(), getBatches(), getTechStacks()
    ]);

    populateSelect('filter-category', categories, 'All Categories');
    populateSelect('filter-batch',    batches,    'All Batches');
    populateSelect('filter-tech',     techStacks, 'All Tech');
  } catch (err) {
    console.error('Filter options error:', err);
  }
}

function populateSelect(id, items, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.textContent = item.name;
    sel.appendChild(opt);
  });
}

// ── Filter & Search Logic ─────────────────────────────────────
function setupFilters() {
  const searchInput    = document.getElementById('search-input');
  const filterDept     = document.getElementById('filter-dept');
  const filterBatch    = document.getElementById('filter-batch');
  const filterCategory = document.getElementById('filter-category');
  const filterTech     = document.getElementById('filter-tech');
  const clearBtn       = document.getElementById('clear-filters');

  // Debounced search — waits 300ms after typing stops
  const handleChange = debounce(applyFilters, 300);

  searchInput?.addEventListener('input', handleChange);
  filterDept?.addEventListener('change', applyFilters);
  filterBatch?.addEventListener('change', applyFilters);
  filterCategory?.addEventListener('change', applyFilters);
  filterTech?.addEventListener('change', applyFilters);
  clearBtn?.addEventListener('click', clearAllFilters);
}

function applyFilters() {
  const search   = document.getElementById('search-input')?.value.toLowerCase().trim()  || '';
  const dept     = document.getElementById('filter-dept')?.value     || '';
  const batch    = document.getElementById('filter-batch')?.value    || '';
  const category = document.getElementById('filter-category')?.value || '';
  const tech     = document.getElementById('filter-tech')?.value     || '';

  const filtered = allProjects.filter(p => {
    // Text search — match name, description, or department
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search) ||
      p.description?.toLowerCase().includes(search) ||
      p.department?.toLowerCase().includes(search);

    const matchDept     = !dept     || p.department === dept;
    const matchBatch    = !batch    || p.batch      === batch;
    const matchCategory = !category || p.category   === category;
    const matchTech     = !tech     || (p.techStack || []).includes(tech);

    return matchSearch && matchDept && matchBatch && matchCategory && matchTech;
  });

  document.getElementById('result-count').textContent = `${filtered.length} project(s)`;
  renderProjects(filtered);
}

function clearAllFilters() {
  document.getElementById('search-input').value     = '';
  document.getElementById('filter-dept').value      = '';
  document.getElementById('filter-batch').value     = '';
  document.getElementById('filter-category').value  = '';
  document.getElementById('filter-tech').value      = '';
  renderProjects(allProjects);
  document.getElementById('result-count').textContent = `${allProjects.length} projects`;
}

// ── Render Project Cards ──────────────────────────────────────
function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (projects.length === 0) {
    showEmpty('projects-grid', 'No projects match your search.', 'Try different keywords or filters.');
    return;
  }

  grid.innerHTML = projects.map(p => {
    const techHtml = (p.techStack || []).slice(0, 3).map(techBadge).join('');
    return `
      <div class="bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 hover:shadow-sm transition-all flex flex-col">
        <!-- Top -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-semibold text-slate-800 text-sm leading-snug flex-1">${p.name}</h3>
          ${p.category ? `<span class="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md whitespace-nowrap">${p.category}</span>` : ''}
        </div>

        <!-- Badges -->
        <div class="flex flex-wrap gap-1 mb-1 text-xs text-slate-500">
          <span class="bg-slate-100 px-2 py-0.5 rounded">${p.department || '—'}</span>
          <span class="bg-slate-100 px-2 py-0.5 rounded">${p.batch || '—'}</span>
        </div>

        <!-- Description -->
        <p class="text-xs text-slate-500 my-2 flex-1 line-clamp-3">${truncate(p.description, 130)}</p>

        <!-- Tech Stack -->
        <div class="flex flex-wrap gap-1 mb-3">${techHtml}</div>

        <!-- Progress -->
        <div class="mb-3">${progressBar(p.completionPercent)}</div>

        <!-- Footer -->
        <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 mb-3">
          <span>👥 ${(p.members || []).length} member(s)</span>
          <span>📎 ${p.resourceCount || 0} resources</span>
          <span>⭐ ${p.reviewCount   || 0} reviews</span>
        </div>

        <!-- Button -->
        <a href="project.html?id=${p.id}"
           class="w-full text-center bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
          View Project →
        </a>
      </div>
    `;
  }).join('');
}

init();
