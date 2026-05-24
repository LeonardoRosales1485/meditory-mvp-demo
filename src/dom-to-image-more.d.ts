declare module "dom-to-image-more" {
  export function toCanvas(node: HTMLElement, options?: Record<string, unknown>): Promise<HTMLCanvasElement>;
  export function toPng(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
  export function toBlob(node: HTMLElement, options?: Record<string, unknown>): Promise<Blob>;
  export function toPixelData(node: HTMLElement, options?: Record<string, unknown>): Promise<Uint8ClampedArray>;
  export function toSvg(node: HTMLElement, options?: Record<string, unknown>): Promise<SVGSVGElement>;
}
