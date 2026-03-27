export default function decorate(block) {
  const rows = [...block.children];
  const props = {};
  rows.forEach((row) => {
    const cols = [...row.children];
    if (cols.length >= 2) {
      const key = cols[0].textContent.trim().toLowerCase().replace(/\s+/g, '');
      const val = cols[1].innerHTML.trim();
      props[key] = val;
    }
  });

  const kicker = props.kicker || props.badge || '';
  const title = props.title || props.heading || 'Fréscopa Stories';
  const description = props.description || props.subtitle || '';

  block.innerHTML = `<div class="cai-hero-inner">
    ${kicker ? `<span class="cai-hero-kicker">${kicker}</span>` : ''}
    <h1 class="cai-hero-title">${title}</h1>
    ${description ? `<p class="cai-hero-sub">${description}</p>` : ''}
  </div>`;
}
