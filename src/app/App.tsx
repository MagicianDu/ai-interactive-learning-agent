import { useState } from "react";

import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "../product/CourseWorkspace";
import { ProductHome } from "../product/ProductHome";

type AppSection = "home" | "workspace";

export function App() {
  const [section, setSection] = useState<AppSection>("home");

  if (section === "home") {
    return (
      <ProductHome
        courseCount={coursePackRegistry.length}
        lessonCount={lessonRegistry.length}
        onOpenSamples={() => setSection("workspace")}
        onStart={() => undefined}
      />
    );
  }

  return <CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />;
}
