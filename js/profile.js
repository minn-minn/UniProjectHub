// ============================================================
// profile.js — Student Profile Page
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import { updateUser, getBatches, getLabGroups } from './firestore.js';
import { showToast, renderSidebarUser, getAvatarColor, formatDate } from './utils.js';

let currentUser = null;
let userData    = null;

// Cached at load time so filtering is instant and needs no extra Firestore reads
let _allGroups  = [];                 // every lab group document
const _batchMap = new Map();          // batch name → batch document ID

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    currentUser = await requireAuth();
    userData    = await getCurrentUserData(currentUser.uid);

    renderSidebarUser(userData);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    renderProfile();
    await loadBatchAndGroupData();    // load both at once
    setupEditForm();
    setupEditToggle();
  } catch (err) {
    console.error(err);
  }
}

// ── Display Profile ───────────────────────────────────────────
function renderProfile() {
  const initial = (userData.fullName || 'S').charAt(0).toUpperCase();
  const color   = getAvatarColor(userData.fullName || '');

  // Big avatar
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.textContent  = initial;
    avatarEl.className    = `w-20 h-20 rounded-full ${color} flex items-center justify-center text-white text-3xl font-bold`;
  }

  // Fields
  setValue('profile-name',   userData.fullName     || '—');
  setValue('profile-id',     userData.universityId || '—');
  setValue('profile-email',  userData.email        || '—');
  setValue('profile-dept',   userData.department   || '—');
  setValue('profile-batch',  userData.batch        || '—');
  setValue('profile-group',  userData.labGroup     || '—');
  setValue('profile-joined', formatDate(userData.createdAt));

  // Pre-fill edit form
  setInput('edit-name', userData.fullName  || '');
  setInput('edit-dept', userData.department || '');
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ── Load Batches AND Groups Together ─────────────────────────
// Both are loaded once. Groups are filtered client-side from _allGroups
// so switching batch is instant with no extra Firestore reads.
async function loadBatchAndGroupData() {
  try {
    // Load both in parallel
    const [batches, groups] = await Promise.all([getBatches(), getLabGroups()]);

    // Cache all groups
    _allGroups = groups;

    // Build name → id map for batches
    // (lab group documents store batchId = the batch document ID, not batch name)
    _batchMap.clear();
    batches.forEach(b => _batchMap.set(b.name, b.id));

    // Populate batch dropdown
    const batchSel = document.getElementById('edit-batch');
    if (!batchSel) return;

    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value       = b.name;
      opt.textContent = b.name;
      if (b.name === userData.batch) opt.selected = true;
      batchSel.appendChild(opt);
    });

    // When batch changes → filter groups for that batch only
    batchSel.addEventListener('change', () => {
      renderGroupOptions(batchSel.value, ''); // clear current group selection
    });

    // Show groups for the user's current batch on page load
    renderGroupOptions(userData.batch || '', userData.labGroup || '');

  } catch (err) {
    console.error('Batch/group load error:', err);
  }
}

// ── Render Group Dropdown (client-side filter) ────────────────
// batchName  — the batch name currently selected in the batch dropdown
// selectValue — which group to pre-select ('' means none)
function renderGroupOptions(batchName, selectValue) {
  const groupSel = document.getElementById('edit-group');
  if (!groupSel) return;

  // Always start fresh with the placeholder
  groupSel.innerHTML = '<option value="">Select Group</option>';

  if (!batchName) return; // no batch chosen yet → leave dropdown empty

  // Look up the document ID for the selected batch
  const batchId = _batchMap.get(batchName);

  // Filter from the cached list — only groups belonging to this batch
  const filtered = _allGroups.filter(g => g.batchId === batchId);

  if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.disabled     = true;
    opt.textContent  = 'No groups for this batch';
    groupSel.appendChild(opt);
    return;
  }

  filtered.forEach(g => {
    const opt = document.createElement('option');
    opt.value       = g.name;
    opt.textContent = g.name;
    if (g.name === selectValue) opt.selected = true;
    groupSel.appendChild(opt);
  });
}

// ── Toggle Edit Form ──────────────────────────────────────────
function setupEditToggle() {
  const editBtn   = document.getElementById('edit-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const viewPanel = document.getElementById('profile-view');
  const editPanel = document.getElementById('profile-edit');

  editBtn?.addEventListener('click', () => {
    viewPanel?.classList.add('hidden');
    editPanel?.classList.remove('hidden');
  });

  cancelBtn?.addEventListener('click', () => {
    viewPanel?.classList.remove('hidden');
    editPanel?.classList.add('hidden');
  });
}

// ── Save Profile Changes ──────────────────────────────────────
function setupEditForm() {
  const form = document.getElementById('edit-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName   = document.getElementById('edit-name')?.value.trim();
    const department = document.getElementById('edit-dept')?.value.trim();
    const batch      = document.getElementById('edit-batch')?.value;
    const labGroup   = document.getElementById('edit-group')?.value;

    if (!fullName) { showToast('Name is required.', 'error'); return; }

    const saveBtn = document.getElementById('save-profile-btn');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';

    try {
      await updateUser(currentUser.uid, { fullName, department, batch, labGroup });

      // Update local data
      userData = { ...userData, fullName, department, batch, labGroup };
      renderProfile();
      renderSidebarUser(userData);

      document.getElementById('profile-view')?.classList.remove('hidden');
      document.getElementById('profile-edit')?.classList.add('hidden');
      showToast('Profile updated!');
    } catch (err) {
      showToast('Failed to update profile.', 'error');
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

init();
