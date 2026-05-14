type PreviewLessonLike = Record<string, unknown> & {
  pages: Array<Record<string, unknown>>;
};

export async function materializePreviewImageAssets<TLesson extends PreviewLessonLike>(
  _workspaceRoot: string,
  _runId: string,
  lessons: TLesson[]
): Promise<TLesson[]> {
  // Image assets are produced by Codex through imagegen before publish.
  // The publisher must not synthesize placeholder SVGs because that hides
  // missing teaching illustrations and leaks template text into the learner UI.
  return lessons;
}
