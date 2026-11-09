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
