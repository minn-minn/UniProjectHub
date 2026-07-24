// ============================================================
// profile.js — Student Profile Page
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import { updateUser, getBatches, getLabGroups } from './firestore.js';
import { showToast, renderSidebarUser, getAvatarColor, formatDate } from './utils.js';

let currentUser = null;
let userData    = null;

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    currentUser = await requireAuth();
    userData    = await getCurrentUserData(currentUser.uid);

    renderSidebarUser(userData);
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    renderProfile();
    await loadBatchOptions();
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
  setValue('profile-name',       userData.fullName     || '—');
  setValue('profile-id',         userData.universityId || '—');
  setValue('profile-email',      userData.email        || '—');
  setValue('profile-dept',       userData.department   || '—');
  setValue('profile-batch',      userData.batch        || '—');
  setValue('profile-group',      userData.labGroup     || '—');
  setValue('profile-joined',     formatDate(userData.createdAt));

  // Pre-fill edit form
  setInput('edit-name',    userData.fullName     || '');
  setInput('edit-dept',    userData.department   || '');
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ── Load Batch Options for Edit Form ─────────────────────────
async function loadBatchOptions() {
  try {
    const batches = await getBatches();
    const batchSel = document.getElementById('edit-batch');
    if (!batchSel) return;

    batches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      if (b.name === userData.batch) opt.selected = true;
      batchSel.appendChild(opt);
    });

    // When batch changes, reload lab groups
    batchSel.addEventListener('change', () => loadGroupOptions(batchSel.value));

    // Load groups for current batch
    if (userData.batch) loadGroupOptions(userData.batch);
  } catch (err) {
    console.error('Batch options error:', err);
  }
}

async function loadGroupOptions(batchName) {
  try {
    const groups  = await getLabGroups();
    const groupSel = document.getElementById('edit-group');
    if (!groupSel) return;

    // Keep only placeholder
    groupSel.innerHTML = '<option value="">Select Group</option>';

    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.name;
      opt.textContent = g.name;
      if (g.name === userData.labGroup) opt.selected = true;
      groupSel.appendChild(opt);
    });
  } catch (err) {
    console.error('Group options error:', err);
  }
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
