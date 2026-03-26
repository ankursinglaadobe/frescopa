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
  const clientId = props.clientid || '';

  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = `ai-response-${id}`;
  wrapper.classList.add('cai-response-wrapper');
  wrapper.dataset.aiResponseId = id;
  wrapper.dataset.searchInputId = searchInputId;
  if (clientId) wrapper.dataset.clientId = clientId;

  const placeholder = document.createElement('div');
  placeholder.classList.add('cai-placeholder');
  placeholder.textContent = 'AI-powered answers will appear here after you search.';

  wrapper.append(placeholder);
  block.append(wrapper);
}
