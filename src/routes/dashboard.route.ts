import type { FastifyInstance } from 'fastify';

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LinkedIn Profile API — dashboard</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    max-width: 720px;
    margin: 2rem auto;
    padding: 0 1rem 4rem;
    line-height: 1.5;
  }
  h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
  .sub { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
  label { font-size: 0.85rem; font-weight: 600; }
  input {
    width: 100%;
    padding: 0.5rem 0.6rem;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 6px;
  }
  button {
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    background: #0a66c2;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  button:disabled { opacity: 0.7; cursor: default; }
  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: none;
  }
  button:disabled .spinner { display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
  #status { font-size: 0.9rem; margin-bottom: 1rem; min-height: 1.2em; }
  #status.error { color: #c0392b; }
  #status.ok { color: #1a7f37; }
  #result { display: none; }
  .banner {
    height: 100px;
    border-radius: 10px 10px 0 0;
    background: linear-gradient(135deg, #dfe7f0, #cfd9e6);
    background-size: cover;
    background-position: center;
    margin-bottom: -36px;
  }
  .card {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    padding: 0 1rem 1rem;
    margin-bottom: 1.5rem;
  }
  .card img {
    width: 72px; height: 72px;
    border-radius: 50%;
    object-fit: cover;
    background: #eee;
    border: 3px solid var(--card-border, #fff);
  }
  .card-info { padding-bottom: 2px; }
  .card h2 { margin: 0; font-size: 1.1rem; }
  .card p { margin: 0.2rem 0 0; color: #555; font-size: 0.9rem; }
  .card .location { color: #777; font-size: 0.82rem; }
  section { margin-bottom: 1.25rem; }
  section h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: #888; margin-bottom: 0.5rem; }
  .entry { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
  .entry:last-child { border-bottom: none; }
  .entry .title { font-weight: 600; }
  .entry .meta { color: #666; font-size: 0.85rem; }
  .empty { color: #999; font-size: 0.85rem; font-style: italic; }
  .chip-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip { background: #eef2f7; color: #333; font-size: 0.82rem; padding: 0.25rem 0.6rem; border-radius: 999px; }
  details { margin-top: 1.5rem; }
  summary { cursor: pointer; font-size: 0.85rem; color: #666; }
  pre { background: #f6f8fa; padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.8rem; }
</style>
</head>
<body>
  <h1>LinkedIn Profile API — dashboard</h1>
  <p class="sub">Manual test client. Runs entirely in your browser and calls this same server's own <code>POST /v1/profile</code> — nothing is sent anywhere else.</p>

  <form id="form">
    <div>
      <label for="apiKey">x-api-key</label>
      <input id="apiKey" type="password" autocomplete="off" placeholder="your API_KEY" required>
    </div>
    <div>
      <label for="url">LinkedIn profile URL</label>
      <input id="url" type="url" placeholder="https://www.linkedin.com/in/&lt;public-identifier&gt;/" required>
    </div>
    <button type="submit" id="submit"><span class="spinner"></span><span id="submitLabel">Fetch profile</span></button>
  </form>

  <div id="status"></div>

  <div id="result">
    <div class="banner" id="banner"></div>
    <div class="card">
      <img id="photo" src="" alt="" onerror="this.style.visibility='hidden'">
      <div class="card-info">
        <h2 id="name"></h2>
        <p id="headline"></p>
        <p class="location" id="location"></p>
      </div>
    </div>

    <section>
      <h3>Experience</h3>
      <div id="experience"></div>
    </section>

    <section>
      <h3>Education</h3>
      <div id="education"></div>
    </section>

    <section>
      <h3>Certifications</h3>
      <div id="certifications"></div>
    </section>

    <section>
      <h3>Languages</h3>
      <div id="languages"></div>
    </section>

    <section>
      <h3>Skills</h3>
      <div id="skills"></div>
    </section>

    <details>
      <summary>Raw JSON</summary>
      <pre id="raw"></pre>
    </details>
  </div>

<script>
(function () {
  const form = document.getElementById('form');
  const apiKeyInput = document.getElementById('apiKey');
  const urlInput = document.getElementById('url');
  const submitBtn = document.getElementById('submit');
  const submitLabel = document.getElementById('submitLabel');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');

  const stored = localStorage.getItem('linkedinApiDashboard.apiKey');
  if (stored) apiKeyInput.value = stored;

  function setStatus(message, kind) {
    statusEl.textContent = message || '';
    statusEl.className = kind || '';
  }

  function renderList(containerId, items, renderEntry) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty">None returned</div>';
      return;
    }
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'entry';
      div.innerHTML = renderEntry(item);
      el.appendChild(div);
    }
  }

  function renderChips(containerId, items, label) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty">None returned</div>';
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'chip-list';
    for (const item of items) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = label(item);
      wrap.appendChild(chip);
    }
    el.appendChild(wrap);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderProfile(profile) {
    document.getElementById('banner').style.backgroundImage = (profile.backgroundImage && profile.backgroundImage.url)
      ? 'url(' + JSON.stringify(profile.backgroundImage.url).slice(1, -1) + ')'
      : 'none';
    document.getElementById('photo').src = (profile.image && profile.image.url) || '';
    document.getElementById('name').textContent = (profile.name && profile.name.fullName) || '(no name)';
    document.getElementById('headline').textContent = profile.headline || '';
    document.getElementById('location').textContent = (profile.location && profile.location.raw) || '';

    renderList('experience', profile.experience, (e) => \`
      <div class="title">\${escapeHtml(e.title)}\${e.company ? ' · ' + escapeHtml(e.company) : ''}</div>
      <div class="meta">\${[e.location, [e.startDate, e.endDate].filter(Boolean).join(' - ')].filter(Boolean).map(escapeHtml).join(' · ')}</div>
      \${e.description ? '<div class="meta">' + escapeHtml(e.description) + '</div>' : ''}
    \`);

    renderList('education', profile.education, (e) => \`
      <div class="title">\${escapeHtml(e.school)}</div>
      \${e.degree ? '<div class="meta">' + escapeHtml(e.degree) + '</div>' : ''}
    \`);

    renderList('certifications', profile.certifications, (c) => \`
      <div class="title">\${escapeHtml(c.name)}</div>
      <div class="meta">\${[c.issuingOrganization, c.issueDate].filter(Boolean).map(escapeHtml).join(' · ')}</div>
    \`);

    renderList('languages', profile.languages, (l) => \`
      <div class="title">\${escapeHtml(l.name)}</div>
      \${l.proficiency ? '<div class="meta">' + escapeHtml(l.proficiency) + '</div>' : ''}
    \`);

    renderChips('skills', profile.skills, (s) => s.name || '');

    document.getElementById('raw').textContent = JSON.stringify(profile, null, 2);
    resultEl.style.display = 'block';
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    const url = urlInput.value.trim();
    localStorage.setItem('linkedinApiDashboard.apiKey', apiKey);

    submitBtn.disabled = true;
    submitLabel.textContent = 'Fetching…';
    resultEl.style.display = 'none';
    setStatus('');
    const startedAt = performance.now();

    try {
      const response = await fetch('/v1/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ url }),
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const body = await response.json();

      if (!response.ok) {
        const message = (body && body.error && body.error.message) || response.statusText;
        setStatus('Error ' + response.status + ' (' + elapsedMs + 'ms): ' + message, 'error');
        return;
      }

      setStatus('OK — ' + elapsedMs + 'ms', 'ok');
      renderProfile(body);
    } catch (err) {
      setStatus('Request failed: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Fetch profile';
    }
  });
})();
</script>
</body>
</html>
`;

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    reply.type('text/html').send(DASHBOARD_HTML);
  });
}
