// ============================================================
// dashboard.js — Student Dashboard Page
// ============================================================
import { requireAuth, getCurrentUserData, logoutUser } from './auth.js';
import { getUserProjects, getRecentByDepartment, getAllProjects } from './firestore.js';
import { showLoading, showEmpty, renderSidebarUser,
         timeAgo, truncate, techBadge, progressBar } from './utils.js';

// ── Start ────────────────────────────────────────────────────
async function init() {
  try {
    const user     = await requireAuth();
    const userData = await getCurrentUserData(user.uid);

    renderSidebarUser(userData);
    document.getElementById('welcome-name').textContent = userData.fullName?.split(' ')[0] || 'Student';

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logoutUser);

    // Load all dashboard sections in parallel
    await Promise.all([
      loadStats(user.uid, userData),
      loadRecentDeptProjects(userData.department),
      loadMyRecentProjects(user.uid),
      loadPopularProjects()
    ]);
  } catch (err) {
    console.error(err);
  }
}

// ── Stats Cards ──────────────────────────────────────────────
async function loadStats(uid, userData) {
  try {
    const myProjects = await getUserProjects(uid);

    // Count contributions (projects where user is a member but not leader)
    const contributions = myProjects.filter(p =>
      p.members?.some(m => m.uid === uid && !m.isLeader)
    ).length;

    // Total resources and reviews across user's projects
    let totalResources = 0;
    let totalReviews   = 0;
    myProjects.forEach(p => {
      totalResources += p.resourceCount || 0;
      totalReviews   += p.reviewCount   || 0;
    });

    document.getElementById('stat-projects').textContent     = myProjects.length;
    document.getElementById('stat-contributions').textContent = contributions;
    document.getElementById('stat-resources').textContent    = totalResources;
    document.getElementById('stat-reviews').textContent      = totalReviews;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ── Recent Department Projects ────────────────────────────────
async function loadRecentDeptProjects(department) {
  showLoading('dept-projects');
  try {
    const projects = await getRecentByDepartment(department, 6);

    if (projects.length === 0) {
      showEmpty('dept-projects', 'No projects yet in your department.', 'Be the first to create one!');
      return;
    }

    document.getElementById('dept-projects').innerHTML = projects.map(renderProjectCard).join('');
  } catch (err) {
    console.error('Dept projects error:', err);
  }
}

// ── My Recent Projects ────────────────────────────────────────
async function loadMyRecentProjects(uid) {
  showLoading('my-recent-projects');
  try {
    const projects = await getUserProjects(uid);
    const recent   = projects.slice(0, 3);

    if (recent.length === 0) {
      showEmpty('my-recent-projects', 'You have no projects yet.', 'Create your first project!');
      return;
    }

    document.getElementById('my-recent-projects').innerHTML =
      recent.map(p => `
        <a href="project.html?id=${p.id}" class="block p-4 border border-slate-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all bg-white">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="font-semibold text-slate-800 text-sm">${p.name}</h4>
            <span class="text-xs text-slate-400 whitespace-nowrap">${timeAgo(p.updatedAt)}</span>
          </div>
          <p class="text-xs text-slate-500 mb-3 line-clamp-2">${truncate(p.description, 80)}</p>
          ${progressBar(p.completionPercent)}
        </a>
      `).join('');
  } catch (err) {
    console.error('My projects error:', err);
  }
}

// ── Popular Projects ─────────────────────────────────────────
async function loadPopularProjects() {
  showLoading('popular-projects');
  try {
    const all     = await getAllProjects();
    // Sort by resource count + review count as a popularity proxy
    const popular = all
      .sort((a, b) => ((b.resourceCount || 0) + (b.reviewCount || 0)) -
                       ((a.resourceCount || 0) + (a.reviewCount || 0)))
      .slice(0, 4);

    if (popular.length === 0) {
      showEmpty('popular-projects', 'No projects yet.', 'Start contributing!');
      return;
    }

    document.getElementById('popular-projects').innerHTML = popular.map(renderProjectCard).join('');
  } catch (err) {
    console.error('Popular projects error:', err);
  }
}

// ── Project Card HTML ─────────────────────────────────────────
function renderProjectCard(project) {
  const techHtml = (project.techStack || []).slice(0, 3).map(techBadge).join('');
  return `
    <a href="project.html?id=${project.id}"
       class="block bg-white border border-slate-200 rounded-xl p-5 hover:border-green-300 hover:shadow-sm transition-all">
      <!-- Header -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <h4 class="font-semibold text-slate-800 text-sm leading-snug">${project.name}</h4>
        <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md whitespace-nowrap">${project.department || ''}</span>
      </div>
      <!-- Description -->
      <p class="text-xs text-slate-500 mb-3 line-clamp-2">${truncate(project.description, 100)}</p>
      <!-- Tech Stack -->
      <div class="flex flex-wrap gap-1 mb-3">${techHtml}</div>
      <!-- Footer -->
      <div class="flex items-center gap-3 text-xs text-slate-400 pt-2 border-t border-slate-100 mb-2">
        <span>👥 ${(project.members || []).length} member(s)</span>
        <span>📎 ${project.resourceCount || 0} resources</span>
        <span>⭐ ${project.reviewCount   || 0} reviews</span>
      </div>
      <div>${progressBar(project.completionPercent)}</div>
    </a>
  `;
}

init();
