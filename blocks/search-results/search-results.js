export default function decorate(block) {
  const rows = [...block.children];
  const props = {};
  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase().replace(/\s+/g, '');
      const val = cols[1].textContent.trim();
      props[key] = val;
    }
  });

  const id = props.id || props.componentid || 'default';
  const searchInputId = props.searchinputid || 'default';
  const index = props.index || props.searchindex || '';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = `search-results-${id}`;
  wrapper.classList.add('cai-results-wrapper');
  wrapper.dataset.searchResultsId = id;
  wrapper.dataset.searchInputId = searchInputId;
  if (index) wrapper.dataset.index = index;

  const placeholder = document.createElement('div');
  placeholder.classList.add('cai-placeholder');
  placeholder.textContent = 'Search results will appear here after you search.';

  wrapper.append(placeholder);
  block.append(wrapper);
}
