# Real Source Trial Notes

This file records source-backed smoke trials without committing generated lesson content from private or copyrighted material.

## 2026-04-30 Agentic Design Patterns PDF

Source:

```text
/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf
```

Command shape:

```bash
node --import tsx - <<'EOF'
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LearnerProjectService } from './tools/agent-runtime/learner/learner-project-service.ts';
import { QuickPreviewService } from './tools/agent-runtime/learner/quick-preview-service.ts';

const sourcePath = '/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf';
const root = await mkdtemp(path.join(tmpdir(), 'learning-agent-real-source-'));
await new LearnerProjectService(root).createProject({
  request: `请用 ${sourcePath} 这本书生成中文学习材料，面向有编程基础但缺少智能体系统心智模型的中文学习者，每个单元 8 页。`,
  runId: 'real-agentic-design'
});
const result = await new QuickPreviewService(root).generate({ runId: 'real-agentic-design', maxSteps: 80 });
console.log(JSON.stringify(result, null, 2));
EOF
```

Result summary:

```json
{
  "status": "preview_ready",
  "runId": "real-agentic-design",
  "preview": {
    "devCommand": "npm run dev",
    "localUrl": "http://127.0.0.1:5173/"
  }
}
```

Auto-approved internal gates included `source-map`, `concept-map`, `curriculum-plan`, child `learning-architecture`, child `lesson`, child `critic-report`, and child `publish-package`.

Generated files were written under a temporary workspace, not this repository, so no private source-derived lesson content is committed.

## 2026-04-30 Codex-authored source-grounded bundle trial

Source:

```text
/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf
```

Command shape:

```bash
node --import tsx - <<'EOF'
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodexAuthoredTrialService } from './tools/agent-runtime/learner/codex-authored-trial.ts';

const sourcePath = '/Users/dm/Documents/1.书籍资料/BOOKS/Agentic_Design_Patterns.pdf';
const root = await mkdtemp(path.join(tmpdir(), 'codex-authored-real-trial-'));
const result = await new CodexAuthoredTrialService(root).runTrial({
  runId: 'codex-agentic-design',
  sourcePath,
  sourceKind: 'book',
  audience: '有编程基础但缺少智能体系统心智模型的中文学习者',
  unitPages: 8
});
console.log(JSON.stringify(result, null, 2));
EOF
```

Result summary:

```json
{
  "status": "preview_ready",
  "runId": "codex-agentic-design",
  "coursePackId": "codex-agentic-design",
  "preview": {
    "devCommand": "npm run dev",
    "localUrl": "http://127.0.0.1:5173/"
  }
}
```

Acceptance notes:

- The generated lesson included lesson-level `sourceContext.sourceAnchorIds`.
- Each page included page-level `sourceAnchorIds`, so the Web Deck can render learner-facing source evidence chips.
- The course pack and lesson were written under a temporary workspace only.
