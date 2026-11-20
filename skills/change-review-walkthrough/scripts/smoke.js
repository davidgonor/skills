#!/usr/bin/env node
/* Usage: node smoke.js page.html
   Runs the page's script against a stub DOM in seven modes (static, served PR, saved state, existing
   threads, local changes, a later round, expanded context), fires every action on every file, focus
   item, draft and comment of your own, and fails on any exception or on broken output such as
   "undefined" or a missing section. No dependencies. */
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2], 'utf8');
const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>\s*<script>\n([\s\S]*?)\n<\/script>/);
if (!m) { console.error('FAIL: could not find the data and app scripts in ' + process.argv[2]); process.exit(1); }
const base = JSON.parse(m[1].replace(/<\\\//g, '</')), app = m[2];
let failed = 0;
const check = (name, ok, extra) => { if (!ok) { failed++; console.error('FAIL ' + name + (extra ? ': ' + extra : '')); } };

function run(mode, data, extra) {
  const els = {}, el = id => els[id] || (els[id] = {textContent: id === 'data' ? JSON.stringify(data) : '', innerHTML: '', querySelector: () => null, focus() {}, scrollIntoView() {}});
  const ctx = {
    console, JSON, Math, Object, Array, Set, String, Number, Promise, Error, isFinite, Infinity,
    document: {getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, activeElement: null, fonts: null, title: '',
      createElement: () => ({style: {}, select() {}, remove() {}}), body: {appendChild() {}}, execCommand() {}},
    window: {addEventListener() {}, scrollTo() {}, scrollY: 0, isSecureContext: false},
    navigator: {}, localStorage: {getItem: () => null, setItem() {}},
    setTimeout: () => 0, clearTimeout() {}, confirm: () => false, fetch: () => Promise.resolve({ok: true, json: () => ({})}),
  };
  ctx.window.document = ctx.document;
  const probe = `
    const page = () => document.getElementById('root').innerHTML; const initial = page(); const out = [];
    const step = (a, id) => { try { act(a, id); out.push(page()); } catch (e) { throw new Error(a + ' ' + id + ': ' + e.message); } };
    ${extra || ''}
    FILES.forEach(f => { step('jump', f.id); step('mapsel', f.id); step('toggle', f.id); step('toggle', f.id); });
    FOCUS.forEach(x => step('jump', x.file + ':' + x.line));
    CM.forEach(c => { step('jump', c.fid + ':' + c.line + ':cm'); step('approve', c.key); step('unapprove', c.key); step('dismiss', c.key); step('restore', c.key); step('pv', c.key + ':1'); step('pv', c.key + ':0'); });
    /* your own comments: a range in every file's first hunk, a whole-file comment, a reply on every thread */
    FILES.forEach(f => { const h = (f.diff || [])[0]; if (h) step('ownrange', f.id + '|0|0|' + Math.min(2, h.rows.length - 1)); step('ownfile', f.id); });
    THREADS.forEach(t => { step('reply', t.id); step('thopen', t.id); step('thopen', t.id); });
    const ownCount = S.own.length, ownRendered = (page().match(/class="cm own /g) || []).length;
    S.own.forEach(o => { o.body = 'see \`x\` and **this**'; step('pv', o.key + ':1'); step('pv', o.key + ':0'); step('ownunapprove', o.key); step('ownapprove', o.key); step('jumpown', o.key); });
    let prevHtml = ''; if (S.own[0]) { step('pv', S.own[0].key + ':1'); prevHtml = page(); step('pv', S.own[0].key + ':0'); }
    const withOwn = page(), pay = payload();
    S.own.slice().forEach(o => { o.body = ''; step('owndel', o.key); });
    ['sec-focus', 'sec-review', 'sec-map'].forEach(s => step('sec', s));
    EVENTS.forEach(e => { step('event', e[0]); step('ready', ''); step('ready', ''); });
    step('desc', ''); step('desc', ''); step('onlyround', ''); step('onlyround', ''); step('copyall', '');
    FILES.forEach(f => { step('viewed', f.id); step('viewed', f.id); });
    FILES.forEach(f => { if (S.viewed.has(f.id)) step('viewed', f.id); });
    ({first: initial, all: out, withOwn, prevHtml, pay, n: {files: FILES.length, cm: CM.length, focus: FOCUS.length, threads: THREADS.length, live: LIVE, local: LOCAL, ownCount, ownRendered, ownLeft: S.own.length, expandable: FILES.some(f => (f.diff || []).length && !isNewOrGone(f))}});`;
  let r;
  try { r = vm.runInNewContext(app + '\n' + probe, ctx, {filename: 'app.js'}); }
  catch (e) { check(mode + ' runs', false, e.message); return; }
  const last = r.all[r.all.length - 1] || r.first;
  for (const [i, h] of [r.first, ...r.all].entries()) {
    const text = h.replace(/<textarea[\s\S]*?<\/textarea>/g, '').replace(/<[^>]+>/g, ' ');
    const bad = text.match(/\b(undefined|NaN|Infinity)\b|\[object Object\]/);
    if (bad) { check(mode + ' output clean', false, 'step ' + i + ' shows "' + bad[0] + '"'); break; }
  }
  const count = (h, s) => (h.match(new RegExp(s, 'g')) || []).length;
  check(mode + ' renders every file', count(last, 'class="file"') === r.n.files, count(last, 'class="file"') + ' of ' + r.n.files);
  check(mode + ' renders every Claude draft', count(last, 'id="cm-f') === r.n.cm, count(last, 'id="cm-f') + ' of ' + r.n.cm);
  check(mode + ' renders focus items', count(last, 'class="rk"') === r.n.focus, count(last, 'class="rk"') + ' of ' + r.n.focus);
  check(mode + ' submit button only when served', /data-act="submit"/.test(last) === r.n.live);
  check(mode + ' renders every comment of yours', r.n.ownRendered === r.n.ownCount, r.n.ownRendered + ' of ' + r.n.ownCount);
  check(mode + ' deletes empty comments of yours', r.n.ownLeft === 0, r.n.ownLeft + ' left');
  check(mode + ' renders markdown preview', (r.prevHtml.includes('<code>x</code>') && r.prevHtml.includes('<b>this</b>')) || r.n.ownCount === 0);
  const lines = r.pay.comments.filter(c => c.source === 'you');
  check(mode + ' payload carries your comments', lines.length + r.pay.files.length + r.pay.replies.length === r.n.ownCount, JSON.stringify({lines: lines.length, files: r.pay.files.length, replies: r.pay.replies.length}));
  check(mode + ' ranges carry a start line', lines.every(c => c.start_line == null || c.start_line !== c.line || c.start_side !== c.side));
  return {first: r.first, last, withOwn: r.withOwn, n: r.n};
}

const clone = () => JSON.parse(JSON.stringify(base));
const live = d => (d.post = {token: 't', repo: 'o/r', number: '1', dry: true}, d);
const keys = base.files.flatMap(f => (f.comments || []).map((c, i) => f.id + '.' + i));

run('static', (() => { const d = clone(); delete d.post; delete d.saved; delete d.threads; return d; })());
const pr = run('served PR', (() => { const d = live(clone()); d.pr_body = 'Long *description* with `code`'; return d; })());
if (pr) check('PR: description hidden until asked', !pr.first.includes('class="panel desc'));

const saved = live(clone()), quiet = base.files.find(f => !(f.comments || []).length) || base.files[0];
saved.saved = {dec: {}, edits: {}, review: 'r', event: 'APPROVE', viewed: [quiet.id], reviewUrl: 'https://example.test/r', posted: []};
if (keys[0]) { saved.saved.dec[keys[0]] = 'approved'; saved.saved.posted.push(keys[0]); }
if (keys[1]) saved.saved.dec[keys[1]] = 'dismissed';
if (keys[2]) saved.saved.edits[keys[2]] = 'edited';
const s = run('served with saved state', saved);
if (s) {
  if (keys[0]) check('saved: posted draft is read-only', /readonly/.test((s.first.split('id="cm-' + keys[0] + '"')[1] || '').split('id="cm-')[0]));
  if (keys[1]) check('saved: dismissed draft offers Restore', s.first.includes('data-act="restore" data-id="' + keys[1] + '"'));
  if (keys[2]) check('saved: edited text restored', s.first.includes('>edited</textarea>'));
  check('saved: viewed file starts collapsed', !s.first.includes('aria-label="Diff of ' + quiet.path + '"'));
  check('saved: submit disabled after a submitted review', /data-act="submit"[^>]*disabled/.test(s.first));
}

const thr = live(clone()), f0 = thr.files.find(f => (f.comments || []).length) || thr.files[0];
thr.threads = [
  {id: '101', path: f0.path, side: 'RIGHT', line: (f0.comments && f0.comments[0] ? f0.comments[0].line : 1), original_line: 1, url: 'https://example.test/t1', comments: [{author: 'a', at: '2026-01-01', body: 'x '.repeat(500), url: 'u'}]},
  {id: '102', path: f0.path, side: 'RIGHT', line: null, original_line: 9999, url: 'https://example.test/t2', comments: [{author: 'b', at: '2026-01-02', body: 'old', url: 'u'}]},
];
const t = run('served with threads', thr);
if (t) {
  check('threads: inline and loose both shown', (t.last.match(/class="th"/g) || []).length === 2);
  check('threads: long thread is folded', t.first.includes('Show the whole thread'));
  check('threads: outdated one is labelled', t.last.includes('outdated, was line 9999'));
  check('threads: Reply offered', t.first.includes('data-act="reply"'));
}

const loc = live(clone()); loc.mode = 'local'; loc.url = '';
const l = run('local changes', loc);
if (l) {
  check('local: verdicts are Questions, Fix these, Looks good', ['Questions', 'Fix these', 'Looks good'].every(x => l.first.includes('>' + x + '<')));
  check('local: sends to Claude', l.first.includes('Send to Claude'));
}

const rnd = live(clone()); rnd.mode = 'local'; rnd.url = ''; rnd.round = {label: 'Round 2', note: 'fixes'};
const rf = rnd.files.find(f => (f.diff || []).length && f.diff[0].rows.some(r => r[0] === '+'));
if (rf) rf.diff[0].rows.forEach(r => { if (r[0] === '+') r[4] = 1; });
const rr = run('later round', rnd);
if (rr && rf) {
  check('round: changed file badge', rr.first.includes('changed in Round 2'));
  check('round: changed rows highlighted', rr.first.includes(' rnd"') || rr.first.includes(' rnd '));
  check('round: only-this-round filter offered', rr.first.includes('data-act="onlyround"'));
}

const ex = run('expanded context', live(clone()), `
  FILES.forEach(f => { S.ft[f.id] = {lines: Array.from({length: 3000}, (_, i) => 'line ' + (i + 1))}; (f.diff || []).forEach((h, g) => { step('expand', f.id + '|' + g + '|bot'); step('expand', f.id + '|' + g + '|top'); }); step('expand', f.id + '|' + (f.diff || []).length + '|all'); });
  out.push(page());`);
if (ex && ex.n.expandable) check('expand: context rows rendered', (ex.withOwn.match(/class="dr ctx"/g) || []).length > 0);

if (failed) { console.error(failed + ' check(s) failed'); process.exit(1); }
console.log('smoke ok: 7 modes, every action on ' + base.files.length + ' files, ' + keys.length + ' drafts, ' + (base.focus || []).length + ' focus items, own comments, replies, expand, rounds');
