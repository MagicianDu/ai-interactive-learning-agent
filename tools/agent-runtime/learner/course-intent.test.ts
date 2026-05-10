import { describe, expect, test } from "vitest";

import { courseIntentLabel, defaultCourseIntent, inferCourseIntent, normalizeCourseIntent } from "./course-intent.js";

describe("course-intent", () => {
  test("defaults to mental-model Web Decks", () => {
    expect(defaultCourseIntent).toBe("build_mental_model");
    expect(inferCourseIntent("请用 /tmp/book.pdf 生成中文学习材料")).toBe("build_mental_model");
  });

  test("infers professor lecture Web Deck wording from Chinese and English requests", () => {
    expect(inferCourseIntent("请生成像大学教授 PPT 一样的中文 Web Deck，帮助我快速掌握课程核心内容")).toBe(
      "professor_lecture_deck"
    );
    expect(inferCourseIntent("turn this book into graduate lecture slides, but keep the output as a web deck")).toBe(
      "professor_lecture_deck"
    );
    expect(inferCourseIntent("请做成研究生课程讲义，包含概念框架、经典例题和课后阅读路径")).toBe("professor_lecture_deck");
  });

  test("prefers explicit normalized course intent over ambiguous wording", () => {
    expect(normalizeCourseIntent("professor_lecture_deck")).toBe("professor_lecture_deck");
    expect(normalizeCourseIntent("build_mental_model")).toBe("build_mental_model");
    expect(normalizeCourseIntent("unknown")).toBeUndefined();
  });

  test("labels course intents for learner-facing Chinese text", () => {
    expect(courseIntentLabel("build_mental_model")).toBe("互动学习课");
    expect(courseIntentLabel("professor_lecture_deck")).toBe("教授式课程讲义 Web Deck");
  });
});
