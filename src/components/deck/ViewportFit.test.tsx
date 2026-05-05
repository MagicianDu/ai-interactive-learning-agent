import { describe, expect, test } from "vitest";

import { calculateViewportScale } from "./ViewportFit";

describe("calculateViewportScale", () => {
  test("keeps the page at full size when content fits the viewport", () => {
    expect(
      calculateViewportScale(
        { height: 600, width: 900 },
        { height: 540, width: 860 }
      )
    ).toBe(1);
  });

  test("scales by height or width so content is not clipped", () => {
    expect(
      calculateViewportScale(
        { height: 500, width: 900 },
        { height: 1000, width: 900 }
      )
    ).toBe(0.5);

    expect(
      calculateViewportScale(
        { height: 600, width: 500 },
        { height: 600, width: 1000 }
      )
    ).toBe(0.5);
  });
});
