export type ProductRoute = {
  courseId?: string;
  previewRunId?: string;
  unitId?: string;
  pageIndex?: number;
};

export function parseProductRoute(hash: string): ProductRoute {
  const match =
    /^#\/course\/(?<courseId>[a-z0-9-]+)(?:\/unit\/(?<unitId>[a-z0-9-]+))?(?:\/page\/(?<page>[0-9]+))?$/u.exec(hash) ??
    /^#\/preview\/(?<previewRunId>[a-z0-9-]+)(?:\/unit\/(?<unitId>[a-z0-9-]+))?(?:\/page\/(?<page>[0-9]+))?$/u.exec(hash);
  if (!match?.groups) {
    return {};
  }

  return {
    courseId: match.groups.courseId,
    previewRunId: match.groups.previewRunId,
    unitId: match.groups.unitId,
    pageIndex: match.groups.page ? Math.max(0, Number(match.groups.page) - 1) : undefined
  };
}

export function buildProductRoute(route: ProductRoute): string {
  if (route.previewRunId) {
    const unit = route.unitId ? `/unit/${route.unitId}` : "";
    const page = route.pageIndex !== undefined ? `/page/${route.pageIndex + 1}` : "";
    return `#/preview/${route.previewRunId}${unit}${page}`;
  }
  if (!route.courseId) {
    return "#/";
  }
  const unit = route.unitId ? `/unit/${route.unitId}` : "";
  const page = route.pageIndex !== undefined ? `/page/${route.pageIndex + 1}` : "";
  return `#/course/${route.courseId}${unit}${page}`;
}
