# Cloudflare 自动部署

推送代码到 `main` 分支后，GitHub Actions 会自动构建并部署到 Cloudflare Workers。

## 前置准备（一次性）

### 1. 创建 Cloudflare 资源

在本地安装 wrangler 并登录后执行：

```bash
npx wrangler login

# 创建 KV 命名空间
npx wrangler kv:namespace create TRIAL_KV
# 把返回的 id 填入 wrangler.toml 的 [[kv_namespaces]] id 字段

# 创建 Vectorize 索引（共享 JD 池用）
npx wrangler vectorize create hunter-ai-jd --dimensions 1536 --metric cosine
```

### 2. 创建 Cloudflare API Token

1. 打开 https://dash.cloudflare.com/profile/api-tokens
2. 点击「Create Token」
3. 选择「Edit Cloudflare Workers」模板
4. Account Resources：选择你的账户
5. 创建后复制 Token（只显示一次）

### 3. 获取 Account ID

在 Cloudflare Dashboard 右侧边栏或 Workers 页面可以看到 Account ID。

### 4. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

**必需（部署用）：**

| Secret 名 | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

**Worker 运行时（Trial 模式 + 共享池用）：**

| Secret 名 | 示例值 | 说明 |
|---|---|---|
| `AI_GATEWAY_PROVIDER` | `deepseek` | Trial AI 提供商 |
| `AI_GATEWAY_API_KEY` | `sk-xxx` | AI 提供商的 API Key |
| `AI_GATEWAY_MODEL` | `deepseek-chat` | 默认模型 |
| `TRIAL_DAILY_QUOTA_PER_IP` | `20` | 每 IP 每日配额 |
| `EMBEDDING_PROVIDER` | `openai` | Embedding 提供商 |
| `EMBEDDING_BASE_URL` | `https://api.openai.com/v1` | Embedding 端点 |
| `EMBEDDING_API_KEY` | `sk-xxx` | Embedding API Key |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding 模型 |

## 部署流程

```
push to main
    ↓
GitHub Actions 触发
    ↓
npm ci → npm run build
    ↓
wrangler deploy（注入 secrets）
    ↓
部署到 https://hunter-ai-worker.<account>.workers.dev
```

## 手动触发部署

在仓库 **Actions** 页面选择「Deploy to Cloudflare」workflow，点击「Run workflow」即可手动触发。

## 本地部署（调试用）

```bash
# 登录 Cloudflare
npx wrangler login

# 本地调试（同时服务前端 + API）
npm run dev:worker

# 手动部署
npm run deploy
```

## 验证部署

部署成功后访问：
- `https://hunter-ai-worker.<account>.workers.dev` — 前端
- `https://hunter-ai-worker.<account>.workers.dev/api/health` — 健康检查

## 故障排查

| 问题 | 解决方案 |
|---|---|
| `wrangler deploy` 报 KV 不存在 | 先执行 `npx wrangler kv:namespace create TRIAL_KV`，把 id 填入 wrangler.toml |
| `wrangler deploy` 报 Vectorize 不存在 | 先执行 `npx wrangler vectorize create hunter-ai-jd --dimensions 1536 --metric cosine` |
| Trial 模式 502 | 检查 `AI_GATEWAY_API_KEY` 是否正确配置为 GitHub Secret |
| Embedding 失败 | 检查 `EMBEDDING_API_KEY` 和 `EMBEDDING_BASE_URL` 配置 |
| 前端能访问但 /api 返回 502 | Worker secrets 未正确注入，检查 GitHub Actions 日志 |
