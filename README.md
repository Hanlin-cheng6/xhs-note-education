# 小红书笔记生成器 · 教材 / 教案 / PPT 场景

输入通用提示词 + 三个关键参数（年级 / 学科 / 册次），自动拼装成完整提示词交给 DeepSeek，输出严格三段：**标题 · 正文 · 话题**。

## 启动

```bash
node server.js          # 或 npm start
# 打开 http://localhost:3000
```

首次使用：点右上角「设置」填 DeepSeek API Key，会写入服务端 `.env`（不会进浏览器缓存）。

## 常驻运行（开机自启 / 崩溃自愈）

```bash
./service.sh install     # 注册到 launchd：登录即启动，进程挂了自动拉起
./service.sh status      # 看状态
./service.sh restart     # 重启
./service.sh logs        # 看日志
./service.sh uninstall   # 取消自启
```

**注意**：`install` 必须在你自己打开的「终端 App」里执行。被其它程序调起的 shell（包括 AI 助手的命令行）不在图形会话里，`launchctl bootstrap` 会报 `Bootstrap failed: 5`，这是系统限制，不是配置问题。

注册内容写在 `com.han.xhs-note.plist`，`KeepAlive=true` + `RunAtLoad=true` + `ThrottleInterval=10`。日志在 `~/Library/Logs/xhs-note.{out,err}.log`。

**端口冲突处理**：`install` 会先清掉占用 3000 的临时进程再注册，避免旧进程和新服务抢端口。

**失效的旧服务**：本机原有的 `com.user.xhsgenerator`（指向 `2026-08-20-11-03-52/xhs-generator`）引用的 node 路径已不存在，长期以退出码 78 反复重启失败，已停用。恢复命令 `./service.sh enable-old`。

## 使用流程

1. 填关键参数：年级、学科、册次（必填），内容类型、补充要求（选填）
2. 「通用提示词模板」区可直接编辑，点「预览拼装结果」确认参数已注入，改完点「保存模板」
3. 点生成（⌘/Ctrl + Enter），流式输出，完成后渲染成三张卡片
4. 标题点选即复制单个，正文 / 话题 / 整篇均可一键复制，可存入历史

当前内置模板 = 「小学教材类小红书笔记生成提示词（完整版）」，含标题 20 字符硬限制、关键词布局、黄金三行、话题三层结构、以及平台合规红线（引流词 / 绝对化词 / 诱导互动 / 侵权表述全部禁掉）。

## 模板占位符

模板中这些变量会在生成时自动替换：

| 变量 | 来源 | 必填 |
|---|---|---|
| `{{年级册次}}` | 年级 + 册次自动拼接，如「四年级上册」 | 是 |
| `{{年级}}` | 年级输入框 | 是 |
| `{{学科}}` | 学科输入框 | 是 |
| `{{册次}}` | 上册 / 下册 / 全一册 | 是 |
| `{{学期}}` | 如 2026秋 / 26秋 | 否 |
| `{{资料类型}}` | 如 全册课件ppt+教案+练习 | 否 |
| `{{资料亮点}}` | 如 多套教案可选、含教学计划进度表 | 否 |
| `{{教材目录}}` | 不给则由模型按最新版教材自动生成，仅展开第一单元 | 否 |
| `{{补充要求}}` | 补充说明输入框 | 否 |

模板保存在 `data/template.txt`（多行文本，不进 `.env`——单行格式存不下模板）；「恢复默认模板」可回滚内置版本。

## 批量生成

「生成篇数」可设 1-10 篇。多篇时后端会在提示词末尾追加一段差异化要求（角度、侧重点、关键词都不能雷同），输出区顶部出现「第 N 篇」标签页，可逐篇查看、单独复制，也能一次性复制全部。

`max_tokens` 按篇数放大：`1200 + N × 900`，上限 8000。若模型输出被截断导致实际篇数少于要求，页面会提示。

## 下拉候选自定义

学期、资料类型、年级、学科的输入框**本身就能手打任意值**；设置面板里另外可以维护下拉建议（每行一个，存 `data/options.json`），保存后追加到内置候选后面并自动去重。

## 输出结构

模型需返回 JSON，前端按此渲染：

```json
{ "notes": [ { "titles": [], "body": "", "topics": [], "checklist": [] } ] }
```

- `notes[]` — 长度等于生成篇数；模型只返回单篇对象时前端也能兼容
- `titles[]` — 5 个备选，**前端自动核算字符数**，超 20 字标红提醒
- `body` — 正文，自动统计字数
- `topics[]` — 10 个，`{tag, layer}`，layer 分「主话题 / 细分 / 长尾」并带颜色标签
- `checklist[]` — 合规自检表，`{item, ok}`，未通过项标红
- 文件引导语「点击下方文件链接可以试看课件ppt👇🏻👇🏻」由前端固定附带，**不交给模型生成**，保证一字不改

## 目录

```
server.js          零依赖 Node 服务（静态托管 + DeepSeek SSE 代理 + 配置/历史持久化）
public/index.html  页面结构
public/style.css   样式
public/app.js      交互、流式读取、输出解析容错
data/history.json  历史记录（最多 50 条，自动生成）
data/template.txt  当前生效的提示词模板（自动生成）
.env               API Key / 模型 / 模板（自动生成，已 gitignore）
```

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config` | 运行状态、Key 掩码、当前模板 |
| POST | `/api/generate` | 流式生成，SSE 返回 `{delta}` / `{error}` / `{done}` |
| POST | `/api/settings` | 写 `apiKey` / `model` / `template` 到 `.env` |
| GET/POST/DELETE | `/api/history` | 历史记录读 / 存 / 删（带 `?id=` 删单条） |

## 输出解析容错

模型不一定老实返回 JSON，`public/app.js` 的 `parseResult` 按四级降级处理：

1. 标准 JSON（含 markdown 围栏剥离）
2. 修复字符串内裸换行后再解析 —— 模型把正文真实换行塞进 JSON 时最常见
3. 正则抓 `titles` / `body` / `topics` 字段
4. 按「标题 / 正文 / 话题」小标题切分纯文本

## 部署到服务器

改端口 `PORT=3010 node server.js`，Nginx 反代时注意关掉缓冲，否则流式会卡住：

```nginx
location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    chunked_transfer_encoding on;
}
```
