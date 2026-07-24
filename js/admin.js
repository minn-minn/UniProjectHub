// ============================================================
// admin.js — Admin Panel Functions
// ============================================================
// Used across all admin pages.
// Admin can manage: Batches, Lab Groups, Categories,
// Review Tags, Tech Stacks, and view Analytics.
// ============================================================
import { requireAdmin, logoutUser } from './auth.js';
import {
  getBatches, createBatch, updateBatch, deleteBatch,
  getLabGroups, createLabGroup, deleteLabGroup,
  getCategories, addCategory, deleteCategory,
  getReviewTags, addReviewTag, deleteReviewTag,
  getTechStacks, addTechStack, deleteTechStack,
  getAllProjects
} from './firestore.js';
import { showToast, showLoading, showEmpty, confirmAction, formatDate } from './utils.js';

// ── Identify which admin page we are on ──────────────────────
// Each admin page has a data-page attribute on the body tag
const page = document.body.dataset.page;

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    const { user, userData } = await requireAdmin();

    // Show admin name in sidebar
    const nameEl = document.getElementById('sidebar-user-name');
    const deptEl = document.getElementById('sidebar-user-dept');
    if (nameEl) nameEl.textContent = userData.fullName || 'Admin';
    if (deptEl) deptEl.textContent = 'Administrator';

    document.getElementById('logout-btn')?.addEventListener('click', logoutUser);

    // Load the right content based on which page this is
    if (page === 'admin-dashboard')      loadAdminDashboard();
    if (page === 'batch-management')     loadBatchManagement();
    if (page === 'metadata-management')  loadMetadataManagement();
    if (page === 'analytics')            loadAnalytics();
  } catch (err) {
    console.error('Admin init error:', err);
  }
}

// ============================================================
// ADMIN DASHBOARD — Summary stats
// ============================================================
async function loadAdminDashboard() {
  try {
    const [projects, batches, categories, techStacks] = await Promise.all([
      getAllProjects(), getBatches(), getCategories(), getTechStacks()
    ]);

    setValue('stat-total-projects', projects.length);
    setValue('stat-total-batches',  batches.length);
    setValue('stat-total-cats',     categories.length);
    setValue('stat-total-tech',     techStacks.length);

    // Recent projects table
    const recent = projects.slice(0, 8);
    const tbody  = document.getElementById('recent-projects-tbody');
    if (!tbody) return;

    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400 text-sm">No projects yet.</td></tr>';
      return;
    }

    tbody.innerHTML = recent.map(p => `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="py-3 px-4 text-sm font-medium text-slate-800">
          <a href="project.html?id=${p.id}" class="hover:text-green-700">${p.name}</a>
        </td>
        <td class="py-3 px-4 text-sm text-slate-500">${p.department || '—'}</td>
        <td class="py-3 px-4 text-sm text-slate-500">${p.batch      || '—'}</td>
        <td class="py-3 px-4 text-sm text-slate-500">${(p.members   || []).length} member(s)</td>
        <td class="py-3 px-4 text-sm text-slate-400">${formatDate(p.createdAt)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Admin dashboard error:', err);
  }
}

// ============================================================
// BATCH MANAGEMENT
// ============================================================
async function loadBatchManagement() {
  showLoading('batches-list');
  showLoading('groups-list');

  try {
    await renderBatches();
    await renderGroups();
  } catch (err) {
    console.error('Batch management error:', err);
  }

  // Add Batch
  document.getElementById('add-batch-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('new-batch-input');
    const name  = input?.value.trim();
    if (!name) { showToast('Enter a batch name.', 'error'); return; }
    try {
      await createBatch(name);
      input.value = '';
      await renderBatches();
      showToast(`Batch "${name}" added!`);
    } catch (err) {
      showToast('Failed to add batch.', 'error');
    }
  });

  // Add Lab Group
  document.getElementById('add-group-btn')?.addEventListener('click', async () => {
    const batchSel = document.getElementById('group-batch-select');
    const nameInput = document.getElementById('new-group-input');
    const name    = nameInput?.value.trim();
    const batchId = batchSel?.value;
    if (!name)    { showToast('Enter a group name.', 'error'); return; }
    if (!batchId) { showToast('Select a batch.', 'error'); return; }
    try {
      await createLabGroup(name, batchId);
      nameInput.value = '';
      await renderGroups();
      showToast(`Group "${name}" added!`);
    } catch (err) {
      showToast('Failed to add group.', 'error');
    }
  });
}

async function renderBatches() {
  const list    = document.getElementById('batches-list');
  const batchSel = document.getElementById('group-batch-select');

  try {
    const batches = await getBatches();

    // Update batch select for group creation
    if (batchSel) {
      const currentVal = batchSel.value;
      batchSel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value       = b.id;
        opt.textContent = b.name;
        if (b.id === currentVal) opt.selected = true;
        batchSel.appendChild(opt);
      });
    }

    if (!list) return;
    if (batches.length === 0) {
      showEmpty('batches-list', 'No batches yet.');
      return;
    }

    list.innerHTML = batches.map(b => `
      <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
        <span class="font-medium text-slate-800 text-sm">${b.name}</span>
        <div class="flex gap-2">
          <button onclick="editBatch('${b.id}', '${b.name.replace(/'/g,"\\'")}' )"
                  class="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">Rename</button>
          <button onclick="delBatch('${b.id}', '${b.name.replace(/'/g,"\\'")}' )"
                  class="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showEmpty('batches-list', 'Could not load batches.');
  }
}

async function renderGroups() {
  const list = document.getElementById('groups-list');
  if (!list) return;
  try {
    const groups = await getLabGroups();
    const batches = await getBatches();
    const batchMap = Object.fromEntries(batches.map(b => [b.id, b.name]));

    if (groups.length === 0) { showEmpty('groups-list', 'No groups yet.'); return; }

    list.innerHTML = groups.map(g => `
      <div class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
        <div>
          <span class="font-medium text-slate-800 text-sm">${g.name}</span>
          <span class="text-xs text-slate-400 ml-2">${batchMap[g.batchId] || 'Unknown Batch'}</span>
        </div>
        <button onclick="delGroup('${g.id}', '${g.name.replace(/'/g,"\\'")}' )"
                class="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
      </div>
    `).join('');
  } catch (err) {
    showEmpty('groups-list', 'Could not load groups.');
  }
}

window.editBatch = async (id, currentName) => {
  const newName = prompt('Rename batch:', currentName);
  if (!newName || newName === currentName) return;
  await updateBatch(id, newName);
  await renderBatches();
  showToast('Batch renamed!');
};

window.delBatch = async (id, name) => {
  const ok = await confirmAction(`Delete batch "${name}"?`);
  if (!ok) return;
  await deleteBatch(id);
  await renderBatches();
  showToast('Batch deleted.');
};

window.delGroup = async (id, name) => {
  const ok = await confirmAction(`Delete group "${name}"?`);
  if (!ok) return;
  await deleteLabGroup(id);
  await renderGroups();
  showToast('Group deleted.');
};

// ============================================================
// METADATA MANAGEMENT (Categories, Tags, Tech Stacks)
// ============================================================
async function loadMetadataManagement() {
  // Setup tab switching
  const tabs = ['categories', 'tags', 'techstacks'];
  tabs.forEach(tab => {
    document.getElementById(`meta-tab-${tab}`)?.addEventListener('click', () => setMetaTab(tab));
  });

  // Default to first tab
  setMetaTab('categories');

  // Wire up "Add" buttons
  document.getElementById('add-category-btn')?.addEventListener('click', () => addMetaItem('categories'));
  document.getElementById('add-tag-btn')?.addEventListener('click',      () => addMetaItem('tags'));
  document.getElementById('add-tech-btn')?.addEventListener('click',     () => addMetaItem('techstacks'));
}

function setMetaTab(active) {
  ['categories','tags','techstacks'].forEach(tab => {
    const btn   = document.getElementById(`meta-tab-${tab}`);
    const panel = document.getElementById(`meta-panel-${tab}`);
    const isActive = tab === active;
    if (btn) {
      btn.className = isActive
        ? 'px-4 py-3 text-sm font-semibold text-violet-700 border-b-2 border-violet-500 bg-white -mb-px'
        : 'px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors';
    }
    if (panel) panel.classList.toggle('hidden', !isActive);
  });

  // Load content for active tab
  if (active === 'categories') renderMetaList('categories', getCategories, deleteCategory, 'cats-list');
  if (active === 'tags')       renderMetaList('tags',       getReviewTags, deleteReviewTag,'tags-list');
  if (active === 'techstacks') renderMetaList('techstacks', getTechStacks, deleteTechStack,'tech-list');
}

async function renderMetaList(type, getFn, deleteFn, listId) {
  showLoading(listId);
  try {
    const items = await getFn();
    const list  = document.getElementById(listId);
    if (!list) return;

    if (items.length === 0) {
      showEmpty(listId, 'No items yet. Add one above.');
      return;
    }

    list.innerHTML = `
      <div class="flex flex-wrap gap-2">
        ${items.map(item => `
          <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <span class="text-sm text-slate-700">${item.name}</span>
            <button onclick="delMetaItem('${type}','${item.id}','${item.name.replace(/'/g,"\\'")}' )"
                    class="text-slate-400 hover:text-red-500 ml-1 text-xs font-bold">✕</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    showEmpty(listId, 'Could not load items.');
  }
}

async function addMetaItem(type) {
  const inputId = { categories: 'new-category-input', tags: 'new-tag-input', techstacks: 'new-tech-input' }[type];
  const listId  = { categories: 'cats-list', tags: 'tags-list', techstacks: 'tech-list' }[type];
  const addFn   = { categories: addCategory, tags: addReviewTag, techstacks: addTechStack }[type];
  const delFn   = { categories: deleteCategory, tags: deleteReviewTag, techstacks: deleteTechStack }[type];
  const getFn   = { categories: getCategories, tags: getReviewTags, techstacks: getTechStacks }[type];

  const input = document.getElementById(inputId);
  const name  = input?.value.trim();
  if (!name) { showToast('Enter a name.', 'error'); return; }

  try {
    await addFn(name);
    input.value = '';
    await renderMetaList(type, getFn, delFn, listId);
    showToast(`"${name}" added!`);
  } catch (err) {
    showToast('Failed to add item.', 'error');
  }
}

window.delMetaItem = async (type, id, name) => {
  const ok = await confirmAction(`Delete "${name}"?`);
  if (!ok) return;

  const listId = { categories: 'cats-list', tags: 'tags-list', techstacks: 'tech-list' }[type];
  const delFn  = { categories: deleteCategory, tags: deleteReviewTag, techstacks: deleteTechStack }[type];
  const getFn  = { categories: getCategories, tags: getReviewTags, techstacks: getTechStacks }[type];

  try {
    await delFn(id);
    await renderMetaList(type, getFn, delFn, listId);
    showToast('Deleted.');
  } catch (err) {
    showToast('Failed to delete.', 'error');
  }
};

// ============================================================
// ANALYTICS
// ============================================================
async function loadAnalytics() {
  showLoading('analytics-content');
  try {
    const projects = await getAllProjects();

    // Count by department
    const byDept     = countBy(projects, 'department');
    const byBatch    = countBy(projects, 'batch');
    const byCategory = countBy(projects, 'category');

    // Count tech stack usage
    const techCount = {};
    projects.forEach(p => {
      (p.techStack || []).forEach(t => {
        techCount[t] = (techCount[t] || 0) + 1;
      });
    });

    const container = document.getElementById('analytics-content');
    if (!container) return;

    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${renderBarChart('Projects by Department', byDept, 'teal')}
        ${renderBarChart('Projects by Batch',      byBatch, 'blue')}
        ${renderBarChart('Projects by Category',   byCategory, 'green')}
        ${renderBarChart('Popular Tech Stacks',    techCount, 'purple')}
      </div>
      <div class="mt-6 bg-white border border-slate-200 rounded-xl p-6">
        <h3 class="font-semibold text-slate-800 mb-1">Summary</h3>
        <p class="text-sm text-slate-500">Total Projects: <strong>${projects.length}</strong></p>
      </div>
    `;
  } catch (err) {
    showEmpty('analytics-content', 'Could not load analytics.');
  }
}

// Count occurrences of a field across projects
function countBy(projects, field) {
  const counts = {};
  projects.forEach(p => {
    const key = p[field] || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

// Render a simple CSS bar chart
function renderBarChart(title, data, color) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max     = Math.max(...entries.map(e => e[1]), 1);

  const colors = {
    teal:   'bg-teal-400',
    blue:   'bg-blue-400',
    green:  'bg-green-400',
    purple: 'bg-violet-400'
  };
  const barColor = colors[color] || 'bg-slate-400';

  if (entries.length === 0) {
    return `
      <div class="bg-white border border-slate-200 rounded-xl p-6">
        <h3 class="font-semibold text-slate-800 mb-4">${title}</h3>
        <p class="text-sm text-slate-400">No data yet.</p>
      </div>
    `;
  }

  return `
    <div class="bg-white border border-slate-200 rounded-xl p-6">
      <h3 class="font-semibold text-slate-800 mb-5">${title}</h3>
      <div class="space-y-3">
        ${entries.map(([label, count]) => `
          <div>
            <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span class="truncate font-medium">${label}</span>
              <span class="ml-2 font-semibold">${count}</span>
            </div>
            <div class="bg-slate-100 rounded-full h-2">
              <div class="${barColor} h-2 rounded-full transition-all"
                   style="width: ${Math.round((count / max) * 100)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Helper
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

init();
