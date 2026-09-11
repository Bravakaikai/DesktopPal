import { nativeImage, NativeImage } from "electron";

// 產生一顆簡單的圓形色塊當作系統匣佔位圖示，之後可換成 Blender 匯出的正式圖示。
export function createTrayIcon(size = 16, color: [number, number, number] = [255, 154, 60]): NativeImage {
  const buffer = Buffer.alloc(size * size * 4);
  const radius = size / 2;
  const [r, g, b] = color;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius + 0.5;
      const dy = y - radius + 0.5;
      const inside = dx * dx + dy * dy <= radius * radius;
      const i = (y * size + x) * 4;
      buffer[i] = r;
      buffer[i + 1] = g;
      buffer[i + 2] = b;
      buffer[i + 3] = inside ? 255 : 0;
    }
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}
