import { describe, expect, test } from "vitest";

import {
  courseIntentLabel,
  courseIntentValues,
  defaultCourseIntent,
  inferCourseIntent,
  normalizeCourseIntent
} from "./course-intent.js";

describe("course-intent", () => {
  test("defaults to mental-model Web Decks", () => {
    expect(defaultCourseIntent).toBe("build_mental_model");
    expect(inferCourseIntent("请用 /tmp/book.pdf 生成中文学习材料")).toBe("build_mental_model");
  });

  test("exports canonical course intent values for boundary schemas", () => {
    expect(courseIntentValues).toEqual([
      "build_mental_model",
      "professor_lecture_deck",
      "student_self_study_textbook"
    ]);
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

  test("lets explicit mental-model intent override professor and graduate wording", () => {
    expect(inferCourseIntent("courseIntent=build_mental_model 请做成教授式研究生课程讲义 Web Deck")).toBe("build_mental_model");
  });

  test("infers student self-study textbook wording", () => {
    expect(inferCourseIntent("我不想读完整本书，想看 Web 教材快速掌握核心内容")).toBe(
      "student_self_study_textbook"
    );
    expect(inferCourseIntent("把这本 800 页的书压缩成 80 页一屏式自学教材")).toBe(
      "student_self_study_textbook"
    );
    expect(inferCourseIntent("courseIntent=student_self_study_textbook 请做成教授式难度，但给学生自学")).toBe(
      "student_self_study_textbook"
    );
  });

  test("keeps ordinary graduate difficulty requests as mental-model Web Decks", () => {
    expect(inferCourseIntent("请用 /tmp/book.pdf 生成中文学习材料，教学难度为研究生课程，每个单元 10 页")).toBe(
      "build_mental_model"
    );
    expect(inferCourseIntent("请生成大学课程难度的中文互动学习材料")).toBe("build_mental_model");
  });

  test("prefers explicit normalized course intent over ambiguous wording", () => {
    expect(normalizeCourseIntent("professor_lecture_deck")).toBe("professor_lecture_deck");
    expect(normalizeCourseIntent("build_mental_model")).toBe("build_mental_model");
    expect(normalizeCourseIntent("student_self_study_textbook")).toBe("student_self_study_textbook");
    expect(normalizeCourseIntent("unknown")).toBeUndefined();
  });

  test("labels course intents for learner-facing Chinese text", () => {
    expect(courseIntentLabel("build_mental_model")).toBe("互动学习课");
    expect(courseIntentLabel("professor_lecture_deck")).toBe("教师/课堂 Web Deck");
    expect(courseIntentLabel("student_self_study_textbook")).toBe("学生自学 Web 教材");
  });
});
