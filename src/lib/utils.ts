import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

async function captureElement(container: HTMLElement): Promise<HTMLCanvasElement> {
  const domtoimage = (await import("dom-to-image-more")) as unknown as {
    toCanvas: (node: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  };
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  return domtoimage.toCanvas(container, { scale });
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const link = document.createElement("a");
  link.download = `${filename.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function downloadChartAsPng(container: HTMLElement, filename: string): Promise<void> {
  const svgEl = container.querySelector<SVGSVGElement>("svg.recharts-surface") ?? container.querySelector<SVGSVGElement>("svg");
  if (svgEl) {
    const rect = svgEl.getBoundingClientRect();
    const width = rect?.width ?? 600;
    const height = rect?.height ?? 300;
    const svgClone = svgEl.cloneNode(true) as SVGSVGElement;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Error al renderizar SVG como imagen"));
      img.src = url;
    });

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el contexto canvas");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    await downloadCanvas(canvas, filename);
    return;
  }

  const canvas = await captureElement(container);
  await downloadCanvas(canvas, filename);
}

export async function downloadElementAsPng(container: HTMLElement, filename: string): Promise<void> {
  const canvas = await captureElement(container);
  await downloadCanvas(canvas, filename);
}
