const http = require('http');
const crypto = require('crypto');

const PORT = 3000;

const users = {
  student: { password: 'student123', name: 'Student', progress: {} },
  admin:   { password: 'admin123',   name: 'Admin',   progress: {} },
};
const sessions = {};

const courses = {
  java: {
    title: 'Java', icon: '☕', next: 'python',
    desc: 'Object-oriented programming and backend basics.',
    lessons: ['Intro and JDK setup', 'OOP basics', 'Collections', 'Exceptions and Streams', 'Spring Boot intro'],
  },
  python: {
    title: 'Python', icon: '🐍', next: 'aws',
    desc: 'Scripting, data handling and automation.',
    lessons: ['Syntax and variables', 'Functions and modules', 'Lists, dicts and files', 'OOP in Python', 'Automation scripts'],
  },
  aws: {
    title: 'AWS', icon: '☁️', next: 'azure',
    desc: 'Core Amazon Web Services for cloud engineers.',
    lessons: ['Cloud basics and IAM', 'EC2 and networking', 'S3 and storage', 'RDS and databases', 'CI/CD with Jenkins'],
  },
  azure: {
    title: 'Azure', icon: '🔷', next: 'aws',
    desc: 'Microsoft Azure fundamentals and deployment.',
    lessons: ['Azure portal and resource groups', 'Virtual machines', 'Storage accounts', 'Azure SQL', 'Azure DevOps pipelines'],
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => resolve(new URLSearchParams(data)));
  });
}

function currentUser(req) {
  const sid = cookies(req).sid;
  return sid && sessions[sid] ? { username: sessions[sid], ...users[sessions[sid]] } : null;
}

const done = (user, id) => user.progress[id] || [];
const pct = (user, id) => Math.round((done(user, id).length / courses[id].lessons.length) * 100);

function recommend(user) {
  const ids = Object.keys(courses);
  for (const id of ids) {
    const nxt = courses[id].next;
    if (pct(user, id) >= 50 && pct(user, nxt) < 50) {
      return `You are ${pct(user, id)}% through ${courses[id].title}. Learners at this stage do well moving on to <b>${courses[nxt].title}</b>.`;
    }
  }
  const started = ids.filter((id) => pct(user, id) > 0 && pct(user, id) < 100)
    .sort((a, b) => pct(user, b) - pct(user, a));
  if (started.length) {
    return `Keep your momentum: continue <b>${courses[started[0]].title}</b> (${pct(user, started[0])}% done).`;
  }
  if (ids.every((id) => pct(user, id) === 100)) return 'You completed every course. Great work!';
  return 'New here? Start with <b>Python</b>. It is beginner friendly and leads to AWS.';
}

const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Arial,sans-serif;background:#f4f6fb;color:#1c2333}
nav{background:#1f2a44;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
nav a{color:#fff;text-decoration:none;margin-left:16px}main{max-width:900px;margin:24px auto;padding:0 16px}
.card{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.bar{background:#e3e8f3;border-radius:8px;height:10px;overflow:hidden}.bar i{display:block;height:100%;background:#3b82f6}
.btn{background:#3b82f6;color:#fff;border:0;border-radius:8px;padding:9px 14px;cursor:pointer;text-decoration:none;display:inline-block;font-size:14px}
.btn.alt{background:#22a06b}.btn.gray{background:#8a94a8}
input{width:100%;padding:10px;margin:6px 0 14px;border:1px solid #cdd5e4;border-radius:8px}
.login{max-width:360px;margin:12vh auto}.err{color:#c0392b}.ai{background:#eef5ff;border-left:4px solid #3b82f6}
li.l{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eef0f6;list-style:none}
ul{padding:0;margin:0}`;

function page(title, body, user) {
  const nav = user
    ? `<span>🎓 SmartLearn LMS</span><span>Hi, ${esc(user.name)}<a href="/dashboard">Dashboard</a><a href="/logout">Logout</a></span>`
    : `<span>🎓 SmartLearn LMS</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body><nav>${nav}</nav><main>${body}</main></body></html>`;
}

const loginPage = (err) => page('Login', `
<div class="card login"><h2>Sign in</h2>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="POST" action="/login">
<label>Username</label><input name="username" required>
<label>Password</label><input name="password" type="password" required>
<button class="btn" style="width:100%">Login</button></form>
<p style="font-size:13px;color:#667">Demo: student / student123</p></div>`);

function dashboardPage(user) {
  const cards = Object.entries(courses).map(([id, c]) => `
<div class="card"><h3>${c.icon} ${c.title}</h3><p style="font-size:14px">${c.desc}</p>
<div class="bar"><i style="width:${pct(user, id)}%"></i></div>
<p style="font-size:13px">${pct(user, id)}% complete</p>
<a class="btn" href="/course/${id}">${pct(user, id) ? 'Continue' : 'Start'}</a></div>`).join('');
  return page('Dashboard', `
<h2>Welcome back, ${esc(user.name)}</h2>
<div class="card ai"><b>🤖 Smart recommendation</b><p>${recommend(user)}</p></div>
<h3>My courses</h3><div class="grid">${cards}</div>`, user);
}

function coursePage(user, id) {
  const c = courses[id];
  const d = done(user, id);
  const items = c.lessons.map((l, i) => `
<li class="l"><span>${d.includes(i) ? '✅' : '⬜'} Lesson ${i + 1}: ${l}</span>
<form method="POST" action="/course/${id}/lesson/${i}" style="margin:0">
<button class="btn ${d.includes(i) ? 'gray' : 'alt'}">${d.includes(i) ? 'Undo' : 'Mark done'}</button></form></li>`).join('');
  return page(c.title, `
<a href="/dashboard">&larr; Back</a>
<div class="card"><h2>${c.icon} ${c.title}</h2><p>${c.desc}</p>
<div class="bar"><i style="width:${pct(user, id)}%"></i></div><p>${pct(user, id)}% complete</p></div>
<div class="card"><ul>${items}</ul></div>`, user);
}

const redirect = (res, to, headers = {}) => { res.writeHead(302, { Location: to, ...headers }); res.end(); };
const send = (res, html, code = 200) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };

http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const user = currentUser(req);

  if (path === '/health') { res.writeHead(200); return res.end('OK'); }

  if (path === '/login' && req.method === 'POST') {
    const b = await readBody(req);
    const u = users[b.get('username')];
    if (u && u.password === b.get('password')) {
      const sid = crypto.randomBytes(24).toString('hex');
      sessions[sid] = b.get('username');
      return redirect(res, '/dashboard', { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/` });
    }
    return send(res, loginPage('Invalid username or password'), 401);
  }

  if (path === '/logout') {
    delete sessions[cookies(req).sid];
    return redirect(res, '/', { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' });
  }

  if (path === '/' || path === '/login') return user ? redirect(res, '/dashboard') : send(res, loginPage());

  if (!user) return redirect(res, '/login');

  if (path === '/dashboard') return send(res, dashboardPage(user));

  let m = path.match(/^\/course\/(\w+)$/);
  if (m && courses[m[1]]) return send(res, coursePage(user, m[1]));

  m = path.match(/^\/course\/(\w+)\/lesson\/(\d+)$/);
  if (m && req.method === 'POST' && courses[m[1]]) {
    const n = Number(m[2]);
    const list = users[user.username].progress[m[1]] || [];
    users[user.username].progress[m[1]] = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
    return redirect(res, `/course/${m[1]}`);
  }

  send(res, page('Not found', '<div class="card"><h2>404</h2><a href="/dashboard">Go to dashboard</a></div>', user), 404);
}).listen(PORT, () => console.log(`LMS running on port ${PORT}`));const http = require('http');
const crypto = require('crypto');

const PORT = 3000;

const users = {
  student: { password: 'student123', name: 'Student', progress: {} },
  admin:   { password: 'admin123',   name: 'Admin',   progress: {} },
};
const sessions = {};

const courses = {
  java: {
    title: 'Java', icon: '☕', next: 'python',
    desc: 'Object-oriented programming and backend basics.',
    lessons: ['Intro and JDK setup', 'OOP basics', 'Collections', 'Exceptions and Streams', 'Spring Boot intro'],
  },
  python: {
    title: 'Python', icon: '🐍', next: 'aws',
    desc: 'Scripting, data handling and automation.',
    lessons: ['Syntax and variables', 'Functions and modules', 'Lists, dicts and files', 'OOP in Python', 'Automation scripts'],
  },
  aws: {
    title: 'AWS', icon: '☁️', next: 'azure',
    desc: 'Core Amazon Web Services for cloud engineers.',
    lessons: ['Cloud basics and IAM', 'EC2 and networking', 'S3 and storage', 'RDS and databases', 'CI/CD with Jenkins'],
  },
  azure: {
    title: 'Azure', icon: '🔷', next: 'aws',
    desc: 'Microsoft Azure fundamentals and deployment.',
    lessons: ['Azure portal and resource groups', 'Virtual machines', 'Storage accounts', 'Azure SQL', 'Azure DevOps pipelines'],
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => resolve(new URLSearchParams(data)));
  });
}

function currentUser(req) {
  const sid = cookies(req).sid;
  return sid && sessions[sid] ? { username: sessions[sid], ...users[sessions[sid]] } : null;
}

const done = (user, id) => user.progress[id] || [];
const pct = (user, id) => Math.round((done(user, id).length / courses[id].lessons.length) * 100);

function recommend(user) {
  const ids = Object.keys(courses);
  for (const id of ids) {
    const nxt = courses[id].next;
    if (pct(user, id) >= 50 && pct(user, nxt) < 50) {
      return `You are ${pct(user, id)}% through ${courses[id].title}. Learners at this stage do well moving on to <b>${courses[nxt].title}</b>.`;
    }
  }
  const started = ids.filter((id) => pct(user, id) > 0 && pct(user, id) < 100)
    .sort((a, b) => pct(user, b) - pct(user, a));
  if (started.length) {
    return `Keep your momentum: continue <b>${courses[started[0]].title}</b> (${pct(user, started[0])}% done).`;
  }
  if (ids.every((id) => pct(user, id) === 100)) return 'You completed every course. Great work!';
  return 'New here? Start with <b>Python</b>. It is beginner friendly and leads to AWS.';
}

const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Arial,sans-serif;background:#f4f6fb;color:#1c2333}
nav{background:#1f2a44;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
nav a{color:#fff;text-decoration:none;margin-left:16px}main{max-width:900px;margin:24px auto;padding:0 16px}
.card{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.bar{background:#e3e8f3;border-radius:8px;height:10px;overflow:hidden}.bar i{display:block;height:100%;background:#3b82f6}
.btn{background:#3b82f6;color:#fff;border:0;border-radius:8px;padding:9px 14px;cursor:pointer;text-decoration:none;display:inline-block;font-size:14px}
.btn.alt{background:#22a06b}.btn.gray{background:#8a94a8}
input{width:100%;padding:10px;margin:6px 0 14px;border:1px solid #cdd5e4;border-radius:8px}
.login{max-width:360px;margin:12vh auto}.err{color:#c0392b}.ai{background:#eef5ff;border-left:4px solid #3b82f6}
li.l{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eef0f6;list-style:none}
ul{padding:0;margin:0}`;

function page(title, body, user) {
  const nav = user
    ? `<span>🎓 SmartLearn LMS</span><span>Hi, ${esc(user.name)}<a href="/dashboard">Dashboard</a><a href="/logout">Logout</a></span>`
    : `<span>🎓 SmartLearn LMS</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head><body><nav>${nav}</nav><main>${body}</main></body></html>`;
}

const loginPage = (err) => page('Login', `
<div class="card login"><h2>Sign in</h2>${err ? `<p class="err">${esc(err)}</p>` : ''}
<form method="POST" action="/login">
<label>Username</label><input name="username" required>
<label>Password</label><input name="password" type="password" required>
<button class="btn" style="width:100%">Login</button></form>
<p style="font-size:13px;color:#667">Demo: student / student123</p></div>`);

function dashboardPage(user) {
  const cards = Object.entries(courses).map(([id, c]) => `
<div class="card"><h3>${c.icon} ${c.title}</h3><p style="font-size:14px">${c.desc}</p>
<div class="bar"><i style="width:${pct(user, id)}%"></i></div>
<p style="font-size:13px">${pct(user, id)}% complete</p>
<a class="btn" href="/course/${id}">${pct(user, id) ? 'Continue' : 'Start'}</a></div>`).join('');
  return page('Dashboard', `
<h2>Welcome back, ${esc(user.name)}</h2>
<div class="card ai"><b>🤖 Smart recommendation</b><p>${recommend(user)}</p></div>
<h3>My courses</h3><div class="grid">${cards}</div>`, user);
}

function coursePage(user, id) {
  const c = courses[id];
  const d = done(user, id);
  const items = c.lessons.map((l, i) => `
<li class="l"><span>${d.includes(i) ? '✅' : '⬜'} Lesson ${i + 1}: ${l}</span>
<form method="POST" action="/course/${id}/lesson/${i}" style="margin:0">
<button class="btn ${d.includes(i) ? 'gray' : 'alt'}">${d.includes(i) ? 'Undo' : 'Mark done'}</button></form></li>`).join('');
  return page(c.title, `
<a href="/dashboard">&larr; Back</a>
<div class="card"><h2>${c.icon} ${c.title}</h2><p>${c.desc}</p>
<div class="bar"><i style="width:${pct(user, id)}%"></i></div><p>${pct(user, id)}% complete</p></div>
<div class="card"><ul>${items}</ul></div>`, user);
}

const redirect = (res, to, headers = {}) => { res.writeHead(302, { Location: to, ...headers }); res.end(); };
const send = (res, html, code = 200) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };

http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const user = currentUser(req);

  if (path === '/health') { res.writeHead(200); return res.end('OK'); }

  if (path === '/login' && req.method === 'POST') {
    const b = await readBody(req);
    const u = users[b.get('username')];
    if (u && u.password === b.get('password')) {
      const sid = crypto.randomBytes(24).toString('hex');
      sessions[sid] = b.get('username');
      return redirect(res, '/dashboard', { 'Set-Cookie': `sid=${sid}; HttpOnly; Path=/` });
    }
    return send(res, loginPage('Invalid username or password'), 401);
  }

  if (path === '/logout') {
    delete sessions[cookies(req).sid];
    return redirect(res, '/', { 'Set-Cookie': 'sid=; Max-Age=0; Path=/' });
  }

  if (path === '/' || path === '/login') return user ? redirect(res, '/dashboard') : send(res, loginPage());

  if (!user) return redirect(res, '/login');

  if (path === '/dashboard') return send(res, dashboardPage(user));

  let m = path.match(/^\/course\/(\w+)$/);
  if (m && courses[m[1]]) return send(res, coursePage(user, m[1]));

  m = path.match(/^\/course\/(\w+)\/lesson\/(\d+)$/);
  if (m && req.method === 'POST' && courses[m[1]]) {
    const n = Number(m[2]);
    const list = users[user.username].progress[m[1]] || [];
    users[user.username].progress[m[1]] = list.includes(n) ? list.filter((x) => x !== n) : [...list, n];
    return redirect(res, `/course/${m[1]}`);
  }

  send(res, page('Not found', '<div class="card"><h2>404</h2><a href="/dashboard">Go to dashboard</a></div>', user), 404);
}).listen(PORT, () => console.log(`LMS running on port ${PORT}`));
