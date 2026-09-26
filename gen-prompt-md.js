#!/usr/bin/env node
/**
 * 把 data/template.txt 导出成可读的 Markdown 文档（通用提示词模板.md）。
 *
 * 为什么要用脚本导出：这份文档以前是手工维护的，很快就和 template.txt 脱节
 * （出现过"文档里还是旧范例、线上已是新规则"的情况）。现在改为从真源一键生成，
 * 模板一改，重跑本脚本即可刷新。
 *
 * 用法：node gen-prompt-md.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'data', 'template.txt');
const OUT = path.join(ROOT, '通用提示词模板.md');

const tpl = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n').trimEnd();

// 动态提取模板里实际用到的占位符，避免文档里的说明和模板对不上
const keys = [...new Set((tpl.match(/\{\{[^}]+\}\}/g) || []).map((s) => s.slice(2, -2).trim()))];
const keyLine = keys.map((k) => '`{{' + k + '}}`').join('、');

const stamp = new Date().toLocaleString('zh-CN', { hour12: false });

const md = `# 小红书笔记生成器 · 通用提示词模板

> 本文件由 \`gen-prompt-md.js\` 从 \`data/template.txt\` 自动导出（导出时间：${stamp}）。
> **请勿直接编辑本文件** —— 要改提示词请改 \`data/template.txt\`（或在页面上改后点「保存模板」），再重跑 \`node gen-prompt-md.js\` 刷新本文档。

> **占位符说明**：模板中的 ${keyLine} 会在生成时自动替换成表单里填写的内容。
> 另外，服务端在拼装提示词时还会在末尾追加一段【本次生成参数（最高优先级）】，把当次选择的年级、册次、学科、教材版本再强约束一遍。

---

${tpl}
`;

fs.writeFileSync(OUT, md, 'utf8');

const lines = md.split('\n').length;
console.log('✅ 已生成 ' + path.basename(OUT));
console.log('   来源：data/template.txt（' + tpl.length + ' 字符）');
console.log('   输出：' + md.length + ' 字符 / ' + lines + ' 行');
console.log('   占位符（' + keys.length + ' 个）：' + keys.join('、'));
