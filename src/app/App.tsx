import { coursePackRegistry } from "../course-packs/registry";
import { lessonRegistry } from "../lessons/registry";
import { CourseWorkspace } from "../product/CourseWorkspace";

export function App() {
  return <CourseWorkspace coursePacks={coursePackRegistry} lessons={lessonRegistry} />;
}
