export default function decorate(block) {
  const rows = [...block.children];
  const props = {};
  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase();
      const val = cols[1].textContent.trim();
      props[key] = val;
    }
  });

  const id = props.id || 'default';
  const searchInputId = props.searchinputid || 'default';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = `search-results-${id}`;
  wrapper.classList.add('content-ai-search-results-wrapper');
  wrapper.dataset.searchResultsId = id;
  wrapper.dataset.searchInputId = searchInputId;

  const placeholder = document.createElement('div');
  placeholder.classList.add('search-results-placeholder');
  placeholder.textContent = 'Search results will appear here after searching.';

  wrapper.append(placeholder);
  block.append(wrapper);
}
