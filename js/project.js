// ============================================================
// project.js — Project Detail Page (6 Tabs)
// ============================================================
// Tabs: Overview | Team Members | Activity Timeline | Notes | Resources | Final Reviews
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import {
  getProject, updateProject, addMember, removeMember,
  getActivities, createActivity, updateActivity, deleteActivity, recalcProgress,
  getNotes, createNote, updateNote, deleteNote,
  getResources, createResource, deleteResource,
  getReviews, createReview, updateReview,
  searchStudents
} from './firestore.js';
import { findSimilarProjects } from './similarity.js';
import {
  showToast, showLoading, showEmpty, renderSidebarUser,
  formatDate, techBadge, tagBadge,
  progressBar, getAvatarColor, getQueryParam, isValidUrl,
  confirmAction, debounce, escapeHtml, describeError
} from './utils.js';

let project     = null;
let currentUser = null;
let userData    = null;
let projectId   = null;
let isLeader    = false;
let isMember    = false;

// Store note objects by ID so edit/delete handlers can access full data
// (avoids putting note content inside onclick attributes, which breaks on newlines)
const _noteCache = new Map();

// Store student search results by UID so addMemberHandler can look them up
// (avoids putting names with apostrophes inside onclick attribute strings)
const _memberSearchCache = new Map();

// Store activities by ID so edit/delete handlers get the real title
// instead of one squeezed through an onclick="" attribute
const _activityCache = new Map();

// Safe refresh: reload a tab's list after a write. If the reload
// itself fails, we say so honestly instead of claiming the save failed.
async function refreshList(loader, renderer, listElementId, label) {
  try {
    renderer(await loader());
  } catch (err) {
    showEmpty(listElementId, `Saved, but could not reload ${label}.`, 'Refresh the page to see it.');
    showToast(describeError(err, `Could not reload ${label}.`), 'error');
  }
}

// ── Start ────────────────────────────────────────────────────
async function init() {
  projectId = getQueryParam('id');
  if (!projectId) { window.location.href = 'browse-projects.html'; return; }

  try {
    currentUser = await requireAuth();
    userData    = await getCurrentUserData(currentUser.uid);

    renderSidebarUser(userData);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    project  = await getProject(projectId);
    if (!project) { showToast('Project not found.', 'error'); return; }

    isMember = project.members?.some(m => m.uid === currentUser.uid) || false;
    isLeader = project.members?.some(m => m.uid === currentUser.uid && m.isLeader) || false;

    // Render page header info
    document.getElementById('project-title').textContent  = project.name;
    document.getElementById('project-dept').textContent   = project.department || '—';
    document.getElementById('project-batch').textContent  = project.batch      || '—';

    setupTabs();
    loadTab('overview'); // Load first tab by default
  } catch (err) {
    console.error(err);
  }
}

// ── Tab System ───────────────────────────────────────────────
const tabs = ['overview', 'team', 'timeline', 'notes', 'resources', 'reviews'];

function setupTabs() {
  tabs.forEach(tab => {
    document.getElementById(`tab-${tab}`)?.addEventListener('click', () => loadTab(tab));
  });
}

function setActiveTab(activeTab) {
  tabs.forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;
    // Note: -mb-px lives on the PARENT div in project.html, not on individual buttons.
    // Active tab gets a bottom border that visually merges with the panel below.
    if (tab === activeTab) {
      btn.className = 'tab-btn px-4 py-3 text-sm font-semibold text-green-700 border-b-2 border-green-500 bg-white whitespace-nowrap';
    } else {
      btn.className = 'tab-btn px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors whitespace-nowrap';
    }
  });
  // Hide all panels, show active
  tabs.forEach(tab => {
    const panel = document.getElementById(`panel-${tab}`);
    if (panel) panel.classList.toggle('hidden', tab !== activeTab);
  });
}

async function loadTab(tab) {
  setActiveTab(tab);
  switch (tab) {
    case 'overview':  loadOverview();  break;
    case 'team':      loadTeam();      break;
    case 'timeline':  loadTimeline();  break;
    case 'notes':     loadNotes();     break;
    case 'resources': loadResources(); break;
    case 'reviews':   loadReviews();   break;
  }
}

// ============================================================
// TAB 1: OVERVIEW
// ============================================================
async function loadOverview() {
  const p = project;

  document.getElementById('ov-name').textContent   = p.name;
  document.getElementById('ov-desc').textContent   = p.description;
  document.getElementById('ov-dept').textContent   = p.department  || '—';
  document.getElementById('ov-batch').textContent  = p.batch       || '—';
  document.getElementById('ov-group').textContent  = p.labGroup    || '—';
  document.getElementById('ov-cat').textContent    = p.category    || '—';
  document.getElementById('ov-date').textContent   = formatDate(p.createdAt);

  // Tech Stack
  const techContainer = document.getElementById('ov-tech');
  techContainer.innerHTML = (p.techStack?.length)
    ? p.techStack.map(techBadge).join(' ')
    : '<span class="text-slate-400 text-sm">No tech stack added.</span>';

  // Similar Projects
  loadSimilarProjects(p.name, p.description, p.techStack);
}

async function loadSimilarProjects(title, desc, techStack) {
  const container = document.getElementById('similar-projects');
  if (!container) return;
  container.innerHTML = `<div class="text-sm text-slate-400 flex items-center gap-2"><div class="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin"></div>Scanning…</div>`;

  try {
    const results = await findSimilarProjects(title, desc, techStack || [], projectId);

    if (results.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-400 italic">No similar projects found. This is unique! 🎉</p>';
      return;
    }

    container.innerHTML = results.map(r => {
      const color = r.score >= 70 ? 'border-l-red-400' : r.score >= 40 ? 'border-l-yellow-400' : 'border-l-blue-400';
      const badge = r.score >= 70 ? 'bg-red-100 text-red-700' : r.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
      return `
        <div class="flex items-start gap-3 p-3 border-l-4 ${color} bg-slate-50 rounded-r-lg">
          <div class="flex-1 min-w-0">
            <a href="project.html?id=${r.id}" class="font-semibold text-sm text-slate-800 hover:text-green-700">${r.name}</a>
            <p class="text-xs text-slate-500">${r.department || ''}</p>
          </div>
          <span class="text-xs font-bold px-2 py-1 rounded ${badge} whitespace-nowrap">${r.score}%</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="text-xs text-slate-400">Could not load similar projects.</p>';
  }
}

// ============================================================
// TAB 2: TEAM MEMBERS
// ============================================================
async function loadTeam() {
  renderTeamList();

  // Show add member section only for project members
  const addSection = document.getElementById('add-member-section');
  if (addSection) addSection.classList.toggle('hidden', !isMember);

  // Search students to add
  const searchInput = document.getElementById('member-search');
  const searchFn = debounce(async () => {
    const text = searchInput?.value.trim();
    if (!text || text.length < 2) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }
    const results = await searchStudents(text);
    renderStudentSearchResults(results);
  }, 400);
  // Use oninput (not addEventListener) so switching tabs doesn't stack up listeners
  if (searchInput) searchInput.oninput = searchFn;
}

function renderTeamList() {
  const list = document.getElementById('team-list');
  if (!list) return;
  const members = project.members || [];

  if (members.length === 0) {
    list.innerHTML = '<p class="text-slate-400 text-sm">No members yet.</p>';
    return;
  }

  list.innerHTML = members.map(m => {
    const color   = getAvatarColor(m.name);
    const initial = (m.name || 'U').charAt(0).toUpperCase();
    const canRemove = isLeader && !m.isLeader && m.uid !== currentUser.uid;
    return `
      <div class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
        <div class="w-10 h-10 rounded-full ${color} flex items-center justify-center text-white font-semibold">${initial}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-slate-800">${escapeHtml(m.name)}</p>
          <p class="text-xs text-slate-400">${escapeHtml(m.universityId) || ''} ${m.isLeader ? '· 👑 Leader' : ''}</p>
        </div>
        ${canRemove ? `
          <button onclick="removeMemberHandler('${m.uid}')"
                  class="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
            Remove
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderStudentSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!container) return;

  const memberUids = (project.members || []).map(m => m.uid);
  const available  = results.filter(u => !memberUids.includes(u.id));

  if (available.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 px-2">No matching students found.</p>';
    return;
  }

  // Cache results by UID — avoids putting names (which may contain apostrophes)
  // directly inside onclick="..." attribute strings
  _memberSearchCache.clear();
  available.forEach(u => _memberSearchCache.set(u.id, u));

  container.innerHTML = available.map(u => `
    <div class="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
         onclick="addMemberHandler('${u.id}')">
      <div class="w-8 h-8 rounded-full ${getAvatarColor(u.fullName)} flex items-center justify-center text-white text-sm font-semibold">
        ${u.fullName.charAt(0).toUpperCase()}
      </div>
      <div>
        <p class="text-sm font-medium text-slate-800">${escapeHtml(u.fullName)}</p>
        <p class="text-xs text-slate-400">${escapeHtml(u.universityId)} · ${escapeHtml(u.department)}</p>
      </div>
    </div>
  `).join('');
}

// Exposed to HTML onclick — only receives uid, looks up full data from cache
window.addMemberHandler = async (uid) => {
  const student = _memberSearchCache.get(uid);
  if (!student) { showToast('Student data not found. Search again.', 'error'); return; }

  const { fullName: name, universityId } = student;

  try {
    await addMember(projectId, { uid, name, universityId, isLeader: false });
    project = await getProject(projectId);
    isMember = true;
    renderTeamList();
    document.getElementById('member-search').value = '';
    document.getElementById('search-results').innerHTML = '';
    _memberSearchCache.clear();
    showToast(`${name} added to team!`);
  } catch (err) {
    showToast(describeError(err, 'Failed to add member.'), 'error');
  }
};

window.removeMemberHandler = async (uid) => {
  const ok = await confirmAction('Remove this member from the project?');
  if (!ok) return;
  try {
    const member = project.members.find(m => m.uid === uid);
    if (!member) return;
    await removeMember(projectId, member);
    project = await getProject(projectId);
    renderTeamList();
    showToast('Member removed.');
  } catch (err) {
    showToast(describeError(err, 'Failed to remove member.'), 'error');
  }
};

// ============================================================
// TAB 3: ACTIVITY TIMELINE
// ============================================================
async function loadTimeline() {
  showLoading('timeline-list');

  const addSection = document.getElementById('add-activity-section');
  if (addSection) addSection.classList.toggle('hidden', !isMember);

  try {
    renderTimeline(await getActivities(projectId));
  } catch (err) {
    showEmpty('timeline-list', 'Could not load activities.', describeError(err, ''));
  }

  // Use onclick (not addEventListener) so revisiting the tab doesn't stack up listeners
  const addActivityBtn = document.getElementById('add-activity-btn');
  if (addActivityBtn) addActivityBtn.onclick = async () => {
    const input = document.getElementById('new-activity-input');
    const title = input?.value.trim();
    if (!title) { showToast('Enter an activity title.', 'error'); return; }

    addActivityBtn.disabled = true;
    try {
      await createActivity(projectId, title, currentUser.uid);
      input.value = '';
      showToast('Activity added!');
    } catch (err) {
      showToast(describeError(err, 'Failed to add activity.'), 'error');
      addActivityBtn.disabled = false;
      return;
    }
    addActivityBtn.disabled = false;
    await refreshList(() => getActivities(projectId), renderTimeline, 'timeline-list', 'activities');
    recalcProgress(projectId).catch(e => console.warn('progress not saved:', e));
  };
}

function renderTimeline(activities) {
  const list = document.getElementById('timeline-list');
  if (!list) return;

  _activityCache.clear();
  activities.forEach(a => _activityCache.set(a.id, a));

  // Update progress display
  const done  = activities.filter(a => a.completed).length;
  const total = activities.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressEl = document.getElementById('timeline-progress');
  if (progressEl) progressEl.innerHTML = progressBar(pct);

  if (activities.length === 0) {
    showEmpty('timeline-list', 'No activities yet.', 'Add your first activity above.');
    return;
  }

  list.innerHTML = activities.map(a => `
    <div class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl group">
      <!-- Checkbox -->
      ${isMember ? `
        <input type="checkbox" ${a.completed ? 'checked' : ''}
               onchange="toggleActivity('${a.id}', this.checked)"
               class="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0">
      ` : `
        <span class="text-lg flex-shrink-0">${a.completed ? '✅' : '⬜'}</span>
      `}
      <!-- Title -->
      <span class="flex-1 text-sm ${a.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${escapeHtml(a.title)}</span>
      <!-- Actions (only for members) -->
      ${isMember ? `
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="editActivity('${a.id}')"
                  class="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50">Edit</button>
          <button onclick="delActivity('${a.id}')"
                  class="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.toggleActivity = async (id, completed) => {
  try {
    await updateActivity(id, { completed });
  } catch (err) {
    showToast(describeError(err, 'Failed to update.'), 'error');
    return;
  }
  await refreshList(() => getActivities(projectId), renderTimeline, 'timeline-list', 'activities');
  recalcProgress(projectId).catch(e => console.warn('progress not saved:', e));
};

window.editActivity = async (id) => {
  const activity = _activityCache.get(id);
  if (!activity) { showToast('Activity not found. Refresh the page.', 'error'); return; }

  const newTitle = prompt('Edit activity:', activity.title);
  if (newTitle === null) return;
  const trimmed = newTitle.trim();
  if (!trimmed || trimmed === activity.title) return;

  try {
    await updateActivity(id, { title: trimmed });
    showToast('Updated!');
  } catch (err) {
    showToast(describeError(err, 'Failed to update.'), 'error');
    return;
  }
  await refreshList(() => getActivities(projectId), renderTimeline, 'timeline-list', 'activities');
};

window.delActivity = async (id) => {
  const ok = await confirmAction('Delete this activity?');
  if (!ok) return;
  try {
    await deleteActivity(id);
    showToast('Deleted.');
  } catch (err) {
    showToast(describeError(err, 'Failed to delete.'), 'error');
    return;
  }
  await refreshList(() => getActivities(projectId), renderTimeline, 'timeline-list', 'activities');
  recalcProgress(projectId).catch(e => console.warn('progress not saved:', e));
};

// ============================================================
// TAB 4: NOTES
// ============================================================
async function loadNotes() {
  showLoading('notes-list');

  const addSection = document.getElementById('add-note-section');
  if (addSection) addSection.classList.toggle('hidden', !isMember);

  try {
    renderNotes(await getNotes(projectId));
  } catch (err) {
    showEmpty('notes-list', 'Could not load notes.', describeError(err, ''));
  }

  // Use onclick so revisiting the tab doesn't stack up listeners
  const addNoteBtn = document.getElementById('add-note-btn');
  if (addNoteBtn) addNoteBtn.onclick = () => showNoteModal();
}

function renderNotes(notes) {
  const list = document.getElementById('notes-list');
  if (!list) return;

  // Populate cache — this lets onclick handlers access the full note without
  // embedding the content string (which may contain quotes/newlines) in HTML
  _noteCache.clear();
  notes.forEach(n => _noteCache.set(n.id, n));

  if (notes.length === 0) {
    showEmpty('notes-list', 'No notes yet.', 'Add observations, challenges, or learnings.');
    return;
  }

  list.innerHTML = notes.map(n => `
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-start justify-between gap-2 mb-2">
        <h4 class="font-semibold text-slate-800">${escapeHtml(n.title)}</h4>
        <span class="text-xs text-slate-400">${formatDate(n.createdAt)}</span>
      </div>
      <p class="text-sm text-slate-600 whitespace-pre-wrap mb-3">${escapeHtml(n.content)}</p>
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-400">By ${escapeHtml(n.createdByName) || '—'}</span>
        ${(isMember && n.createdBy === currentUser.uid) ? `
          <div class="flex gap-2">
            <button onclick="editNote('${n.id}')"
                    class="text-xs text-blue-600 hover:underline">Edit</button>
            <button onclick="delNote('${n.id}')"
                    class="text-xs text-red-500 hover:underline">Delete</button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function showNoteModal(noteId = null, existingTitle = '', existingContent = '') {
  const modal = document.createElement('div');
  modal.id = 'note-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
      <h3 class="font-semibold text-slate-800 mb-4">${noteId ? 'Edit Note' : 'Add Note'}</h3>
      <input id="note-title" type="text" placeholder="Note title"
             value="${escapeHtml(existingTitle)}"
             class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400">
      <textarea id="note-content" rows="5" placeholder="Write your note here..."
                class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none">${escapeHtml(existingContent)}</textarea>
      <div class="flex gap-3">
        <button id="note-cancel" class="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button id="note-save"   class="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600">Save Note</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('note-cancel').onclick = () => modal.remove();
  document.getElementById('note-save').onclick   = async () => {
    const title   = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    if (!title || !content) { showToast('Fill in both fields.', 'error'); return; }

    const saveBtn = document.getElementById('note-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (noteId) {
        await updateNote(noteId, { title, content });
      } else {
        await createNote(projectId, title, content, currentUser.uid, userData.fullName);
      }
      modal.remove();
      showToast('Note saved!');
    } catch (err) {
      showToast(describeError(err, 'Failed to save note.'), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Note';
      return;
    }
    await refreshList(() => getNotes(projectId), renderNotes, 'notes-list', 'notes');
  };
}

window.editNote = (id) => {
  const note = _noteCache.get(id);
  if (note) showNoteModal(id, note.title, note.content);
};
window.delNote  = async (id) => {
  const ok = await confirmAction('Delete this note?');
  if (!ok) return;
  try {
    await deleteNote(id);
    showToast('Deleted.');
  } catch (err) {
    showToast(describeError(err, 'Failed to delete note.'), 'error');
    return;
  }
  await refreshList(() => getNotes(projectId), renderNotes, 'notes-list', 'notes');
};

// ============================================================
// TAB 5: RESOURCES
// ============================================================
async function loadResources() {
  showLoading('resources-list');

  const addSection = document.getElementById('add-resource-section');
  if (addSection) addSection.classList.toggle('hidden', !isMember);

  try {
    renderResources(await getResources(projectId));
  } catch (err) {
    showEmpty('resources-list', 'Could not load resources.', describeError(err, ''));
  }

  // Use onclick so revisiting the tab doesn't stack up listeners
  const addResourceBtn = document.getElementById('add-resource-btn');
  if (addResourceBtn) addResourceBtn.onclick = () => showResourceModal();
}

const RESOURCE_ICONS = { Repository: '📦', Document: '📄', Resource: '🔗' };

function renderResources(resources) {
  const list = document.getElementById('resources-list');
  if (!list) return;

  if (resources.length === 0) {
    showEmpty('resources-list', 'No resources yet.', 'Add GitHub repos, docs, or links.');
    return;
  }

  list.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Description</th>
          <th class="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">Added By</th>
          <th class="py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        ${resources.map(r => `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="py-3 px-3">
              <span class="inline-flex items-center gap-1 text-xs text-slate-600">
                ${RESOURCE_ICONS[r.type] || '🔗'} ${escapeHtml(r.type)}
              </span>
            </td>
            <td class="py-3 px-3">
              <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer"
                 class="font-medium text-blue-600 hover:underline">${escapeHtml(r.name)}</a>
            </td>
            <td class="py-3 px-3 hidden md:table-cell text-slate-500 text-xs">${escapeHtml(r.description) || '—'}</td>
            <td class="py-3 px-3 text-slate-400 text-xs">${escapeHtml(r.createdByName) || '—'}</td>
            <td class="py-3 px-3">
              ${(isMember && r.createdBy === currentUser.uid) ? `
                <div class="flex gap-1">
                  <button onclick="delResource('${r.id}')"
                          class="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                </div>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showResourceModal() {
  const modal = document.createElement('div');
  modal.id = 'resource-modal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
      <h3 class="font-semibold text-slate-800 mb-4">Add Resource</h3>
      <select id="res-type" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400">
        <option value="Repository">📦 Repository (GitHub / GitLab)</option>
        <option value="Document">📄 Document (Drive / OneDrive)</option>
        <option value="Resource">🔗 Resource (Tutorial / Reference)</option>
      </select>
      <input id="res-name" type="text" placeholder="Resource name"
             class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400">
      <input id="res-url"  type="url" placeholder="https://..."
             class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400">
      <input id="res-desc" type="text" placeholder="Short description (optional)"
             class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400">
      <div class="flex gap-3">
        <button id="res-cancel" class="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        <button id="res-save"   class="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600">Add Resource</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('res-cancel').onclick = () => modal.remove();
  document.getElementById('res-save').onclick   = async () => {
    const type = document.getElementById('res-type').value;
    const name = document.getElementById('res-name').value.trim();
    const url  = document.getElementById('res-url').value.trim();
    const desc = document.getElementById('res-desc').value.trim();

    if (!name) { showToast('Name is required.', 'error'); return; }
    if (!url || !isValidUrl(url)) { showToast('Enter a valid URL.', 'error'); return; }

    const saveBtn = document.getElementById('res-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding…';

    try {
      await createResource(projectId, { type, name, url, description: desc },
                           currentUser.uid, userData.fullName);
      modal.remove();
      showToast('Resource added!');
    } catch (err) {
      showToast(describeError(err, 'Failed to add resource.'), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Resource';
      return;
    }
    await refreshList(() => getResources(projectId), renderResources, 'resources-list', 'resources');
  };
}

window.delResource = async (id) => {
  const ok = await confirmAction('Delete this resource?');
  if (!ok) return;
  try {
    await deleteResource(id, projectId);
    showToast('Deleted.');
  } catch (err) {
    showToast(describeError(err, 'Failed to delete resource.'), 'error');
    return;
  }
  await refreshList(() => getResources(projectId), renderResources, 'resources-list', 'resources');
};

// ============================================================
// TAB 6: FINAL REVIEWS
// ============================================================
const REVIEW_TAGS = [
  'Good For Evaluation', 'Beginner Friendly', 'Research Oriented',
  'Software Heavy', 'Hardware Heavy', 'Time Consuming',
  'Strict Evaluation', 'Good Learning Experience'
];

let selectedReviewTags = [];
let existingReviewId   = null;

async function loadReviews() {
  showLoading('reviews-list');

  // Show the review form for members first — it must appear even if
  // the reviews list fails to load for some reason.
  const reviewForm = document.getElementById('review-form-section');
  if (reviewForm) reviewForm.classList.toggle('hidden', !isMember);

  let reviews = [];
  try {
    reviews = await getReviews(projectId);
    renderReviews(reviews);
  } catch (err) {
    showEmpty('reviews-list', 'Could not load reviews.', describeError(err, ''));
  }

  if (isMember) {
    // Reuse the list we already fetched instead of querying again
    const myReview = reviews.find(r => r.createdBy === currentUser.uid) || null;
    existingReviewId = myReview?.id || null;

    const textEl = document.getElementById('review-text');
    const btnEl  = document.getElementById('review-submit-btn');
    if (myReview) {
      if (textEl) textEl.value = myReview.content || '';
      selectedReviewTags = myReview.tags || [];
      if (btnEl) btnEl.textContent = 'Update Review';
    } else {
      if (textEl) textEl.value = '';
      selectedReviewTags = [];
      if (btnEl) btnEl.textContent = 'Submit Review';
    }
    renderTagSelector();
  }

  // Use onclick so revisiting the tab doesn't stack up listeners
  const submitBtn = document.getElementById('review-submit-btn');
  if (submitBtn) submitBtn.onclick = submitReview;
}

function renderTagSelector() {
  const container = document.getElementById('review-tags-selector');
  if (!container) return;

  container.innerHTML = REVIEW_TAGS.map(tag => `
    <button type="button"
            class="tag-select-btn px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              selectedReviewTags.includes(tag)
                ? 'bg-green-500 text-white border-green-500'
                : 'border-slate-300 text-slate-600 hover:border-green-400 hover:bg-green-50'
            }"
            data-tag="${tag}">
      ${tag}
    </button>
  `).join('');

  container.querySelectorAll('.tag-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (selectedReviewTags.includes(tag)) {
        selectedReviewTags = selectedReviewTags.filter(t => t !== tag);
      } else {
        selectedReviewTags.push(tag);
      }
      renderTagSelector(); // Re-render to update styles
    });
  });
}

async function submitReview() {
  const content = document.getElementById('review-text')?.value.trim();
  if (!content) { showToast('Write your review first.', 'error'); return; }

  const btn = document.getElementById('review-submit-btn');
  const original = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (existingReviewId) {
      await updateReview(existingReviewId, { content, tags: selectedReviewTags });
      showToast('Review updated!');
    } else {
      // Save the new ID so the next submit becomes an update, not a second create
      existingReviewId = await createReview(
        projectId, content, selectedReviewTags, currentUser.uid, userData.fullName
      );
      showToast('Review submitted!');
    }
  } catch (err) {
    showToast(describeError(err, 'Failed to save review.'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = original; }
    return;
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Update Review'; }
  await refreshList(() => getReviews(projectId), renderReviews, 'reviews-list', 'reviews');
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  if (reviews.length === 0) {
    showEmpty('reviews-list', 'No reviews yet.', 'Be the first team member to leave a review.');
    return;
  }

  list.innerHTML = reviews.map(r => `
    <div class="bg-white border border-slate-200 rounded-xl p-5">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-full ${getAvatarColor(r.createdByName || '')} flex items-center justify-center text-white font-semibold text-sm">
          ${(r.createdByName || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="font-semibold text-slate-800 text-sm">${escapeHtml(r.createdByName) || 'Anonymous'}</p>
          <p class="text-xs text-slate-400">${formatDate(r.createdAt)}</p>
        </div>
      </div>
      <p class="text-sm text-slate-600 mb-3 whitespace-pre-wrap">${escapeHtml(r.content)}</p>
      <div class="flex flex-wrap gap-1">
        ${(r.tags || []).map(tagBadge).join('')}
      </div>
    </div>
  `).join('');
}

init();
