let csrfToken = null;
let currentMode = 'semantic';

const MODES = {
  lexical: {
    label: 'Lexical',
    icon: '\ud83d\udcda',
    description: 'Keyword matching \u2014 finds stories that contain the exact words you type.',
  },
  semantic: {
    label: 'Semantic',
    icon: '\ud83e\udde0',
    description: 'Understands intent and concepts \u2014 finds stories relevant to your meaning, even without exact keyword matches.',
  },
  generative: {
    label: 'Generative',
    icon: '\u2728',
    description: 'AI-powered answers \u2014 reads all stories and generates a direct answer to your question.',
  },
};

const EXAMPLE_QUERIES = [
  { icon: '\u2615', text: 'How do I brew better espresso at home?' },
  { icon: '\ud83c\udf0d', text: "Where does Fr\u00e9scopa\u2019s coffee come from?" },
  { icon: '\ud83c\udf75', text: 'I want to learn how to make latte art' },
];

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const resp = await fetch('/libs/granite/csrf/token.json', { credentials: 'same-origin' });
    if (resp.ok) {
      const data = await resp.json();
      csrfToken = data.token;
    }
  } catch (e) {
    /* ignore */
  }
  return csrfToken;
}

function getLinkedComponents(searchInputId) {
  const aiAnswers = document.querySelectorAll(`.ai-answer [data-search-input-id="${searchInputId}"]`);
  const searchResults = document.querySelectorAll(`.search-results [data-search-input-id="${searchInputId}"]`);
  return { aiAnswers, searchResults };
}

function extractSnippet(text, maxLen = 180) {
  if (!text) return '';
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, maxLen) + (text.length > maxLen ? '...' : '');
}

function getImageUrl(result) {
  const meta = (result.data && result.data.metadata) || {};
  const imgPath = meta['twitter:image'] || meta.primaryImagePath || '';
  if (!imgPath) return '';
  if (imgPath.startsWith('http')) return imgPath;
  const source = (result.data && result.data.source) || '';
  try {
    const url = new URL(source);
    return `${url.origin}${imgPath}`;
  } catch (e) {
    return '';
  }
}

function renderAIAnswer(el, data) {
  const answer = data.result || '';
  const links = (data.retrievedLinks || []).filter((l) => l.url && !l.url.endsWith('/robots.txt'));

  let html = `<div class="cai-gen-header">
    <div class="cai-gen-avatar">\u2728</div>
    <div>
      <div class="cai-gen-label">Generative Answer</div>
      <div class="cai-gen-sublabel">Powered by Content AI</div>
    </div>
  </div>`;
  html += `<div class="cai-answer-text">${answer}</div>`;
  if (links.length > 0) {
    html += '<div class="cai-answer-sources"><span class="cai-sources-label">Sources</span>';
    html += links.map((link) => {
      const parts = link.url.split('/');
      const page = parts[parts.length - 1].replace('.html', '').replace(/-/g, ' ');
      const name = page.charAt(0).toUpperCase() + page.slice(1);
      return `<a href="${link.url}" class="cai-source-link" target="_blank">${name}</a>`;
    }).join('');
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderSearchResults(el, data, mode) {
  const results = (data.results || []).filter((r) => {
    const src = r.data && r.data.source;
    return src && !src.endsWith('/robots.txt');
  });
  const count = results.length;

  if (count === 0) {
    el.innerHTML = '<div class="cai-no-results">No results found.</div>';
    return;
  }

  const modeInfo = MODES[mode] || MODES.semantic;
  const banner = `<div class="cai-results-banner">
    <span class="cai-banner-icon">\ud83d\udca1</span>
    <span>${modeInfo.label} search found <strong>${count} relevant stories</strong>.</span>
  </div>`;

  const header = `<div class="cai-results-header">
    <h3 class="cai-results-title">Stories Found</h3>
    <div class="cai-results-meta">
      <span class="cai-results-count">${count} results</span>
      <span class="cai-results-mode-badge badge-${mode}">${modeInfo.icon} ${modeInfo.label.toUpperCase()}</span>
    </div>
  </div>`;

  const cards = `<div class="cai-results-grid">${results.map((result) => {
    const meta = (result.data && result.data.metadata) || {};
    const title = meta.title || meta['twitter:title'] || 'Untitled';
    const source = (result.data && result.data.source) || '#';
    const snippet = extractSnippet(result.data && result.data.text);
    const imageUrl = getImageUrl(result);

    return `<div class="cai-story-card">
      ${imageUrl ? `<div class="cai-story-image"><img src="${imageUrl}" alt="${title}" loading="lazy"></div>` : '<div class="cai-story-image cai-story-image-empty"></div>'}
      <div class="cai-story-body">
        <a href="${source}" class="cai-story-title" target="_blank">${title}</a>
        <p class="cai-story-snippet">${snippet}</p>
      </div>
    </div>`;
  }).join('')}</div>`;

  el.innerHTML = banner + header + cards;
}

async function performSearch(query, searchInputId) {
  const { aiAnswers, searchResults } = getLinkedComponents(searchInputId);
  const timestamp = Date.now();

  let clientId = '';
  aiAnswers.forEach((el) => { if (el.dataset.clientId) clientId = el.dataset.clientId; });
  let index = '';
  searchResults.forEach((el) => { if (el.dataset.index) index = el.dataset.index; });

  const token = await getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['csrf-token'] = token;
  const fetchOpts = { method: 'POST', headers, credentials: 'same-origin' };

  if (currentMode === 'generative') {
    // Generative: show AI answer, hide search results
    aiAnswers.forEach((el) => {
      el.closest('.ai-answer').style.display = '';
      el.innerHTML = '<div class="cai-loading"><div class="cai-spinner"></div> Generating AI answer\u2026</div>';
    });
    searchResults.forEach((el) => { el.closest('.search-results').style.display = 'none'; });

    const payload = { query, timestamp };
    if (clientId) payload.clientId = clientId;

    try {
      const resp = await fetch('/bin/caid/gensearch', { ...fetchOpts, body: JSON.stringify(payload) });
      const data = await resp.json();
      aiAnswers.forEach((el) => {
        if (!data.error) renderAIAnswer(el, data);
        else el.innerHTML = `<div class="cai-error">${data.error}</div>`;
      });
    } catch (e) {
      aiAnswers.forEach((el) => { el.innerHTML = `<div class="cai-error">Request failed: ${e.message}</div>`; });
    }
  } else {
    // Lexical or Semantic: show search results, hide AI answer
    searchResults.forEach((el) => {
      el.closest('.search-results').style.display = '';
      el.innerHTML = '<div class="cai-loading"><div class="cai-spinner"></div> Searching\u2026</div>';
    });
    aiAnswers.forEach((el) => { el.closest('.ai-answer').style.display = 'none'; });

    const payload = { query, timestamp };
    if (index) payload.index = index;

    try {
      const resp = await fetch('/bin/caid/search', { ...fetchOpts, body: JSON.stringify(payload) });
      const data = await resp.json();
      searchResults.forEach((el) => {
        if (!data.error) renderSearchResults(el, data, currentMode);
        else el.innerHTML = `<div class="cai-error">${data.error}</div>`;
      });
    } catch (e) {
      searchResults.forEach((el) => { el.innerHTML = `<div class="cai-error">Search failed: ${e.message}</div>`; });
    }
  }
}

export default function decorate(block) {
  const id = block.textContent.trim() || 'default';
  block.innerHTML = '';

  // Mode toggle
  const modeSection = document.createElement('div');
  modeSection.classList.add('cai-mode-section');

  const modeLabel = document.createElement('div');
  modeLabel.classList.add('cai-mode-label');
  modeLabel.textContent = 'CHOOSE SEARCH MODE';

  const modeToggle = document.createElement('div');
  modeToggle.classList.add('cai-mode-toggle');

  const modeDesc = document.createElement('div');
  modeDesc.classList.add('cai-mode-desc');
  modeDesc.textContent = MODES[currentMode].description;

  Object.entries(MODES).forEach(([key, mode]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('cai-mode-btn');
    btn.dataset.mode = key;
    if (key === currentMode) btn.classList.add('active');
    btn.innerHTML = `${mode.icon} ${mode.label}`;
    btn.addEventListener('click', () => {
      currentMode = key;
      modeToggle.querySelectorAll('.cai-mode-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      modeDesc.textContent = mode.description;
    });
    modeToggle.append(btn);
  });

  modeSection.append(modeLabel, modeToggle, modeDesc);

  // Example queries
  const exSection = document.createElement('div');
  exSection.classList.add('cai-examples-section');

  const exLabel = document.createElement('div');
  exLabel.classList.add('cai-examples-label');
  exLabel.innerHTML = 'EXAMPLE QUERIES \u2014 CLICK TO SEARCH';

  const exRow = document.createElement('div');
  exRow.classList.add('cai-examples-row');

  // Search wrapper (build early so examples can reference it)
  const wrapper = document.createElement('div');
  wrapper.classList.add('cai-search-input-wrapper');
  wrapper.dataset.searchInputId = id;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask a question or search...';
  input.classList.add('cai-search-field');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Search Stories';
  btn.classList.add('cai-search-btn');

  const onSearch = () => {
    const q = input.value.trim();
    if (q) performSearch(q, id);
  };

  EXAMPLE_QUERIES.forEach((eq) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.classList.add('cai-example-card');
    card.innerHTML = `<span class="cai-example-icon">${eq.icon}</span> ${eq.text}`;
    card.addEventListener('click', () => {
      input.value = eq.text;
      performSearch(eq.text, id);
    });
    exRow.append(card);
  });

  exSection.append(exLabel, exRow);

  btn.addEventListener('click', onSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch();
  });

  wrapper.append(input, btn);
  block.append(modeSection, exSection, wrapper);
}
