import { describe, expect, test } from "vitest";

import { evaluateProfessorLectureRubric } from "./professor-lecture-rubric.js";
import { publishableLessonFixture } from "./test-fixtures.js";

describe("professor lecture rubric", () => {
  test("passes a professor-style lecture deck with framing, example, discussion, homework, and takeaway", () => {
    const lesson = publishableLessonFixture({ id: "professor-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      feedbackSpec: undefined,
      narrative:
        index === 0
          ? "课程框架：本讲定位、核心问题、先修要求和学习边界。"
          : index === 1
            ? "概念地图：关键定义、术语、方法谱系和理论结构。"
            : index === 2
              ? "方法结构：比较 planning、tool use、reflection 的适用条件。"
              : index === 3
                ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
                : index === 4
                  ? "方法比较：taxonomy、权衡、适用边界和反例。"
                  : index === 5
                    ? "课堂讨论题：批判一个设计选择并给出参考要点。"
                    : index === 6
                      ? "课后作业：阅读路径、problem set 和 homework。"
                      : "本讲 takeaway：三条复习清单和下一讲衔接。"
    }));

    const result = evaluateProfessorLectureRubric([lesson]);

    expect(result.status).toBe("passed");
    expect(result.missingMoves).toEqual([]);
  });

  test("warns when a professor deck is only a generic chapter summary", () => {
    const lesson = publishableLessonFixture({ id: "professor-summary", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page) => ({
      ...page,
      narrative: "本页总结本章内容，介绍核心概念，帮助学习者理解资料大意。"
    }));

    const result = evaluateProfessorLectureRubric([lesson]);

    expect(result.status).toBe("warning");
    expect(result.missingMoves.map((move) => move.id)).toEqual(
      expect.arrayContaining(["course_framing", "worked_example", "discussion_prompt", "homework_or_reading"])
    );
  });
});
