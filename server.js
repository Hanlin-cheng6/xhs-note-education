/**
 * 小红书笔记生成器 · 教材/教案/PPT 场景
 * 零依赖 Node 服务（仅用内置模块）
 *   - 静态托管 public/
 *   - POST /api/generate        流式代理 DeepSeek（SSE）
 *   - GET  /api/config          读取运行状态与配置
 *   - POST /api/settings        写入 API Key / 模型到 .env
 *   - GET  /api/history         历史记录
 *   - POST /api/history         保存一条历史
 *   - DELETE /api/history       清空 / 删除单条
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TEMPLATE_FILE = path.join(DATA_DIR, 'template.txt');
const OPTIONS_FILE = path.join(DATA_DIR, 'options.json');
const ENV_FILE = path.join(ROOT, '.env');
const PORT = Number(process.env.PORT || 3000);

/* ---------------- 提示词模板 ---------------- */

const DEFAULT_TEMPLATE = `【角色设定】你是一位深耕小红书教育赛道 3 年以上的资深运营，专注"小学教材配套资料"（课件PPT、教案、练习、知识清单等）赛道，熟悉小红书搜索流量逻辑、关键词布局和社区规范。请根据我提供的信息，生成一篇高搜索曝光、高转化的合规笔记，包含标题、正文、话题三部分。

【输入信息】
- 学期：{{学期}}
- 年级册次：{{年级册次}}
- 学科：{{学科}}
- 资料类型：{{资料类型}}
- 资料亮点：{{资料亮点}}
- 教材目录：{{教材目录}}

## 一、小红书爆款标题要求

请生成 5 个备选标题，严格遵守以下规则：

### （1）长度与差异化（两条都必须满足）
- 长度：目标 18-20 个字符（汉字/标点/emoji/字母/数字各算 1 个），最低不得少于 17。每个标题写成后逐字默数一遍，不足 17 字符的一律补足再输出；超过 20 字符作废重写。5 条都要过这一关。
- 差异化：5 个备选标题必须彼此有实质差异——句式不同、切入角度不同、关键词组合不同；严禁共用同一句式、只替换 emoji 或个别字词（出现即整体重写）。
- 补足长度时按每条自身句式挑选要补的信息（5 条不要都补同一个词）：学期"26秋"、版本"人教版/统编版"、册次范围"全册"、资料细分"课件/教案/练习/知识清单"、场景"开学备课/期末复习/随堂巩固"、人群"道法老师"。补的是实质信息，不是同一个固定后缀。
- emoji 最多 1 个，只作点缀，绝不能成为 5 条之间唯一的区别。
- 合格标题示范（仅示范"17-20 字符 + 5 条句式各不相同"的标准，内容禁止照抄）：
  1. 26秋新版四上道法全册课件+教案+练习卷（20 字符·清单式）
  2. 四上道法备课没头绪？全册课件教案备齐了（19 字符·痛点疑问式）
  3. 道法老师看过来四上全册课件教案练习（17 字符·人群锁定式）
  4. 开学备课四上道法课件教案随堂练习全册（18 字符·场景式）
  5. 四上道法课件教案练习三件套全册打包（17 字符·数字式）

### （2）关键词布局
- 标题前半段（前 8-10 字符）是搜索权重最高的位置，必须直接包含【核心搜索词】，格式为"学期+年级册次+学科简称+资料类型"，如"26秋新四上道法全册课件"。
- 关键词不是热门词，是"用户需求、平台识别和内容定位之间的连接词"：优先选择老师会真实搜索的精准词（如"四上道法课件"），而不是宽泛热词（如"小学资料"）。
- 标题必须同时说清两个点：①是什么资料；②解决什么具体问题或包含什么具体内容，禁止只写"干货分享""好物推荐"这类看不出内容的标题。
- 在长度内尽可能多命中核心关键词（学期/年级册次/学科/册次范围/资料类型），并让 5 个标题覆盖不同的搜索入口（有的主打"课件"、有的主打"教案"、有的主打"复习/期末"），避免 5 条挤在同一组词上。

### （3）标题公式（仅作参考，鼓励改造、混搭与原创）
- 公式A（清单式）：【学期年级学科】+🌈+【资料组合清单】
- 公式B（痛点式）：【核心关键词】+【问题/收益】
- 公式C（人群锁定式）：【人群词】+【关键词】
- 公式D（疑问式）：【关键词】+【怎么办/怎么找/有没有】
- 公式E（数字式）：【数字或套数】+【关键词】+【收益】
- 公式F（节点式）：【时间节点】+【关键词】+【节奏词】
- 公式G（对比式）：【常规做法】vs【本资料的不同】
- 公式H（效果式）：【关键词】+【能省什么/帮到什么】
- 公式I（场景式）：【备课/复习/开学场景】+【关键词】
- 公式J（罗列式）：【关键词】+【内容点A+B+C】
- 公式K（身份共鸣式）：【老师/我们】+【关键词】+【真实体验】
- 公式L（说明书式）：【关键词】+【形态说明，如全套/可编辑/分单元】
- 5 个标题尽量各用一个不同公式，避免全部套同一模板。

### （4）标题禁忌（红线，出现任何一条即重写）
- 禁绝对化/广告法违禁词：最、第一、首选、顶级、全网最全、独家、100%、绝对、万能、必备神器（"最全"为高危词，禁止）。
- 禁虚假承诺词：保过、必考、押题、包你、用了就提分、内部绝密、命题人出品。
- 禁引流词：微信、vx、V、威信、公众号、淘宝、闲鱼、链接在主页、私我、扣1（含一切谐音、拆字、符号变体）。
- 禁诱导互动词：点赞、关注、收藏、转发、刷到就是赚到、不看后悔。
- 禁夸大营销词：震惊、爆款、疯传、血赚、绝绝子、yyds。
- 禁侵权表述：不得宣称"官方原版""教材扫描件""盗版同源"等涉及版权的表述。

## 二、小红书爆款正文要求

请生成正文（300-500字），严格遵守以下规则：

### （1）正文前三行（黄金三行，搜索用户只给 3 秒）
1. 关键词复现——第一句自然重复标题核心词，让用户确认没点错；
2. 人群锁定+问题确认——点名目标人群并说出其痛点，让老师感到"这就是写给我的"；
3. 给出继续看的理由——抛出一个具体收益。
禁止前三行写"大家好""今天给大家分享"等无效铺垫。

### （2）正文主体结构（不包括前三行内容，从第四行开始）
- 用清单格式列出资料内容，每条一行，信息具体可感（禁止编造）。
- 每条清单前面的 emoji 最多 1 个，优先使用 🎈🎯🌈📚✨📖，每次生成随机选择同一个即可，格式如下：

\`\`\`
🎈人教版六上道法备课资料如下：👇👇
- 🎯 00 核对版本
- 🎯 01 课件 ppt+配套教案 + 练习 (多套选择)
- 🎯 02 表格式核心素养教案 (全册一个文档)
\`\`\`

- 教材目录一律以【输入信息】中提供的《教材目录》为准，直接使用，不要另行改写；仅当其标注为「未提供」时，才由你根据【年级册次+学科】自动生成，并遵守以下规则：
  1. 必须援引最新版教材：小学 4-6 年级部分学科已启用改版新教材，生成前先判断该年级该学科当前使用新版还是旧版，一律以最新版目录为准；禁止新旧版本课目混排，禁止凭记忆编造课文名，若无法确认版本须明确说明判断依据。
  2. 展示规则：每一个单元都要展开它下面的课次，不能只展开第一单元、其余只留单元名。单元层级与课次叫法严格沿用《教材目录》原文、按学科各异——语文/道法/历史等是"第N课"，英语是"Unit N"及其下的"Part A / Part B"，数学、科学等按该教材实际称谓；不要自行统一格式或改写叫法。
  3. 格式照此排版（每个单元下面都要列出它的课次）：

\`\`\`
🎈2026秋四上道德与法治目录如下：👇👇
🌈第一单元 我们的班集体
第1课 热爱班集体｜
第2课 选举班委会｜
第3课 协商决定班级事务
🌈第二单元 少年在成长
第4课 我是独特的｜
第5课 生命最宝贵｜
第6课 自我保护，免受伤害
🌈第三单元 生活在信息社会
第7课 神奇的世界｜
第8课 别让它抢走太多｜
第9课 安全文明上网
\`\`\`

- 关键词自然分布：正文中"年级+学科+课件/教案"的组合词出现 2-3 次，变体交替使用，禁止同一句内堆砌。
- 结尾设置一个站内合规的互动钩子：抛一个与教学相关的问题引导评论，为评论区关键词二次强化留口。

### （3）正文语气
- 口语化、像真实老师/资料博主在说话，适当使用"啦、哦、呢"等语气词；分段短，每段不超过 3 行。
- emoji 总量 5-10 个，集中在清单符号位，不要每行都塞。

### （4）正文禁忌（红线，出现任何一条即重写）
- 禁一切站外引流词及其变体：微信、vx、VX、V心、威信、wx、公众号、企鹅号、QQ、淘宝、闲鱼、拼多多、网盘链接、百度云、扫码、二维码、"看主页简介""点击下方链接""私信我领取""评论区扣1发你"——谐音、拼音、拆字、emoji变体同样违规，一律禁止。获取方式只允许引导至平台内合规动作。
- 禁诱导互动/诱导关注词：求关注、点赞收藏、转发给需要的人、关注我持续更新、不迷路、刷到别划走。
- 禁绝对化与虚假承诺词：最全、独家、第一、顶级、必备、包过、必考、押中、提分神器、内部资料、绝密、命题组。
- 禁贩卖焦虑/夸大词：再不买就晚了、熬夜整理、吐血整理、哭晕、错过等一年。
- 禁侵权与违规经营表述：不提"盗版""扫描版教材""破解"，不承诺与教材出版方存在官方合作关系；资料须为原创或已获授权。
- 禁教育类特殊违规：不得暗示可代写作业/代考，不得对教学效果做保证性承诺，不得贬低教材或学校教学。
- 全篇不得出现任何联系方式、价格引导话术。

## 三、小红书话题要求

### （1）数量与结构
- 生成 10 个，按重要性排序。
- 组合公式：2-3 个大流量主话题 + 3-4 个精准细分话题 + 3-4 个长尾需求话题。
- 多篇生成时各篇话题必须互相错开：每一篇至少要有 2-3 个话题是本篇独有、前面几篇都没出现过的；严禁 N 篇共用同一套话题。优先替换长尾话题，其次细分；主话题（学科大盘词）允许适度重复。

### （2）三层话题选词逻辑
- 主话题（2-3个）：学科/学段级，保证进入大流量池。
- 细分话题（3-4个）：与内容强相关的"年级+册次+学科+资料类型"组合，必须与标题、正文核心关键词一致，形成"标题-正文-话题"的关键词闭环。
- 长尾话题（3-4个）：从老师真实搜索场景挖细分词，用于差异化突围。

### （3）选词规则
- 相关性第一，禁止蹭与内容无关的热门话题。
- 优先选择有真实浏览量的存量话题，自创话题不超过 1 个。
- 同一语义词只保留一个。
- 话题内不得出现标点、空格、emoji。

### （4）话题禁忌（红线）
- 禁含引流信息的话题。
- 禁含违禁词的话题：绝对化/虚假表述。
- 禁蹭无关高热话题：明星、娱乐、社会热点。
- 禁灰产类话题：社群导流、分销性质。

## 四、输出格式要求

只输出一个 JSON 对象，不要任何解释文字，不要 markdown 代码块，结构如下：

{
  "notes": [
    {
      "titles": ["标题1", "标题2", "标题3", "标题4", "标题5"],
      "body": "正文全文",
      "topics": [{"tag": "小学道法", "layer": "主话题"}],
      "checklist": [{"item": "无引流词", "ok": true}]
    }
  ]
}

- notes：数组，长度严格等于本次要求的生成篇数，每篇一个元素。
- titles：每篇 5 个备选，每个必须为 17-20 字符（优先写满 20 字符；少于 17 字符作废重写），不要自带字符数标注，前端会自动核算。
- body：完整可直接发布的版本，300-500 字。
- topics：每篇 10 个，按重要性排序；layer 只能是 主话题 / 细分 / 长尾 三者之一；tag 不带 # 号。
- checklist：合规自检表逐项确认，item 为检查项名称，ok 为 true/false。必须包含：无引流词、无绝对化词、无诱导互动词、无侵权表述、5 个标题句式彼此不同、标题长度在 17-20 字符、关键词在标题前半段、前三行含关键词+人群+收益、目录为最新版且仅展开第一单元、话题与正文关键词闭环。
- "点击下方文件链接可以试看课件ppt👇🏻👇🏻" 这句由系统固定添加，你不要输出。

{{补充要求}}`;

/* ---------------- 工具 ---------------- */

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
}

function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

/* 模板是多行文本，不能塞进单行的 .env，单独存文件 */
function readTemplate() {
  ensureFiles();
  try {
    const t = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    return t.trim() ? t : DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

function writeTemplate(text) {
  ensureFiles();
  fs.writeFileSync(TEMPLATE_FILE, String(text || ''), 'utf8');
}

/* 下拉候选的用户自定义项（增量，内置项在前端常量里） */
const EMPTY_OPTIONS = { terms: [], materials: [], grades: [], subjects: [] };

function readOptions() {
  ensureFiles();
  try {
    const o = JSON.parse(fs.readFileSync(OPTIONS_FILE, 'utf8'));
    return { ...EMPTY_OPTIONS, ...o };
  } catch {
    return { ...EMPTY_OPTIONS };
  }
}

function writeOptions(patch) {
  ensureFiles();
  const next = { ...readOptions(), ...patch };
  for (const k of Object.keys(EMPTY_OPTIONS)) {
    next[k] = Array.isArray(next[k]) ? [...new Set(next[k].map((x) => String(x).trim()).filter(Boolean))] : [];
  }
  fs.writeFileSync(OPTIONS_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function writeEnv(patch) {
  // 历史版本把模板写进过 .env，这里把它清掉，避免多行值把 .env 撑坏
  const env = { ...readEnv(), ...patch };
  delete env.TEMPLATE;
  const content = Object.keys(env)
    .map((k) => `${k}=${env[k]}`)
    .join('\n') + '\n';
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
  return env;
}

function getApiKey() {
  return process.env.DEEPSEEK_API_KEY || readEnv().DEEPSEEK_API_KEY || '';
}

function getModel() {
  return process.env.DEEPSEEK_MODEL || readEnv().DEEPSEEK_MODEL || 'deepseek-chat';
}

function readHistory() {
  ensureFiles();
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeHistory(list) {
  ensureFiles();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(list.slice(0, 50), null, 2), 'utf8');
}

function sendJSON(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const target = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(target, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target)] || 'application/octet-stream',
      // 本地工具：禁用静态资源缓存，保证前端改动后刷新即生效（避免用户拿到旧的 app.js / style.css）
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    });
    res.end(buf);
  });
}

/* ---------------- 提示词拼装 ---------------- */

function fillTemplate(template, p, count = 1) {
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
  let out = String(template || DEFAULT_TEMPLATE).replace(/\{\{([^}]+)\}\}/g, (_, k) => {
    const key = k.trim();
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : `{{${key}}}`;
  });

  const n = Math.min(10, Math.max(1, Number(count) || 1));
  if (n > 1) {
    out += `\n\n【本次生成数量】请一次性生成 ${n} 篇完整笔记，notes 数组长度必须为 ${n}。` +
      `这 ${n} 篇必须是「可分别单独发布的不同笔记」，硬性要求：` +
      `① 每篇的 5 个标题都要独立构思，不得与其他篇重复，更不能只换 emoji 或个别字词；` +
      `② 各篇标题采用的公式、切入角度、主打关键词组合要互不相同；` +
      `③ 正文的结构与侧重点也要有区别；` +
      `④ 话题必须错开——每一篇至少要有 2-3 个话题是其他篇没出现过的（优先替换长尾、其次细分话题），不能 ${n} 篇共用同一套话题。` +
      `禁止把同一篇内容复制 ${n} 份、只改几个字充当多篇。`;
  }
  return out;
}

/* ---------------- DeepSeek 流式调用 ---------------- */

async function streamDeepSeek(res, { system, user, temperature = 0.85, maxTokens = 2400 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ error: '未配置 DEEPSEEK_API_KEY' })}\n\n`);
    res.end();
    return;
  }

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: true,
      temperature,
      max_tokens: Math.min(8000, maxTokens),
      // deepseek-flash 是推理模型，思考会耗尽 max_tokens 导致正文为空，必须显式关闭
      thinking: { type: 'disabled' },
    }),
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    res.write(`data: ${JSON.stringify({ error: `DeepSeek ${upstream.status}: ${text.slice(0, 400)}` })}\n\n`);
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        } catch {
          /* 忽略半包 */
        }
      }
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: `上游中断：${e.message}` })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
}

/* 非流式单次调用（目录生成等短任务用）。关闭思考，直接要结果。 */
async function callDeepSeekOnce({ system, user, temperature = 0.3, maxTokens = 1200 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('未配置 DeepSeek Key，请先在右上角设置中填写');
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' },
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    throw new Error(`DeepSeek ${upstream.status}: ${String(data.error?.message || '').slice(0, 200)}`);
  }
  return String(data.choices?.[0]?.message?.content || '').trim();
}

/* ---------------- 路由 ---------------- */

/* ---------------- 已核实教材目录库 ----------------
   模型训练数据有截止时间，新版教材目录它必然不知道（编出旧版甚至瞎编）。
   目录以人工联网核实的静态库为准，未命中才回落模型生成并显式标注「未经核实」。 */

const TB_DIR = path.join(DATA_DIR, 'textbooks');

// 各学科的首选版本（未指定版本时优先命中）
// 各学科的「首选版本序列」：按顺序取第一个在库中存在的版本。
// 用数组而非单值，是因为同一学科的学段差异很大——如英语低年级是「一年级起点」系（人教新起点/外研一起），
// 中高年级才是「三年级起点」系（人教PEP/译林版）；只写单值会导致二年级误命中三起版本。
/* 学科别名归一化：用户口语说法 → 库内文件名的学科前缀 */
const SUBJECT_ALIAS = {
  生物学: '生物', 生物: '生物', 生命科学: '生物',
  道法: '道德与法治', 道德与法治: '道德与法治', 政治: '道德与法治', 思想品德: '道德与法治',
  自然: '科学', 科学: '科学',
  思想政治: '思想政治', 政治与法治: '思想政治',
  // 艺术 / 书法：目录库文件名用简称，索引里叫「艺术·音乐」这种全称，两边都要能命中
  艺术·音乐: '音乐', 音乐: '音乐', 音乐欣赏: '音乐',
  艺术·美术: '美术', 美术: '美术',
  语文·书法练习指导: '书法', 书法: '书法', 书法练习指导: '书法',
  艺术·舞蹈影视戏剧: '艺术·舞蹈影视戏剧', '艺术·舞蹈/影视/戏剧': '艺术·舞蹈影视戏剧',
};

function normalizeSubject(s) {
  const t = String(s || '').trim();
  return SUBJECT_ALIAS[t] || t;
}

/* 年级别名归一化：口语说法 → 库内文件名的年级前缀（库内统一用「七年级」而非「初一」） */
const GRADE_ALIAS = {
  初一: '七年级', 初二: '八年级', 初三: '九年级',
  小学一年级: '一年级', 小学二年级: '二年级', 小学三年级: '三年级',
  小学四年级: '四年级', 小学五年级: '五年级', 小学六年级: '六年级',
  高中一年级: '高一', 高中二年级: '高二', 高中三年级: '高三',
  高中1年级: '高一', 高中2年级: '高二', 高中3年级: '高三',
};
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function normalizeGrade(g) {
  let t = String(g || '').trim().replace(/\s/g, '');
  if (GRADE_ALIAS[t]) return GRADE_ALIAS[t];
  const m = t.match(/^([1-9])年级$/);
  if (m) return CN_NUM[Number(m[1])] + '年级';
  return t;
}

/* 册次归一化：上/上学期 → 上册，下 → 下册，全 → 全一册 */
const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

/* 册次归一化：小学初中为「上册/下册/全一册」，高中为「必修上册 / 必修1 / 必修第一册 /
   选择性必修2」等。两者写法差异极大，统一压成可比对的键，否则高一整学段查不出库。
   必修上册→必修1、必修第一册→必修1、必修一→必修1、选必二→选择性必修2 */
function volumeKey(v) {
  let t = String(v || '').trim();
  if (!t) return '';
  t = t.replace(/[（(][^)）]*[)）]/g, '').replace(/\s+/g, '');
  const isHS = /必修/.test(t);
  t = t.replace(/选必/g, '选择性必修');
  t = t.replace(/第/g, '');
  t = t.replace(new RegExp(`[${CIRCLED}]`, 'g'), (c) => String(CIRCLED.indexOf(c) + 1));
  t = t.replace(/[一二三四五六七八九十]/g, (c) => String(CN_DIGIT[c]));
  if (isHS) {
    t = t.replace(/册/g, '');
    // 高中的「必修上册/下册」与「必修1/2」指同一本书，统一成数字写法
    t = t.replace(/^((?:选择性)?必修)上/, '$11').replace(/^((?:选择性)?必修)下/, '$12');
    return t;
  }
  if (/全/.test(t)) return '全一册';
  if (/下/.test(t)) return '下册';
  if (/上/.test(t)) return '上册';
  return t;
}

/* 仅用于给「库里已有的册次」排序展示：必修在前 / 选择性必修在后，组内按序号或上下中册。
   语文的选择性必修上/中/下若按字典序会排成 上、下、中，必须显式定序。 */
function volumeSortKey(v) {
  const t = String(v || '');
  const group = /选择性/.test(t) ? 1 : (/必修/.test(t) ? 0 : 2);
  let n = 9;
  const ar = t.match(/\d/);
  if (ar) n = Number(ar[0]);
  else {
    const cn = t.match(/[一二三四五六七八九十]/);
    if (cn) n = CN_DIGIT[cn[0]];
    else if (/全/.test(t)) n = 0;
    else if (/上/.test(t)) n = 1;
    else if (/中/.test(t)) n = 2;
    else if (/下/.test(t)) n = 3;
  }
  return group * 100 + n;
}

/* 册次相似度：0 完全相同，1 前缀包含（如「必修1」命中「必修1 分子与细胞」），
   2 上下册与全一册互认（沪科版物理等不分上下册），Infinity 不匹配。
   数字越小越优，用于在多个候选册次里取最佳。 */
function volumeScore(input, candidate) {
  const a = volumeKey(input);
  if (!a) return 0;
  const b = volumeKey(candidate);
  if (a === b) return 0;
  const updown = (x) => x === '上册' || x === '下册';
  if ((updown(a) && b === '全一册') || (a === '全一册' && updown(b))) return 2;
  // 前缀包含只用于必修类（数字序号），避免「上册」误命中「上」之类的短串
  if (/必修/.test(a) && (b.startsWith(a) || a.startsWith(b))) return 1;
  return Infinity;
}

/* 版本别名归一化：库内同一版本在不同批次入库时写法有分歧（如「沪教牛津」「沪教牛津版」
   「沪教牛津上海版」），统一映射到规范名，避免用户选了版本却命中不了。 */
/* 版本别名：只做「同一版本的不同写法」归一（出版社全称、简称、书面名）。
   切勿把不同版本合并——「沪科版」与「沪科版五四制」、「鲁科版」与「鲁教版」、
   「青岛版」与「青岛五四制」、「人教PEP」与「人教PEP一起」在库里都是独立教材，
   合并会导致用户选了版本却拿到另一套章节体系的目录。 */
const VERSION_ALIAS = {
  沪教牛津: '沪教牛津版', 沪教牛津上海版: '沪教牛津版', 牛津上海版: '沪教牛津版',
  沪科粤教: '沪科粤教版', 沪粤版: '沪科粤教版',
  科粤版: '科粤版', 粤教粤科版: '科粤版', 粤科版: '科粤版',
  沪科五四制: '沪科版五四制',
  人教PEP一年级起点: '人教PEP一起',
  人教版PEP: '人教PEP',
  北师大: '北师大版', 人教版化学: '人教版', 教育科学出版社: '教科版',
  上海科学技术出版社: '沪科版', 山东教育出版社: '鲁教版', 山东科学技术出版社: '鲁科版',
  人民教育出版社: '人教版', 江苏凤凰教育出版社: '苏教版', 河北教育出版社: '冀教版',
};

function normalizeVersion(v) {
  const t = String(v || '').trim();
  if (!t) return '';
  return VERSION_ALIAS[t] || t;
}

/* 版本匹配：先精确，再别名归一后相等，最后双向包含（覆盖「教科版」与「教科版(2024)」这类写法） */
function versionMatches(requested, candidate) {
  if (!requested) return false;
  if (requested === candidate) return true;
  const a = normalizeVersion(requested);
  const b = normalizeVersion(candidate);
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

const SUBJECT_TOP_VERSION = {
  科学: ['教科版', '苏教版', '人教版'],
  生物: ['人教版', '北师大版', '苏教版', '苏科版', '浙科版'],
  语文: ['统编版'],
  道德与法治: ['统编版'],
  思想政治: ['统编版'],
  历史: ['统编版'],
  地理: ['人教版', '湘教版', '中图版', '商务星球版', '鲁教版'],
  物理: ['人教版', '沪科版', '苏科版', '北师大版', '教科版', '粤教版', '鲁科版', '沪科粤教版', '沪教版', '鲁教版五四制'],
  化学: ['人教版', '鲁科版', '苏教版', '科粤版', '沪教版', '沪科版', '仁爱版', '北京版'],
  // 英语分「一年级起点」系（人教新起点 / 人教PEP一起 / 外研一起）与「三年级起点」系（人教PEP / 人教版 / 外研版 / 译林版）
  // 初一及以上库内统一写「人教版」，须排在译林版等之前，否则七年级英语会误命中译林版
  英语: ['人教新起点', '人教PEP', '人教版', '外研一起', '外研版', '译林版', '沪教牛津', '重庆大学版'],
  // 高中数学分 A/B 版（库内小学初中写「人教版」、高中写「人教版A版/B版」），A 版最主流须排最前
  数学: ['人教版A版', '人教版B版', '人教版', '北师大版', '苏教版', '西师版', '华东师大版', '湘教版', '鄂教版'],
};

// 版本主流度排序：未指定版本且学科首选版本不存在时的兜底顺序
// 注意：英语「一年级起点」系（人教新起点 / 人教PEP一起 / 外研一起）必须排在「三年级起点」系（译林版 / 人教PEP）之前，
// 否则查一年级英语会命中译林版这类三起教材，而该年级根本没有对应的三起册次。
const VERSION_PRIORITY = [
  '统编版', '人教版A版', '人教版B版', '人教版', '教科版', '北师大版', '苏教版', '西师版', '青岛版', '湘科版',
  '粤教版', '冀教版', '冀人版',
  '人教新起点', '人教PEP一起', '外研一起', '沪教牛津', '沪教牛津2024', '冀教一起',
  '人教PEP', '外研版', '译林版', '科普版', '鲁教版', '浙教版', '闽教版', '陕旅版',
  // 初中新增版本体系
  '华东师大版', '湘教版', '中图版', '商务星球版', '仁爱版', '济南版', '冀少版',
  '沪科版', '沪教版', '苏科版', '沪科粤教版', '晋教版', '星球版',
  // 九年级新增：化学版本体系（化学是九年级起始科目，版本与物理/数学不同）
  '科粤版', '北京版',
  // 高中新增版本体系（鲁科版/浙科版/鄂教版/重庆大学版为高中独有）
  '鲁科版', '浙科版', '鄂教版', '重庆大学版',
  // 五四制体系（鲁教版初中仅四年，九年级为全一册；青岛版/沪科版五四制与六三制章节不同）
  '鲁教版五四制', '沪科版五四制', '青岛五四制',
];

function catalogToText(data) {
  // 所有单元都展开课次。单元层级与课次叫法由数据自身承载、按学科各异：
  // 语文/道法/历史等为「第N课」，英语为「Unit N + Part A/B/C」，数学等按教材实际称谓，不做统一。
  return data.units.map((u) => {
    const lessons = u.lessons?.length ? '\n' + u.lessons.join('\n') : '';
    return u.title + lessons;
  }).join('\n');
}

/* 扫描目录库：版本与册次都不写死，新入库的册自动被发现。
   文件名格式「学科-年级-册次-版本.json」（册次与版本名内不含短横线）。
   匹配顺序：版本优先 → 册次筛选 → 学科首选/主流度排序。
   版本优先是因为：库中某版本可能只存在于「全一册」（如沪科版物理），
   若先按册次筛会把该版本整批滤掉，用户明明指定了版本却拿到别的版本。 */
function findVerifiedCatalog({ grade, volume, subject, version }) {
  let files = [];
  try {
    files = fs.readdirSync(TB_DIR).filter((f) => f.endsWith('.json'));
  } catch { return null; }

  const subj = normalizeSubject(subject);
  const gd = normalizeGrade(grade);
  const basePrefix = `${subj}-${gd}-`;

  const books = [];
  for (const f of files) {
    if (!f.startsWith(basePrefix)) continue;
    const rest = f.slice(basePrefix.length, -5); // 去掉前缀与 .json
    const i = rest.lastIndexOf('-');
    if (i < 0) continue;
    books.push({ volume: rest.slice(0, i), version: rest.slice(i + 1), file: f });
  }
  if (!books.length) return null;

  // 1) 版本优先：先把用户所填版本解析成库内唯一一个版本名，再在该版本内挑册次。
  //    必须先收敛成单一版本，否则「版本→册次」两步筛选会互相拉扯：
  //    例如「八年级物理 + 沪科版」，沪科版在库中只有「全一册」，若允许册次筛选把
  //    「沪科版五四制（上册）」拉进来，用户明确指定的沪科版反而被挤掉，拿到另一套目录。
  let pool = books;
  if (version) {
    const names = [...new Set(books.map((b) => b.version))];
    let chosen = null;
    if (names.includes(version)) {
      chosen = version; // 用户填的就是库内的规范名 → 直接用，不走别名
    } else {
      const hit = names.filter((n) => versionMatches(version, n));
      // 命中多个时取最短名（通常是规范名，如「沪教牛津版」而非「沪教牛津上海版」）
      if (hit.length) chosen = hit.sort((a, b) => a.length - b.length)[0];
    }
    if (chosen) pool = books.filter((b) => b.version === chosen);
  }

  // 2) 册次：作为「加权项」而不是硬过滤。
  //    硬过滤会误伤——人教版九年级物理只有「全一册」，用户按默认的「上册」查询时人教版
  //    会被整批滤掉，反而命中苏科版。改成打分后，学科首选版本的权重高于册次，两级都能兼顾。
  const volScore = (b) => (volume ? volumeScore(volume, b.volume) : 0);
  if (volume && !version) {
    const anyHit = pool.some((b) => volScore(b) !== Infinity);
    if (!anyHit) {
      // 一个册次都对不上：跨体系（用户填上下册、库是高中必修）时忽略册次继续，
      // 同体系则视为「查无此册」，宁可让模型生成也不拿别的册次冒充。
      const dbHS = books.some((b) => /必修/.test(b.volume));
      if (dbHS === /必修/.test(String(volume))) return null;
    }
  }

  // 3) 学科首选序列（权重高）+ 版本主流度 + 册次吻合度（权重低）
  const topKey = Object.keys(SUBJECT_TOP_VERSION).find((k) => subj.includes(k));
  const topList = topKey ? SUBJECT_TOP_VERSION[topKey] : [];
  const rankScore = (b) => {
    const i = topList.findIndex((t) => versionMatches(t, b.version));
    if (i >= 0) return i;
    const j = VERSION_PRIORITY.findIndex((t) => versionMatches(t, b.version));
    return 100 + (j < 0 ? 999 : j);
  };
  const totalScore = (b) => {
    const vs = volScore(b);
    return rankScore(b) * 3 + (vs === Infinity ? 900 : vs);
  };
  // 同名兄弟版本（沪科版 / 沪科版五四制）别名归一后分数相同，必须再比一次，
  // 否则用户在「沪科版」下会拿到五四制的目录（章节体系不同，属实质性错配）。
  const win = [...pool].sort((a, b) => {
    const d = totalScore(a) - totalScore(b);
    if (d) return d;
    if (version) {
      const ea = a.version === version ? 0 : 1;
      const eb = b.version === version ? 0 : 1;
      if (ea !== eb) return ea - eb;
    }
    return a.version.length - b.version.length; // 更短的通常是规范名
  })[0];

  try {
    const data = JSON.parse(fs.readFileSync(path.join(TB_DIR, win.file), 'utf8'));
    // 可选版本按「学科+年级」维度给出（pool 已被收敛到单一版本，用它列不全）
    const allVersions = [...new Set(books.map((b) => b.version))];
    return {
      catalog: catalogToText(data),
      volume: win.volume,
      version: win.version,
      availableVersions: allVersions,
      allVolumes: [...new Set(books.map((b) => b.volume))],
      autoPicked: Boolean(version) ? !versionMatches(version, win.version) : false,
      confidence: data.confidence || '',
      note: data.note || '',
      source: data.source || '',
      edition: data.edition || '',
      verifiedAt: data.verifiedAt || '',
    };
  } catch { return null; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/config') {
    return sendJSON(res, 200, {
      hasKey: Boolean(getApiKey()),
      keyMask: getApiKey() ? getApiKey().slice(0, 6) + '****' + getApiKey().slice(-4) : '',
      model: getModel(),
      template: readTemplate(),
      defaultTemplate: DEFAULT_TEMPLATE,
    });
  }

  if (req.method === 'POST' && pathname === '/api/settings') {
    try {
      const body = await readBody(req);
      const patch = {};
      if (body.apiKey) patch.DEEPSEEK_API_KEY = body.apiKey;
      if (body.model) patch.DEEPSEEK_MODEL = body.model;
      if (typeof body.template === 'string') writeTemplate(body.template);
      if (body.template === null) writeTemplate(DEFAULT_TEMPLATE); // 恢复默认
      writeEnv(patch);
      if (patch.DEEPSEEK_API_KEY) process.env.DEEPSEEK_API_KEY = patch.DEEPSEEK_API_KEY;
      if (patch.DEEPSEEK_MODEL) process.env.DEEPSEEK_MODEL = patch.DEEPSEEK_MODEL;
      return sendJSON(res, 200, { ok: true });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/generate') {
    try {
      const body = await readBody(req);
      const params = body.params || {};
      const count = Math.min(10, Math.max(1, Number(body.count) || 1));
      const prompt = fillTemplate(body.template, params, count);
      const system =
        '你是资深的小红书教育类内容编辑。必须严格按用户要求输出纯 JSON，不输出多余文字，不使用 markdown 代码块。';
      await streamDeepSeek(res, {
        system,
        user: prompt,
        temperature: body.temperature ?? 0.85,
        maxTokens: 1200 + count * 900,
      });
    } catch (e) {
      sendJSON(res, 400, { error: e.message });
    }
    return;
  }

  // 该年级+学科在已核实目录库里实际有哪些册次与版本（前端册次建议据此生成，
  // 避免硬编码建议与库内命名（如「选择性必修1 化学反应原理」）逐渐脱节）
  if (req.method === 'GET' && pathname === '/api/volumes') {
    const u = new URL(req.url, 'http://localhost');
    const grade = normalizeGrade(u.searchParams.get('grade') || '');
    const subject = normalizeSubject(u.searchParams.get('subject') || '');
    if (!grade || !subject) return sendJSON(res, 200, { ok: true, volumes: [], versions: [] });
    let files = [];
    try { files = fs.readdirSync(TB_DIR).filter((f) => f.endsWith('.json')); } catch { /* 库不存在 */ }
    const prefix = `${subject}-${grade}-`;
    const vols = new Set();
    const vers = new Set();
    for (const f of files) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length, -5); // 「册次-版本」
      const i = rest.lastIndexOf('-');
      if (i < 0) continue;
      vols.add(rest.slice(0, i));
      vers.add(rest.slice(i + 1));
    }
    const list = [...vols].sort((a, b) => volumeSortKey(a) - volumeSortKey(b));
    return sendJSON(res, 200, { ok: true, volumes: list, versions: [...vers] });
  }

  if (req.method === 'POST' && pathname === '/api/catalog') {
    try {
      const body = await readBody(req);
      const grade = String(body.grade || '').trim();
      const volume = String(body.volume || '').trim();
      const subject = String(body.subject || '').trim();
      const version = String(body.version || '').trim();
      if (!grade || !subject) {
        return sendJSON(res, 400, { ok: false, error: '请先填写年级和学科' });
      }

      // 1) 优先命中已核实库
      const hit = findVerifiedCatalog({ grade, volume, subject, version });
      if (hit) {
        return sendJSON(res, 200, {
          ok: true,
          catalog: hit.catalog,
          verified: true,
          volume: hit.volume,
          version: hit.version,
          availableVersions: hit.availableVersions,
          allVolumes: hit.allVolumes,
          autoPicked: hit.autoPicked,
          confidence: hit.confidence,
          note: hit.note,
          source: hit.source,
          edition: hit.edition,
          verifiedAt: hit.verifiedAt,
        });
      }

      // 2) 未命中：模型生成，显式标注未经核实
      // 各学科主流版本不同（科学是教科版、英语是PEP/外研版），自动判断时给模型明确锚点
      const MAIN_VERSION = {
        科学: '教科版（教育科学出版社）',
        生物: '人教版',
        语文: '统编版（部编版）',
        道德与法治: '统编版（部编版）',
        思想政治: '统编版（部编版）',
        历史: '统编版（部编版）',
        地理: '人教版 或 湘教版（按使用最广的）',
        物理: '人教版',
        化学: '人教版',
        数学: '人教版',
        英语: '人教PEP 或 外研版（按使用最广的）',
      };
      let hint = '人教版';
      for (const k of Object.keys(MAIN_VERSION)) {
        if (subject.includes(k)) { hint = MAIN_VERSION[k]; break; }
      }
      const verPart = version
        ? `【${version}】`
        : `最新主流版本（该学段学科的最广用版本为 ${hint}，以此为准）`;
      const catalog = await callDeepSeekOnce({
        system: '你是熟悉全国中小学现行教材的教研专家，能准确给出各版本教材的单元目录。只输出目录本身，不要任何解释、编号符号或页码。',
        user: `请给出 ${verPart}《${grade}${volume}${subject}》教材的完整单元目录。要求：\n` +
          '1. 每行一个单元，格式如「第一单元 观察物体」，保留教材真实单元名称；\n' +
          '2. 按教材真实顺序列全所有单元（含整理和复习、总复习等收尾板块，若教材有则列出）；\n' +
          '3. 不确定的版本细节按最主流的现行版本处理，禁止编造页码、课时长度；\n' +
          '4. 不要输出 markdown 列表符号，不要输出任何说明文字。',
        temperature: 0.3,
        maxTokens: 1200,
      });
      if (!catalog) throw new Error('模型未返回目录内容，请重试');
      return sendJSON(res, 200, { ok: true, catalog });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/options') {
    if (req.method === 'GET') return sendJSON(res, 200, { options: readOptions() });
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        return sendJSON(res, 200, { ok: true, options: writeOptions(body.options || {}) });
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: e.message });
      }
    }
  }

  if (pathname === '/api/history') {
    if (req.method === 'GET') return sendJSON(res, 200, { list: readHistory() });
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const list = readHistory();
        const item = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          createdAt: new Date().toISOString(),
          params: body.params || {},
          result: body.result || {},
        };
        list.unshift(item);
        writeHistory(list);
        return sendJSON(res, 200, { ok: true, item });
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: e.message });
      }
    }
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) {
        writeHistory([]);
        return sendJSON(res, 200, { ok: true });
      }
      writeHistory(readHistory().filter((i) => i.id !== id));
      return sendJSON(res, 200, { ok: true });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405).end('method not allowed');
});

ensureFiles();
server.listen(PORT, () => {
  console.log(`\n  小红书笔记生成器已启动  →  http://localhost:${PORT}`);
  console.log(`  ${getApiKey() ? 'DeepSeek Key 已配置' : '未配置 DeepSeek Key，请在页面右上角设置中填写'}\n`);
});
