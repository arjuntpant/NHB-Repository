/* ============================================================
   NHB JV Question Database — app.js
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY = 'nhb_user_questions';
const THRESHOLD = 2 / 3; // clue must appear in ≥ 2/3 of results

// Stopwords to exclude from clue analysis
const STOPWORDS = new Set([
  'a','an','the','and','or','but','of','in','on','at','to','for',
  'with','by','from','as','is','was','were','are','be','been',
  'being','have','has','had','do','does','did','will','would',
  'could','should','may','might','shall','this','that','these',
  'those','it','its','he','she','they','them','his','her','their',
  'who','which','what','when','where','how','not','no','so','if',
  'than','then','also','after','before','during','over','under',
  'into','onto','upon','about','against','between','through',
  'while','though','although','because','since','until','without',
  'within','among','across','along','around','there','here','very',
  'such','one','two','three','first','second','third','can','said',
  'name','points','named','known','called','became','used','made',
  'became','led','took','gave','set','put','came','went','later',
  'including','known','often','other','most','more','many','some',
  'any','all','each','both','only','even','just','also','much',
  'thus','where','whom','whose','while','whether','once','own',
  'same','new','old','large','small','great','long','high','low',
  'following','several','including','however','therefore','although',
  'him','us','we','i','you','me','my','your','our','up','out',
  'off','down','time','part','side','way','day','year','man','men',
  'war','city','country','state','government','army','king','empire',
  'battle','leader','president','prime','minister','republic'
]);

// ── State ─────────────────────────────────────────────────────
let allQuestions = [];   // combined: NHB_QUESTIONS + user-added
let currentResults = []; // current search results

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Hide loading overlay once data is ready (questions-data.js is already parsed)
  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
    loadAllQuestions();
    bindEvents();
    renderBrowseCount();
  }, 50);
});

function loadAllQuestions() {
  const userQs = getUserQuestions();
  allQuestions = [...NHB_QUESTIONS, ...userQs];
}

function getUserQuestions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { return []; }
}

function saveUserQuestion(q) {
  const existing = getUserQuestions();
  existing.push(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

// ── Event Binding ─────────────────────────────────────────────
function bindEvents() {
  document.getElementById('search-btn').addEventListener('click', runSearch);
  document.getElementById('clear-btn').addEventListener('click', clearSearch);
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch();
  });
  document.getElementById('sort-select').addEventListener('change', () => {
    const kw = document.getElementById('search-input').value.trim();
    renderQuestions(getSortedResults(currentResults, kw), kw);
  });
  document.getElementById('add-form').addEventListener('submit', handleAddQuestion);
  document.getElementById('browse-toggle').addEventListener('click', toggleBrowse);
}

// ── Search ────────────────────────────────────────────────────
function getCompFilter() {
  const checked = document.querySelector('input[name="comp-filter"]:checked');
  return checked ? checked.value : 'all';
}

function runSearch() {
  const keyword = document.getElementById('search-input').value.trim();
  if (!keyword) return;

  const answerOnly = document.getElementById('answer-only-toggle').checked;
  const showClues = document.getElementById('clue-analysis-toggle').checked;
  const compFilter = getCompFilter();

  const results = searchQuestions(keyword, answerOnly, compFilter);
  currentResults = results;

  document.getElementById('results-area').classList.remove('hidden');
  document.getElementById('result-count').textContent = `${results.length} found`;

  const sortedResults = getSortedResults(results, keyword);
  renderQuestions(sortedResults, keyword);

  if (showClues && results.length >= 3) {
    const clues = analyzeClues(results, keyword);
    renderClues(clues, results.length, keyword);
    document.getElementById('clues-section').classList.remove('hidden');
  } else {
    document.getElementById('clues-section').classList.add('hidden');
  }

  document.getElementById('questions-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  document.getElementById('results-area').classList.add('hidden');
  currentResults = [];
}

function searchQuestions(keyword, answerOnly, compFilter) {
  const kw = keyword.toLowerCase();
  return allQuestions.filter(q => {
    // Competition filter
    if (compFilter === 'Bee' && q.competition !== 'Bee') return false;
    if (compFilter === 'Bowl' && q.competition !== 'Bowl') return false;
    // Text filter
    if (answerOnly) {
      return q.answer.toLowerCase().includes(kw);
    }
    return (
      q.question.toLowerCase().includes(kw) ||
      q.answer.toLowerCase().includes(kw)
    );
  });
}

// ── Sort ──────────────────────────────────────────────────────
function getSortedResults(results, keyword) {
  const mode = document.getElementById('sort-select').value;
  const arr = [...results];
  if (mode === 'source') {
    arr.sort((a, b) => (a.source_label || '').localeCompare(b.source_label || ''));
  } else if (mode === 'answer') {
    arr.sort((a, b) => a.answer.localeCompare(b.answer));
  } else {
    // relevance: exact answer match first, then question match
    const kw = keyword.toLowerCase();
    arr.sort((a, b) => {
      const aAns = a.answer.toLowerCase().includes(kw) ? 0 : 1;
      const bAns = b.answer.toLowerCase().includes(kw) ? 0 : 1;
      return aAns - bAns;
    });
  }
  return arr;
}

// ── Render Questions ──────────────────────────────────────────
function renderQuestions(results, keyword) {
  const list = document.getElementById('questions-list');
  const noRes = document.getElementById('no-results');

  list.innerHTML = '';

  if (results.length === 0) {
    noRes.classList.remove('hidden');
    return;
  }
  noRes.classList.add('hidden');

  results.forEach((q, idx) => {
    list.appendChild(buildQuestionCard(q, idx + 1, keyword));
  });
}

function buildQuestionCard(q, displayNum, keyword) {
  const card = document.createElement('div');
  card.className = 'question-card' +
    (q.user_added ? ' user-added' : '') +
    (q.jv ? ' jv-specific' : '');

  const badges = [];
  if (q.jv_specific || q.jv) badges.push('<span class="q-badge badge-jv">JV Finals</span>');
  if (q.competition === 'Bowl') badges.push('<span class="q-badge badge-bowl">Bowl</span>');
  if (q.competition === 'Bee') badges.push('<span class="q-badge badge-bee">Bee</span>');
  if (q.user_added) badges.push('<span class="q-badge badge-user">User Added</span>');

  card.innerHTML = `
    <div class="q-header">
      <span class="q-num">#${displayNum}</span>
      <span class="q-source">${escapeHtml(q.source_label || q.source || 'Unknown')}</span>
      <span>${badges.join(' ')}</span>
    </div>
    <div class="q-body">
      <div class="q-text">${highlightKeyword(escapeHtml(q.question), keyword)}</div>
      <div class="q-answer-row">
        <span class="q-answer-label">Answer</span>
        <span class="q-answer-text">${highlightKeyword(escapeHtml(q.answer), keyword)}</span>
      </div>
    </div>
  `;
  return card;
}

// ── Clue Analysis ─────────────────────────────────────────────
function analyzeClues(results, searchKeyword) {
  const n = results.length;
  const minCount = Math.ceil(n * THRESHOLD); // ≥ 2/3 threshold
  const skw = searchKeyword.toLowerCase();

  // Collect all answers (lowercased) so we can exclude them from clues
  const answerWords = new Set();
  results.forEach(q => {
    tokenize(q.answer).forEach(w => answerWords.add(w));
  });

  // Collect candidate phrases from question text
  // Strategy: unigrams + bigrams from the question body (not answer line)
  const phraseCounts = new Map(); // phrase → Set of question indices that contain it
  const phraseContexts = new Map(); // phrase → example context sentences

  results.forEach((q, qi) => {
    const text = q.question;
    const tokens = tokenize(text);
    const sentences = text.split(/(?<=[.?!])\s+/);

    // Unigrams
    const seen = new Set();
    tokens.forEach(tok => {
      if (STOPWORDS.has(tok)) return;
      if (tok.length < 3) return;
      if (answerWords.has(tok)) return;
      // Skip if it's part of the search keyword
      if (skw.includes(tok) || tok.includes(skw)) return;
      if (!seen.has(tok)) {
        seen.add(tok);
        if (!phraseCounts.has(tok)) phraseCounts.set(tok, new Set());
        phraseCounts.get(tok).add(qi);
        // Store context
        if (!phraseContexts.has(tok)) {
          const ctx = findContext(sentences, tok);
          if (ctx) phraseContexts.set(tok, ctx);
        }
      }
    });

    // Bigrams (consecutive meaningful words)
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i], b = tokens[i + 1];
      if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
      if (a.length < 3 || b.length < 3) continue;
      if (answerWords.has(a) && answerWords.has(b)) continue;
      const bigram = `${a} ${b}`;
      if (skw.includes(a) && skw.includes(b)) continue;
      if (!seen.has(bigram)) {
        seen.add(bigram);
        if (!phraseCounts.has(bigram)) phraseCounts.set(bigram, new Set());
        phraseCounts.get(bigram).add(qi);
        if (!phraseContexts.has(bigram)) {
          const ctx = findContext(sentences, bigram);
          if (ctx) phraseContexts.set(bigram, ctx);
        }
      }
    }
  });

  // Filter to phrases meeting the threshold
  const frequent = [];
  phraseCounts.forEach((qSet, phrase) => {
    if (qSet.size >= minCount) {
      frequent.push({
        phrase,
        count: qSet.size,
        total: n,
        context: phraseContexts.get(phrase) || ''
      });
    }
  });

  // Remove sub-phrases if a longer phrase already covers them
  // (prefer bigrams over unigrams if bigram has same or higher count)
  const filtered = frequent.filter(item => {
    if (!item.phrase.includes(' ')) {
      // Check if a bigram containing this word also qualifies
      const dominated = frequent.some(other =>
        other.phrase !== item.phrase &&
        other.phrase.includes(' ') &&
        other.phrase.includes(item.phrase) &&
        other.count >= item.count
      );
      return !dominated;
    }
    return true;
  });

  // Sort by count desc, then phrase alphabetically
  filtered.sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));

  return filtered;
}

function tokenize(text) {
  // Lowercase, remove punctuation, split
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function findContext(sentences, phrase) {
  // Find the first sentence containing the phrase (cleaned)
  const target = phrase.toLowerCase();
  for (const s of sentences) {
    if (s.toLowerCase().includes(target)) {
      // Strip the (+) and (*) markers, trim
      return s
        .replace(/\(\+\)|\(\*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
    }
  }
  return '';
}

// ── Generate clue explanation ─────────────────────────────────
function buildClueExplanation(clue, context, answers) {
  // Build a natural explanation of the clue without naming the answer
  const cap = toTitleCase(clue.phrase);
  const frac = `${clue.count}/${clue.total}`;

  // Identify what kind of clue this is from context
  let desc = '';

  if (context) {
    // Sanitize context: strip answer words from context display
    let safeCtx = context;
    answers.forEach(ans => {
      const words = ans.split(/\s+/);
      words.forEach(w => {
        if (w.length > 3) {
          const re = new RegExp('\\b' + escapeRegex(w) + '\\b', 'gi');
          safeCtx = safeCtx.replace(re, '___');
        }
      });
    });
    // Trim to a reasonable length and form description
    safeCtx = safeCtx.replace(/\s+/g, ' ').trim();
    if (safeCtx.length > 160) safeCtx = safeCtx.slice(0, 157) + '…';
    desc = `A frequently tested clue appearing in <strong>${frac}</strong> matching questions. Example context: "<em>${escapeHtml(safeCtx)}</em>"`;
  } else {
    desc = `A recurring term found in <strong>${frac}</strong> matching questions.`;
  }

  return desc;
}

// ── Render Clues ──────────────────────────────────────────────
function renderClues(clues, total, searchKeyword) {
  const list = document.getElementById('clues-list');
  const subtitle = document.getElementById('clues-subtitle');
  list.innerHTML = '';

  if (clues.length === 0) {
    subtitle.textContent = 'none found';
    document.getElementById('clues-section').classList.add('hidden');
    return;
  }

  subtitle.textContent = `${clues.length} found`;

  // Collect answers from current results (for sanitizing context)
  const answers = currentResults.map(q => q.answer);

  clues.forEach(clue => {
    const li = document.createElement('li');
    const cap = toTitleCase(clue.phrase);
    const frac = `${clue.count}/${clue.total}`;
    const explanation = buildClueExplanation(clue, clue.context, answers);

    li.innerHTML = `
      <div>
        <span class="clue-name">${escapeHtml(cap)}</span>
        <span class="clue-fraction">${frac}</span>
      </div>
      <div class="clue-desc">${explanation}</div>
    `;
    list.appendChild(li);
  });
}

// ── Add Question ──────────────────────────────────────────────
function handleAddQuestion(e) {
  e.preventDefault();
  const questionText = document.getElementById('new-question').value.trim();
  const answerText = document.getElementById('new-answer').value.trim();
  const sourceText = document.getElementById('new-source').value.trim();

  if (!questionText || !answerText) return;

  const newQ = {
    id: Date.now(),
    question: questionText,
    answer: answerText,
    source: sourceText || 'User Added',
    source_label: sourceText || 'User Added',
    jv: false,
    user_added: true
  };

  saveUserQuestion(newQ);
  allQuestions.push(newQ);
  renderBrowseCount();

  document.getElementById('new-question').value = '';
  document.getElementById('new-answer').value = '';
  document.getElementById('new-source').value = '';

  const msg = document.getElementById('add-success');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
}

// ── Browse All ────────────────────────────────────────────────
function renderBrowseCount() {
  document.getElementById('total-count').textContent = allQuestions.length;
}

let browseRendered = false;
function toggleBrowse() {
  const list = document.getElementById('browse-list');
  const btn = document.getElementById('browse-toggle');
  if (list.classList.contains('hidden')) {
    if (!browseRendered) {
      renderBrowseList();
      browseRendered = true;
    }
    list.classList.remove('hidden');
    btn.textContent = 'Hide';
  } else {
    list.classList.add('hidden');
    btn.textContent = 'Show All';
  }
}

function renderBrowseList() {
  const list = document.getElementById('browse-list');
  list.innerHTML = '';
  allQuestions.forEach((q, idx) => {
    list.appendChild(buildQuestionCard(q, idx + 1, ''));
  });
}

// ── Utilities ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightKeyword(html, keyword) {
  if (!keyword) return html;
  const escaped = escapeRegex(escapeHtml(keyword));
  const re = new RegExp(`(${escaped})`, 'gi');
  return html.replace(re, '<mark>$1</mark>');
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
