// ============================================================
// similarity.js — Similar Project Discovery Engine
// ============================================================
// This is the CORE FEATURE of UniProjectHub.
//
// HOW IT WORKS:
// 1. Student types a project name and description
// 2. We break the text into individual words (tokens)
// 3. We compare those words against every existing project
// 4. We score each match using Jaccard Similarity
// 5. We return the top 5 most similar projects
//
// JACCARD SIMILARITY:
//   score = (words in common) ÷ (all unique words combined)
//   Example: "web login" vs "login system"
//     Common words: {login}           = 1
//     All words: {web, login, system} = 3
//     Score = 1/3 = 33%
//
// WEIGHTING:
//   Description = 70%  (most important — describes what the project does)
//   Title       = 20%  (important — summarizes the idea)
//   Tech Stack  = 10%  (bonus — same technology = more similar)
// ============================================================

import { getAllProjectsRaw } from './firestore.js';

// Words to ignore — too common to be meaningful
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','was','are','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'must','can','this','that','these','those','it','its','we','our','us',
  'my','your','their','i','you','he','she','they','using','use','used',
  'system','based','project','app','application','platform','management',
  'create','new','build','make','develop'
]);

// ── Step 1: Tokenize ─────────────────────────────────────────
// Breaks text into a Set of meaningful lowercase words
function tokenize(text) {
  if (!text) return new Set();

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation
      .split(/\s+/)                   // Split on whitespace
      .filter(word =>
        word.length > 2 &&            // Skip very short words
        !STOP_WORDS.has(word)         // Skip stop words
      )
  );
}

// ── Step 2: Jaccard Similarity ───────────────────────────────
// Compares two sets of words and returns a score 0–1
function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  // Words in both sets
  const intersection = new Set([...setA].filter(w => setB.has(w)));

  // All unique words across both sets
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

// ── Step 3: Score One Project ────────────────────────────────
// Returns a 0–100 similarity score for one existing project
function scoreProject(inputTokens, existingProject) {
  const existTitle = tokenize(existingProject.name        || '');
  const existDesc  = tokenize(existingProject.description || '');
  const existTech  = tokenize((existingProject.techStack  || []).join(' '));

  const titleScore = jaccard(inputTokens.title, existTitle);
  const descScore  = jaccard(inputTokens.desc,  existDesc);
  const techScore  = jaccard(inputTokens.tech,  existTech);

  // Weighted combination
  const weighted = (descScore * 0.70) + (titleScore * 0.20) + (techScore * 0.10);

  return Math.round(weighted * 100);
}

// ── Main Function ─────────────────────────────────────────────
// Call this when the student types in the Create Project form.
//
// Parameters:
//   title     — project name text (string)
//   desc      — project description text (string)
//   techStack — array of tech stack strings e.g. ['Firebase', 'React']
//   excludeId — ID of current project to skip (for edit mode)
//
// Returns: Array of up to 5 objects: { id, name, description, department, score }
export async function findSimilarProjects(title, desc, techStack = [], excludeId = null) {
  // Don't search if input is too short — not enough to compare
  const combined = `${title} ${desc}`.trim();
  if (combined.length < 10) return [];

  // Tokenize the student's input
  const inputTokens = {
    title: tokenize(title),
    desc:  tokenize(desc),
    tech:  tokenize(techStack.join(' '))
  };

  // Load all existing projects from Firestore
  let allProjects;
  try {
    allProjects = await getAllProjectsRaw();
  } catch (err) {
    console.error('Similarity engine: could not load projects', err);
    return [];
  }

  // Score every existing project
  const scored = allProjects
    .filter(p => p.id !== excludeId)          // Skip current project
    .map(p => ({
      id:          p.id,
      name:        p.name,
      description: p.description,
      department:  p.department,
      batch:       p.batch,
      score:       scoreProject(inputTokens, p)
    }))
    .filter(p => p.score >= 10);              // Only show meaningful matches (10%+)

  // Sort highest score first, return top 5
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
