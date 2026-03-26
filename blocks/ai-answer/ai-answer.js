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
  wrapper.id = `ai-response-${id}`;
  wrapper.classList.add('content-ai-response-wrapper');
  wrapper.dataset.aiResponseId = id;
  wrapper.dataset.searchInputId = searchInputId;

  const placeholder = document.createElement('div');
  placeholder.classList.add('ai-response-placeholder');
  placeholder.textContent = 'AI-powered answers will appear here after searching.';

  wrapper.append(placeholder);
  block.append(wrapper);
}
