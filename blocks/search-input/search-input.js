let csrfToken = null;
let currentMode = 'semantic';

const MODES = {
  lexical: {
    label: 'Lexical',
    icon: '\ud83d\udcda',
    color: '#A33532',
    description: 'Keyword matching \u2014 finds stories that contain the exact words you type.',
  },
  semantic: {
    label: 'Semantic',
    icon: '\ud83e\udde0',
    color: '#00647D',
    description: 'Understands intent and concepts \u2014 finds stories relevant to your meaning, even without exact keyword matches.',
  },
  generative: {
    label: 'Generative',
    icon: '\u2728',
    color: '#5B4FCF',
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
  } catch (e) { /* ignore */ }
  return csrfToken;
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
    .substring(0, maxLen) + (text.length > maxLen ? '\u2026' : '');
}

function getImageUrl(result) {
  const meta = (result.data && result.data.metadata) || {};
  const imgPath = meta['twitter:image'] || meta.primaryImagePath || '';
  if (!imgPath) return '';
  if (imgPath.startsWith('http')) return imgPath;
  try {
    const url = new URL((result.data && result.data.source) || '');
    return `${url.origin}${imgPath}`;
  } catch (e) { return ''; }
}

function renderGenAnswer(container, data) {
  const answer = data.result || '';
  const links = (data.retrievedLinks || []).filter((l) => l.url && !l.url.endsWith('/robots.txt'));

  let html = `<div class="cai-gen-panel">
    <div class="cai-gen-header">
      <div class="cai-gen-avatar">\u2728</div>
      <div>
        <div class="cai-gen-label">Generative Answer</div>
        <div class="cai-gen-sublabel">Powered by Content AI</div>
      </div>
    </div>
    <div class="cai-gen-body">${answer}</div>`;

  if (links.length > 0) {
    html += '<div class="cai-gen-sources"><span class="cai-gen-sources-label">Sources</span><div class="cai-gen-sources-list">';
    html += links.map((link) => {
      const parts = link.url.split('/');
      const page = parts[parts.length - 1].replace('.html', '').replace(/-/g, ' ');
      const name = page.charAt(0).toUpperCase() + page.slice(1);
      return `<a href="${link.url}" class="cai-gen-source-tag" target="_blank">${name}</a>`;
    }).join('');
    html += '</div></div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderSearchResults(container, data, mode) {
  const results = (data.results || []).filter((r) => {
    const src = r.data && r.data.source;
    return src && !src.endsWith('/robots.txt');
  });
  const count = results.length;
  const modeInfo = MODES[mode] || MODES.semantic;

  if (count === 0) {
    container.innerHTML = '<div class="cai-empty">No results found.</div>';
    return;
  }

  const banner = `<div class="cai-insight">
    <span class="cai-insight-icon">\ud83d\udca1</span>
    <span>${modeInfo.label} search found <strong>${count} relevant stories</strong>.</span>
  </div>`;

  const header = `<div class="cai-results-head">
    <h3 class="cai-results-title">Stories Found</h3>
    <div class="cai-results-meta">
      <span class="cai-results-count">${count} results</span>
      <span class="cai-mode-pill pill-${mode}">${modeInfo.icon} ${modeInfo.label.toUpperCase()}</span>
    </div>
  </div>`;

  const cards = `<div class="cai-stories-grid">${results.map((result) => {
    const meta = (result.data && result.data.metadata) || {};
    const title = meta.title || meta['twitter:title'] || 'Untitled';
    const source = (result.data && result.data.source) || '#';
    const snippet = extractSnippet(result.data && result.data.text);
    const imageUrl = getImageUrl(result);

    return `<a href="${source}" class="cai-story-card" target="_blank">
      ${imageUrl ? `<div class="cai-story-img"><img src="${imageUrl}" alt="${title}" loading="lazy"></div>` : '<div class="cai-story-img cai-story-img-empty"></div>'}
      <div class="cai-story-body">
        <div class="cai-story-title">${title}</div>
        <p class="cai-story-teaser">${snippet}</p>
      </div>
    </a>`;
  }).join('')}</div>`;

  container.innerHTML = banner + header + cards;
}

async function performSearch(query, resultsEl) {
  const timestamp = Date.now();
  const token = await getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['csrf-token'] = token;
  const fetchOpts = { method: 'POST', headers, credentials: 'same-origin' };

  resultsEl.innerHTML = '<div class="cai-loading"><div class="cai-spinner"></div> Searching\u2026</div>';
  resultsEl.style.display = '';

  if (currentMode === 'generative') {
    try {
      const resp = await fetch('/bin/caid/gensearch', {
        ...fetchOpts,
        body: JSON.stringify({ query, timestamp }),
      });
      const data = await resp.json();
      if (data.error) {
        resultsEl.innerHTML = `<div class="cai-error">${data.error}</div>`;
      } else {
        renderGenAnswer(resultsEl, data);
      }
    } catch (e) {
      resultsEl.innerHTML = `<div class="cai-error">Request failed: ${e.message}</div>`;
    }
  } else {
    try {
      const resp = await fetch('/bin/caid/search', {
        ...fetchOpts,
        body: JSON.stringify({ query, timestamp }),
      });
      const data = await resp.json();
      if (data.error) {
        resultsEl.innerHTML = `<div class="cai-error">${data.error}</div>`;
      } else {
        renderSearchResults(resultsEl, data, currentMode);
      }
    } catch (e) {
      resultsEl.innerHTML = `<div class="cai-error">Search failed: ${e.message}</div>`;
    }
  }
}

export default function decorate(block) {
  block.innerHTML = '';

  // Mode toggle
  const modeSection = document.createElement('div');
  modeSection.className = 'cai-mode-section';

  const modeLabel = document.createElement('div');
  modeLabel.className = 'cai-section-label';
  modeLabel.textContent = 'CHOOSE SEARCH MODE';

  const modeToggle = document.createElement('div');
  modeToggle.className = 'cai-mode-toggle';

  const modeDesc = document.createElement('div');
  modeDesc.className = 'cai-mode-caption';
  modeDesc.textContent = MODES[currentMode].description;

  Object.entries(MODES).forEach(([key, mode]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cai-mode-btn is-${key.substring(0, 3)}`;
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
  exSection.className = 'cai-examples-section';

  const exLabel = document.createElement('div');
  exLabel.className = 'cai-section-label';
  exLabel.innerHTML = 'EXAMPLE QUERIES \u2014 CLICK TO SEARCH';

  const exRow = document.createElement('div');
  exRow.className = 'cai-intents-grid';

  // Results area
  const resultsEl = document.createElement('div');
  resultsEl.className = 'cai-results-area';

  // Search bar
  const searchBar = document.createElement('div');
  searchBar.className = 'cai-search-bar';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask a question or search\u2026';
  input.className = 'cai-search-field';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Search Stories';
  btn.className = 'cai-search-btn';

  const onSearch = () => {
    const q = input.value.trim();
    if (q) performSearch(q, resultsEl);
  };

  btn.addEventListener('click', onSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(); });

  EXAMPLE_QUERIES.forEach((eq) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cai-intent-chip';
    card.innerHTML = `<span class="cai-intent-icon">${eq.icon}</span> <span class="cai-intent-text">${eq.text}</span>`;
    card.addEventListener('click', () => {
      input.value = eq.text;
      performSearch(eq.text, resultsEl);
    });
    exRow.append(card);
  });

  exSection.append(exLabel, exRow);
  searchBar.append(input, btn);
  block.append(modeSection, exSection, searchBar, resultsEl);
}
