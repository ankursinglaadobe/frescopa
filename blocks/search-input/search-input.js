export default function decorate(block) {
  const id = block.textContent.trim();
  block.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.id = `search-input-${id || 'default'}`;
  wrapper.classList.add('content-ai-search-input-wrapper');
  wrapper.dataset.searchInputId = id || 'default';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search...';
  input.classList.add('content-ai-search-input');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Search';
  btn.classList.add('content-ai-search-btn');

  wrapper.append(input, btn);
  block.append(wrapper);
}
