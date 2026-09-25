/* 小红书笔记生成器 · 前端逻辑 */

const $ = (s) => document.querySelector(s);

const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '七年级', '八年级', '九年级',
  '高一', '高二', '高三',
];
const SUBJECTS = [
  '道德与法治', '语文', '数学', '英语', '科学',
  '音乐', '体育', '美术', '信息技术', '综合实践',
  '历史', '地理', '物理', '化学', '生物',
];
const TERMS = ['2026秋', '26秋', '2026春', '26春', '2025秋', '25秋'];
const MATERIALS = [
  '全册课件ppt+教案+练习', '全册课件ppt', '课件ppt+教案',
  '配套教案', '课时练习', '知识清单', '单元试卷',
  '教学计划进度表', '全册复习资料',
];

let state = {
  template: '',
  defaultTemplate: '',
  notes: [],          // [{ titles, body, topics, checklist }, ...]
  current: 0,
  selectedTitles: [], // 每篇当前选中的标题下标
  params: {},
  options: { terms: [], materials: [], grades: [], subjects: [] },
};

/* ---------------- 基础 UI ---------------- */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

async function copyText(text, okMsg = '已复制') {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(okMsg);
  }
}

function openDrawer(sel) {
  document.querySelectorAll('.drawer.open').forEach((d) => d.classList.remove('open'));
  $(sel).classList.add('open');
  $('#mask').classList.remove('hidden');
}
function closeDrawers() {
  document.querySelectorAll('.drawer.open').forEach((d) => d.classList.remove('open'));
  $('#mask').classList.add('hidden');
}

/* 学科 → 该学科真实存在的教材版本。不同学科出版社体系完全不同（如科学是教科版/青岛版，英语是PEP/外研版），
   必须按学科给建议，否则会给出该学科根本不存在的版本。 */
const SUBJECT_VERSIONS = {
  科学: ['教科版', '人教版', '苏教版', '青岛版', '湘科版', '大象版', '粤教版', '冀人版', '浙教版'],
  生物: ['人教版', '北师大版', '苏教版', '苏科版', '济南版', '冀少版', '浙科版'],
  语文: ['统编版', '人教版', '苏教版', '北师大版', '沪教版', '冀教版'],
  数学: ['人教版', '人教版A版', '人教版B版', '北师大版', '苏教版', '冀教版', '西师版', '青岛版', '青岛五四制', '沪教版', '浙教版', '华东师大版', '湘教版', '苏科版', '鄂教版'],
  英语: ['人教PEP', '人教新起点', '人教PEP一起', '人教版', '外研版', '外研一起', '译林版', '仁爱版', '冀教版', '冀教一起', '沪教牛津', '沪教牛津2024', '科普版', '北师大版', '鲁教版', '重庆大学版', '教科版'],
  道德与法治: ['统编版'],
  思想政治: ['统编版'],
  历史: ['统编版'],
  地理: ['人教版', '湘教版', '中图版', '商务星球版', '粤教版', '晋教版', '鲁教版'],
  物理: ['人教版', '沪科版', '苏科版', '北师大版', '粤教版', '鲁科版', '浙教版', '教科版'],
  化学: ['人教版', '沪教版', '鲁科版', '苏教版', '粤教版', '浙教版', '沪科版'],
};
const DEFAULT_VERSIONS = [
  '人教版', '统编版', '北师大版', '苏教版', '冀教版', '沪教版',
  '浙教版', '外研版', '译林版', '教科版', '青岛版',
];

function versionsFor(subject) {
  const s = String(subject || '').trim();
  // 空学科不能走 includes 匹配：'' 会被任何 key 判定为包含，会误命中第一个学科
  if (!s) return DEFAULT_VERSIONS;
  for (const key of Object.keys(SUBJECT_VERSIONS)) {
    if (s.includes(key) || key.includes(s)) return SUBJECT_VERSIONS[key];
  }
  return DEFAULT_VERSIONS;
}

function fillVersionOptions(subject) {
  const list = $('#versionList');
  if (!list) return;
  list.innerHTML = versionsFor(subject)
    .map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');
}

/* 册次候选：小学初中是「上册/下册/全一册」，高中是「必修…」，且高中各学科的册次命名不同
   （语文历史=必修上册；政治=必修1；数英物化地=必修第一册；生物=必修1 分子与细胞）。 */
const HS_GRADE = /高[一二三]|高中/;

function volumesFor(grade, subject) {
  if (!HS_GRADE.test(String(grade || '').trim())) {
    return ['上册', '下册', '全一册'];
  }
  const s = String(subject || '').trim();
  if (/语文|历史/.test(s)) {
    return ['必修上册', '必修下册', '选择性必修上册', '选择性必修中册', '选择性必修下册'];
  }
  if (/思想政治|政治/.test(s)) {
    return ['必修1', '必修2', '必修3', '必修4', '选择性必修1', '选择性必修2', '选择性必修3'];
  }
  if (/生物/.test(s)) {
    return [
      '必修1 分子与细胞', '必修2 遗传与进化',
      '选择性必修1 稳态与调节', '选择性必修2 生物与环境', '选择性必修3 生物技术与工程',
    ];
  }
  if (/化学/.test(s)) {
    return ['必修第一册', '必修第二册',
      '选择性必修1 化学反应原理', '选择性必修2 物质结构与性质', '选择性必修3 有机化学基础'];
  }
  if (/地理/.test(s)) {
    return ['必修第一册', '必修第二册',
      '选择性必修1 自然地理基础', '选择性必修2 区域发展', '选择性必修3 资源、环境与国家安全'];
  }
  // 数学 / 英语 / 物理
  const base = ['必修第一册', '必修第二册', '必修第三册',
    '选择性必修第一册', '选择性必修第二册', '选择性必修第三册'];
  if (/英语/.test(s)) base.push('选择性必修第四册');
  return base;
}

/* 库内册次缓存：key = 年级||学科。命中后不再重复请求 */
const volumeCache = new Map();

function applyVolumeList(vols, keepCurrent) {
  const list = $('#volumeList');
  if (!list) return;
  list.innerHTML = vols.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');
  // 年级/学科切换后若当前册次不在新候选里，自动换掉，避免留下「上册」这种高中无效值
  const cur = $('#volume').value.trim();
  if (!keepCurrent && cur && !vols.includes(cur)) $('#volume').value = vols[0];
}

function fillVolumeOptions(grade, subject, keepCurrent) {
  const g = String(grade || '').trim();
  const s = String(subject || '').trim();
  const local = volumesFor(g, s);
  const key = `${g}||${s}`;

  const cached = volumeCache.get(key);
  applyVolumeList(cached && cached.length ? cached : local, keepCurrent);
  if (cached) return;
  if (!g && !s) return;

  // 用「已核实目录库」里的真实册次覆盖本地兜底：库内册名随教材而异
  // （语文是「选择性必修上册」、化学是「选择性必修1 化学反应原理」、数学是「选择性必修第一册」）
  fetch(`/api/volumes?grade=${encodeURIComponent(g)}&subject=${encodeURIComponent(s)}`)
    .then((r) => r.json())
    .then((j) => {
      if (!j || !j.ok || !Array.isArray(j.volumes) || !j.volumes.length) return;
      volumeCache.set(key, j.volumes);
      // 防竞态：用户已经改了年级/学科就丢弃这次结果
      if ($('#grade').value.trim() === g && $('#subject').value.trim() === s) {
        applyVolumeList(j.volumes, true);
      }
    })
    .catch(() => { /* 接口不可用时保留本地建议 */ });
}

/* ---------------- 初始化 ---------------- */

function fillOptions(custom) {
  const c = custom || state.options || { terms: [], materials: [], grades: [], subjects: [] };
  if (custom) state.options = c;

  // 内置候选 + 用户自定义候选，去重后一起塞进 datalist
  const uniq = (a, b) => [...new Set([...(a || []), ...(b || [])].filter(Boolean))];
  const opt = (arr) => arr.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('');

  $('#gradeList').innerHTML = opt(uniq(GRADES, c.grades));
  $('#subjectList').innerHTML = opt(uniq(SUBJECTS, c.subjects));
  $('#termList').innerHTML = opt(uniq(TERMS, c.terms));
  $('#matList').innerHTML = opt(uniq(MATERIALS, c.materials));

  const t = $('#optTerms');
  if (t) {
    t.value = (c.terms || []).join('\n');
    $('#optMaterials').value = (c.materials || []).join('\n');
    $('#optGrades').value = (c.grades || []).join('\n');
    $('#optSubjects').value = (c.subjects || []).join('\n');
  }
}

async function loadOptions() {
  try {
    const r = await fetch('/api/options');
    const j = await r.json();
    fillOptions(j.options);
  } catch { /* 接口挂了就用内置候选 */ }
}

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    state.template = c.template || c.defaultTemplate || '';
    state.defaultTemplate = c.defaultTemplate || '';
    $('#template').value = state.template;
    $('#model').placeholder = c.model || 'deepseek-chat';
    const ks = $('#keyState');
    if (c.hasKey) {
      ks.textContent = `Key 已配置 ${c.keyMask}`;
      ks.className = 'key-state ok';
    } else {
      ks.textContent = '未配置 API Key，点设置填写';
      ks.className = 'key-state bad';
    }
  } catch (e) {
    $('#keyState').textContent = '无法连接服务';
    $('#keyState').className = 'key-state bad';
  }
}

/* ---------------- 参数 ---------------- */

function collectParams() {
  return {
    grade: $('#grade').value.trim(),
    subject: $('#subject').value.trim(),
    volume: $('#volume').value,
    term: $('#term').value.trim(),
    materialType: $('#materialType').value.trim(),
    highlights: $('#highlights').value.trim(),
    catalog: $('#catalog').value.trim(),
    extra: $('#extra').value.trim(),
  };
}

function checkParams(p) {
  const miss = [];
  if (!p.grade) miss.push('年级');
  if (!p.subject) miss.push('学科');
  if (!p.volume) miss.push('册次');
  return miss;
}

function fillTemplateLocal(tpl, p) {
  const grade = p.grade || '';
  const volume = p.volume || '';
  const dict = {
    '年级': grade || '（未填年级）',
    '学科': p.subject || '（未填学科）',
    '册次': volume || '（未填册次）',
    '年级册次': grade && volume ? `${grade}${volume}` : (grade || volume || '（未填年级册次）'),
    '学期': p.term || '（未填学期，按当前最新学期处理）',
    '资料类型': p.materialType || '（未填资料类型，按课件ppt+教案+练习处理）',
    '资料亮点': p.highlights || '（未填，按资料类型合理推断，禁止编造具体页数）',
    '教材目录': p.catalog || '（未提供，由你依据最新版教材自动生成，仅展开第一单元课次）',
    '内容类型': p.contentType ? `本次重点落在：${p.contentType}。` : '',
    '补充要求': p.extra ? `【创作者的额外要求】\n${p.extra}` : '',
  };
  return tpl.replace(/\{\{([^}]+)\}\}/g, (_, k) => {
    const key = k.trim();
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : `{{${key}}}`;
  });
}

/* ---------------- 解析模型输出 ---------------- */

/** 话题可能是 ["xx"] 也可能是 [{tag,layer}]，统一成对象 */
function normTopics(arr) {
  const list = Array.isArray(arr) ? arr : arr ? [arr] : [];
  return list
    .map((x) => {
      if (x && typeof x === 'object') {
        return {
          tag: String(x.tag || x.name || x.text || '').replace(/^#/, '').trim(),
          layer: String(x.layer || x.type || '').trim(),
        };
      }
      return { tag: String(x || '').replace(/^#/, '').trim(), layer: '' };
    })
    .filter((t) => t.tag);
}

/** 合规自检表：模型可能给 {item,ok} 对象，也可能给字符串数组 */
function normChecklist(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list
    .map((x) => {
      if (x && typeof x === 'object') {
        return {
          item: String(x.item || x.name || x.check || '').trim(),
          ok: x.ok === true || x.ok === 'true' || x.pass === true || x.pass === 'true',
        };
      }
      // 纯字符串形态：带 ✅ 视为通过，带 ❌ 视为未通过
      const s = String(x);
      return { item: s.replace(/[✅❌✓✗✔]/g, '').trim(), ok: !/[❌✗]/.test(s) };
    })
    .filter((c) => c.item);
}

/**
 * 模型经常把正文里的真实换行直接放进 JSON 字符串，属于非法 JSON。
 * 这里按字符扫描，只把「字符串内部的裸控制字符」转义掉，不动其它内容。
 */
function repairJson(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c;
      continue;
    }
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\') { out += c; esc = true; continue; }
    if (c === '"') { out += c; inStr = false; continue; }
    if (c === '\n') { out += '\\n'; continue; }
    if (c === '\r') { out += '\\r'; continue; }
    if (c === '\t') { out += '\\t'; continue; }
    out += c;
  }
  return out;
}

/** 兜底：按「标题 / 正文 / 话题」小标题切分纯文本输出 */
function parseBySections(text) {
  const lines = String(text || '').split('\n');
  const secs = { titles: [], body: [], topics: [] };
  let cur = null;
  for (const line of lines) {
    const t = line.trim();
    const h = t.replace(/^[#*\-—\s]+/, '').replace(/[：:]$/, '');
    if (/^标题/.test(h)) { cur = 'titles'; continue; }
    if (/^正文/.test(h)) { cur = 'body'; continue; }
    if (/^(话题|标签|hashtags?)/i.test(h)) { cur = 'topics'; continue; }
    if (!cur || !t) { if (cur === 'body') secs.body.push(line); continue; }

    if (cur === 'titles') {
      const x = t.replace(/^\d+[.、)]\s*/, '').replace(/^[#*\-]+\s*/, '').trim();
      if (x) secs.titles.push(x);
    } else if (cur === 'topics') {
      const xs = t.split(/[\s、,，]+/).filter(Boolean).map((x) => x.replace(/^#/, ''));
      secs.topics.push(...xs);
    } else {
      secs.body.push(line);
    }
  }
  return {
    titles: secs.titles,
    body: secs.body.join('\n').trim(),
    topics: normTopics(secs.topics.filter(Boolean)),
  };
}

/**
 * 剥掉标题末尾模型擅自附加的字数/公式标注，如「（20字符）」「(18字)」「（20字符·清单式）」。
 * 这些只是提示词里的内部说明，不应被复制进实际发布的标题。
 */
function stripTitleTag(s) {
  return String(s || '')
    .replace(/\s*[（(][^（）()]*\d+\s*个?\s*字(?:符)?[^（）()]*[)）]\s*$/, '')
    .replace(/\s*[（(]\s*(?:痛点疑问式|痛点式|清单式|疑问式|人群锁定式|人群式|数字式|节点式|对比式|效果式|场景式|罗列式|身份共鸣式|共鸣式|说明书式|公式[A-Za-z])\s*[)）]\s*$/, '')
    .trim();
}

/** 把单篇对象归一化成统一结构 */
function normNote(o) {
  const x = o || {};
  const titles = (Array.isArray(x.titles) ? x.titles : [x.title])
    .filter(Boolean).map((t) => String(t).trim()).map(stripTitleTag).filter(Boolean);
  return {
    titles,
    body: String(x.body || x.content || '').trim(),
    topics: normTopics(Array.isArray(x.topics) || Array.isArray(x.tags) ? (x.topics || x.tags) : [x.topic]),
    checklist: normChecklist(x.checklist || x.compliance || x.selfCheck),
  };
}

/** 统一返回 notes 数组，哪怕模型只给了一篇 */
function parseResult(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  const candidates = [];
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) candidates.push(s.slice(a, b + 1));
  candidates.push(s);

  for (const cand of candidates) {
    try {
      const o = JSON.parse(repairJson(cand));
      // 多篇：{ notes: [...] }
      if (Array.isArray(o.notes) && o.notes.length) {
        const many = o.notes.map(normNote).filter((n) => n.titles.length || n.body);
        if (many.length) return many;
      }
      // 单篇：{ titles, body, topics, checklist }
      const note = normNote(o);
      if (note.titles.length || note.body) return [note];
    } catch { /* 试下一个候选 */ }
  }

  // 降级一：正则抓字段（同样做控制字符修复）
  const grab = (key) => {
    const m = s.match(new RegExp(`"${key}"\\s*:\\s*(\\[[\\s\\S]*?\\]|"(?:[^"\\\\]|\\\\.)*")`));
    if (!m) return null;
    try { return JSON.parse(repairJson(m[1])); } catch { return null; }
  };
  const t = grab('titles') || grab('title');
  const tp = grab('topics') || grab('tags') || grab('topic');
  const bm = s.match(/"(?:body|content)"\s*:\s*"((?:[^"\\]|\\.)*(?:\n[^"\\]*)*)"/);
  let body = '';
  if (bm) {
    try { body = JSON.parse(repairJson(`"${bm[1]}"`)); } catch { body = bm[1]; }
  }
  if ((Array.isArray(t) && t.length) || body) {
    return [{
      titles: Array.isArray(t) ? t : t ? [t] : [],
      body: String(body || '').trim(),
      topics: normTopics(tp),
      checklist: [],
    }];
  }

  // 降级二：按小标题切分
  const bySec = parseBySections(s);
  if (bySec.titles.length || bySec.topics.length) return [{ ...bySec, checklist: [] }];

  // 降级三：整段当正文
  return [{ titles: [], body: s, topics: [], checklist: [] }];
}

/* ---------------- 渲染 ---------------- */

/* ---------------- 多篇渲染 ---------------- */

function setNotes(notes) {
  state.notes = notes || [];
  state.current = 0;
  state.selectedTitles = state.notes.map(() => 0);
  $('#emptyState').classList.add('hidden');
  $('#result').classList.remove('hidden');
  renderTabs();
  renderNote(0);
}

function renderTabs() {
  const box = $('#noteTabs');
  if (state.notes.length <= 1) { box.innerHTML = ''; return; }
  box.innerHTML = state.notes.map((_, i) =>
    `<button class="note-tab ${i === state.current ? 'active' : ''}" data-n="${i}">第 ${i + 1} 篇</button>`
  ).join('');
  box.querySelectorAll('.note-tab').forEach((b) => {
    b.onclick = () => {
      state.current = Number(b.dataset.n);
      renderTabs();
      renderNote(state.current);
    };
  });
}

function renderNote(i) {
  const d = state.notes[i];
  if (!d) return;
  const sel = state.selectedTitles[i] ?? 0;
  const box = $('#noteBody');

  box.innerHTML =
    `<div class="card">
      <div class="card-head">
        <h3>标题<em>5 个备选，点选即复制</em></h3>
        <button class="mini copy" data-copy="titles">复制全部</button>
      </div>
      <ul class="titles">${titleHtml(d.titles, sel)}</ul>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>正文<em>${d.body ? countWords(d.body) + ' 字' : ''}</em></h3>
        <button class="mini copy" data-copy="body">复制正文</button>
      </div>
      <div class="body">${escapeHtml(d.body || '（未解析到正文）')}</div>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>话题<em>${(d.topics || []).length ? d.topics.length + ' 个' : ''}</em></h3>
        <button class="mini copy" data-copy="topics">复制话题</button>
      </div>
      <div class="topics">${topicHtml(d.topics)}</div>
    </div>
    <div class="card">
      <div class="card-head">
        <h3>文件引导语<em>固定文案，复制时自动附在话题下方</em></h3>
        <button class="mini copy" data-copy="cta">复制</button>
      </div>
      <div class="cta">${escapeHtml(CTA_TEXT)}</div>
    </div>
    ${checkHtml(d.checklist)}`;

  bindNoteEvents(box, i);
}

function titleHtml(titles, sel) {
  const list = (titles || []).map(stripTitleTag);
  if (!list.length) return '<li style="color:var(--text-3)">未解析到标题</li>';
  return list.map((t, i) => {
    const n = charCount(t);
    const over = n > 20;
    const under = n < 17;
    const cls = over ? ' over' : under ? ' under' : '';
    const tip = over ? '超过 20 字符，需重写' : under ? `仅 ${n} 字符，偏短（建议 17-20 字符），建议重写` : '符合 17-20 字符要求';
    return `<li class="${i === sel ? 'active' : ''}" data-i="${i}">` +
      `<span class="idx">${i + 1}</span>` +
      `<span class="txt">${escapeHtml(t)}</span>` +
      `<span class="len${cls}" title="${tip}">${n}字</span>` +
      `</li>`;
  }).join('');
}

function topicHtml(topics) {
  const list = topics || [];
  if (!list.length) return '<span style="color:var(--text-3);font-size:12.5px">未解析到话题</span>';
  return list.map((t) => {
    const cls = layerClass(t.layer);
    const badge = t.layer ? `<b class="layer ${cls}">${escapeHtml(t.layer)}</b>` : '';
    return `<span class="topic" data-t="${escapeHtml(t.tag)}">${badge}#${escapeHtml(t.tag)}</span>`;
  }).join('');
}

function checkHtml(cl) {
  const list = cl || [];
  if (!list.length) return '';
  const passed = list.filter((c) => c.ok).length;
  return `<div class="card">
    <div class="card-head">
      <h3>合规自检表<em>${passed}/${list.length} 项通过</em></h3>
    </div>
    <ul class="checklist">${list.map((c) =>
      `<li class="${c.ok ? 'ok' : 'no'}">` +
      `<span class="mark">${c.ok ? '✓' : '✕'}</span>` +
      `<span class="txt">${escapeHtml(c.item)}</span></li>`
    ).join('')}</ul>
  </div>`;
}

function bindNoteEvents(box, i) {
  const d = state.notes[i];
  box.querySelectorAll('.titles li[data-i]').forEach((li) => {
    li.onclick = () => {
      const idx = Number(li.dataset.i);
      state.selectedTitles[i] = idx;
      box.querySelectorAll('.titles li').forEach((x) => x.classList.remove('active'));
      li.classList.add('active');
      copyText(stripTitleTag(d.titles[idx]), '标题已复制');
    };
  });
  box.querySelectorAll('.topics .topic').forEach((el) => {
    el.onclick = () => copyText('#' + el.dataset.t, '话题已复制');
  });
  box.querySelectorAll('.copy').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.copy;
      if (k === 'titles') copyText(d.titles.map(stripTitleTag).join('\n'), '标题已复制');
      if (k === 'body') copyText(d.body, '正文已复制');
      if (k === 'topics') copyText((d.topics || []).map((t) => '#' + t.tag).join(' '), '话题已复制');
      if (k === 'cta') copyText(CTA_TEXT, '引导语已复制');
    };
  });
}

/** 标题字数：汉字、标点、emoji 各算 1 个字符 */
function charCount(s) {
  const str = String(s || '');
  try {
    if (window.Intl && Intl.Segmenter) {
      return [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(str)].length;
    }
  } catch { /* 退回码点计数 */ }
  return Array.from(str).length;
}

function layerClass(layer) {
  if (/主/.test(layer)) return 'main';
  if (/细分/.test(layer)) return 'niche';
  if (/长尾/.test(layer)) return 'long';
  return '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function countWords(s) {
  return (s.match(/[\u4e00-\u9fa5]|[A-Za-z0-9]+/g) || []).length;
}

/* ---------------- 生成 ---------------- */

async function generate() {
  const params = collectParams();
  const miss = checkParams(params);
  const err = $('#genErr');
  if (miss.length) {
    err.textContent = `请先填写：${miss.join('、')}`;
    return;
  }
  err.textContent = '';
  state.params = params;

  const count = Math.min(10, Math.max(1, Number($('#count').value) || 1));
  const btn = $('#btnGenerate');
  btn.disabled = true;
  btn.textContent = count > 1 ? `生成中…（${count} 篇）` : '生成中…';
  $('#streamBox').classList.remove('hidden');
  $('#streamText').textContent = '';
  $('#result').classList.add('hidden');

  let raw = '';
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params,
        count,
        template: $('#template').value,
        temperature: Number($('#temperature').value),
      }),
    });

    const reader = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    let gotError = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let payload;
        try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (payload.error) gotError = payload.error;
        if (payload.delta) {
          raw += payload.delta;
          $('#streamText').textContent = raw;
          $('#streamText').scrollTop = $('#streamText').scrollHeight;
        }
      }
    }

    if (gotError) {
      err.textContent = gotError;
      $('#streamBox').classList.add('hidden');
      return;
    }

    $('#streamBox').classList.add('hidden');
    const notes = parseResult(raw);
    setNotes(notes.length ? notes : [{ titles: [], body: raw, topics: [], checklist: [] }]);
    if (count > 1 && notes.length < count) {
      err.textContent = `要求 ${count} 篇，实际解析出 ${notes.length} 篇（模型输出可能被截断，可减少篇数或重试）`;
    }
  } catch (e) {
    err.textContent = `请求失败：${e.message}`;
    $('#streamBox').classList.add('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '生成小红书笔记';
  }
}

/* ---------------- 复制 ---------------- */

const CTA_TEXT = '点击下方文件链接可以试看课件ppt👇🏻👇🏻';

function currentAllText(i = state.current) {
  const d = state.notes[i];
  if (!d) return '';
  const sel = state.selectedTitles[i] ?? 0;
  const title = d.titles[sel] || d.titles[0] || '';
  const topics = (d.topics || []).map((t) => '#' + t.tag).join(' ');
  return `${title}\n\n${d.body}\n\n${topics}\n${CTA_TEXT}`;
}

function allNotesText() {
  return state.notes.map((_, i) => `—— 第 ${i + 1} 篇 ——\n\n${currentAllText(i)}`).join('\n\n\n');
}

/* ---------------- 历史 ---------------- */

async function loadHistory() {
  const r = await fetch('/api/history');
  const { list } = await r.json();
  const el = $('#historyList');
  if (!list.length) {
    el.innerHTML = '<p style="color:var(--text-3);font-size:13px">还没有记录</p>';
    return;
  }
  el.innerHTML = list.map((it) => {
    const p = it.params || {};
    const notes = it.notes || (it.result ? [it.result] : []);
    const first = notes[0]?.titles?.[0];
    const t = (typeof first === 'object' ? first?.tag : first) || '(无标题)';
    const time = new Date(it.createdAt).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return `<div class="hist-item" data-id="${it.id}">
      <div class="hist-meta"><span>${time}</span><span class="hist-del" data-del="${it.id}">删除</span></div>
      <div class="hist-title">${escapeHtml(t)}${notes.length > 1 ? ` <span style="color:var(--text-3);font-size:11.5px">共 ${notes.length} 篇</span>` : ''}</div>
      <div class="hist-tags">${escapeHtml([p.term, p.grade, p.volume, p.subject, p.materialType].filter(Boolean).join(' · '))}</div>
    </div>`;
  }).join('');

  el.querySelectorAll('.hist-item').forEach((node) => {
    node.onclick = async (e) => {
      if (e.target.dataset.del) {
        await fetch(`/api/history?id=${e.target.dataset.del}`, { method: 'DELETE' });
        loadHistory();
        return;
      }
      const id = node.dataset.id;
      const item = list.find((x) => x.id === id);
      if (!item) return;
      const p = item.params || {};
      $('#grade').value = p.grade || '';
      $('#subject').value = p.subject || '';
      $('#volume').value = p.volume || '上册';
      $('#term').value = p.term || '';
      $('#materialType').value = p.materialType || '';
      $('#highlights').value = p.highlights || '';
      $('#catalog').value = p.catalog || '';
      $('#extra').value = p.extra || '';
      $('#count').value = notes.length || 1;
      setNotes(notes);
      closeDrawers();
      toast('已载入该条记录');
    };
  });
}

/* ---------------- 事件绑定 ---------------- */

/**
 * 原生 datalist 会按输入框当前值过滤候选项：框里已填「四年级」时，点开下拉只剩「四年级」一项，
 * 无法重新选择。这里在点击输入框时临时清空 value，让下拉始终列出全部候选；原值改用灰色
 * placeholder 回显，避免「框被清空」的突兀感。若用户没选新值就离开，则自动还原原值。
 * 清空与还原都是程序赋值，不会触发 input 事件，因此不影响「年级/学科 → 册次候选」等联动。
 */
function enableFullDatalist(input) {
  if (!input || input._fullListBound) return;
  input._fullListBound = true;
  const ORIG_PH = input.placeholder || '';

  const stash = () => {
    if (!input.value.trim()) return;        // 本来为空，直接展示全部候选
    input._prevValue = input.value;
    input.placeholder = input.value;        // 灰色回显原值
    input.value = '';
  };
  const restore = () => {
    if (input._prevValue != null) {
      if (!input.value.trim()) input.value = input._prevValue;   // 未选新值 → 还原
      input._prevValue = null;
    }
    input.placeholder = ORIG_PH;
  };

  input.addEventListener('mousedown', stash);        // mousedown 早于 focus 与候选展开
  input.addEventListener('keydown', (e) => {         // 键盘唤起候选时同样清空
    if (e.key === 'ArrowDown' && input.value.trim()) stash();
  });
  input.addEventListener('blur', restore);
}

/**
 * 给输入框挂一个「历史记录下拉」：输入过的内容自动记住，下次点开即可直接选用；
 * 每条右侧有 × 可单独删除，底部可一键清空。数据存 localStorage，刷新/重开浏览器依然在。
 * 之所以不用原生 datalist，是因为原生下拉无法在候选上放删除按钮。
 */
function attachHistoryDropdown(input, storageKey, opts) {
  if (!input || input._histBound) return;
  input._histBound = true;
  const MAX = (opts && opts.max) || 50;        // 最多保留条数
  const MAXLEN = (opts && opts.maxLen) || 400; // 单条过长不入库（多为误粘贴）

  let list = [];
  try { list = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { list = []; }
  if (!Array.isArray(list)) list = [];
  list = list.filter((t) => typeof t === 'string' && t.trim());
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch {} };

  // 结构：wrap > (input + panel)，wrap 提供定位上下文
  const wrap = document.createElement('div');
  wrap.className = 'hist-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const panel = document.createElement('div');
  panel.className = 'hist-panel hidden';
  wrap.appendChild(panel);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render() {
    if (!list.length) {
      panel.innerHTML = '<div class="hist-empty">暂无记录，输入内容后会自动保存到这里</div>';
      return;
    }
    panel.innerHTML =
      list.map((t, i) =>
        `<div class="hist-item" data-i="${i}" title="点击选用">` +
          `<span class="hist-text">${esc(t)}</span>` +
          `<button class="hist-del" data-del="${i}" title="删除这条">×</button>` +
        `</div>`).join('') +
      '<div class="hist-foot"><button class="hist-clear">清空全部</button></div>';
  }

  const open = () => { render(); panel.classList.remove('hidden'); };
  const close = () => panel.classList.add('hidden');

  function remember(v) {
    const val = String(v || '').trim();
    if (!val || val.length > MAXLEN) return;
    const i = list.indexOf(val);
    if (i >= 0) list.splice(i, 1);   // 已存在则提到最前
    list.unshift(val);
    if (list.length > MAX) list.length = MAX;
    persist();
  }

  input.addEventListener('focus', open);
  input.addEventListener('click', open);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.blur(); }
    else if (e.key === 'Enter') close();
  });
  input.addEventListener('blur', () => {
    // 延后执行：让面板上的点击先处理完，再收起并保存
    setTimeout(() => { close(); remember(input.value); }, 120);
  });

  // 面板内按下鼠标不夺焦，避免 input 先 blur 导致点击落空
  panel.addEventListener('mousedown', (e) => e.preventDefault());
  panel.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {                                   // 删除单条
      list.splice(Number(del.dataset.del), 1);
      persist(); render();
      return;
    }
    if (e.target.closest('.hist-clear')) {       // 清空全部
      list = []; persist(); render();
      return;
    }
    const item = e.target.closest('.hist-item');
    if (item) {                                  // 选用这条
      const chosen = list[Number(item.dataset.i)] || '';
      remember(input.value);                     // 先把当前手输内容也存下
      input.value = chosen;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      close();
    }
  });
}

function bind() {
  fillOptions();
  loadConfig();
  loadOptions();

  // 点击任意带 datalist 的输入框，都列出全部候选供重新选择
  document.querySelectorAll('input[list]').forEach(enableFullDatalist);

  // 资料亮点：记住输入过的内容，可下拉选用 / 单条删除 / 清空
  attachHistoryDropdown($('#highlights'), 'xhs_highlights_history_v1');

  $('#temperature').oninput = (e) => { $('#tempVal').textContent = e.target.value; };

  // 学科变化时，教材版本的候选建议同步切换（科学/数学/英语的版本体系完全不同）
  $('#subject').oninput = (e) => {
    fillVersionOptions(e.target.value);
    fillVolumeOptions($('#grade').value, e.target.value);
  };
  fillVersionOptions($('#subject').value);

  // 年级变化时，册次候选整批切换（小学初中是上下册，高中是必修系列，命名体系完全不同）
  $('#grade').oninput = (e) => fillVolumeOptions(e.target.value, $('#subject').value);
  fillVolumeOptions($('#grade').value, $('#subject').value, true);
  if (!$('#volume').value.trim()) $('#volume').value = volumesFor($('#grade').value, $('#subject').value)[0];

  $('#btnGenerate').onclick = generate;

  $('#btnGenCatalog').onclick = async () => {
    const btn = $('#btnGenCatalog');
    const st = $('#catalogState');
    const grade = $('#grade').value.trim();
    const subject = $('#subject').value.trim();
    if (!grade || !subject) {
      st.textContent = '请先填年级和学科';
      st.className = 'catalog-state err';
      return;
    }
    btn.disabled = true;
    st.textContent = '正在生成目录…';
    st.className = 'catalog-state';
    try {
      const r = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          subject,
          volume: $('#volume').value,
          version: $('#textbookVersion').value,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || '生成失败');
      $('#catalog').value = j.catalog;
      if (j.verified) {
        const conf = j.confidence || 'high';
        let msg = '';
        let cls = 'catalog-state ok';
        if (conf === 'low') {
          msg = `⚠ 库内已收录但置信度低（${j.version}），发布前必须对照实体书核对`;
          cls = 'catalog-state err';
        } else if (conf === 'medium') {
          msg = `△ 已收录（${j.version}），来源为二手教辅站／个别信息待核，建议对照实体书`;
          cls = 'catalog-state warn';
        } else {
          msg = `✓ 已核实目录（${j.version}，${j.verifiedAt} 核对），可手动修改`;
        }
        if (j.autoPicked && j.availableVersions?.length > 1) {
          msg += `｜库里还有 ${j.availableVersions.join('、')}，换版本请手动填`;
        }
        st.textContent = msg;
        st.className = cls;
      } else {
        st.textContent = '⚠ 模型生成，未经核实——发布前务必对照教材核对';
        st.className = 'catalog-state err';
      }
    } catch (e) {
      st.textContent = e.message;
      st.className = 'catalog-state err';
    } finally {
      btn.disabled = false;
    }
  };

  $('#btnResetTpl').onclick = () => {
    $('#template').value = state.defaultTemplate;
    $('#tplState').textContent = '已恢复默认模板，记得点保存';
  };

  $('#btnSaveTpl').onclick = async () => {
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: $('#template').value }),
    });
    const j = await r.json();
    $('#tplState').textContent = j.ok ? '模板已保存' : '保存失败';
    $('#tplState').className = j.ok ? 'tpl-state' : 'tpl-state bad';
  };

  $('#btnPreview').onclick = () => {
    const p = collectParams();
    $('#previewText').textContent = fillTemplateLocal($('#template').value, p);
    openDrawer('#drawerPreview');
  };

  $('#btnCopyPrompt').onclick = () => copyText($('#previewText').textContent, '提示词已复制');

  $('#btnCopyAll').onclick = () =>
    copyText(currentAllText(), state.notes.length > 1 ? `第 ${state.current + 1} 篇已复制` : '整篇已复制');

  $('#btnCopyEvery').onclick = () => {
    if (!state.notes.length) return toast('还没有生成内容');
    copyText(allNotesText(), `全部 ${state.notes.length} 篇已复制`);
  };

  $('#btnSaveHistory').onclick = async () => {
    if (!state.notes.length) return toast('还没有生成内容');
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params: state.params, notes: state.notes }),
    });
    toast('已存入历史');
  };

  $('#btnHistory').onclick = () => { loadHistory(); openDrawer('#drawerHistory'); };
  $('#btnSettings').onclick = () => openDrawer('#drawerSettings');
  $('#mask').onclick = closeDrawers;
  document.querySelectorAll('.close-drawer').forEach((b) => { b.onclick = closeDrawers; });

  $('#btnClearHistory').onclick = async () => {
    if (!confirm('确定清空全部历史记录？')) return;
    await fetch('/api/history', { method: 'DELETE' });
    loadHistory();
  };

  $('#btnSaveSettings').onclick = async () => {
    const body = {};
    const key = $('#apiKey').value.trim();
    const model = $('#model').value.trim();
    if (key) body.apiKey = key;
    if (model) body.model = model;
    const r = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    $('#setState').textContent = j.ok ? '已保存，刷新页面生效' : '保存失败';
    $('#setState').className = j.ok ? 'tpl-state' : 'tpl-state bad';
    if (j.ok) { $('#apiKey').value = ''; loadConfig(); }
  };

  $('#btnSaveOptions').onclick = async () => {
    const options = {
      terms: $('#optTerms').value.split('\n'),
      materials: $('#optMaterials').value.split('\n'),
      grades: $('#optGrades').value.split('\n'),
      subjects: $('#optSubjects').value.split('\n'),
    };
    const r = await fetch('/api/options', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ options }),
    });
    const j = await r.json();
    if (j.ok) {
      fillOptions(j.options);
      $('#optState').textContent = '候选已保存';
      $('#optState').className = 'tpl-state';
      toast('候选已保存');
    } else {
      $('#optState').textContent = '保存失败';
      $('#optState').className = 'tpl-state bad';
    }
  };

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
    if (e.key === 'Escape') closeDrawers();
  });
}

bind();
