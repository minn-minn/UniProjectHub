// ============================================================
// firestore.js — All Database Operations
// ============================================================
// Every read/write to Firestore goes through this file.
// This keeps all database code in one place.
// ============================================================

import {
  collection, doc,
  addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where,
  serverTimestamp, arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db } from './firebase.js';

// ============================================================
// SORTING HELPERS
// ============================================================
// IMPORTANT — why we do NOT use Firestore orderBy() here:
//
// A query that combines where('projectId','==',x) with
// orderBy('createdAt') is a COMPOUND query. Firestore refuses to
// run it unless a composite index has been created in the console,
// and it throws a "failed-precondition / requires an index" error.
//
// That error is what made Timeline / Notes / Resources / Reviews
// say "Failed to add..." and show nothing — the write succeeded,
// but the read-back that follows it crashed.
//
// Fix: fetch with the equality filter only (always allowed, no
// index needed) and sort in JavaScript instead. Datasets here are
// per-project and small, so this is fast and needs zero setup.
// ============================================================

// Firestore Timestamp -> milliseconds. Handles Date, ISO string,
// and a serverTimestamp() that has not resolved yet (returns 0).
function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// Sort an array of docs by a timestamp field
function sortByTime(list, field = 'createdAt', direction = 'desc') {
  return list.sort((a, b) => direction === 'asc'
    ? toMillis(a[field]) - toMillis(b[field])
    : toMillis(b[field]) - toMillis(a[field]));
}

// Sort an array of docs alphabetically by name
function sortByName(list) {
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// Read a whole collection with optional equality filters, no orderBy
async function fetchWhere(colName, filters = {}) {
  const constraints = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([field, value]) => where(field, '==', value));
  const snap = await getDocs(query(collection(db, colName), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================================
// USERS
// ============================================================

// Get a user's profile by their UID
export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Update a user's profile fields
export async function updateUser(uid, fields) {
  await updateDoc(doc(db, 'users', uid), {
    ...fields,
    updatedAt: serverTimestamp()
  });
}

// Search students by name OR university ID (for adding team members)
export async function searchStudents(searchText) {
  // Firestore doesn't support full-text search, so we load all users
  // and filter locally. Fine for small university datasets.
  const snap = await getDocs(collection(db, 'users'));
  const results = [];
  const lower = searchText.toLowerCase();

  snap.forEach(d => {
    const u = { id: d.id, ...d.data() };
    if (u.isAdmin) return; // Skip admin accounts
    if (
      u.fullName?.toLowerCase().includes(lower) ||
      u.universityId?.toLowerCase().includes(lower)
    ) {
      results.push(u);
    }
  });

  return results.slice(0, 10); // Max 10 results
}

// ============================================================
// PROJECTS
// ============================================================

// Create a new project
export async function createProject(projectData, creatorUser) {
  const data = {
    name:               projectData.name,
    description:        projectData.description,
    department:         creatorUser.department,
    batch:              creatorUser.batch,
    labGroup:           creatorUser.labGroup,
    category:           projectData.category || '',
    techStack:          projectData.techStack || [],
    createdBy:          creatorUser.uid,
    completionPercent:  0,
    resourceCount:      0,
    reviewCount:        0,
    // Store creator as the first (leader) member
    members: [{
      uid:          creatorUser.uid,
      name:         creatorUser.fullName,
      universityId: creatorUser.universityId,
      isLeader:     true
    }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'projects'), data);
  return ref.id;
}

// Get a single project by ID
export async function getProject(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Get all projects (for Browse page)
export async function getAllProjects(filters = {}) {
  const projects = await fetchWhere('projects', {
    department: filters.department,
    batch:      filters.batch,
    labGroup:   filters.labGroup,
    category:   filters.category
  });
  return sortByTime(projects, 'createdAt', 'desc');
}

// Get projects where the user is a member
export async function getUserProjects(uid) {
  // Firestore can't query inside arrays of objects, so we load
  // all projects and filter by member uid locally.
  const projects = await fetchWhere('projects');
  const mine = projects.filter(p => p.members?.some(m => m.uid === uid));
  return sortByTime(mine, 'updatedAt', 'desc');
}

// Get recent projects from a department (for Dashboard)
export async function getRecentByDepartment(department, count = 6) {
  const projects = await fetchWhere('projects', { department });
  return sortByTime(projects, 'createdAt', 'desc').slice(0, count);
}

// Get all projects (for similarity engine and analytics)
export async function getAllProjectsRaw() {
  const snap = await getDocs(collection(db, 'projects'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Update project metadata
export async function updateProject(projectId, fields) {
  await updateDoc(doc(db, 'projects', projectId), {
    ...fields,
    updatedAt: serverTimestamp()
  });
}

// ── Team Members ─────────────────────────────────────────────

// Add a member to a project
export async function addMember(projectId, member) {
  await updateDoc(doc(db, 'projects', projectId), {
    members:   arrayUnion(member),
    updatedAt: serverTimestamp()
  });
}

// Remove a member from a project
export async function removeMember(projectId, member) {
  await updateDoc(doc(db, 'projects', projectId), {
    members:   arrayRemove(member),
    updatedAt: serverTimestamp()
  });
}

// ============================================================
// ACTIVITY TIMELINE
// ============================================================

// Get all activities for a project, oldest first
export async function getActivities(projectId) {
  const activities = await fetchWhere('activityTimeline', { projectId });
  return sortByTime(activities, 'createdAt', 'asc');
}

// Add a new activity
export async function createActivity(projectId, title, creatorUid) {
  const ref = await addDoc(collection(db, 'activityTimeline'), {
    projectId,
    title,
    completed:  false,
    createdBy:  creatorUid,
    createdAt:  serverTimestamp()
  });
  return ref.id;
}

// Toggle complete / edit title
export async function updateActivity(activityId, fields) {
  await updateDoc(doc(db, 'activityTimeline', activityId), fields);
}

// Delete an activity
export async function deleteActivity(activityId) {
  await deleteDoc(doc(db, 'activityTimeline', activityId));
}

// Recalculate and save completion percentage to the project
export async function recalcProgress(projectId) {
  const activities = await getActivities(projectId);
  if (activities.length === 0) {
    await updateProject(projectId, { completionPercent: 0 });
    return 0;
  }
  const done = activities.filter(a => a.completed).length;
  const pct  = Math.round((done / activities.length) * 100);
  await updateProject(projectId, { completionPercent: pct });
  return pct;
}

// ============================================================
// NOTES
// ============================================================

export async function getNotes(projectId) {
  const notes = await fetchWhere('notes', { projectId });
  return sortByTime(notes, 'createdAt', 'desc');
}

export async function createNote(projectId, title, content, creatorUid, creatorName) {
  const ref = await addDoc(collection(db, 'notes'), {
    projectId,
    title,
    content,
    createdBy:     creatorUid,
    createdByName: creatorName,
    createdAt:     serverTimestamp()
  });
  return ref.id;
}

export async function updateNote(noteId, fields) {
  await updateDoc(doc(db, 'notes', noteId), {
    ...fields,
    updatedAt: serverTimestamp()
  });
}

export async function deleteNote(noteId) {
  await deleteDoc(doc(db, 'notes', noteId));
}

// ============================================================
// RESOURCES
// ============================================================

export async function getResources(projectId) {
  const resources = await fetchWhere('resources', { projectId });
  return sortByTime(resources, 'createdAt', 'desc');
}

export async function createResource(projectId, data, creatorUid, creatorName) {
  const ref = await addDoc(collection(db, 'resources'), {
    projectId,
    type:          data.type,
    name:          data.name,
    url:           data.url,
    description:   data.description || '',
    createdBy:     creatorUid,
    createdByName: creatorName,
    createdAt:     serverTimestamp()
  });
  // Counter is cosmetic — never let it fail the whole "add resource" action
  try {
    await updateDoc(doc(db, 'projects', projectId), { resourceCount: increment(1) });
  } catch (err) {
    console.warn('resourceCount not updated:', err);
  }
  return ref.id;
}

export async function deleteResource(resourceId, projectId) {
  await deleteDoc(doc(db, 'resources', resourceId));
  try {
    await updateDoc(doc(db, 'projects', projectId), { resourceCount: increment(-1) });
  } catch (err) {
    console.warn('resourceCount not updated:', err);
  }
}

// ============================================================
// FINAL REVIEWS
// ============================================================

export async function getReviews(projectId) {
  const reviews = await fetchWhere('finalReviews', { projectId });
  return sortByTime(reviews, 'createdAt', 'desc');
}

// Find the review left by a specific user on a project
export async function getUserReview(projectId, uid) {
  const reviews = await getReviews(projectId);
  return reviews.find(r => r.createdBy === uid) || null;
}

export async function createReview(projectId, content, tags, creatorUid, creatorName) {
  const ref = await addDoc(collection(db, 'finalReviews'), {
    projectId,
    content,
    tags,
    createdBy:     creatorUid,
    createdByName: creatorName,
    createdAt:     serverTimestamp()
  });
  // Counter is cosmetic — never let it fail the whole "submit review" action
  try {
    await updateDoc(doc(db, 'projects', projectId), { reviewCount: increment(1) });
  } catch (err) {
    console.warn('reviewCount not updated:', err);
  }
  return ref.id;
}

export async function updateReview(reviewId, fields) {
  await updateDoc(doc(db, 'finalReviews', reviewId), fields);
}

// ============================================================
// ADMIN — BATCHES
// ============================================================

export async function getBatches() {
  return sortByName(await fetchWhere('batches'));
}

export async function createBatch(name) {
  return await addDoc(collection(db, 'batches'), {
    name, createdAt: serverTimestamp()
  });
}

export async function updateBatch(id, name) {
  await updateDoc(doc(db, 'batches', id), { name });
}

export async function deleteBatch(id) {
  await deleteDoc(doc(db, 'batches', id));
}

// ── Lab Groups ───────────────────────────────────────────────

export async function getLabGroups(batchId = null) {
  return sortByName(await fetchWhere('labGroups', { batchId }));
}

export async function createLabGroup(name, batchId) {
  return await addDoc(collection(db, 'labGroups'), {
    name, batchId, createdAt: serverTimestamp()
  });
}

export async function deleteLabGroup(id) {
  await deleteDoc(doc(db, 'labGroups', id));
}

// ============================================================
// ADMIN — METADATA (Categories, Review Tags, Tech Stacks)
// ============================================================

// Generic helpers for simple name-only collections
async function getMetaCollection(colName) {
  return sortByName(await fetchWhere(colName));
}

async function addMeta(colName, name) {
  return await addDoc(collection(db, colName), {
    name, createdAt: serverTimestamp()
  });
}

async function deleteMeta(colName, id) {
  await deleteDoc(doc(db, colName, id));
}

export const getCategories  = ()     => getMetaCollection('categories');
export const addCategory    = (name) => addMeta('categories', name);
export const deleteCategory = (id)   => deleteMeta('categories', id);

export const getReviewTags  = ()     => getMetaCollection('reviewTags');
export const addReviewTag   = (name) => addMeta('reviewTags', name);
export const deleteReviewTag= (id)   => deleteMeta('reviewTags', id);

export const getTechStacks  = ()     => getMetaCollection('techStacks');
export const addTechStack   = (name) => addMeta('techStacks', name);
export const deleteTechStack= (id)   => deleteMeta('techStacks', id);
