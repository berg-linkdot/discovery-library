# 新作档案

公开来源的中文产品发现档案。静态 HTML、CSS、JavaScript，零依赖、无需构建，支持 GitHub Pages 项目子路径。

## 功能与内容边界

- 产品搜索、来源筛选、日期范围筛选、按来源帖发布时间倒序排列
- 详情包含用途、人群、创作动机、证据类别、核查范围、限制与公开出处
- 当前数据为 40 个 Hacker News / Show HN 项目；并非全网或当日全部产品
- 日期显示使用 Asia/Shanghai（北京时间），数据中的时间保持 ISO 8601 UTC
- `publishedAt` 是来源帖子时间，不是产品首次上线时间
- `discoveredAt` 是保存的收录批次核查完成时间，不代表首次发现的精确秒数
- 核查状态不代表质量、安全、隐私或合规背书；按条目查看限制
- 无登录、评论、上传、外部 JavaScript、iframe、Cookie、分析追踪或第三方字体
- 浏览器只读取本站公开 JSON；离站链接在新标签页打开并禁止发送 referrer

## 运行与测试

在本目录执行：

```
python3 -m http.server 8765
node --test archive.test.cjs
```

打开 `http://localhost:8765/`。不要用 `file://` 直接打开，因为浏览器会阻止读取 JSON。

## GitHub Pages

所有发布文件放在仓库根目录。GitHub Settings → Pages → Build and deployment：

- Source：Deploy from a branch
- Branch：main
- Folder：/(root)

保留 `.nojekyll`；无需 Actions 工作流。资源和 JSON 均使用相对路径，可部署在 `/discovery-library/`。

## 内容更新

内容与页面分离：只更新 `projects.json` 即可增加或修订记录。站点不会在浏览器自动抓取外部来源。

1. 从公开来源整理记录，只保留下面列出的字段，勿将原始执行日志、私有文档、账户信息或凭据放入仓库
2. 以 `(provider, sourceId)` 去重，使用稳定 `id`；同时检查 `canonicalUrl`，不要仅凭同域名合并不同项目
3. 保留最早的 `discoveredAt`；重新核查后更新 `verification.checkedAt`
4. `count` 等于记录数，`updatedAt` 是最新已完成的核查时间，`projects` 按 `publishedAt` 倒序
5. 运行 `node --test archive.test.cjs`，审阅 `git diff -- projects.json`
6. 仅提交本次数据变更；按仓库权限推送 main 后由 Pages 发布
7. 检查 Pages 部署成功，并确认公开页面的条数与最近核查时间

不要把私有仓库历史、个人记录或不相关文件复制进本公开仓库。自动抓取、定时提交和凭据配置不在当前站点中。

## 数据契约 1.0.0

详尽 JSON Schema 见 `projects.schema.json`。顶层：

```
{ "schemaVersion": "1.0.0", "language": "zh-CN", "updatedAt": "ISO timestamp", "count": 40, "projects": [] }
```

每条记录：

- `id`、`provider`、`source`、`sourceId`：来源无关的稳定标识。当前 `provider` 为 `hacker_news`，`source` 为 `show_hn`
- `title`：展示名
- `url`：产品/演示/官方项目入口；自托管项目可指向仓库
- `canonicalUrl`：规范化 URL，供去重使用
- `sourceUrl`：通用公开出处；`hnUrl` 仅为兼容字段，其他来源可为 null
- `publishedAt`、`discoveredAt`：ISO 时间戳
- `what`、`audience`、`why`：中文编辑摘要，不使用 HTML
- `whySource`：`{status, urls}`；status 为 `author_stated`（作者自述）、`official_stated`（官方自述）、`product_goal_only`（仅产品目标）或 `not_stated`（未明确说明）
- `verification`：`{status, summary, checkedAt}`；status 为 `interactive_demo`（观察到部分演示）、`page_reviewed`（网页核对）、`source_reviewed`（资料核对）或 `limited`（核查受限）
- `caveats`：未实测事项、依赖和限制的字符串列表
- `sources`：`{type, url}` 数组；type 为 `discussion`、`official_site`、`repository` 或 `source_metadata`
- `tags`：可选字符串列表

URL 仅允许无用户名密码的绝对 HTTP(S) 地址。前端使用 `textContent` 渲染外部文本，不解释来源 HTML。客户端校验和测试拒绝危险链接与主要契约错误；JSON Schema 提供更严格的完整字段约束。

### 新来源适配

适配器输出相同契约即可；前端依据 `provider:source` 自动生成筛选项，不依赖 HN 数字 ID。稳定 ID 建议使用 `provider:sourceId`。动机未说明时明确保留未知，不能将产品目标改写成创作者个人经历。破坏性字段变更需提升 schema 主版本并同步前端。

规范化 URL 时可小写协议和主机、删除默认端口及 fragment、移除 `utm_*` / `fbclid` / `gclid`、排序其余 query；保留有意义路径及参数。多个来源提到同一项目，应通过明确规则关联，保留归因。
