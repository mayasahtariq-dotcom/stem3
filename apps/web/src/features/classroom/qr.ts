/**
 * QR scanning with the browser's built-in BarcodeDetector (Chromium/Android).
 * No library is shipped; where the API is missing, the Scan button is hidden
 * and the student types the key (always available).
 */
interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function canScanQr(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function createQrDetector(): Detector {
  const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return new Ctor({ formats: ["qr_code"] });
}
