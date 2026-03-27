let csrfToken = null;

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const resp = await fetch('/libs/granite/csrf/token.json', { credentials: 'same-origin' });
    if (resp.ok) {
      const data = await resp.json();
      csrfToken = data.token;
      return csrfToken;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Content AI] Could not fetch CSRF token:', e);
  }
  return null;
}

function getLinkedComponents(searchInputId) {
  const aiAnswers = document.querySelectorAll(`.ai-answer [data-search-input-id="${searchInputId}"]`);
  const searchResults = document.querySelectorAll(`.search-results [data-search-input-id="${searchInputId}"]`);
  return { aiAnswers, searchResults };
}

function extractSnippet(text, maxLen = 200) {
  if (!text) return '';
  // Strip markdown links, images, headings
  const clean = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '') // images
    .replace(/#{1,6}\s*/g, '') // headings
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // bold/italic
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.substring(0, maxLen)}...`;
}

function renderAIAnswer(el, data) {
  const answer = data.result || '';
  const links = data.retrievedLinks || [];

  let html = `<div class="cai-answer-text">${answer}</div>`;

  if (links.length > 0) {
    html += '<div class="cai-answer-sources"><span class="cai-sources-label">Sources:</span>';
    html += links
      .filter((link) => link.url && !link.url.endsWith('/robots.txt'))
      .map((link) => {
        const url = link.url;
        // Extract a readable page name from the URL
        const parts = url.split('/');
        const page = parts[parts.length - 1].replace('.html', '').replace(/-/g, ' ');
        const displayName = page.charAt(0).toUpperCase() + page.slice(1);
        return `<a href="${url}" class="cai-source-link" target="_blank">${displayName}</a>`;
      })
      .join('');
    html += '</div>';
  }

  el.innerHTML = html;
}

function renderSearchResults(el, data) {
  const results = data.results || [];

  if (results.length === 0) {
    el.innerHTML = '<div class="cai-no-results">No results found.</div>';
    return;
  }

  el.innerHTML = results.map((result) => {
    const meta = (result.data && result.data.metadata) || {};
    const title = meta.title || meta['twitter:title'] || 'Untitled';
    const source = (result.data && result.data.source) || '#';
    const snippet = extractSnippet(result.data && result.data.text);
    const score = result.score ? result.score.toFixed(2) : '';

    return `<div class="cai-result-card">
      <a href="${source}" class="cai-result-title" target="_blank">${title}</a>
      ${score ? `<span class="cai-result-score">Relevance: ${score}</span>` : ''}
      <div class="cai-result-snippet">${snippet}</div>
      <div class="cai-result-url">${source}</div>
    </div>`;
  }).join('');
}

async function performSearch(query, searchInputId) {
  const { aiAnswers, searchResults } = getLinkedComponents(searchInputId);
  const timestamp = Date.now();

  // Read clientId from linked AI Answer component
  let clientId = '';
  aiAnswers.forEach((el) => {
    if (el.dataset.clientId) clientId = el.dataset.clientId;
  });

  // Read index from linked Search Results component
  let index = '';
  searchResults.forEach((el) => {
    if (el.dataset.index) index = el.dataset.index;
  });

  // Show loading states
  aiAnswers.forEach((el) => {
    el.innerHTML = '<div class="cai-loading"><div class="cai-spinner"></div> Generating AI answer...</div>';
  });
  searchResults.forEach((el) => {
    el.innerHTML = '<div class="cai-loading"><div class="cai-spinner"></div> Searching...</div>';
  });

  const token = await getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['csrf-token'] = token;

  const genPayload = { query, timestamp };
  if (clientId) genPayload.clientId = clientId;

  const searchPayload = { query, timestamp };
  if (index) searchPayload.index = index;

  // Call both APIs in parallel
  const [genResponse, searchResponse] = await Promise.allSettled([
    fetch('/bin/caid/gensearch', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(genPayload),
    }).then((r) => r.json()),
    fetch('/bin/caid/search', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(searchPayload),
    }).then((r) => r.json()),
  ]);

  // Render AI answer
  aiAnswers.forEach((el) => {
    if (genResponse.status === 'fulfilled' && !genResponse.value.error) {
      renderAIAnswer(el, genResponse.value);
    } else {
      const err = genResponse.status === 'rejected'
        ? genResponse.reason
        : (genResponse.value && genResponse.value.error);
      el.innerHTML = `<div class="cai-error">Could not generate AI answer: ${err || 'Unknown error'}</div>`;
    }
  });

  // Render search results
  searchResults.forEach((el) => {
    if (searchResponse.status === 'fulfilled' && !searchResponse.value.error) {
      renderSearchResults(el, searchResponse.value);
    } else {
      const err = searchResponse.status === 'rejected'
        ? searchResponse.reason
        : (searchResponse.value && searchResponse.value.error);
      el.innerHTML = `<div class="cai-error">Search failed: ${err || 'Unknown error'}</div>`;
    }
  });
}

export default function decorate(block) {
  const id = block.textContent.trim() || 'default';
  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.classList.add('cai-search-input-wrapper');
  wrapper.dataset.searchInputId = id;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask a question or search...';
  input.classList.add('cai-search-field');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Search';
  btn.classList.add('cai-search-btn');

  const onSearch = () => {
    const q = input.value.trim();
    if (q) performSearch(q, id);
  };

  btn.addEventListener('click', onSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch();
  });

  wrapper.append(input, btn);
  block.append(wrapper);
}
