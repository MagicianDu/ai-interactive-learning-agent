import { databaseIndexLesson } from "../lessons/database-index/lesson";
import { WebDeckRenderer } from "../renderers/WebDeckRenderer";

export function App() {
  return <WebDeckRenderer lesson={databaseIndexLesson} />;
}
