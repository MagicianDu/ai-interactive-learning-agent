# Fresh 用户视角手测记录

日期：2026-06-02
目标版本：`beta/2026-06-02-seed`
工作区：`/Users/dm/Documents/the learning agent`

## 结论

通过。当前版本可以作为本地种子用户 beta candidate 推送给 3-10 位技术型用户测试。

## 执行项

### 1. Fresh install

命令：

```bash
npm ci
```

结果：

- 依赖从 `package-lock.json` 成功重建。
- 初次安装发现 2 个 moderate 间接依赖漏洞。
- 已执行 `npm audit fix`，升级 lockfile 中的 `brace-expansion` 和 `ws`。
- 重新 `npm ci` 后 `npm audit --json` 显示 `total=0`。

### 2. 临时 Codex Home 安装

命令：

```bash
CODEX_HOME="$(mktemp -d)" npm run codex:bundle:install
CODEX_HOME="<same temp dir>" npm run codex:mcp:check
```

结果：

- `learningAgent` MCP server 写入临时 `config.toml`。
- 3 个 skills 成功安装到临时 `skills/`：
  - `learning-agent-operator`
  - `source-to-course`
  - `learner-feedback-revision`
- MCP profiles 校验通过：default learner、explicit authoring、explicit operator。

### 3. 完整发布前检查

命令：

```bash
npm run release:check
```

结果：

- `typecheck` 通过。
- `lint` 通过。
- unit tests 通过：90 files / 529 tests。
- regression tests 通过：1 file / 3 tests。
- seed check 通过：source regression 4/4 passed，source evidence 4/4 passed。
- `codex:mcp:check` 通过。
- `smoke:playwright` 通过。

### 4. Fresh publish/revision/export 操作流

在临时 workspace 中通过 `LearningAgentRuntimeTools` 走真实 publish 产物路径：

1. `learning_agent.publish_learning_course`
2. `learning_agent.get_learning_preview`
3. `learning_agent.revise_learning_course`
4. `learning_agent.apply_learning_revision`
5. `learning_agent.get_learning_preview`
6. `learning_agent.export_learning_course`

结果摘要：

```json
{
  "publishedStatus": "preview_ready",
  "qualityStatus": "passed",
  "previewStatus": "preview_ready",
  "previewUrl": "http://127.0.0.1:5173/#/preview/fresh-user-publish-smoke",
  "revisionStatus": "revision_brief_ready",
  "appliedStatus": "revision_applied",
  "changedLessonIds": ["fresh-hash-overview"],
  "refreshedPreviewStatus": "preview_ready",
  "revisionHistoryCount": 1,
  "exportStatus": "export_ready"
}
```

### 5. 浏览器 smoke

命令：

```bash
npm run smoke:playwright
```

结果：

- `[playwright-smoke] passed`

## 观察到的边界

- `generate_grounded_course` 是 deterministic draft 路径，不应当被当成默认用户 publish preview 路径。
- targeted revision 和 export 的用户流程应基于 `publish_learning_course` 生成的 `learning-preview.json`。
- 不可抽取 PDF 会被 source extraction 边界阻断；测试说明中已要求用户改用 OCR 后 PDF、可读文本或公开 URL。

## 推送建议

可以推送给小范围种子用户测试。推荐附带 `docs/runtime/seed-user-beta-test-guide.zh-CN.md`，并要求用户按反馈模板提交结果。
