// ============================================================
// utils.js — Shared Helper Functions
// ============================================================
// These small helper functions are used by many pages.
// Import what you need in your page JS files.
// ============================================================

// ── Toast Notifications ─────────────────────────────────────
// Shows a small popup message at the bottom of the screen.
// type: 'success' | 'error' | 'info'
export function showToast(message, type = 'success') {
  // Remove any existing toast first
  const existing = document.getElementById('toast-msg');
  if (existing) existing.remove();

  const colors = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-blue-600'
  };

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ'
  };

  const toast = document.createElement('div');
  toast.id = 'toast-msg';
  toast.className = `
    fixed bottom-6 right-6 z-50 flex items-center gap-3
    ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg
    text-sm font-medium transition-all duration-300
  `;
  toast.innerHTML = `
    <span class="font-bold text-base">${icons[type]}</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Loading Spinner ──────────────────────────────────────────
// Show a spinner inside any element by its ID
export function showLoading(elementId, message = 'Loading...') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <div class="flex items-center justify-center py-12 text-slate-500">
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-sm">${message}</p>
      </div>
    </div>
  `;
}

// Show empty state when no data is found
export function showEmpty(elementId, message = 'No items found.', hint = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-slate-400">
      <div class="text-5xl mb-4">📭</div>
      <p class="text-base font-medium text-slate-500">${message}</p>
      ${hint ? `<p class="text-sm mt-1">${hint}</p>` : ''}
    </div>
  `;
}

// ── Date Formatting ──────────────────────────────────────────
// Converts a Firestore Timestamp or JS Date into a readable string
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'short',
    day:   'numeric'
  });
}

// Shows "2 days ago", "just now", etc.
export function timeAgo(timestamp) {
  if (!timestamp) return '—';
  const date   = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now    = new Date();
  const diff   = Math.floor((now - date) / 1000); // seconds

  if (diff < 60)         return 'just now';
  if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)    return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(timestamp);
}

// ── URL Helpers ──────────────────────────────────────────────
// Get a URL query parameter: getQueryParam('id') from ?id=abc123
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Check if a URL looks valid
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ── HTML Escaping ────────────────────────────────────────────
// User-typed text (note titles, activity names, review text) is
// inserted with innerHTML. Without escaping, a stray < or " can
// break the surrounding markup and make the item render blank.
export function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Error Messages ───────────────────────────────────────────
// Turns a Firebase error into something a human can act on,
// and always logs the raw error to the console for debugging.
export function describeError(err, fallback = 'Something went wrong.') {
  console.error(err);
  const code = err?.code || '';
  if (code.includes('permission-denied'))
    return 'Permission denied — check your Firestore security rules.';
  if (code.includes('failed-precondition'))
    return 'Database query needs an index. Check the console for the fix link.';
  if (code.includes('unavailable') || code.includes('network'))
    return 'Network problem — check your connection and try again.';
  if (code.includes('unauthenticated'))
    return 'You are signed out. Please log in again.';
  return err?.message ? `${fallback} (${err.message})` : fallback;
}

// ── Text Helpers ─────────────────────────────────────────────
// Shorten long text with "..."
export function truncate(text, maxLength = 120) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

// ── Debounce ─────────────────────────────────────────────────
// Delays a function call. Used for live search to avoid
// firing on every single keystroke.
// Example: input.addEventListener('input', debounce(search, 400))
export function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Avatar Color ─────────────────────────────────────────────
// Returns a Tailwind bg color based on first letter of name
export function getAvatarColor(name = '') {
  const palette = [
    'bg-blue-500',   'bg-green-500',  'bg-purple-500',
    'bg-pink-500',   'bg-yellow-500', 'bg-red-500',
    'bg-teal-500',   'bg-indigo-500', 'bg-orange-500'
  ];
  const index = (name.charCodeAt(0) || 0) % palette.length;
  return palette[index];
}

// ── Confirm Modal ────────────────────────────────────────────
// Shows a simple confirmation dialog before a destructive action.
// Returns a Promise<boolean>
export function confirmAction(message = 'Are you sure?') {
  return new Promise((resolve) => {
    // Remove existing modal
    const existing = document.getElementById('confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-modal';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <p class="text-slate-800 font-medium text-center mb-6">${message}</p>
        <div class="flex gap-3">
          <button id="confirm-no"  class="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button id="confirm-yes" class="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-yes').onclick = () => { overlay.remove(); resolve(true);  };
    document.getElementById('confirm-no').onclick  = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// ── Render Sidebar User Info ─────────────────────────────────
// Call this from every protected page to show the user's
// name and department in the sidebar.
export function renderSidebarUser(userData) {
  const nameEl  = document.getElementById('sidebar-user-name');
  const deptEl  = document.getElementById('sidebar-user-dept');
  const avEl    = document.getElementById('sidebar-avatar');

  if (!userData) return;

  const initial = (userData.fullName || 'U').charAt(0).toUpperCase();
  const color   = getAvatarColor(userData.fullName || '');

  if (nameEl) nameEl.textContent = userData.fullName || 'Student';
  if (deptEl) deptEl.textContent = userData.department || '';
  if (avEl)   { avEl.textContent = initial; avEl.className = `w-9 h-9 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm`; }
}

// ── Tech Stack Badge ─────────────────────────────────────────
// Returns HTML for a small colored badge
export function techBadge(tech) {
  return `<span class="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-md font-medium">${tech}</span>`;
}

export function tagBadge(tag) {
  return `<span class="inline-block bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-md font-medium">${tag}</span>`;
}

// ── Progress Bar ─────────────────────────────────────────────
// Returns HTML for a progress bar + percentage
export function progressBar(percent) {
  const pct = Math.min(100, Math.max(0, percent || 0));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-slate-400';
  return `
    <div class="flex items-center gap-2">
      <div class="flex-1 bg-slate-100 rounded-full h-1.5">
        <div class="${color} h-1.5 rounded-full transition-all" style="width: ${pct}%"></div>
      </div>
      <span class="text-xs text-slate-500 font-medium w-8 text-right">${pct}%</span>
    </div>
  `;
}
