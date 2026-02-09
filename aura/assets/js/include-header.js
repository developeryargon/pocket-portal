// Inject shared site header into pages that have: <div data-include="site-header"></div>
const mount = document.querySelector('[data-include="site-header"]');
if (mount) {
  const url = new URL('../partials/site-header.html', import.meta.url);
  fetch(url)
    .then(r => (r.ok ? r.text() : Promise.reject()))
    .then(html => { mount.outerHTML = html; })
    .catch(() => {});
}
