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
    el.innerHTML = '<div class="cai-loading">Generating AI answer...</div>';
  });
  searchResults.forEach((el) => {
    el.innerHTML = '<div class="cai-loading">Searching...</div>';
  });

  const token = await getCsrfToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['csrf-token'] = token;

  // Build payloads matching the original servlet expectations
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
      const data = genResponse.value;
      const answer = data.answer || data.response || data.text || JSON.stringify(data);
      el.innerHTML = `<div class="cai-answer-content">${answer}</div>`;
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
      const data = searchResponse.value;
      const results = data.results || data.items || data.hits || [];
      if (results.length === 0) {
        el.innerHTML = '<div class="cai-no-results">No results found.</div>';
        return;
      }
      el.innerHTML = results.map((result) => {
        const title = result.title || result.name || 'Untitled';
        const description = result.description || result.snippet || result.text || '';
        const url = result.url || result.path || '#';
        return `<div class="cai-result-card">
          <a href="${url}" class="cai-result-title">${title}</a>
          <div class="cai-result-description">${description}</div>
        </div>`;
      }).join('');
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
