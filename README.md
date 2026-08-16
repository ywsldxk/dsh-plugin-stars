# DSH Plugin Stars

展示 GitHub 上较受欢迎的 DeepSeek Harness（DSH）插件排行榜。

- [打开可搜索的完整榜单](https://ywsldxk.github.io/dsh-plugin-stars/)
- [在 GitHub 上给本站点 Star](https://github.com/ywsldxk/dsh-plugin-stars)

## 高 Star 插件榜

<!-- RANKING:START -->
正在等待自动刷新数据，请稍后再来查看 Top 20 榜单。
<!-- RANKING:END -->

## 收录规则

- 公开 GitHub 仓库。
- 仓库 topic 包含 `dsh-plugin`。
- 默认最低 100 Star（可通过仓库变量 `MIN_STARS` 调整）。
- 自动排除 fork 与 archived 仓库。
- 仓库名称或描述需符合插件语义，包含英文 `plugin`、`skill`、`extension`、`preset`、`integration`，或中文 `插件`、`技能`、`扩展`、`预设`、`集成` 等关键词。
- 若出现错误收录，可通过仓库变量 `EXCLUDE_REPOS`（逗号分隔的 `owner/repo`）排除。

自动分类不代表人工背书，榜单仅作为检索参考。

## 更新机制

- GitHub Actions 每 30 分钟自动运行一次，也支持手动触发。
- 数据来自 GitHub repository search，单次搜索最多返回 1000 条结果。
- `MIN_STARS` 与 `EXCLUDE_REPOS` 通过仓库变量（repo variables）配置。

## 安全与技术

- 纯静态站点，无 DSH 插件、无后端服务、不向浏览器发送任何 token。
- 所有外部链接均经过 `http:` / `https:` 白名单校验。
