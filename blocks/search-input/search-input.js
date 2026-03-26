const AEM_HOST = 'https://author-p187852-e1967098.adobeaemcloud.com';

function getLinkedComponents(searchInputId) {
  const aiAnswers = document.querySelectorAll(`.ai-answer [data-search-input-id="${searchInputId}"]`);
  const searchResults = document.querySelectorAll(`.search-results [data-search-input-id="${searchInputId}"]`);
  return { aiAnswers, searchResults };
}

async function performSearch(query, searchInputId) {
  const { aiAnswers, searchResults } = getLinkedComponents(searchInputId);

  // Show loading states
  aiAnswers.forEach((el) => {
    el.innerHTML = '<div class="cai-loading">Generating AI answer...</div>';
  });
  searchResults.forEach((el) => {
    el.innerHTML = '<div class="cai-loading">Searching...</div>';
  });

  // Call both APIs in parallel
  const [genResponse, searchResponse] = await Promise.allSettled([
    fetch(`${AEM_HOST}/bin/caid/gensearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      credentials: 'include',
    }).then((r) => r.json()),
    fetch(`${AEM_HOST}/bin/caid/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      credentials: 'include',
    }).then((r) => r.json()),
  ]);

  // Render AI answer
  aiAnswers.forEach((el) => {
    if (genResponse.status === 'fulfilled' && !genResponse.value.error) {
      const data = genResponse.value;
      const answer = data.answer || data.response || data.text || JSON.stringify(data);
      el.innerHTML = `<div class="cai-answer-content">${answer}</div>`;
    } else {
      const err = genResponse.status === 'rejected' ? genResponse.reason : genResponse.value.error;
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
      const err = searchResponse.status === 'rejected' ? searchResponse.reason : searchResponse.value.error;
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
    const query = input.value.trim();
    if (query) performSearch(query, id);
  };

  btn.addEventListener('click', onSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch();
  });

  wrapper.append(input, btn);
  block.append(wrapper);
}
