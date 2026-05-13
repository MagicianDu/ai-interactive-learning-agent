import { describe, expect, test } from "vitest";

import { evaluateProfessorLectureRubric } from "./professor-lecture-rubric.js";
import { publishableLessonFixture } from "./test-fixtures.js";

describe("professor lecture rubric", () => {
  test("passes a professor-level textbook deck with nodes, links, examples, boundaries, and summary", () => {
    const lesson = publishableLessonFixture({ id: "professor-rich", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      feedbackSpec: undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题、覆盖边界。先修要求：理解基本 agent、prompt 和 workflow。"
          : index === 1
            ? "知识节点：概念地图、方法谱系和理论结构。"
          : index === 2
              ? "核心定义：定义、正式术语和最小判别条件。"
          : index === 3
                ? "关键链路：从输入状态到工具调用，再到观察和评估。"
          : index === 4
                  ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
          : index === 5
                    ? "方法比较：taxonomy、权衡、适用边界和反例。"
          : index === 6
                      ? "边界案例：相邻场景、保留条件和断裂条件。"
                      : "总结图：三条总结要点和下一单元衔接。"
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
      expect.arrayContaining(["course_framing", "worked_example", "key_link", "boundary_case"])
    );
  });

  test("requires prerequisites and definitions as independent textbook moves", () => {
    const lesson = publishableLessonFixture({ id: "professor-missing-separate-moves", targetPageCount: 8 });
    lesson.pages = lesson.pages.map((page, index) => ({
      ...page,
      interactionSpec: undefined,
      narrative:
        index === 0
          ? "本讲定位：核心问题和覆盖边界。"
          : index === 1
            ? "知识节点：方法谱系和理论结构。"
          : index === 2
              ? "关键链路：比较 planning、tool use、reflection 的适用条件。"
          : index === 3
                ? "经典例题：用一个 agent orchestration case analysis 展开推导。"
          : index === 4
                  ? "方法比较：taxonomy、权衡、适用边界和反例。"
          : index === 5
                    ? "边界案例：相邻场景、保留条件和断裂条件。"
          : index === 6
                      ? "应用案例：具体场景和判断依据。"
                      : "总结图：三条总结要点和下一单元衔接。"
    }));

    const result = evaluateProfessorLectureRubric([lesson]);

    expect(result.status).toBe("warning");
    expect(result.missingMoves.map((move) => move.id)).toEqual(
      expect.arrayContaining(["prerequisites", "definitions"])
    );
  });
});
