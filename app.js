/* 地球 ONLINE · 两条线：任务（自己打勾）→ 成就（系统判定） */
(function () {
  'use strict';

  const CATS = (window.EO_CATS || []).slice();
  const TASKS_BASE = (window.EO_TASKS || []).slice();
  const ACH_BASE = (window.EO_ACH || []).slice();
  const ACH_TOTAL = ACH_BASE.length;

  const LS_KEY = 'earth-online-v2-save';
  const BOOK_KEY = 'earth-online-v2-book';

  let TASKS = [];
  let TOTAL = 0;

  const state = { v: 2, name: '同学', sound: true, done: {}, ach: {} };
  let book = { v: 2, removed: [], custom: [], pos: {} };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const pad2 = n => String(n).padStart(2, '0');
  const fmtDate = iso => { const d = iso ? new Date(iso) : new Date(); return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()); };
  const fmtTime = iso => { const d = iso ? new Date(iso) : new Date(); return fmtDate(iso) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  /* ── 存档 ───────────────────────────── */
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        state.v = 2;
        state.name = typeof o.name === 'string' && o.name ? o.name : '同学';
        state.sound = o.sound !== false;
        state.done = o.done && typeof o.done === 'object' ? o.done : {};
        state.ach = o.ach && typeof o.ach === 'object' ? o.ach : {};
      }
    } catch (e) { /* 忽略损坏的存档 */ }
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
  function loadBook() {
    try {
      const raw = localStorage.getItem(BOOK_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        book = { v: 2, removed: Array.isArray(o.removed) ? o.removed.map(String) : [], custom: Array.isArray(o.custom) ? o.custom : [], pos: o.pos && typeof o.pos === 'object' ? o.pos : {} };
      }
    } catch (e) { /* 忽略 */ }
  }
  function saveBook() { try { localStorage.setItem(BOOK_KEY, JSON.stringify(book)); return true; } catch (e) { return false; } }

  /* ── 数据重建 ───────────────────────── */
  function normCustom(c) {
    const cat = CATS.some(x => x.key === c.cat) ? c.cat : CATS[0].key;
    return {
      id: String(c.id || ''), cat: cat, custom: true,
      title: String(c.title || '未命名任务').slice(0, 24),
      note: String(c.note || '').slice(0, 120),
      hard: Math.min(3, Math.max(1, Math.round(num(c.hard) || 1))),
      pts: Math.min(999, Math.max(1, Math.round(num(c.pts) || 15)))
    };
  }
  function rebuild() {
    const rm = new Set(book.removed.map(String));
    TASKS = TASKS_BASE.filter(t => !rm.has(String(t.id))).map(t => ({ ...t })).concat(book.custom.map(normCustom));
    TOTAL = TASKS.length;
  }

  const catOf = key => CATS.find(c => c.key === key) || CATS[0];
  const MILE = { key: '里程碑', color: '#8b7355', glyph: '里', desc: '系统里程碑，自动判定' };
  const achCat = key => CATS.find(c => c.key === key) || MILE;
  const taskById = id => TASKS.find(t => String(t.id) === String(id)) || null;
  const achById = id => ACH_BASE.find(a => String(a.id) === String(id)) || null;
  const isDone = id => !!state.done[String(id)];
  const isAch = id => !!state.ach[String(id)];

  const doneCount = () => TASKS.reduce((s, t) => s + (isDone(t.id) ? 1 : 0), 0);
  const achCount = () => ACH_BASE.filter(a => isAch(a.id)).length;
  const pct = () => (TOTAL ? doneCount() / TOTAL : 0);

  function catStat(key) {
    const all = TASKS.filter(t => t.cat === key);
    const got = all.filter(t => isDone(t.id)).length;
    return { all: all, got: got, total: all.length };
  }
  function catsTouched() { return CATS.filter(c => catStat(c.key).got > 0).length; }
  function catAchStat(key) {
    const all = ACH_BASE.filter(a => a.cat === key);
    return { got: all.filter(a => isAch(a.id)).length, total: all.length };
  }

  /* ── 成就规则 ──────────────────────── */
  function ruleInfo(a) {
    const r = (a && a.rule) || { t: 'total', n: 1 };
    if (r.t === 'tasks') {
      const ids = (r.ids || []).map(String);
      const need = ids.length;
      const got = ids.filter(id => isDone(id)).length;
      return { type: 'tasks', got: got, need: need, ok: got >= need, ids: ids, text: '把这几件事都做完' };
    }
    if (r.t === 'cat') {
      const st = catStat(r.cat);
      return { type: 'cat', got: st.got, need: r.n, ok: st.got >= r.n, text: r.cat + '方向完成 ' + r.n + ' 件' };
    }
    if (r.t === 'catsAll') {
      const got = catsTouched();
      return { type: 'catsAll', got: got, need: CATS.length, ok: got >= CATS.length, text: '八个方向各完成至少 1 件' };
    }
    const got = doneCount();
    return { type: 'total', got: got, need: r.n, ok: got >= r.n, text: '完成任意 ' + r.n + ' 件任务' };
  }

  /* 成就状态 = 当下规则是否满足：满足则点亮，不满足则熄灭 */
  function syncAch(opts) {
    const silent = !!(opts && opts.silent);
    const fresh = [], lost = [];
    ACH_BASE.forEach(a => {
      const ok = ruleInfo(a).ok;
      const on = isAch(a.id);
      if (ok && !on) { state.ach[String(a.id)] = new Date().toISOString(); fresh.push(a); }
      else if (!ok && on) { delete state.ach[String(a.id)]; lost.push(a); }
    });
    if (fresh.length || lost.length) save();
    if (!silent) {
      fresh.forEach((a, i) => setTimeout(() => achToast(a), 320 * i));
      if (lost.length) setTimeout(() => lostToast(lost), 140);
    }
    return { fresh: fresh, lost: lost };
  }

  function lostToast(list) {
    if (!list.length) return;
    sfxUndo();
    if (list.length === 1) {
      toast('<b class="t-k">成就熄灭</b><span class="t-n">' + esc(list[0].name) + '</span><span class="t-s">对应的任务已经取消，成就随之熄灭</span>', 'off');
    } else {
      const names = list.slice(0, 3).map(a => a.name).join('、') + (list.length > 3 ? ' 等' : '');
      toast('<b class="t-k">成就熄灭 ' + list.length + ' 个</b><span class="t-n">' + esc(names) + '</span><span class="t-s">对应的任务已经取消</span>', 'off');
    }
  }

  /* ── 音效 / 粒子 / 提示 ─────────────── */
  let AC = null;
  function beep(freqs, dur, type, gain) {
    if (!state.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      const t0 = AC.currentTime;
      freqs.forEach((f, i) => {
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type || 'square';
        o.frequency.value = f;
        const st = t0 + i * (dur * 0.62);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(gain || 0.05, st + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
        o.connect(g); g.connect(AC.destination);
        o.start(st); o.stop(st + dur + 0.02);
      });
    } catch (e) { /* 无音频环境 */ }
  }
  const sfxTap = () => beep([880], 0.07, 'square', 0.035);
  const sfxUndo = () => beep([420, 320], 0.08, 'square', 0.03);
  const sfxAch = () => beep([660, 880, 1180, 1480], 0.16, 'square', 0.045);

  function burst(x, y, color) {
    const cvs = $('#fx');
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const w = cvs.width = cvs.clientWidth * devicePixelRatio;
    const h = cvs.height = cvs.clientHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 150;
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 1, s: 2 + Math.random() * 3 });
    }
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      parts.forEach(p => {
        if (p.life <= 0) return;
        p.life -= dt * 1.25; p.vy += 320 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life > 0) { alive++; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = color || '#f0a51e'; ctx.fillRect(p.x, p.y, p.s, p.s); }
      });
      ctx.globalAlpha = 1;
      if (alive) requestAnimationFrame(tick); else ctx.clearRect(0, 0, w, h);
    };
    requestAnimationFrame(tick);
  }

  function toast(html, kind) {
    const host = $('#toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.innerHTML = html;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 420); }, 3200);
    while (host.children.length > 4) host.firstElementChild.remove();
  }
  function achToast(a) {
    const c = achCat(a.cat);
    sfxAch();
    toast('<b class="t-k">成就达成</b><span class="t-n">' + esc(a.name) + '</span><span class="t-s">' + esc(a.desc) + '</span>', 'ach');
    try {
      const r = $('#hudLevel').getBoundingClientRect();
      burst(r.left + r.width / 2, r.bottom + 10, c.color);
    } catch (e) { /* 忽略 */ }
    renderAll();
  }

  /* ── HUD ───────────────────────────── */
  const RING_LEN = 653.45;
  const CN_NUM = ['零','一','二','三','四','五','六','七','八','九','十'];
  function cnNum(n) { return CN_NUM[n] || String(n); }

  function renderHUD() {
    const d = doneCount(), a = achCount();
    const bar = $('#hudBar');
    if (bar) bar.style.width = (pct() * 100).toFixed(2) + '%';
    const c = $('#hudCount'); if (c) c.textContent = '任务 ' + d + ' / ' + TOTAL;
    const p = $('#hudPct'); if (p) p.textContent = Math.round(pct() * 100) + '%';
    const an = $('#hudAchNum'); if (an) an.textContent = a + '/' + ACH_TOTAL;
    const lv = $('#hudLevel'); if (lv) lv.title = '已解锁成就 ' + a + ' / ' + ACH_TOTAL;
    document.title = '（' + d + '/' + TOTAL + ' · 成就 ' + a + '/' + ACH_TOTAL + '）地球 ONLINE · 任务线';
    const rg = $('#ringFg');
    if (rg) {
      rg.style.strokeDasharray = RING_LEN;
      rg.style.strokeDashoffset = RING_LEN * (1 - pct());
    }
    const rp = $('#ringPct'); if (rp) rp.innerHTML = Math.round(pct() * 100) + '<span>%</span>';
  }

  /* ── 主页 ───────────────────────────── */
  function renderHome() {
    const d = doneCount(), a = achCount();
    const rankMax = $('#statRankMax'); if (rankMax) rankMax.textContent = '/ ' + CATS.length;
    const qt = $('#questTitle'); if (qt) qt.textContent = cnNum(CATS.length) + '方向 · 任务书';
    const ct = $('#catBarsTitle'); if (ct) ct.textContent = cnNum(CATS.length) + '个方向';

    const heroSub = $('#heroSub');
    if (heroSub) heroSub.innerHTML = TOTAL + ' 件大学生真的能做到的小事，做完自己打个勾。<br>' + ACH_TOTAL + ' 个成就不能自己点——系统看你真的做过了什么，才替你点亮。';
const heroName = $('#heroName'); if (heroName) heroName.textContent = state.name || '同学';
    const su = $('#statUnlocked'); if (su) su.textContent = d;
    const suS = su && su.parentElement && su.parentElement.querySelector('small');
    if (suS) suS.textContent = '/ ' + TOTAL;
    const sp = $('#statPoints'); if (sp) sp.textContent = a;
    const spS = sp && sp.parentElement && sp.parentElement.querySelector('small');
    if (spS) spS.textContent = '/ ' + ACH_TOTAL;
    const sr = $('#statRank'); if (sr) sr.textContent = catsTouched();
    const sl = $('#statLeft'); if (sl) sl.textContent = TOTAL - d;

    const lastAch = ACH_BASE.filter(x => isAch(x.id)).map(x => ({ a: x, t: state.ach[String(x.id)] })).sort((p, q) => String(q.t).localeCompare(String(p.t)))[0];
    const sr2 = $('#statRarest');
    if (sr2) sr2.textContent = lastAch ? (lastAch.a.name + ' · ' + fmtDate(lastAch.t)) : '还没有成就，先去完成一件小事';

    renderToday();
    renderRecent();
    renderCatBars();
  }

  function todayTask() {
    const pool = TASKS.filter(t => !isDone(t.id));
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    const day = new Date();
    let seed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
    return pool[seed % pool.length];
  }

  function renderToday() {
    const host = $('#todayBody');
    if (!host) return;
    const t = todayTask();
    if (!t) {
      host.innerHTML = '<div class="today-info"><h3>今天的任务已经全完成了</h3><p>任务书里的每一件都打了勾。想加新的，就去任务线里点「编辑」。</p><div class="row"><button class="btn btn--sm" data-go="quest">去任务线</button></div></div>';
      return;
    }
    const c = catOf(t.cat);
    host.innerHTML = '<div class="today-art"><span class="ph" style="--t:' + c.color + '">' + esc(iconOf(t.title)) + '</span></div>' +
      '<div class="today-info"><h3>' + esc(t.title) + '</h3>' +
      '<p>' + esc(t.note || '做到就算完成。') + '</p>' +
      '<div class="badges"><span class="badge" style="--t:' + c.color + '">' + esc(c.key) + '</span>' +
      '<span class="badge">难度 ' + t.hard + '</span><span class="badge">+' + t.pts + ' PTS</span></div>' +
      '<div class="row"><button class="btn btn--primary btn--sm" data-done="' + esc(t.id) + '">我做到了</button>' +
      '<button class="btn btn--sm" data-detail="' + esc(t.cat) + '" data-task="' + esc(t.id) + '">这是哪条</button>' +
      '<button class="btn btn--sm" data-go="quest">去任务线</button></div></div>';
  }

  function renderRecent() {
    const host = $('#recentList');
    if (!host) return;
    const list = ACH_BASE.filter(x => isAch(x.id)).map(x => ({ a: x, t: state.ach[String(x.id)] })).sort((p, q) => String(q.t).localeCompare(String(p.t))).slice(0, 4);
    if (!list.length) { host.innerHTML = '<li class="empty-row">还没有成就。完成的任务够了，系统会替你点亮。</li>'; return; }
    host.innerHTML = list.map(x => '<li data-detail="' + esc(x.a.id) + '">' +
      '<img src="' + esc(x.a.art) + '" alt="">' +
      '<span class="r-name">' + esc(x.a.name) + '</span>' +
      '<span class="r-time">' + fmtDate(x.t) + '</span></li>').join('');
  }

  function renderCatBars() {
    const host = $('#tierBars');
    if (!host) return;
    host.innerHTML = CATS.map(c => {
      const st = catStat(c.key);
      const w = st.total ? (st.got / st.total) * 100 : 0;
      return '<li><span class="tb-name" style="color:' + c.color + '">' + esc(c.glyph + ' ' + c.key) + '</span>' +
        '<span class="tb-track"><i style="width:' + w.toFixed(1) + '%;background:' + c.color + '"></i></span>' +
        '<span class="tb-num">' + st.got + ' / ' + st.total + '</span></li>';
    }).join('');
  }

  /* ── 任务书画布 ─────────────────────── */
  const QB = { N: 74, GX: 46, ROW: 152, PER: 5, PADX: 120, PADY: 96, HEAD: 104, GAP: 110 };
  let qbMeta = null;
  let questBuilt = false;
  let qbActive = 0;
  let qbFitted = false;
  const qbView = { x: 0, y: 0, k: 1 };

  function layoutQuestBook() {
    const bands = [], nodes = [], links = [];
    let y = QB.PADY;
    let maxW = 0;

    CATS.forEach((c, ci) => {
      const items = TASKS.filter(t => t.cat === c.key).slice().sort((a, b) => a.hard - b.hard || String(a.id).localeCompare(String(b.id)));
      const rows = Math.max(1, Math.ceil(items.length / QB.PER));
      const perRow = Math.max(1, Math.ceil(items.length / rows));
      const w = perRow * QB.N + (perRow - 1) * QB.GX;
      maxW = Math.max(maxW, w);
      let h = QB.HEAD + rows * QB.ROW;
      bands.push({ i: ci, cat: c.key, color: c.color, glyph: c.glyph, x: 0, y: y, w: w, h: h, count: items.length, rows: rows, perRow: perRow });
      y += h + QB.GAP;
    });

    bands.forEach(b => { b.x = QB.PADX + (maxW - b.w) / 2; });

    bands.forEach((b, bi) => {
      const items = TASKS.filter(t => t.cat === b.cat).slice().sort((a, x) => a.hard - x.hard || String(a.id).localeCompare(String(x.id)));
      const prevInBand = [];
      items.forEach((t, i) => {
        const r = Math.floor(i / b.perRow);
        const c = i % b.perRow;
        const col = r % 2 === 0 ? c : (b.perRow - 1 - c);
        const lx = col * (QB.N + QB.GX);
        const ly = QB.HEAD + r * QB.ROW;
        const p = book.pos[String(t.id)] || null;
        const ax = p && isFinite(p.x) ? Number(p.x) : b.x + lx;
        const ay = p && isFinite(p.y) ? Number(p.y) : b.y + ly;
        const node = { id: String(t.id), task: t, ch: bi, cat: t.cat, color: b.color, glyph: b.glyph, x: lx, y: ly, ax: ax, ay: ay, cx: ax + QB.N / 2, cy: ay + QB.N / 2 };
        if (r > 0) b.h = Math.max(b.h, ay - b.y + QB.N + 52);
        nodes.push(node);
        if (prevInBand.length) {
          const pv = prevInBand[prevInBand.length - 1];
          const sameRow = Math.abs(pv.ay - ay) < 6;
          const d = sameRow
            ? 'M' + pv.cx + ',' + pv.cy + ' H' + node.cx
            : 'M' + pv.cx + ',' + pv.cy + ' V' + ((pv.cy + node.cy) / 2) + ' H' + node.cx + ' V' + node.cy;
          links.push({ a: pv.id, b: node.id, d: d, color: b.color, head: false });
        }
        prevInBand.push(node);
      });
    });

    let maxY = 0;
    nodes.forEach(n => { maxY = Math.max(maxY, n.ay + QB.N + 46); });
    const last = bands[bands.length - 1];
    return { bands: bands, nodes: nodes, links: links, W: QB.PADX * 2 + maxW, H: Math.max(maxY, last.y + last.h) + QB.PADY };
  }

  function renderQuest(force) {
    if (questBuilt && !force) { refreshQuestState(); return; }
    qbMeta = layoutQuestBook();
    const rail = $('#qbRail'), canvas = $('#qbCanvas');
    if (!rail || !canvas) return;

    rail.innerHTML = CATS.map((c, i) => {
      const st = catStat(c.key);
      const done = st.total > 0 && st.got === st.total;
      return '<button class="qb-ch' + (i === qbActive ? ' is-active' : '') + (done ? ' is-done' : '') + '" data-ch="' + i + '" style="--t:' + c.color + '">' +
        '<span class="qb-ch-num">' + esc(c.glyph) + '</span>' +
        '<span class="qb-ch-count" data-ch-count="' + i + '">' + st.got + '/' + st.total + '</span></button>';
    }).join('');

    const bandHTML = qbMeta.bands.map(b => {
      const st = catStat(b.cat);
      return '<div class="qb-band" style="left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;--t:' + b.color + '">' +
        '<div class="qb-band-head"><b class="qb-band-title">' + esc(b.cat) + '</b>' +
        '<span class="qb-band-meta" data-ch-meta="' + b.i + '">' + st.got + ' / ' + st.total + '</span></div>' +
        '<p class="qb-band-desc">' + esc(catOf(b.cat).desc) + '</p>' +
        '<div class="qb-band-rule"></div></div>';
    }).join('');

    const linkHTML = '<svg class="qb-links" width="' + qbMeta.W + '" height="' + qbMeta.H + '" viewBox="0 0 ' + qbMeta.W + ' ' + qbMeta.H + '">' +
      qbMeta.links.map(l => '<path class="qb-link" data-a="' + esc(l.a) + '" data-b="' + esc(l.b) + '" d="' + l.d + '" fill="none" stroke-width="2"></path>').join('') + '</svg>';

    const nodeHTML = qbMeta.nodes.map(n => {
      return '<button class="qnode" data-id="' + esc(n.id) + '" data-task="' + esc(n.id) + '" style="left:' + n.ax + 'px;top:' + n.ay + 'px;--t:' + n.color + '">' +
        '<span class="qnode-box"><span class="ph" style="--t:' + n.color + '">' + esc(iconOf(n.task.title)) + '</span>' +
        '<span class="qnode-tick">✓</span></span>' +
        '<span class="qnode-name">' + esc(n.task.title) + '</span>' +
        '<span class="qnode-rate">难度 ' + n.task.hard + '</span></button>';
    }).join('');

    canvas.style.width = qbMeta.W + 'px';
    canvas.style.height = qbMeta.H + 'px';
    canvas.innerHTML = bandHTML + linkHTML + nodeHTML;
    questBuilt = true;
    refreshQuestState();
  }

  function refreshQuestState() {
    if (!qbMeta) return;
    const canvas = $('#qbCanvas');
    if (!canvas) return;
    $$('.qnode', canvas).forEach(el => {
      const on = isDone(el.dataset.id);
      el.classList.toggle('is-on', on);
    });
    $$('.qb-link', canvas).forEach(p => {
      const on = isDone(p.dataset.a) && isDone(p.dataset.b);
      p.classList.toggle('is-on', on);
      p.setAttribute('stroke', p.classList.contains('is-on') ? (taskById(p.dataset.a) ? catOf(taskById(p.dataset.a).cat).color : '#2b2116') : 'rgba(43,33,22,.22)');
    });
    CATS.forEach((c, i) => {
      const st = catStat(c.key);
      const meta = $('[data-ch-meta="' + i + '"]');
      if (meta) meta.textContent = st.got + ' / ' + st.total;
      const cnt = $('[data-ch-count="' + i + '"]');
      if (cnt) cnt.textContent = st.got + '/' + st.total;
      const rail = $('.qb-ch[data-ch="' + i + '"]');
      if (rail) rail.classList.toggle('is-done', st.total > 0 && st.got === st.total);
    });
  }

  function applyQB() {
    const c = $('#qbCanvas'), vp = $('#qbViewport');
    if (!c) return;
    c.style.transform = 'translate(' + qbView.x + 'px,' + qbView.y + 'px) scale(' + qbView.k + ')';
    if (vp) {
      const s = 26 * qbView.k;
      vp.style.backgroundSize = s + 'px ' + s + 'px';
      vp.style.backgroundPosition = qbView.x + 'px ' + qbView.y + 'px';
    }
  }

  function zoomQB(cx, cy, factor) {
    const vp = $('#qbViewport');
    if (!vp) return;
    const k0 = qbView.k;
    const k = Math.max(0.3, Math.min(1.8, k0 * factor));
    if (Math.abs(k - k0) < 0.0005) return;
    qbView.x = cx - (cx - qbView.x) * (k / k0);
    qbView.y = cy - (cy - qbView.y) * (k / k0);
    qbView.k = k;
    applyQB();
  }

  function fitChapter(i, animate) {
    const vp = $('#qbViewport');
    if (!vp || !qbMeta) return;
    const b = qbMeta.bands[i];
    if (!b) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (!vw || !vh) return;
    const pad = 54;
    const maxW = Math.max(1, qbMeta.W - QB.PADX * 2);
    const k = Math.max(0.34, Math.min(1.05, Math.min((vw - pad * 2) / maxW, (vh - pad * 2) / b.h)));
    qbView.k = k;
    qbView.x = vw / 2 - (QB.PADX + maxW / 2) * k;
    qbView.y = pad - b.y * k;
    qbActive = i;
    qbFitted = true;
    $$('.qb-ch').forEach(el => el.classList.toggle('is-active', Number(el.dataset.ch) === i));
    const c = $('#qbCanvas');
    if (animate && c && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      c.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)';
      setTimeout(() => { c.style.transition = ''; }, 470);
    }
    applyQB();
  }

  function bindQuestBook() {
    const vp = $('#qbViewport');
    if (!vp) return;

    let drag = null, nodeDrag = null;
    const clearSel = () => { try { const s = window.getSelection(); if (s) s.removeAllRanges(); } catch (e) { /* 忽略 */ } };

    const endDrag = () => {
      if (nodeDrag) {
        if (nodeDrag.moved) {
          const id = nodeDrag.id;
          book.pos[id] = { x: Math.round(parseFloat(nodeDrag.el.style.left)), y: Math.round(parseFloat(nodeDrag.el.style.top)) };
          saveBook();
          renderQuest(true);
        } else {
          openEditor(nodeDrag.id);
        }
        nodeDrag.el.classList.remove('is-dragging');
        nodeDrag = null;
      }
      if (drag) {
        vp.classList.remove('is-grabbing');
        vp.style.cursor = '';
        if (drag.moved !== undefined) { /* noop */ }
        drag = null;
      }
      clearSel();
    };

    vp.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const nodeEl = e.target.closest('.qnode');
      if (nodeEl) {
        if (!editMode) return;
        nodeDrag = { el: nodeEl, id: nodeEl.dataset.id, sx: e.clientX, sy: e.clientY, ox: parseFloat(nodeEl.style.left) || 0, oy: parseFloat(nodeEl.style.top) || 0, moved: false };
        nodeEl.classList.add('is-dragging');
        vp.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      drag = { sx: e.clientX, sy: e.clientY, ox: qbView.x, oy: qbView.y, moved: false };
      vp.classList.add('is-grabbing');
      vp.style.cursor = 'grabbing';
      vp.setPointerCapture(e.pointerId);
      clearSel();
      e.preventDefault();
    });

    vp.addEventListener('pointermove', e => {
      if (nodeDrag) {
        const dx = (e.clientX - nodeDrag.sx) / qbView.k;
        const dy = (e.clientY - nodeDrag.sy) / qbView.k;
        if (Math.abs(dx) + Math.abs(dy) > 2) nodeDrag.moved = true;
        nodeDrag.el.style.left = (nodeDrag.ox + dx) + 'px';
        nodeDrag.el.style.top = (nodeDrag.oy + dy) + 'px';
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      qbView.x = drag.ox + dx;
      qbView.y = drag.oy + dy;
      applyQB();
    });

    vp.addEventListener('pointerup', endDrag);
    vp.addEventListener('pointercancel', endDrag);

    vp.addEventListener('wheel', e => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomQB(e.clientX - r.left, e.clientY - r.top, Math.pow(1.0016, -e.deltaY));
    }, { passive: false });

    document.addEventListener('selectstart', e => { if (drag || nodeDrag) e.preventDefault(); }, true);
    window.addEventListener('blur', () => { if (drag || nodeDrag) endDrag(); });

    const inBtn = $('#qbIn'), outBtn = $('#qbOut'), fitBtn = $('#qbFit'), editBtn = $('#qbEdit'), addBtn = $('#qbAdd');
    if (inBtn) inBtn.onclick = () => { const r = vp.getBoundingClientRect(); zoomQB(r.width / 2, r.height / 2, 1.2); };
    if (outBtn) outBtn.onclick = () => { const r = vp.getBoundingClientRect(); zoomQB(r.width / 2, r.height / 2, 1 / 1.2); };
    if (fitBtn) fitBtn.onclick = () => fitChapter(qbActive, true);
    if (editBtn) editBtn.onclick = toggleEdit;
    if (addBtn) addBtn.onclick = () => addTask(false);

    const rail = $('#qbRail');
    if (rail) rail.addEventListener('click', e => {
      const b = e.target.closest('.qb-ch');
      if (!b) return;
      fitChapter(Number(b.dataset.ch), true);
    });

    const canvas = $('#qbCanvas');
    if (canvas) {
      canvas.addEventListener('contextmenu', e => {
        const n = e.target.closest('.qnode');
        if (!n) return;
        e.preventDefault();
        openTaskDetail(n.dataset.id);
      });
      canvas.addEventListener('dblclick', e => {
        const n = e.target.closest('.qnode');
        if (!n) return;
        openTaskDetail(n.dataset.id);
      });
    }
  }

  /* ── 编辑模式 ──────────────────────── */
  let editMode = false, editingId = null, delArmed = 0, delTimer = 0;

  function toggleEdit() {
    editMode = !editMode;
    const qb = $('#qb');
    if (qb) qb.classList.toggle('is-editing', editMode);
    const btn = $('#qbEdit');
    if (btn) { btn.textContent = editMode ? '完成' : '编辑'; btn.classList.toggle('is-on', editMode); }
    const add = $('#qbAdd');
    if (add) add.hidden = !editMode;
    if (!editMode) closeEditor();
  }

  function openEditor(id) {
    const t = taskById(id);
    if (!t) return;
    editingId = String(id);
    const box = $('#qbEditor');
    const title = $('#qbeTitle');
    if (title) title.textContent = t.custom ? '编辑自定义任务' : '编辑任务';
    const n = $('#qbeName'); if (n) n.value = t.title;
    const d = $('#qbeDesc'); if (d) d.value = t.note || '';
    const tier = $('#qbeTier');
    if (tier) {
      tier.innerHTML = CATS.map(c => '<option value="' + esc(c.key) + '">' + esc(c.key + ' · ' + c.desc) + '</option>').join('');
      tier.value = t.cat;
    }
    const r = $('#qbeRate'); if (r) r.value = t.hard;
    const p = $('#qbePts'); if (p) p.value = t.pts;
    const del = $('#qbeDel');
    if (del) { del.textContent = '删除'; del.classList.remove('is-armed'); }
    delArmed = 0;
    if (box) box.hidden = false;
  }

  function closeEditor() {
    const box = $('#qbEditor');
    if (box) box.hidden = true;
    editingId = null;
    delArmed = 0;
  }

  function saveEditor() {
    if (!editingId) return;
    const nameEl = $('#qbeName'), descEl = $('#qbeDesc'), tierEl = $('#qbeTier'), rateEl = $('#qbeRate'), ptsEl = $('#qbePts');
    const title = (nameEl && nameEl.value || '').trim() || '未命名任务';
    const note = (descEl && descEl.value || '').trim();
    const cat = tierEl ? tierEl.value : CATS[0].key;
    const hard = Math.min(3, Math.max(1, Math.round(num(rateEl && rateEl.value) || 1)));
    const pts = Math.min(999, Math.max(1, Math.round(num(ptsEl && ptsEl.value) || 15)));
    const id = String(editingId);
    const idx = book.custom.findIndex(c => String(c.id) === id);
    const payload = { id: id, custom: true, cat: cat, title: title, note: note, hard: hard, pts: pts };
    if (idx >= 0) book.custom[idx] = payload;
    else {
      if (!book.removed.includes(id)) book.removed.push(id);
      book.custom.push(payload);
    }
    saveBook();
    rebuild();
    questBuilt = false;
    renderQuest(true);
    renderAll();
    syncAch({ silent: true });
    renderAll();
    fitChapter(qbActive, false);
    closeEditor();
    toast('<b class="t-k">已保存</b><span class="t-n">' + esc(title) + '</span><span class="t-s">' + esc(cat) + ' · 难度 ' + hard + ' · +' + pts + ' PTS</span>');
  }

  function deleteTask(id) {
    const target = String((typeof id === 'string' && id) || editingId || '');
    if (!target) return;
    const t = taskById(target);
    const idx = book.custom.findIndex(c => String(c.id) === target);
    if (idx >= 0) book.custom.splice(idx, 1);
    else if (TASKS_BASE.some(x => String(x.id) === target)) { if (!book.removed.includes(target)) book.removed.push(target); }
    delete book.pos[target];
    delete state.done[target];
    saveBook(); save();
    rebuild();
    questBuilt = false;
    closeEditor();
    renderQuest(true);
    syncAch({ silent: true });
    renderAll();
    toast('<b class="t-k">任务已删除</b><span class="t-n">' + esc(t ? t.title : target) + '</span>');
  }

  function addTask(silent) {
    let maxN = 0;
    book.custom.forEach(c => { const m = /^u(\d+)$/.exec(String(c.id)); if (m) maxN = Math.max(maxN, Number(m[1])); });
    const id = 'u' + (maxN + 1);
    const cat = CATS[qbActive] ? CATS[qbActive].key : CATS[0].key;
    const item = { id: id, custom: true, cat: cat, title: '新的任务', note: '写清楚什么情况算做到。', hard: 2, pts: 25 };
    book.custom.push(item);
    const vp = $('#qbViewport');
    const visW = vp ? Math.max(240, vp.clientWidth - (editMode ? 322 : 0)) : 480;
    const visH = vp ? vp.clientHeight : 420;
    book.pos[id] = {
      x: Math.round((visW / 2 - qbView.x) / qbView.k - QB.N / 2),
      y: Math.round((visH / 2 - qbView.y) / qbView.k - QB.N / 2)
    };
    saveBook();
    rebuild();
    questBuilt = false;
    renderQuest(true);
    syncAch({ silent: true });
    renderAll();
    if (!silent) { openEditor(id); toast('<b class="t-k">新任务</b><span class="t-s">填好内容后点保存</span>'); }
  }

  /* ── 打卡 ──────────────────────────── */
  function toggleTask(id, ev) {
    const t = taskById(id);
    if (!t) return;
    const key = String(id);
    if (isDone(key)) {
      delete state.done[key];
      save();
      syncAch();
      toast('<b class="t-k">已取消</b><span class="t-n">' + esc(t.title) + '</span><span class="t-s">' + esc(t.cat) + ' 进度 -1，相关成就已重新判定</span>');
      sfxUndo();
    } else {
      state.done[key] = new Date().toISOString();
      save();
      if (ev) burst(ev.clientX, ev.clientY, catOf(t.cat).color);
      sfxTap();
      const r = syncAch();
      if (!r.fresh.length) {
        toast('<b class="t-k">完成一件</b><span class="t-n">' + esc(t.title) + '</span><span class="t-s">' + esc(t.cat) + ' · +' + t.pts + ' PTS</span>');
      }
    }
    renderAll();
  }

  /* ── 成就视图 ──────────────────────── */
  const filter = { cat: 'all', state: 'all', q: '', sort: 'orig' };

  function achProgress(a) {
    const info = ruleInfo(a);
    const list = info.type === 'tasks' ? info.ids.map(id => { const t = taskById(id); return { id: id, title: t ? t.title : id, done: isDone(id) }; }) : [];
    return { info: info, list: list };
  }

  function currentAchList() {
    const q = filter.q.trim().toLowerCase();
    let list = ACH_BASE.filter(a => {
      if (filter.cat !== 'all' && a.cat !== filter.cat) return false;
      const on = isAch(a.id);
      if (filter.state === 'locked' && on) return false;
      if (filter.state === 'unlocked' && !on) return false;
      if (q) {
        const hay = (a.name + ' ' + a.desc + ' ' + a.cat).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (filter.sort === 'name') list = list.slice().sort((x, y) => x.name.localeCompare(y.name, 'zh'));
    else if (filter.sort === 'cat') list = list.slice().sort((x, y) => CATS.findIndex(c => c.key === x.cat) - CATS.findIndex(c => c.key === y.cat));
    else if (filter.sort === 'near') list = list.slice().sort((x, y) => {
      const ix = ruleInfo(x), iy = ruleInfo(y);
      return (ix.need ? ix.got / ix.need : 0) < (iy.need ? iy.got / iy.need : 0) ? 1 : -1;
    });
    return list;
  }

  const KEYCHARS = '饭睡跑书课钱家电影洗修账话病床衣手读写练唱拍走站坐哭买灯鞋证件票车球山课';
  function iconOf(title) {
    const t = String(title || '');
    for (let i = 0; i < t.length; i++) if (KEYCHARS.indexOf(t[i]) >= 0) return t[i];
    return t.slice(0, 1) || '·';
  }

  function shortLabel(a, info) {
    const left = Math.max(0, (info.need || 0) - (info.got || 0));
    if (info.type === 'tasks') return '还需 ' + left + ' 件指定任务';
    if (info.type === 'cat') return a.cat + '还需 ' + left + ' 件';
    if (info.type === 'catsAll') return '还需 ' + left + ' 个方向';
    return '还需 ' + left + ' 件任务';
  }

  function cardHTML(a) {
    const on = isAch(a.id);
    const c = achCat(a.cat);
    const { info } = achProgress(a);
    const need = info.need || 1;
    const got = Math.min(info.got, need);
    const shown = on ? '已达成' : got + ' / ' + need;
    return '<article class="card' + (on ? ' is-on' : '') + '" data-detail="' + esc(a.id) + '" data-id="' + esc(a.id) + '" tabindex="0" role="button" aria-label="' + esc(a.name) + '">' +
      '<div class="card-art" style="--t:' + c.color + '">' +
      '<img src="' + esc(a.art) + '" alt="" loading="lazy">' +
      '<div class="card-veil"></div>' +
      '<span class="badge" style="--t:' + c.color + '">' + esc(a.cat) + '</span>' +
      '<span class="card-pct">' + esc(shown) + '</span>' +
      (on ? '<div class="stamp">✓</div>' : '') +
      '</div>' +
      '<div class="card-body"><h3>' + esc(a.name) + '</h3><p>' + esc(a.desc) + '</p>' +
      '<div class="card-foot"><span class="state">' + (on ? '已达成 · ' + fmtDate(state.ach[String(a.id)]) : esc(shortLabel(a, info))) + '</span>' +
      '<span class="pts">' + got + '/' + need + '</span></div></div></article>';
  }

  function renderTierChips() {
    const host = $('#tierChips');
    if (!host) return;
    const all = '<button class="chip' + (filter.cat === 'all' ? ' is-active' : '') + '" data-tier="all">全部 ' + ACH_TOTAL + '</button>';
    const pool = CATS.concat([MILE]).filter(c => ACH_BASE.some(a => a.cat === c.key));
    host.innerHTML = all + pool.map(c => {
      const st = catAchStat(c.key);
      return '<button class="chip' + (filter.cat === c.key ? ' is-active' : '') + '" data-tier="' + esc(c.key) + '" style="--t:' + c.color + '">' + esc(c.key) + ' <em>' + st.total + '</em></button>';
    }).join('');
  }

  function renderDex() {
    const grid = $('#grid'), empty = $('#empty');
    if (!grid) return;
    const list = currentAchList();
    grid.innerHTML = list.map(cardHTML).join('');
    if (empty) empty.hidden = list.length > 0;
    $$('#stateChips .chip').forEach(b => b.classList.toggle('is-active', b.dataset.state === filter.state));
  }

  /* ── 详情 ──────────────────────────── */
  function openModal(html, kind) {
    const m = $('#modal'), body = $('#modalBody');
    if (!m || !body) return;
    body.innerHTML = html;
    const card = m.querySelector('.modal-card');
    if (card) { card.classList.toggle('modal-card--detail', kind === 'detail'); }
    m.hidden = false;
    document.body.classList.add('is-locked');
  }
  function closeModal() {
    const m = $('#modal');
    if (!m) return;
    m.hidden = true;
    document.body.classList.remove('is-locked');
  }

  function openDetail(id) {
    const a = achById(id);
    if (!a) return;
    const on = isAch(a.id);
    const c = achCat(a.cat);
    const { info, list } = achProgress(a);
    const need = info.need || 1;
    const got = Math.min(info.got, need);
    const w = Math.round((got / need) * 100);
    const condHTML = list.length
      ? '<ul class="rule-list">' + list.map(x => '<li class="' + (x.done ? 'is-done' : '') + '"><i>' + (x.done ? '✓' : '·') + '</i>' + esc(x.title) + '</li>').join('') + '</ul>'
      : '<p class="rule-text">' + esc(info.text) + '</p>';
    openModal('<div class="detail"><div class="detail-art" style="--t:' + c.color + '">' +
      '<img src="' + esc(a.art) + '" alt=""><div class="detail-veil"></div>' +
      '<div class="detail-head"><span class="badge" style="--t:' + c.color + '">' + esc(a.cat) + '</span><h2>' + esc(a.name) + '</h2></div>' +
      '<span class="detail-pct">' + (on ? '已达成' : got + '/' + need) + '</span></div>' +
      '<p class="detail-desc">' + esc(a.desc) + '</p>' +
      '<div class="detail-meta">' +
      '<div><span>判定方式</span><b>系统自动</b></div>' +
      '<div><span>所属方向</span><b>' + esc(a.cat) + '</b></div>' +
      '<div><span>当前进度</span><b>' + got + ' / ' + need + '</b></div>' +
      '<div><span>状态</span><b>' + (on ? '已达成 · ' + fmtDate(state.ach[String(a.id)]) : '未达成') + '</b></div>' +
      '</div>' +
      '<div class="achbar"><span>进度</span><i><b style="width:' + w + '%;background:' + c.color + '"></b></i><em>' + w + '%</em></div>' +
      '<p class="rule-cap">达成条件</p>' + condHTML +
      '<div class="row"><button class="btn btn--primary" data-go="quest" data-close="1">去完成对应任务</button><button class="btn" data-close="1">关闭</button></div>' +
      '<p class="detail-foot">成就不需要手动点。规则满足时自动点亮；把对应任务取消掉，它也会跟着熄灭。</p></div>', 'detail');
  }

  function openTaskDetail(id) {
    const t = taskById(id);
    if (!t) return;
    const c = catOf(t.cat);
    const on = isDone(t.id);
    const feeds = ACH_BASE.filter(a => {
      const r = a.rule || {};
      if (r.t === 'tasks') return (r.ids || []).map(String).includes(String(t.id));
      if (r.t === 'cat') return r.cat === t.cat;
      if (r.t === 'catsAll') return true;
      return true;
    });
    openModal('<div class="detail"><div class="detail-art detail-art--flat" style="--t:' + c.color + '">' +
      '<span class="ph" style="--t:' + c.color + '">' + esc(c.glyph) + '</span>' +
      '<div class="detail-head"><span class="badge" style="--t:' + c.color + '">' + esc(t.cat) + '</span><h2>' + esc(t.title) + '</h2></div>' +
      '<span class="detail-pct">' + (on ? '已完成' : '未完成') + '</span></div>' +
      '<p class="detail-desc">' + esc(t.note || '做到就算完成。') + '</p>' +
      '<div class="detail-meta">' +
      '<div><span>方向</span><b>' + esc(t.cat) + '</b></div>' +
      '<div><span>难度</span><b>' + t.hard + ' / 3</b></div>' +
      '<div><span>点数</span><b>+' + t.pts + '</b></div>' +
      '<div><span>状态</span><b>' + (on ? '已完成 · ' + fmtDate(state.done[String(t.id)]) : '未完成') + '</b></div>' +
      '</div>' +
      '<p class="rule-cap">它能推动这些成就</p>' +
      '<ul class="rule-list">' + feeds.slice(0, 6).map(a => {
        const info = ruleInfo(a);
        return '<li class="' + (isAch(a.id) ? 'is-done' : '') + '"><i>' + (isAch(a.id) ? '✓' : '·') + '</i>' + esc(a.name) + ' <em>' + Math.min(info.got, info.need) + '/' + info.need + '</em></li>';
      }).join('') + '</ul>' +
      '<div class="row"><button class="btn btn--primary" data-done="' + esc(t.id) + '" data-close="1">' + (on ? '取消完成' : '标记完成') + '</button><button class="btn" data-close="1">关闭</button></div></div>', 'detail');
  }

  /* ── 存档页 ────────────────────────── */
  function renderSave() {
    const n = $('#playerName'); if (n) n.value = state.name || '同学';
    const su = $('#saveUnlocked'); if (su) su.textContent = doneCount();
    const sp = $('#savePoints'); if (sp) sp.textContent = achCount();
    const sc = $('#savePct'); if (sc) sc.textContent = Math.round(pct() * 100) + '%';
    const sr = $('#saveRank'); if (sr) sr.textContent = catsTouched() + ' / ' + CATS.length;
  }

  function exportSave() {
    const payload = { app: 'earth-online', v: 2, at: new Date().toISOString(), state: state, book: book };
    const txt = JSON.stringify(payload);
    const area = $('#ioArea');
    if (area) { area.value = txt; area.focus(); area.select(); }
    try { navigator.clipboard.writeText(txt); } catch (e) { /* 忽略 */ }
    toast('<b class="t-k">已导出</b><span class="t-s">已填入下方文本框并尝试复制</span>');
  }

  function importSave() {
    const area = $('#ioArea');
    if (!area) return;
    let obj = null;
    try { obj = JSON.parse(area.value); } catch (e) { toast('<b class="t-k">导入失败</b><span class="t-s">不是合法的存档内容</span>'); return; }
    if (!obj || !obj.state) { toast('<b class="t-k">导入失败</b><span class="t-s">缺少 state 字段</span>'); return; }
    const s = obj.state;
    state.name = typeof s.name === 'string' && s.name ? s.name : state.name;
    state.sound = s.sound !== false;
    state.done = s.done && typeof s.done === 'object' ? s.done : {};
    state.ach = s.ach && typeof s.ach === 'object' ? s.ach : {};
    if (obj.book) {
      book = { v: 2, removed: Array.isArray(obj.book.removed) ? obj.book.removed.map(String) : [], custom: Array.isArray(obj.book.custom) ? obj.book.custom : [], pos: obj.book.pos || {} };
      saveBook();
    }
    save();
    rebuild();
    questBuilt = false;
    renderQuest(true);
    renderAll();
    syncAch({ silent: true });
    renderAll();
    toast('<b class="t-k">已导入</b><span class="t-s">任务 ' + doneCount() + ' · 成就 ' + achCount() + '</span>');
  }

  function resetAll() {
    openModal('<div class="detail detail--flat"><h2 class="confirm-t">清空全部进度？</h2>' +
      '<p class="detail-desc">任务打勾、成就、自定义任务都会回到初始状态。这一步不能撤销。</p>' +
      '<div class="row"><button class="btn btn--danger" data-reset-confirm="1">确认清空</button><button class="btn" data-close="1">取消</button></div></div>');
  }

  function resetBook() {
    openModal('<div class="detail detail--flat"><h2 class="confirm-t">复原任务书？</h2>' +
      '<p class="detail-desc">会恢复 72 件内置任务、删除你自建的任务与拖动位置，已打勾的进度保留（如果任务回来，勾也还在）。</p>' +
      '<div class="row"><button class="btn btn--danger" data-book-reset="1">确认复原</button><button class="btn" data-close="1">取消</button></div></div>');
  }

  /* ── 战报图 ────────────────────────── */
  function makePoster() {
    const W = 900, H = 1240;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const g = cvs.getContext('2d');
    const ink = '#2b2116', cream = '#f7efdd', paper = '#fffdf5', gold = '#f0a51e', teal = '#1f9e96';

    g.fillStyle = cream; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f1e6cd';
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) if (((x / 16) + (y / 16)) % 2 === 0) g.fillRect(x, y, 16, 16);
    g.fillStyle = ink; g.fillRect(26, 26, W - 52, H - 52);
    g.fillStyle = paper; g.fillRect(34, 34, W - 68, H - 68);
    g.strokeStyle = '#e4d7ba'; g.lineWidth = 2; g.strokeRect(46, 46, W - 92, H - 92);

    const font = (sz, bold) => (bold ? 'bold ' : '') + sz + 'px "Zpix","Microsoft YaHei",monospace';
    g.textAlign = 'left'; g.fillStyle = ink;
    g.font = font(15); g.fillText('EARTH ONLINE / SAVE REPORT', 78, 96);
    g.font = font(44, true); g.fillText(state.name || '同学', 78, 152);
    g.font = font(17); g.fillStyle = '#7a6b58';
    g.fillText('任务 ' + doneCount() + ' / ' + TOTAL + ' · 成就 ' + achCount() + ' / ' + ACH_TOTAL, 78, 186);

    const cxp = 700, cyp = 150, r = 78;
    g.beginPath(); g.arc(cxp, cyp, r, 0, Math.PI * 2); g.strokeStyle = '#e4d7ba'; g.lineWidth = 18; g.stroke();
    g.beginPath(); g.arc(cxp, cyp, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct()); g.strokeStyle = teal; g.lineWidth = 18; g.stroke();
    g.fillStyle = ink; g.textAlign = 'center'; g.font = font(40, true);
    g.fillText(Math.round(pct() * 100) + '%', cxp, cyp + 14);
    g.font = font(14); g.fillStyle = '#7a6b58'; g.fillText('任务完成度', cxp, cyp + 40);
    g.textAlign = 'left';

    let y = 300;
    const rows = [
      ['已完成任务', doneCount() + ' / ' + TOTAL],
      ['已解锁成就', achCount() + ' / ' + ACH_TOTAL],
      ['迈过方向', catsTouched() + ' / ' + CATS.length],
      ['最有分量的一枚', (function () {
        const u = ACH_BASE.filter(a => isAch(a.id));
        return u.length ? u[u.length - 1].name : '（还没有）';
      })()]
    ];
    g.font = font(14); 
    rows.forEach(row => {
      g.fillStyle = '#8b7355'; g.fillText(row[0], 78, y);
      g.fillStyle = ink; g.font = font(26, true); g.fillText(String(row[1]), 78, y + 34);
      g.font = font(14);
      g.fillStyle = '#e4d7ba'; g.fillRect(78, y + 48, 744, 2);
      y += 88;
    });

    y += 6;
    g.fillStyle = '#8b7355'; g.font = font(14); g.fillText('八个方向', 78, y);
    y += 26;
    CATS.forEach(c => {
      const st = catStat(c.key);
      g.fillStyle = c.color; g.font = font(15, true); g.fillText(c.glyph, 78, y + 14);
      g.fillStyle = ink; g.font = font(15); g.fillText(c.key, 108, y + 14);
      g.fillStyle = '#e4d7ba'; g.fillRect(180, y + 4, 500, 12);
      g.fillStyle = c.color; g.fillRect(180, y + 4, 500 * (st.total ? st.got / st.total : 0), 12);
      g.fillStyle = '#7a6b58'; g.font = font(13); g.textAlign = 'right';
      g.fillText(st.got + '/' + st.total, 796, y + 15); g.textAlign = 'left';
      y += 34;
    });

    g.fillStyle = '#8b7355'; g.font = font(13);
    g.fillText('地球 ONLINE · 任务线', 78, H - 86);
    g.fillText(fmtDate(), 78, H - 62);
    g.textAlign = 'right';
    g.fillText('配图 @地球online成就收集家', W - 78, H - 62);

    const url = cvs.toDataURL('image/png');
    openModal('<div class="poster-wrap"><h2 class="confirm-t">你的战报</h2>' +
      '<p class="detail-desc">长按或右键保存这张图，发给你想炫耀的那个人。</p>' +
      '<img class="poster-img" src="' + url + '" alt="战报">' +
      '<a class="btn btn--primary" download="earth-online.png" href="' + url + '">下载 PNG</a></div>');
  }

  /* ── 渲染总装 ──────────────────────── */
  function renderAll() {
    renderHUD();
    renderHome();
    renderDex();
    renderSave();
    refreshQuestState();
  }

  /* ── 视图切换 ──────────────────────── */
  const VIEWS = ['home', 'quest', 'dex', 'save'];
  function go(view, silent) {
    if (VIEWS.indexOf(view) < 0) view = 'home';
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
    $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === view));
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// 下可能失败 */ }
    if (view === 'quest') {
      renderQuest(false);
      bindQuestBook();
      if (!qbFitted) fitChapter(qbActive, false);
    }
    window.scrollTo({ top: 0, behavior: silent ? 'auto' : 'smooth' });
  }

  /* ── 事件 ──────────────────────────── */
  function bindEvents() {
    document.addEventListener('click', e => {
      const tab = e.target.closest('.tab[data-view]');
      if (tab) { go(tab.dataset.view); return; }

      const goEl = e.target.closest('[data-go]');
      if (goEl) { if (goEl.dataset.close) closeModal(); go(goEl.dataset.go); return; }

      const doneEl = e.target.closest('[data-done]');
      if (doneEl) { if (doneEl.dataset.close) closeModal(); toggleTask(doneEl.dataset.done, e); return; }

      const chip = e.target.closest('[data-tier]');
      if (chip) { filter.cat = chip.dataset.tier; renderTierChips(); renderDex(); return; }

      const st = e.target.closest('[data-state]');
      if (st) { filter.state = st.dataset.state; renderDex(); return; }

      const det = e.target.closest('[data-detail]');
      if (det) { if (det.dataset.task) openTaskDetail(det.dataset.task); else openDetail(det.dataset.detail); return; }

      const node = e.target.closest('.qnode');
      if (node) { toggleTask(node.dataset.id, e); return; }

      if (e.target.closest('[data-close]') || e.target.closest('#modalX')) { closeModal(); return; }
      if (e.target.closest('[data-reset-confirm]')) {
        state.done = {}; state.ach = {}; save(); closeModal(); renderAll();
        toast('<b class="t-k">已清空</b><span class="t-s">从头开始也没关系</span>'); return;
      }
      if (e.target.closest('[data-book-reset]')) {
        book = { v: 2, removed: [], custom: [], pos: {} }; saveBook(); rebuild(); questBuilt = false;
        closeModal(); renderQuest(true); renderAll(); fitChapter(0, false);
        toast('<b class="t-k">任务书已复原</b><span class="t-s">72 件内置任务回来了</span>'); return;
      }

      const save = e.target.closest('#qbeSave');
      if (save) { saveEditor(); return; }
      const del = e.target.closest('#qbeDel');
      if (del) {
        if (Date.now() < delArmed) { clearTimeout(delTimer); deleteTask(editingId); return; }
        delArmed = Date.now() + 6000;
        del.textContent = '确认删除？';
        del.classList.add('is-armed');
        clearTimeout(delTimer);
        delTimer = setTimeout(() => { delArmed = 0; del.textContent = '删除'; del.classList.remove('is-armed'); }, 5800);
        return;
      }
      if (e.target.closest('#qbeClose')) { closeEditor(); return; }

      if (e.target.closest('#btnExport')) { exportSave(); return; }
      if (e.target.closest('#btnImport')) { importSave(); return; }
      if (e.target.closest('#btnPoster')) { makePoster(); return; }
      if (e.target.closest('#btnReset')) { resetAll(); return; }
      if (e.target.closest('#btnResetBook')) { resetBook(); return; }
      if (e.target.closest('#btnSound')) {
        state.sound = !state.sound; save();
        const b = $('#btnSound'); if (b) { b.textContent = state.sound ? '♪' : '×'; b.setAttribute('aria-pressed', String(state.sound)); }
        return;
      }
    });

    document.addEventListener('contextmenu', e => {
      const card = e.target.closest('.card[data-detail]');
      const node = e.target.closest('.qnode');
      if (!card && !node) return;
      e.preventDefault();
      if (card) openDetail(card.dataset.detail);
      else if (node) openTaskDetail(node.dataset.id);
    });

    document.addEventListener('dblclick', e => {
      const card = e.target.closest('.card[data-detail]');
      if (card) { e.preventDefault(); openDetail(card.dataset.detail); }
    });

    const modal = $('#modal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); } });

    const search = $('#search');
    if (search) search.addEventListener('input', () => { filter.q = search.value; renderDex(); });

    const sort = $('#sort');
    if (sort) sort.addEventListener('change', () => { filter.sort = sort.value; renderDex(); });

    const name = $('#playerName');
    if (name) name.addEventListener('input', () => { state.name = name.value.slice(0, 16); save(); renderHome(); });

    window.addEventListener('hashchange', () => {
      const v = (location.hash || '').replace('#', '');
      if (VIEWS.indexOf(v) >= 0) go(v, true);
    });
  }

  /* ── 启动 ──────────────────────────── */
  function boot() {
    load();
    loadBook();
    rebuild();
    renderTierChips();
    renderAll();
    bindEvents();
    syncAch({ silent: true });
    renderAll();
    renderQuest(false);
    const sb = $('#btnSound');
    if (sb) { sb.textContent = state.sound ? '♪' : '×'; sb.setAttribute('aria-pressed', String(state.sound)); }
    const start = (location.hash || '').replace('#', '');
    go(VIEWS.indexOf(start) >= 0 ? start : 'home', true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
