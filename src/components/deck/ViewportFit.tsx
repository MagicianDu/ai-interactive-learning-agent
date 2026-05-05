import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type ViewportFitProps = {
  children: ReactNode;
};

type FitRect = {
  height: number;
  width: number;
};

export function calculateViewportScale(container: FitRect, content: FitRect): number {
  if (container.width <= 0 || container.height <= 0 || content.width <= 0 || content.height <= 0) {
    return 1;
  }

  return Math.min(1, container.width / content.width, container.height / content.height);
}

export function ViewportFit({ children }: ViewportFitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      return undefined;
    }

    let frame = 0;
    const scheduleMeasure = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const nextScale = calculateViewportScale(
          {
            height: container.clientHeight,
            width: container.clientWidth
          },
          {
            height: content.scrollHeight,
            width: content.scrollWidth
          }
        );
        setScale((currentScale) => (Math.abs(currentScale - nextScale) > 0.005 ? nextScale : currentScale));
      });
    };

    scheduleMeasure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleMeasure);
      return () => {
        window.removeEventListener("resize", scheduleMeasure);
        if (frame) {
          window.cancelAnimationFrame(frame);
        }
      };
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    observer.observe(content);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      className="h-full min-h-0 overflow-hidden p-2 sm:p-3 lg:p-4"
      data-fit-scale={scale.toFixed(3)}
      data-testid="deck-viewport-fit"
      ref={containerRef}
    >
      <div
        className="origin-top-left"
        ref={contentRef}
        style={{
          transform: `scale(${scale})`,
          width: scale < 1 ? `${100 / scale}%` : "100%"
        }}
      >
        {children}
      </div>
    </div>
  );
}
