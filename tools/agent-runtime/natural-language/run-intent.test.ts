import { describe, expect, test } from "vitest";

import { parseRunIntent } from "./run-intent.js";

describe("parseRunIntent", () => {
  test("maps a Chinese book course request into a source-backed run intent", () => {
    const intent = parseRunIntent(
      "用 \"examples/sources/agent-workflow-notes.md\" 这本书生成一套中文课程：先做总览课，再按核心 topic 拆课。每个单元 10 页，面向有基础编程经验但没建立系统心智模型的中文学习者。"
    );

    expect(intent.source).toMatchObject({
      type: "file",
      value: "examples/sources/agent-workflow-notes.md",
      kind: "book"
    });
    expect(intent.language).toBe("zh-CN");
    expect(intent.unitPages).toBe(10);
    expect(intent.strategy).toBe("overview_plus_topic");
    expect(intent.planningMode).toBe("topic_guided");
    expect(intent.adapter).toBe("codex");
    expect(intent.audience).toBe("有基础编程经验但没建立系统心智模型的中文学习者");
  });

  test("maps chapter-guided paper requests", () => {
    const intent = parseRunIntent(
      "请把 /tmp/papers/retrieval-study.pdf 这篇论文按章节生成中文学习材料，每个单元 8 页，面向研究生。"
    );

    expect(intent.source.type).toBe("file");
    expect(intent.source.kind).toBe("paper");
    expect(intent.unitPages).toBe(8);
    expect(intent.strategy).toBe("chapter_guided");
    expect(intent.planningMode).toBe("chapter_guided");
    expect(intent.audience).toBe("研究生");
  });

  test("maps patent and blog source kinds from Chinese wording", () => {
    const patentIntent = parseRunIntent("基于 /tmp/patents/cache-system.txt 这份专利做技术机制课，每个单元 12 页。");
    const blogIntent = parseRunIntent("用 https://example.com/blog/rag-workflow 这篇博客生成总览课和核心 topic 课，每个单元 6 页。");

    expect(patentIntent.source.kind).toBe("patent");
    expect(patentIntent.source.type).toBe("file");
    expect(patentIntent.unitPages).toBe(12);

    expect(blogIntent.source.kind).toBe("blog");
    expect(blogIntent.source.type).toBe("url");
    expect(blogIntent.strategy).toBe("overview_plus_topic");
  });

  test("falls back to a topic intent when no file or url is present", () => {
    const intent = parseRunIntent("用哈希表生成 8 页中文课，面向有基础编程经验的学习者，教学难度为本科核心课程。");

    expect(intent.source).toEqual({
      type: "topic",
      value: "哈希表",
      kind: "unknown"
    });
    expect(intent.unitPages).toBe(8);
    expect(intent.audience).toBe("有基础编程经验的学习者");
    expect(intent.difficultyLevel).toBe("undergraduate_core");
  });

  test("maps professor lecture deck requests into course intent", () => {
    const intent = parseRunIntent(
      "请把 /tmp/book.pdf 这本书生成教授式中文 Web Deck，像大学课程 PPT 一样组织，每个单元 10 页，面向研究生。"
    );

    expect(intent.courseIntent).toBe("professor_lecture_deck");
  });
});
