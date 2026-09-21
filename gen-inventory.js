#!/usr/bin/env node
/**
 * 扫描教材目录库（data/textbooks/*.json），重新生成《教材目录库-已入库清单.md》。
 *
 * 用法：
 *   node gen-inventory.js          # 在项目根目录执行
 *
 * 说明：
 *   - 目录库每次新增/修改 JSON 后，重跑本脚本即可刷新清单；
 *   - 清单会自动统计年级/学科/置信度/核实时间分布，并列出 low 置信度条目与分年级明细；
 *   - 若某文件 JSON 解析失败，会单独列在「解析失败文件」一节，便于修复。
 */
const fs = require('fs');
const BASE = __dirname + '/';
const DIR = BASE + 'data/textbooks/';
const OUT = BASE + '教材目录库-已入库清单.md';

const GRADE_ORDER = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级', '高一', '高二', '高三'];
const SUBJECT_ORDER = ['语文', '数学', '英语', '道德与法治', '思想政治', '历史', '地理', '物理', '化学', '生物', '科学', '信息科技', '劳动', '体育与健康', '音乐', '美术', '艺术', '书法', '俄语', '日语', '法语', '德语'];
const gi = (g) => (GRADE_ORDER.indexOf(g) < 0 ? 99 : GRADE_ORDER.indexOf(g));
const si = (s) => (SUBJECT_ORDER.indexOf(s) < 0 ? 99 : SUBJECT_ORDER.indexOf(s));
const cut = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
const rows = [];
const bad = [];
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(DIR + f, 'utf8'));
    rows.push({
      subject: d.subject || '（未标注）',
      grade: d.grade || '（未标注）',
      volume: d.volume || '（未标注）',
      version: d.version || '（未标注）',
      edition: (d.edition || '').replace(/\s+/g, ' ').trim(),
      confidence: (d.confidence || '未标注').toLowerCase(),
      verifiedAt: d.verifiedAt || '未标注',
    });
  } catch (e) { bad.push(f + ' → ' + e.message); }
}
rows.sort((a, b) => gi(a.grade) - gi(b.grade) || si(a.subject) - si(b.subject) || String(a.version).localeCompare(String(b.version)) || String(a.volume).localeCompare(String(b.volume)));

const total = rows.length;
const byGrade = {};
rows.forEach((r) => { (byGrade[r.grade] = byGrade[r.grade] || []).push(r); });
const byConf = {};
rows.forEach((r) => { byConf[r.confidence] = (byConf[r.confidence] || 0) + 1; });
const byVf = {};
rows.forEach((r) => { byVf[r.verifiedAt] = (byVf[r.verifiedAt] || 0) + 1; });
const today = process.env.INV_DATE || new Date().toISOString().slice(0, 10);

let md = '';
md += '# 教材目录库 · 已入库清单\n\n';
md += `> 统计时间：**${today}** ｜ 当前总计 **${total} 册** ｜ 覆盖 ${Object.keys(byGrade).length} 个年级\n`;
md += '> 文件命名规则：`学科-年级-册次-版本.json`，存放于 `data/textbooks/`。\n';
md += '> 置信度含义：**high** ＝ 出版社官网／国家中小学智慧教育平台／省级教委用书目录等权威来源直接核对；**medium** ＝ 教辅站或百科交叉印证，或版次细节未取到；**low** ＝ 单一来源或存在未确认项，发布前请人工复核。\n';
md += '> ⚠️ 目录库为**服务端实时读取**，新增或修改 JSON 后即刻生效，无需重启服务。\n';
md += '> 本清单由 `gen-inventory.js` 自动生成，目录库有变动后重跑即可刷新。\n\n';

md += '## 一、总览\n\n';
md += '| 年级 | 学科数 | 版本条目数 | 册数 |\n|---|---:|---:|---:|\n';
GRADE_ORDER.concat(Object.keys(byGrade).filter((g) => GRADE_ORDER.indexOf(g) < 0)).forEach((g) => {
  const rs = byGrade[g];
  if (!rs) return;
  md += `| ${g} | ${new Set(rs.map((r) => r.subject)).size} | ${new Set(rs.map((r) => r.subject + '|' + r.version)).size} | ${rs.length} |\n`;
});
md += `| **合计** | — | — | **${total}** |\n\n`;
md += '> 版本条目数 ＝ 学科×版本的组合数；同一版本常有多个册次（上册／下册／全一册），故与册数不等。\n\n';
md += '**置信度分布**：' + ['high', 'medium', 'low', '未标注'].filter((c) => byConf[c]).map((c) => `${c} ${byConf[c]} 册`).join(' ／ ') + '\n\n';
md += '**核实时间分布**：' + Object.keys(byVf).sort().map((v) => `${v}：${byVf[v]} 册`).join(' ／ ') + '\n\n';
md += '**学科分布**（按册数降序）：\n\n| 学科 | 册数 |\n|---|---:|\n';
Object.entries(rows.reduce((a, r) => { a[r.subject] = (a[r.subject] || 0) + 1; return a; }, {}))
  .sort((a, b) => b[1] - a[1]).forEach(([s, n]) => { md += `| ${s} | ${n} |\n`; });
md += '\n';

// 最近一次校审修正记录（人工维护：每次校审后用最新的替换本节内容）
const AUDIT_DATE = '2026-09-21';
const AUDIT_FIXED = [
  ['英语-五年级-上册-人教PEP', '2014版：What\'s he like? / My week / What would you like? + Recycle 1-2', 'Different friends / My feelings / Work and play / Healthy habits / Food we eat / Nature and us + Revision'],
  ['英语-六年级-上册-译林版', '2012课标版：The king\'s new clothes / What a day! / Holiday fun + Project', 'Try your best / Honesty / Great people / Getting together / Keeping it clean / Going green / Old things, new life / Then and now + 2 个 Project'],
  ['英语-五年级-上册-科普版', '2011课标版：Lesson 1 What is she doing? 等 Lesson 结构', '改为 10 个 Unit：Festivals / Activities and habits / Helping hands at home / Using money the right way / Doing the right thing / Healthy living / Helpers / Animals and plants / Homes for people and animals / Revision'],
  ['英语-五年级-上册-陕旅版', '2013版：Get Up on Time / Be Helpful at Home / What\'s Your Favorite Food? / At Table', 'The Mid-Autumn Festival / When Is Your Birthday? / Keep the Room Tidy / How Do You Feel? / We\'re Going to the Park / How Can I Get to the Cinema? / How Much Is It? / What Size Do You Want? + 2 组 Review'],
  ['英语-六年级-上册-闽教版', '旧版：The Olympic Games / Physical Exercises / Food and Health / Buying New Clothes', '改为 4 大单元 × 4 Lesson：Wonderful Sports Events / Healthy Life / Good Manners / Great People'],
  ['英语-六年级-上册-陕旅版', '旧版：It\'s time to play the violin / I\'m healthy / Care for the earth', 'They Were Here Just Now / My Hometown / What Did You Do Last Weekend? / Where Did You Go on Your Holiday? / A Sports Meet / We Had a Good Time / We\'d Like a Plate of Beef / New Year Is Coming + 2 组 Review'],
];
const AUDIT_OK = '冀教版五上（School clubs…）、北师大版五上（Welcoming seasons…）、外研版五上（What\'s on your plate?…）、人教精通版六上（Travelling…）、冀教版六上（Pocket money…）、科学-五年级-上册-青岛五四制。';
const AUDIT_DOUBT = ['物理-九年级-上册-沪教版', '上海市教委《2026年秋季上海市中小学教学用书目录》(2026-08-10) 确认 2026 秋上海全面换新（物理"新版已普及"），但**新版单元目录未取到权威数据**；且该册原数据的"第11–15章"编号体系更接近沪科版，**版本归属存疑**。已保留原目录、置信度置为 low，使用前请以实物课本核对。'];

md += `## 二、最近一次校审修正记录（${AUDIT_DATE}）\n\n`;
md += '对照**电子课本网「2026秋版」专页**、人教社官网、教习网 2026-2027 学年教学资料逐一联网核实。\n\n';
md += `### 已修正为 2026 秋新版（${AUDIT_FIXED.length} 册）\n\n| 册次 | 原（旧版） | 现（2026 秋新版） |\n|---|---|---|\n`;
AUDIT_FIXED.forEach(([n, o, nw]) => { md += `| ${n} | ${o} | ${nw} |\n`; });
md += `\n### 已核实为最新、无需修改（6 册）\n\n${AUDIT_OK}\n\n`;
md += '### 标注存疑、待人工核对（1 册）\n\n| 册次 | 问题 |\n|---|---|\n';
md += `| ${AUDIT_DOUBT[0]} | ${AUDIT_DOUBT[1]} |\n\n`;

const lowRows = rows.filter((r) => r.confidence === 'low');
md += `## 三、置信度 low 条目（共 ${lowRows.length} 册，发布前务必人工复核）\n\n`;
if (lowRows.length) {
  md += '| 册次 | 版次 |\n|---|---|\n';
  lowRows.forEach((r) => { md += `| ${r.grade} · ${r.subject} · ${r.volume} · ${r.version} | ${cut(r.edition, 90)} |\n`; });
} else { md += '（无）\n'; }
md += '\n';

md += '## 四、分年级明细\n\n';
GRADE_ORDER.concat(Object.keys(byGrade).filter((g) => GRADE_ORDER.indexOf(g) < 0)).forEach((g) => {
  const rs = byGrade[g];
  if (!rs) return;
  md += `### ${g}（${new Set(rs.map((r) => r.subject)).size} 学科 · ${rs.length} 册）\n\n`;
  md += '| 学科 | 版本 | 册次 | 版次 | 置信度 |\n|---|---|---|---|---|\n';
  rs.forEach((r) => {
    const conf = r.confidence === 'low' ? '**low**' : r.confidence;
    md += `| ${r.subject} | ${r.version} | ${r.volume} | ${cut(r.edition, 60) || '—'} | ${conf} |\n`;
  });
  md += '\n';
});

if (bad.length) {
  md += '## 五、解析失败文件（需修复）\n\n';
  bad.forEach((b) => { md += `- ${b}\n`; });
  md += '\n';
}

fs.writeFileSync(OUT, md, 'utf8');
console.log('✅ 已生成：' + OUT);
console.log('   总册数: ' + total + ' ｜ 年级数: ' + Object.keys(byGrade).length + ' ｜ 文档字节: ' + Buffer.byteLength(md, 'utf8'));
console.log('   置信度: ' + JSON.stringify(byConf));
console.log('   解析失败: ' + bad.length + (bad.length ? ' → ' + bad.join('; ') : ''));
