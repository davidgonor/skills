/* Data shape is documented in the skill's SKILL.md. render.py attaches each file's full diff as f.diff
   (rows are [sign, code, old line, new line, changed-this-round flag]). Nothing leaves this page unless
   it is served by serve.py and you confirm the submit. */
const D = JSON.parse(document.getElementById('data').textContent);
const GROUPS = D.groups, FILES = D.files, BASE = D.base || 'base', LIVE = !!D.post, FOCUS = D.focus || [];
const LOCAL = D.mode === 'local';
const byId = Object.fromEntries(FILES.map(f => [f.id, f]));
const idxOf = id => FILES.findIndex(f => f.id === id);
const base = p => p.split('/').pop();
const dirOf = p => p.includes('/') ? p.split('/').slice(0, -1).join('/') + '/' : '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const T = FILES.reduce((a, f) => ({add: a.add + (f.add || 0), del: a.del + (f.del || 0)}), {add: 0, del: 0});
const SEV = ['important', 'question', 'suggestion', 'nit', 'optional'];
const SEVN = {important: 'Important', question: 'Question', suggestion: 'Suggestion', nit: 'Nit', optional: 'Optional'};
/* Claude's drafts are numbered in reading order (file order, then line) so numbers match the diff top to bottom. */
const CM = FILES.flatMap((f, fi) => (f.comments || []).map((c, ci) => ({...c, fid: f.id, key: f.id + '.' + ci, ref: f.path + ':' + c.line, fi}))).sort((a, b) => a.fi - b.fi || a.line - b.line);
CM.forEach((c, i) => c.n = i + 1);
const BYSEV = CM.slice().sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || a.n - b.n);
const cmOf = id => CM.filter(c => c.fid === id);
const START = FILES[0];
const THREADS = D.threads || [];
const thOf = f => THREADS.filter(t => t.path === f.path);
const ORPHANS = THREADS.filter(t => !FILES.some(f => f.path === t.path));
const ROUND = D.round && D.round.label ? D.round : null;
const inRound = f => (f.diff || []).some(h => h.rows.some(r => r[4]));
const EVENTS = LOCAL ? [['QUESTIONS', 'Questions'], ['FIX', 'Fix these'], ['APPROVE', 'Looks good']] : [['COMMENT', 'Comment'], ['APPROVE', 'Approve'], ['REQUEST_CHANGES', 'Request changes']];

const S = {cur: START.id, viewed: new Set(), collapsed: new Set(FILES.filter(f => f.generated).map(f => f.id)), edits: {}, dec: {}, event: LOCAL ? 'FIX' : 'COMMENT', ready: false,
  own: [], nid: 0, posted: {}, err: {}, busy: '', copied: '', flash: '', status: '', review: (D.review && D.review.body) || '', reviewUrl: '', reviewErr: '', reviewWarn: '',
  pv: {}, thOpen: {}, desc: false, onlyRound: false, exp: {}, ft: {}, focusKey: ''};
/* Restore saved edits, decisions and your own comments: from serve.py when served, else from this browser. */
const STORE = 'walkthrough:' + (D.url || D.title) + ':' + ((D.review && D.review.head) || '') + ':' + (ROUND ? ROUND.label : '');
const SAVED = D.saved || (() => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } })();
if (SAVED) {
  Object.assign(S.edits, SAVED.edits || {}); Object.assign(S.dec, SAVED.dec || {});
  if (typeof SAVED.review === 'string') S.review = SAVED.review;
  if (SAVED.event && EVENTS.some(e => e[0] === SAVED.event)) S.event = SAVED.event;
  S.ready = !!SAVED.ready; S.own = Array.isArray(SAVED.own) ? SAVED.own.filter(o => o && o.key && (byId[o.fid] || o.kind === 'reply')) : []; S.nid = SAVED.nid || S.own.length;
  (SAVED.viewed || []).forEach(id => { if (byId[id]) { S.viewed.add(id); S.collapsed.add(id); } });
  S.reviewUrl = SAVED.reviewUrl || '';
  (SAVED.posted || []).forEach(k => { S.posted[k] = S.reviewUrl || 'posted'; });
}
let saveTimer = null, lastSaved = '';
function persist() {
  const blob = JSON.stringify({edits: S.edits, dec: S.dec, review: S.review, event: S.event, viewed: [...S.viewed], own: S.own, nid: S.nid, ready: S.ready});
  if (blob === lastSaved) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    lastSaved = blob;
    if (LIVE) fetch('/state', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Token': D.post.token}, body: blob}).catch(() => { lastSaved = ''; });
    else try { localStorage.setItem(STORE, blob); } catch (e) {}
  }, 400);
}

/* ---------- drafts: Claude's (CM) and yours (S.own: line ranges, whole files, thread replies) ---------- */
const txt = c => S.edits[c.key] !== undefined ? S.edits[c.key] : c.body;
/* Claude's drafts start undecided; yours start approved, since you wrote them. Only approved ones are sent. */
const stateOf = c => S.posted[c.key] ? 'posted' : S.dec[c.key] || 'draft';
const ownState = o => S.posted[o.key] ? 'posted' : o.dec || 'approved';
const STN = {draft: 'Draft', approved: 'Approved', dismissed: 'Dismissed', posted: LOCAL ? 'Sent' : 'Posted'};
const pending = () => CM.filter(c => stateOf(c) === 'approved' && txt(c).trim());
const ownPending = () => S.own.filter(o => ownState(o) === 'approved' && o.body.trim());
const countOf = s => CM.filter(c => stateOf(c) === s).length;
const sideOf = r => r[0] === '-' ? {side: 'LEFT', line: r[2]} : {side: 'RIGHT', line: r[3]};
const ownLabel = o => o.kind === 'file' ? 'Whole file' : o.kind === 'reply' ? 'Reply' :
  (o.start.side === o.end.side && o.start.line === o.end.line ? 'Line ' : 'Lines ' + (o.start.side === 'LEFT' ? 'old ' : '') + o.start.line + '-') + (o.end.side === 'LEFT' ? 'old ' : '') + o.end.line;
const ownPath = o => byId[o.fid] ? byId[o.fid].path : o.path;
const ownRef = o => ownPath(o) + (o.kind === 'line' ? ':' + (o.start.line === o.end.line && o.start.side === o.end.side ? '' : o.start.line + '-') + o.end.line : '');
const totalPending = () => pending().length + ownPending().length;

/* ---------- small markdown renderer: escapes everything, then adds a safe subset ---------- */
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<i>$2</i>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function md(src) {
  const L = String(src || '').replace(/\r/g, '').split('\n'); let out = '', i = 0;
  const isBlock = l => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^>/.test(l) || /^\s*([-*+]|\d+\.)\s+/.test(l);
  while (i < L.length) {
    const l = L[i];
    let m = l.match(/^\s*```\s*(\S*)/);
    if (m) {
      const code = []; i++;
      while (i < L.length && !/^\s*```/.test(L[i])) code.push(L[i++]);
      i++;
      out += '<div class="mdcode">' + (m[1] === 'suggestion' ? '<div class="mdsl">Suggested change</div>' : '') + '<pre><code>' + esc(code.join('\n')) + '</code></pre></div>';
      continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)/))) { out += '<p class="mdh">' + inline(m[2]) + '</p>'; i++; continue; }
    if (/^>/.test(l)) { const q = []; while (i < L.length && /^>/.test(L[i])) q.push(L[i++].replace(/^>\s?/, '')); out += '<blockquote>' + md(q.join('\n')) + '</blockquote>'; continue; }
    if ((m = l.match(/^\s*([-*+]|\d+\.)\s+/))) {
      const ord = /\d/.test(m[1]), items = [];
      while (i < L.length && /^\s*([-*+]|\d+\.)\s+/.test(L[i])) items.push(L[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
      out += (ord ? '<ol>' : '<ul>') + items.map(x => '<li>' + inline(x) + '</li>').join('') + (ord ? '</ol>' : '</ul>');
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const p = [];
    while (i < L.length && L[i].trim() && !isBlock(L[i])) p.push(L[i++]);
    out += '<p>' + p.map(inline).join('<br>') + '</p>';
  }
  return out;
}

const stat = f => '<span class="stat"><span class="a">+' + (f.add || 0) + '</span> <span class="d">-' + (f.del || 0) + '</span></span>';
const sevChip = (s, label) => '<span class="sev ' + s + '">' + (label || SEVN[s]) + '</span>';
const sevBadges = id => SEV.filter(s => cmOf(id).some(c => c.sev === s)).map(s => sevChip(s, cmOf(id).filter(c => c.sev === s).length + ' ' + SEVN[s])).join(' ');
const ownBadge = id => { const n = S.own.filter(o => o.fid === id).length; return n ? '<span class="chip you-chip">' + n + ' yours</span>' : ''; };
const roundBadge = f => ROUND && inRound(f) ? '<span class="chip rnd-chip">changed in ' + esc(ROUND.label) + '</span>' : '';
const btn = (a, id, cls, inner, key, attrs) => '<button type="button" class="' + cls + '" data-act="' + a + '" data-id="' + esc(id || '') + '" data-fk="' + esc(key || a + '-' + (id || '')) + '" ' + (attrs || '') + '>' + inner + '</button>';
/* textarea height that fits the draft without scrolling (about 95 mono chars per line at the comment width) */
const rowsFor = s => s.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 95)), 1);
const list = a => a.map(x => '<li>' + esc(x) + '</li>').join('');
const where = LOCAL ? 'Claude' : (D.post ? D.post.repo + '#' + D.post.number : '');

/* ---------- views ---------- */
function header() {
  const d = S.viewed.size, t = FILES.length;
  return '<header class="head"><div><h1>' + esc(D.title) + (/^https?:\/\//.test(D.url || '') ? ' <a class="prlink" href="' + esc(D.url) + '" target="_blank" rel="noopener">' + esc(D.ref || D.url) + '</a>' : '') + '</h1>' +
    '<p class="src">' + esc(D.source) + ' ' + t + ' files, +' + T.add + ' -' + T.del + '.' + (ROUND ? ' <b>' + esc(ROUND.label) + '</b>' + (ROUND.note ? ': ' + esc(ROUND.note) : '') : '') + '</p>' +
    (D.pr_body ? btn('desc', '', 'lnk desct', (S.desc ? '&#9662; Hide' : '&#9656; Show') + ' PR description', 'desc', 'aria-expanded="' + S.desc + '"') : '') + '</div>' +
    '<div class="prog"><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="' + t + '" aria-valuenow="' + d + '" aria-label="Files viewed"><span style="width:' + (d / t * 100) + '%"></span></div><span>' + d + ' of ' + t + ' viewed</span></div></header>' +
    (D.pr_body && S.desc ? '<section class="panel desc md" aria-label="PR description">' + md(D.pr_body) + '</section>' : '');
}

function sidebar() {
  const p = totalPending();
  const secs = (FOCUS.length ? '<li>' + btn('sec', 'sec-focus', 'nv', '<span class="nvt">Where to spend your time</span><span class="nvm">' + FOCUS.length + ' areas</span>', 'nav-focus') + '</li>' : '') +
    '<li>' + btn('sec', 'sec-review', 'nv', '<span class="nvt">' + (LOCAL ? 'Your review for Claude' : 'Pending review') + '</span><span class="nvm">' + p + ' to send, ' + countOf('draft') + ' undecided</span>', 'nav-review') + '</li>' +
    '<li>' + btn('sec', 'sec-map', 'nv', '<span class="nvt">Dependency map</span><span class="nvm">' + FILES.length + ' files, ' + GROUPS.length + ' groups</span>', 'nav-map') + '</li>';
  const shown = FILES.filter(f => !S.onlyRound || inRound(f));
  const files = shown.map(f =>
    '<li>' + btn('jump', f.id, 'sf' + (S.viewed.has(f.id) ? ' done' : '') + (f.id === S.cur ? ' sel' : ''),
      '<span class="ord"><span>' + (idxOf(f.id) + 1) + '</span></span><span class="nm">' + esc(base(f.path)) + '</span><span class="dir">' + esc(dirOf(f.path)) + '</span>' +
      '<span class="row2">' + stat(f) + (f === START ? '<span class="start">start here</span>' : '') + (f.generated ? '<span class="chip">generated</span>' : '') + roundBadge(f) + sevBadges(f.id) + ownBadge(f.id) +
      (thOf(f).length ? '<span class="chip th-chip">' + thOf(f).length + ' existing</span>' : '') + '</span>', 'side-' + f.id) + '</li>').join('');
  return '<nav class="panel side" aria-label="Jump to"><h2>Jump to</h2><ol class="nvsec">' + secs + '</ol>' +
    (ROUND ? btn('onlyround', '', 'viewed rndf' + (S.onlyRound ? ' on' : ''), (S.onlyRound ? '&#9745;' : '&#9744;') + ' Only changes from ' + esc(ROUND.label), 'onlyround', 'aria-pressed="' + S.onlyRound + '"') : '') +
    '<h3 class="nvh">Files in review order</h3><ol>' + files + '</ol></nav>';
}

function focusView() {
  if (!FOCUS.length) return '';
  return '<section class="panel focus" id="sec-focus" aria-label="Where to spend your time"><h2>Where to spend your time</h2><p class="mute">The changes most worth your attention, most important first. Click a reference to jump to the line.</p><ol>' +
    FOCUS.map((x, i) => {
      const f = byId[x.file], rel = CM.filter(c => c.fid === x.file && (x.lines || [x.line]).includes(c.line));
      return '<li><span class="rk">' + (i + 1) + '</span><div><p class="ft">' + esc(x.title) + '</p><p class="why">' + esc(x.why) + '</p></div><div class="go">' +
        btn('jump', x.file + ':' + x.line, 'lnk', '<code class="ref">' + esc(base(f.path)) + ':' + x.line + '</code>', 'focus-' + i) +
        (rel.length ? '<span class="rel">drafts ' + rel.map(c => '#' + c.n).join(', ') + '</span>' : '') + '</div></li>';
    }).join('') + '</ol></section>';
}

const consequence = () => !LOCAL ? '' : S.event === 'QUESTIONS' ? 'Claude answers in the next round and changes no code.'
  : S.event === 'FIX' ? 'Claude applies your approved comments and opens the next round, reviewing only what changed.'
  : 'Claude commits, pushes and opens a ' + (S.ready ? 'ready-for-review' : 'draft') + ' PR.';

function reviewBar() {
  const p = pending(), op = ownPending(), n = p.length + op.length, counts = SEV.map(s => [s, CM.filter(c => c.sev === s).length]).filter(x => x[1]);
  const needBody = !LOCAL && S.event !== 'APPROVE', done = !!S.reviewUrl;
  const canSubmit = LIVE && !done && S.busy !== 'review' && (!needBody || S.review.trim()) && (n || S.event === 'APPROVE' || S.review.trim());
  const ownRows = S.own.map(o => '<li class="st-' + ownState(o) + '"><span class="chip you-chip">You</span>' +
    btn('jumpown', o.key, 'lnk', '<code class="ref">' + esc(base(ownPath(o))) + (o.kind === 'line' ? ':' + o.end.line : '') + '</code> ' + esc(ownLabel(o)) + ': ' + esc((o.body || '(empty)').split('\n')[0].slice(0, 80)), 'allo-' + o.key) +
    '<span class="stc ' + ownState(o) + '">' + STN[ownState(o)] + '</span></li>').join('');
  return '<section class="panel rbar" id="sec-review" aria-label="' + (LOCAL ? 'Your review for Claude' : 'Pending review') + '"><h2>' + (LOCAL ? 'Your review for Claude' : 'Pending review') + '</h2>' +
    '<div class="rsum"><b>' + CM.length + ' Claude drafts</b>' + counts.map(x => sevChip(x[0], x[1] + ' ' + SEVN[x[0]])).join(' ') + (S.own.length ? '<span class="chip you-chip">' + S.own.length + ' yours</span>' : '') +
    (THREADS.length ? '<span class="chip th-chip">' + THREADS.length + ' existing threads</span>' : '') +
    '<span class="mute">' + n + ' to send; Claude drafts: ' + ['approved', 'draft', 'dismissed'].map(s => countOf(s) + ' ' + (s === 'draft' ? 'undecided' : s)).join(', ') + '.</span></div>' +
    '<p class="ro">Select line numbers (click, drag, or click then shift-click) to add your own comment. Use Comment on file in a file header for the whole file.</p>' +
    '<ol class="alld">' + BYSEV.map(c => '<li class="st-' + stateOf(c) + '">' + sevChip(c.sev) +
      btn('jump', c.fid + ':' + c.line + ':cm', 'lnk', '#' + c.n + ' <code class="ref">' + esc(base(byId[c.fid].path)) + ':' + c.line + '</code> ' + esc(c.title), 'all-' + c.key) +
      '<span class="stc ' + stateOf(c) + '">' + STN[stateOf(c)] + '</span></li>').join('') + ownRows + '</ol>' +
    '<label class="rbody"><span>' + (LOCAL ? 'Note for Claude (optional)' : 'Review summary, posted as the review body' + (needBody ? ' (required)' : ' (optional)')) + '</span><textarea class="draft rb" data-edit="__review" rows="3"' + (done ? ' readonly' : '') + '>' + esc(S.review) + '</textarea></label>' +
    '<div class="verdict" role="radiogroup" aria-label="Review verdict">' + EVENTS.map(([v, l]) => btn('event', v, 'vd' + (S.event === v ? ' on' : ''), l, 'ev-' + v, 'role="radio" aria-checked="' + (S.event === v) + '"' + (done ? ' disabled' : ''))).join('') +
    (LOCAL && S.event === 'APPROVE' ? btn('ready', '', 'viewed rdy' + (S.ready ? ' on' : ''), (S.ready ? '&#9745;' : '&#9744;') + ' Open the PR as ready for review', 'ready', 'aria-pressed="' + S.ready + '"' + (done ? ' disabled' : '')) : '') + '</div>' +
    (LOCAL ? '<p class="ro">' + consequence() + '</p>' : '') +
    '<div class="acts">' + (LIVE ? btn('submit', '', 'btn pri', S.busy === 'review' ? 'Sending...' : (LOCAL ? 'Send to Claude' : 'Submit review') + ' with ' + n + ' comment' + (n === 1 ? '' : 's'), 'submit', canSubmit ? '' : 'disabled') : '') +
    btn('copyall', '', 'btn sm' + (S.copied === 'all' ? ' done' : ''), S.copied === 'all' ? 'Copied' : 'Copy approved as text', 'copyall') +
    (S.reviewUrl ? '<span class="pok">' + (/^https/.test(S.reviewUrl) ? '<a href="' + esc(S.reviewUrl) + '" target="_blank" rel="noopener">Review posted, open on GitHub</a>' : LOCAL ? 'Sent to Claude. This page has stopped; Claude takes it from here.' : 'Review posted (' + esc(S.reviewUrl) + ')') + '</span>'
      : S.reviewErr ? '<span class="perr">Failed: ' + esc(S.reviewErr) + '</span>'
      : '<span class="ro">' + (LIVE ? (D.post.dry ? 'Dry run: nothing reaches GitHub. ' : '') + (LOCAL ? 'Only approved comments are sent.' : 'Only approved comments are posted, in one review.') : 'Static page: copy the drafts, or open it through serve.py to send them.') + '</span>') +
    (S.reviewWarn ? '<span class="perr">' + esc(S.reviewWarn) + '</span>' : '') + '</div></section>';
}

function mapView() {
  return '<section class="panel" id="sec-map" aria-label="Dependency map"><h2>Dependency map</h2><div class="map"><svg class="edges" aria-hidden="true"></svg><div class="cols" style="--n:' + GROUPS.length + '">' +
    GROUPS.map(g => '<div class="col"><h3>' + esc(g.name) + '</h3>' + FILES.filter(x => x.group === g.id).map(x =>
      btn('mapsel', x.id, 'node' + (x.id === S.cur ? ' sel' : '') + (S.viewed.has(x.id) ? ' done' : ''),
        '<span class="row"><span class="nm">' + esc(base(x.path)) + '</span><span class="ord"><span>' + (idxOf(x.id) + 1) + '</span></span></span><span class="row">' + stat(x) + '</span>', 'node-' + x.id, 'data-node="' + x.id + '"')).join('') + '</div>').join('') +
    '</div><p class="hint">Click a file to highlight what it builds on and what builds on it. Arrows point from a file to the files that build on it. Numbers give the review order; a check marks a viewed file.</p></div></section>';
}

function note(f) {
  const deps = f.deps.length ? f.deps.map(x => btn('jump', x, '', esc(base(byId[x].path)), 'dep-' + f.id + '-' + x)).join('') : '<span class="mute">nothing in this change</span>';
  return '<div class="note"><p class="lead">' + esc(f.what) + '</p><p class="why">' + esc(f.why) + '</p>' +
    '<div class="bl"><b>Builds on</b>' + deps + '</div>' +
    ((f.added || []).length ? '<ul class="ad">' + list(f.added) + '</ul>' : '') +
    ((f.lost || []).length ? '<ul class="lo">' + list(f.lost.map(x => 'lost versus ' + BASE + ': ' + x)) + '</ul>' : '') +
    ((f.checks || []).length ? '<ul class="ck">' + list(f.checks) + '</ul>' : '') + '</div>';
}

/* the editable body shared by every draft: Write / Preview tabs, copy in the corner */
function editor(key, editKey, text, locked, label) {
  const prev = S.pv[key];
  return '<div class="tabs">' + btn('pv', key + ':0', 'tab' + (prev ? '' : ' on'), 'Write', 'pvw-' + key) + btn('pv', key + ':1', 'tab' + (prev ? ' on' : ''), 'Preview', 'pvp-' + key) + '</div>' +
    '<div class="taw">' + (prev ? '<div class="draft prevw md">' + (text.trim() ? md(text) : '<p class="mute">Nothing to preview</p>') + '</div>'
      : '<textarea class="draft" data-edit="' + editKey + '" rows="' + rowsFor(text) + '" aria-label="' + esc(label) + ', editable"' + (locked ? ' readonly' : '') + '>' + esc(text) + '</textarea>') +
    '</div>';
}
const postedLink = u => '<span class="pok">' + (/^https/.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Posted, open on GitHub</a>' : (LOCAL ? 'Sent to Claude' : 'Posted (' + esc(u) + ')')) + '</span>';

function cmBox(c) {
  const st = stateOf(c), posted = S.posted[c.key], fl = S.flash === 'cm-' + c.key ? ' flash' : '';
  const head = '<b>#' + c.n + '</b>' + sevChip(c.sev) + '<span class="ct">' + esc(c.title) + '</span><span class="stc ' + st + '">' + STN[st] + '</span>';
  if (st === 'dismissed')
    return '<div class="cm min ' + c.sev + fl + '" id="cm-' + c.key + '" role="group" aria-label="Dismissed draft ' + c.n + ' on ' + esc(c.ref) + '"><div class="ch">' + head + btn('restore', c.key, 'btn sm', 'Restore', 'restore-' + c.key) + '</div></div>';
  return '<div class="cm ' + c.sev + ' ' + st + fl + '" id="cm-' + c.key + '" role="group" aria-label="Draft comment ' + c.n + ' on ' + esc(c.ref) + '">' +
    '<div class="ch">' + head + '</div>' + editor(c.key, c.key, txt(c), !!posted, 'Draft comment ' + c.n) +
    '<div class="acts">' + (st === 'posted' ? postedLink(posted)
      : (st === 'approved' ? btn('unapprove', c.key, 'btn sm', 'Unapprove', 'appr-' + c.key) : btn('approve', c.key, 'btn sm pri', 'Approve', 'appr-' + c.key)) +
        btn('dismiss', c.key, 'btn sm', 'Dismiss', 'dis-' + c.key) +
        '<span class="ro">' + (st === 'approved' ? 'Will be sent with the review. You can still edit it.' : 'Not sent unless you approve it.') + '</span>') + '</div></div>';
}

function ownBox(o) {
  const st = ownState(o), posted = S.posted[o.key], fl = S.flash === 'cm-' + o.key ? ' flash' : '';
  return '<div class="cm own ' + st + fl + '" id="cm-' + o.key + '" role="group" aria-label="Your comment, ' + esc(ownLabel(o)) + '">' +
    '<div class="ch"><span class="chip you-chip">You</span><span class="ct">' + esc(ownLabel(o)) + '</span><span class="stc ' + st + '">' + STN[st] + '</span></div>' +
    editor(o.key, 'own:' + o.key, o.body, !!posted, 'Your comment') +
    '<div class="acts">' + (st === 'posted' ? postedLink(posted)
      : (st === 'approved' ? btn('ownunapprove', o.key, 'btn sm', 'Unapprove', 'oappr-' + o.key) : btn('ownapprove', o.key, 'btn sm pri', 'Approve', 'oappr-' + o.key)) +
        btn('owndel', o.key, 'btn sm', 'Delete', 'odel-' + o.key) +
        '<span class="ro">' + (st === 'approved' ? 'Will be sent with the review.' : 'Not sent unless you approve it.') + '</span>') + '</div></div>';
}

function thBox(t, loose) {
  const who = [...new Set(t.comments.map(c => c.author))].join(', '), open = S.thOpen[t.id], long = t.comments.reduce((n, c) => n + c.body.length, 0) > 700;
  const replies = S.own.filter(o => o.kind === 'reply' && String(o.thread) === String(t.id));
  return '<div class="th" id="th-' + esc(t.id) + '" role="group" aria-label="Existing thread by ' + esc(who) + '"><div class="thh"><span class="thk">' + (LOCAL ? 'Earlier round' : 'Existing thread') + '</span><span>' + t.comments.length + ' comment' + (t.comments.length === 1 ? '' : 's') + ' by ' + esc(who) + '</span>' +
    (loose ? '<span class="chip">' + (t.line == null ? 'outdated, was line ' + esc(t.original_line) : 'line ' + esc(t.line) + ', outside the diff') + '</span>' : '') +
    (t.url ? '<a href="' + esc(t.url) + '" target="_blank" rel="noopener">open on GitHub</a>' : '') + '</div>' +
    '<div class="thl' + (long && !open ? ' clamp' : '') + '">' + t.comments.map(c => '<div class="thc"><div class="tha"><b>' + esc(c.author) + '</b> <span class="mute">' + esc(c.at || '') + '</span></div><div class="thb md">' + md(c.body) + '</div></div>').join('') + '</div>' +
    (long ? btn('thopen', t.id, 'lnk thmore', open ? 'Show less' : 'Show the whole thread', 'tho-' + t.id) : '') +
    replies.map(ownBox).join('') +
    (t.id != null && !replies.length && !S.reviewUrl ? '<div class="acts">' + btn('reply', t.id, 'btn sm', 'Reply', 'rep-' + t.id) + '</div>' : '') + '</div>';
}

/* ---------- diff with expandable context ---------- */
function hunkSpan(h) {
  const m = h.h.match(/-(\d+)(?:,\d+)? \+(\d+)/), os = m ? +m[1] : 1, ns = m ? +m[2] : 1;
  let oe = os - 1, ne = ns - 1;
  h.rows.forEach(r => { if (r[2] !== '') oe = r[2]; if (r[3] !== '') ne = r[3]; });
  return {os, ns, oe, ne};
}
const isNewOrGone = f => (f.diff || []).every(h => h.rows.every(r => r[0] === '+')) || (f.diff || []).every(h => h.rows.every(r => r[0] === '-'));
/* hidden unchanged lines before hunk 0, between hunks, and after the last hunk, in new-file numbering */
function gaps(f) {
  const H = f.diff || [], sp = H.map(hunkSpan), lines = S.ft[f.id] && S.ft[f.id].lines, out = [];
  for (let g = 0; g <= H.length; g++) {
    const a = g === 0 ? 1 : sp[g - 1].ne + 1, b = g < H.length ? sp[g].ns - 1 : (lines ? lines.length : Infinity);
    const off = g < H.length ? sp[g].os - sp[g].ns : sp[g - 1].oe - sp[g - 1].ne;
    out.push({a, b, off});
  }
  return out;
}
function ctxRow(f, n, off) {
  const code = (S.ft[f.id].lines[n - 1] || '');
  return '<div class="dr ctx"><span class="ln" aria-hidden="true">' + (n + off) + '</span><span class="ln" aria-hidden="true">' + n + '</span><span class="sg" aria-hidden="true"></span><span class="cd">' + esc(code) + '</span></div>';
}
function gapView(f, g, G) {
  if (!LIVE || isNewOrGone(f) || S.onlyRound || G.b < G.a) return '';
  const e = (S.exp[f.id] || {})[g] || {top: 0, bot: 0}, size = G.b - G.a + 1, H = (f.diff || []).length;
  let rows = '';
  if (e.top + e.bot >= size) { for (let n = G.a; n <= G.b; n++) rows += ctxRow(f, n, G.off); return rows; }
  for (let n = G.a; n < G.a + e.top; n++) rows += ctxRow(f, n, G.off);
  const left = isFinite(size) ? size - e.top - e.bot : null, id = f.id + '|' + g;
  const bar = '<div class="gap">' + (g > 0 ? btn('expand', id + '|top', 'gb', '&#8595; 20 lines', 'gt-' + id) : '') + (g < H ? btn('expand', id + '|bot', 'gb', '&#8593; 20 lines', 'gu-' + id) : '') +
    btn('expand', id + '|all', 'gb', left == null ? 'Rest of the file' : 'All ' + left + ' hidden lines', 'ga-' + id) + (S.err['file-' + f.id] ? '<span class="perr">' + esc(S.err['file-' + f.id]) + '</span>' : '') + '</div>';
  let tail = '';
  if (isFinite(G.b)) for (let n = G.b - e.bot + 1; n <= G.b; n++) tail += ctxRow(f, n, G.off);
  return rows + bar + tail;
}

function diffView(f) {
  const cms = cmOf(f.id), ths = thOf(f), placed = new Set(), G = gaps(f), H = f.diff || [];
  const own = S.own.filter(o => o.fid === f.id);
  const at = (side, ln) => ln === '' ? [] : ths.filter(t => t.line === ln && (t.side === 'LEFT') === (side === 'LEFT'));
  const picked = (h, i) => own.some(o => o.kind === 'line' && o.h === h && i >= o.lo && i <= o.hi);
  let body = '';
  H.forEach((h, hi) => {
    if (S.onlyRound && !h.rows.some(r => r[4])) return;
    body += gapView(f, hi, G[hi]) + '<div class="hh">' + esc(h.h) + '</div>';
    h.rows.forEach((r, i) => {
      const [t, code, o, n, fresh] = r, here = n === '' || t === '-' ? [] : cms.filter(c => c.line === n);
      const th = (t === '-' ? at('LEFT', o) : at('RIGHT', n)).filter(x => !placed.has(x));
      th.forEach(x => placed.add(x));
      const mine = own.filter(x => x.kind === 'line' && x.h === hi && x.hi === i);
      body += '<div class="dr' + (t === '+' ? ' add' : t === '-' ? ' del' : '') + (fresh ? ' rnd' : '') + (here.length ? ' has' : '') + (th.length ? ' hasth' : '') + (picked(hi, i) ? ' mine' : '') +
        (n !== '' && S.flash === 'L-' + f.id + '-' + n ? ' flash' : '') + '" data-r="' + f.id + '|' + hi + '|' + i + '"' + (n !== '' ? ' id="L-' + f.id + '-' + n + '"' : '') + '>' +
        '<span class="ln" title="Select to comment" aria-hidden="true">' + o + '</span><span class="ln" title="Select to comment" aria-hidden="true">' + n + '</span><span class="sg" aria-hidden="true">' + (t === ' ' ? '' : t) + '</span><span class="cd">' + esc(code) + '</span></div>' +
        th.map(x => thBox(x)).join('') + here.map(cmBox).join('') + mine.map(ownBox).join('');
    });
  });
  if (H.length && !S.onlyRound) body += gapView(f, H.length, G[H.length]);
  const loose = ths.filter(x => !placed.has(x)), files = own.filter(o => o.kind === 'file');
  return (files.length ? '<div class="fcm">' + files.map(ownBox).join('') + '</div>' : '') +
    (loose.length ? '<div class="loose"><p class="ro">' + loose.length + ' ' + (LOCAL ? 'earlier comment' : 'existing thread') + (loose.length === 1 ? '' : 's') + ' on this file not on a line shown below</p>' + loose.map(x => thBox(x, true)).join('') + '</div>' : '') +
    '<div class="diff" role="group" aria-label="Diff of ' + esc(f.path) + '"><div class="dgi">' + body + '</div></div>';
}

function fileView(f) {
  if (S.onlyRound && !inRound(f)) return '';
  const col = S.collapsed.has(f.id), v = S.viewed.has(f.id);
  return '<section class="file" id="file-' + f.id + '" aria-label="' + esc(f.path) + '"><div class="fhd">' +
    btn('toggle', f.id, 'chev', col ? '&#9656;' : '&#9662;', 'tog-' + f.id, 'aria-expanded="' + !col + '" aria-label="' + (col ? 'Expand ' : 'Collapse ') + esc(f.path) + '"') +
    '<span class="ord"><span>' + (idxOf(f.id) + 1) + '</span></span><span class="path">' + esc(f.path) + '</span>' + stat(f) +
    (f.generated ? '<span class="chip">generated</span>' : '') + roundBadge(f) + sevBadges(f.id) + ownBadge(f.id) + (thOf(f).length ? '<span class="chip th-chip">' + thOf(f).length + ' existing thread' + (thOf(f).length === 1 ? '' : 's') + '</span>' : '') +
    (S.reviewUrl ? '' : btn('ownfile', f.id, 'btn sm', 'Comment on file', 'of-' + f.id)) +
    btn('viewed', f.id, 'viewed' + (v ? ' on' : ''), (v ? '&#9745;' : '&#9744;') + ' Viewed', 'viewed-' + f.id, 'aria-pressed="' + v + '"') + '</div>' +
    (col ? (f.generated && !v ? '<p class="gen">Generated file, collapsed. Expand to read it.</p>' : '') : note(f) + diffView(f)) + '</section>';
}

function orphanView() {
  if (!ORPHANS.length) return '';
  return '<section class="panel" id="sec-orphans" aria-label="Comments on files no longer changed"><h2>' + (LOCAL ? 'Earlier comments on files no longer changed' : 'Threads on files outside this diff') + '</h2>' +
    ORPHANS.map(t => '<p class="ro"><code class="ref">' + esc(t.path) + '</code></p>' + thBox(t, true)).join('') + '</section>';
}

function view() {
  return '<div class="wrap">' + header() + '<div class="layout">' + sidebar() + '<div class="stack">' + focusView() + reviewBar() + orphanView() + mapView() + FILES.map(fileView).join('') + '</div></div></div>';
}

/* ---------- actions ---------- */
function copyText(s) {
  const fb = () => { const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).catch(fb); else fb();
}
const reviewText = () => S.review + '\n\n' + pending().map(c => '#' + c.n + ' [' + SEVN[c.sev] + '] ' + c.ref + ' - ' + c.title + '\n\n' + txt(c)).concat(
  ownPending().map(o => '[You] ' + ownRef(o) + ' - ' + ownLabel(o) + '\n\n' + o.body)).join('\n\n');
const ownByKey = k => S.own.find(o => o.key === k);
function addOwn(o) { o.key = 'u' + (++S.nid); o.body = ''; o.dec = 'approved'; S.own.push(o); S.focusKey = 'own:' + o.key; S.pv[o.key] = false; return o; }
async function loadFile(fid) {
  const j = await call('/file', {path: byId[fid].path});
  S.ft[fid] = {lines: j.lines};
}
function expand(fid, g, dir) {
  const byGap = S.exp[fid] = S.exp[fid] || {}, e = byGap[g] = byGap[g] || {top: 0, bot: 0};
  if (dir === 'all') e.top = 1e9; else e[dir] += 20;
}

let scrollTo = null;
function act(a, id) {
  if (a === 'jump') {
    const [fid, line, cm] = id.split(':');
    S.cur = fid; S.collapsed.delete(fid); S.onlyRound = S.onlyRound && inRound(byId[fid]);
    if (line) { const c = cm && CM.find(x => x.fid === fid && x.line === +line); S.flash = c ? 'cm-' + c.key : 'L-' + fid + '-' + line; scrollTo = S.flash; }
    else scrollTo = 'file-' + fid;
    S.status = 'Showing ' + base(byId[fid].path) + (line ? ' line ' + line : '');
  }
  else if (a === 'jumpown') { const o = ownByKey(id); if (o && byId[o.fid]) { S.cur = o.fid; S.collapsed.delete(o.fid); S.flash = scrollTo = 'cm-' + o.key; } }
  else if (a === 'mapsel') { S.cur = id; S.status = base(byId[id].path) + ' selected; its dependencies are highlighted'; }
  else if (a === 'sec') { scrollTo = id; S.status = 'Showing ' + id.slice(4); }
  else if (a === 'toggle') { S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); }
  else if (a === 'viewed') {
    if (S.viewed.has(id)) { S.viewed.delete(id); S.collapsed.delete(id); }
    else { S.viewed.add(id); S.collapsed.add(id); S.status = base(byId[id].path) + ' viewed, ' + S.viewed.size + ' of ' + FILES.length; scrollTo = 'file-' + id; }
  }
  else if (a === 'approve') { S.dec[id] = 'approved'; S.status = 'Approved'; }
  else if (a === 'unapprove' || a === 'restore') { delete S.dec[id]; S.status = a === 'restore' ? 'Restored as draft' : 'Back to draft'; }
  else if (a === 'dismiss') { S.dec[id] = 'dismissed'; S.status = 'Dismissed'; }
  else if (a === 'ownrange') {
    const [fid, h, x, y] = id.split('|'), hi = +h, lo = Math.min(+x, +y), up = Math.max(+x, +y), rows = byId[fid].diff[hi].rows;
    const o = addOwn({kind: 'line', fid, h: hi, lo, hi: up, start: sideOf(rows[lo]), end: sideOf(rows[up])});
    S.status = 'New comment on ' + base(byId[fid].path) + ', ' + ownLabel(o).toLowerCase();
  }
  else if (a === 'ownfile') { S.collapsed.delete(id); addOwn({kind: 'file', fid: id}); S.status = 'New comment on the whole file'; }
  else if (a === 'reply') { const t = THREADS.find(x => String(x.id) === String(id)), f = t && FILES.find(x => x.path === t.path); if (t) { addOwn({kind: 'reply', thread: t.id, fid: f ? f.id : '', path: t.path}); S.status = 'New reply'; } }
  else if (a === 'ownapprove' || a === 'ownunapprove') { const o = ownByKey(id); if (o) o.dec = a === 'ownapprove' ? 'approved' : 'draft'; }
  else if (a === 'owndel') { const o = ownByKey(id); if (o && (!o.body.trim() || confirm('Delete this comment?'))) { S.own = S.own.filter(x => x !== o); S.status = 'Comment deleted'; } }
  else if (a === 'pv') { const [k, on] = id.split(':'); S.pv[k] = on === '1'; }
  else if (a === 'thopen') { S.thOpen[id] = !S.thOpen[id]; }
  else if (a === 'desc') { S.desc = !S.desc; }
  else if (a === 'onlyround') { S.onlyRound = !S.onlyRound; }
  else if (a === 'ready') { S.ready = !S.ready; }
  else if (a === 'expand') {
    const [fid, g, dir] = id.split('|');
    if (!S.ft[fid]) { S.busy = 'file'; loadFile(fid).then(() => { delete S.err['file-' + fid]; expand(fid, +g, dir); }).catch(e => { S.err['file-' + fid] = e.message; }).then(() => { S.busy = ''; render(); }); return; }
    expand(fid, +g, dir);
  }
  else if (a === 'event') { S.event = id; }
  else if (a === 'copyall') { copyText(reviewText()); S.copied = 'all'; S.status = 'Review copied'; }
  else if (a === 'submit') { submitReview(); return; }
  render();
}

async function call(path, body) {
  const r = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Token': D.post.token}, body: JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
function payload() {
  const p = pending(), op = ownPending();
  const lineOwn = op.filter(o => o.kind === 'line').map(o => ({source: 'you', key: o.key, path: byId[o.fid].path, line: o.end.line, side: o.end.side,
    ...(o.start.line !== o.end.line || o.start.side !== o.end.side ? {start_line: o.start.line, start_side: o.start.side} : {}), body: o.body}));
  return {event: S.event, ready: S.ready, body: S.review,
    comments: p.map(c => ({source: 'claude', key: c.key, title: c.title, path: byId[c.fid].path, line: c.line, side: 'RIGHT', body: txt(c)})).concat(lineOwn),
    files: op.filter(o => o.kind === 'file').map(o => ({path: byId[o.fid].path, body: o.body})),
    replies: op.filter(o => o.kind === 'reply').map(o => ({thread: o.thread, body: o.body})),
    keys: p.map(c => c.key).concat(op.map(o => o.key))};
}
const dryNote = () => D.post.dry ? '\n(dry run: nothing is sent to GitHub)' : '';
async function submitReview() {
  const body = payload(), n = body.keys.length, und = countOf('draft'), ev = EVENTS.find(e => e[0] === S.event)[1];
  if (S.busy || S.reviewUrl) return;
  const msg = LOCAL ? 'Send "' + ev + '" to Claude with ' + n + ' comment' + (n === 1 ? '' : 's') + '?\n' + consequence()
    : 'Submit a "' + ev + '" review to ' + where + ' with ' + n + ' comment' + (n === 1 ? '' : 's') + '?' + dryNote() + '\n\nIt notifies the PR author and cannot be undone from here.';
  if (!confirm(msg + (und ? '\n' + und + ' undecided Claude draft' + (und === 1 ? ' is' : 's are') + ' not included.' : ''))) return;
  S.busy = 'review'; S.reviewErr = ''; S.reviewWarn = ''; render();
  try {
    const j = await call('/review', body);
    S.reviewUrl = j.url || 'ok'; body.keys.forEach(k => S.posted[k] = S.reviewUrl); S.status = LOCAL ? 'Sent to Claude' : 'Review posted';
    if (j.errors && j.errors.length) S.reviewWarn = 'Posted the review, but: ' + j.errors.join('; ');
  } catch (e) { S.reviewErr = e.message; }
  S.busy = ''; render();
}

/* ---------- selecting line numbers to comment: click, drag, or click then shift-click (one hunk) ---------- */
let drag = null, anchor = null;
const rowOf = el => el && el.closest ? el.closest('.dr[data-r]') : null;
function mark() {
  document.querySelectorAll('.dr.pick').forEach(e => e.classList.remove('pick'));
  if (!drag) return;
  for (let i = Math.min(drag.i0, drag.i1); i <= Math.max(drag.i0, drag.i1); i++) {
    const e = document.querySelector('.dr[data-r="' + drag.fid + '|' + drag.h + '|' + i + '"]'); if (e) e.classList.add('pick');
  }
}
document.addEventListener('mousedown', e => {
  if (S.reviewUrl || !e.target.closest || !e.target.closest('.dr[data-r] .ln')) return;
  const [fid, h, i] = rowOf(e.target).dataset.r.split('|');
  e.preventDefault();
  if (e.shiftKey && anchor && anchor.fid === fid && anchor.h === h) { act('ownrange', [fid, h, anchor.i, i].join('|')); anchor = null; return; }
  drag = {fid, h, i0: +i, i1: +i}; mark();
});
document.addEventListener('mouseover', e => {
  if (!drag) return;
  const r = rowOf(e.target); if (!r) return;
  const [fid, h, i] = r.dataset.r.split('|');
  if (fid === drag.fid && h === drag.h) { drag.i1 = +i; mark(); }
});
document.addEventListener('mouseup', () => {
  if (!drag) return;
  const d = drag; drag = null; anchor = {fid: d.fid, h: d.h, i: d.i0};
  act('ownrange', [d.fid, d.h, d.i0, d.i1].join('|'));
});

/* ---------- map edges ---------- */
function drawEdges() {
  const map = document.querySelector('#sec-map .map'); if (!map) return;
  const svg = map.querySelector('.edges'), mr = map.getBoundingClientRect();
  svg.setAttribute('viewBox', '0 0 ' + mr.width + ' ' + mr.height);
  let h = '<defs>' + ['ah:var(--line2)', 'ahon:var(--accent)'].map(s => { const [i, c] = s.split(':'); return '<marker id="' + i + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + c + '"/></marker>'; }).join('') + '</defs>';
  FILES.forEach(f => f.deps.forEach(d => {
    const a = map.querySelector('[data-node="' + d + '"]'), b = map.querySelector('[data-node="' + f.id + '"]'); if (!a || !b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); let p;
    if (Math.abs(ra.left - rb.left) < 10) { const x = ra.left - mr.left + ra.width / 2; p = 'M' + x + ' ' + (ra.bottom - mr.top) + 'L' + x + ' ' + (rb.top - mr.top); }
    else { const x1 = ra.right - mr.left, y1 = ra.top - mr.top + ra.height / 2, x2 = rb.left - mr.left, y2 = rb.top - mr.top + rb.height / 2, c = (x2 - x1) / 2; p = 'M' + x1 + ' ' + y1 + 'C' + (x1 + c) + ' ' + y1 + ' ' + (x2 - c) + ' ' + y2 + ' ' + x2 + ' ' + y2; }
    const on = f.id === S.cur || d === S.cur;
    h += '<path d="' + p + '" class="' + (on ? 'on' : '') + '" marker-end="url(#ah' + (on ? 'on' : '') + ')"/>';
  }));
  svg.innerHTML = h;
}

/* ---------- render ---------- */
const root = document.getElementById('root');
function render() {
  const ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null, y = window.scrollY;
  root.innerHTML = view();
  const fresh = S.focusKey; S.focusKey = '';
  if (!scrollTo) window.scrollTo(0, y);
  if (fresh) { const t = root.querySelector('[data-edit="' + fresh + '"]'); if (t) { t.focus({preventScroll: true}); if (t.scrollIntoView) t.scrollIntoView({block: 'nearest'}); } }
  else if (fk) { const n = root.querySelector('[data-fk="' + fk + '"]'); if (n) n.focus({preventScroll: true}); }
  if (scrollTo) { const el = document.getElementById(scrollTo); if (el) el.scrollIntoView({block: /^(file|sec)-/.test(scrollTo) ? 'start' : 'center'}); scrollTo = null; }
  if (S.flash) setTimeout(() => { S.flash = ''; }, 0);
  document.getElementById('status').textContent = S.status; S.status = '';
  persist();
  drawEdges();
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.edit; if (!k) return;
  if (k === '__review') S.review = e.target.value;
  else if (k.startsWith('own:')) { const o = ownByKey(k.slice(4)); if (o) o.body = e.target.value; }
  else S.edits[k] = e.target.value;
  persist();
});
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) act(el.dataset.act, el.dataset.id); });
window.addEventListener('resize', drawEdges);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawEdges);
document.title = D.title + (D.ref ? ' (' + D.ref + ')' : '') + ' - walkthrough';
render();
