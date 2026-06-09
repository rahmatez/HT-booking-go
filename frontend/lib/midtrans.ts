const IS_PROD = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "";

type SnapCallbacks = {
  onSuccess?: (result: Record<string, string>) => void;
  onPending?: (result: Record<string, string>) => void;
  onError?: (result: Record<string, string>) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: SnapCallbacks) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadMidtransSnap(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.snap) return Promise.resolve();
  if (!CLIENT_KEY) return Promise.reject(new Error("Midtrans client key tidak dikonfigurasi"));

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = IS_PROD
        ? "https://app.midtrans.com/snap/snap.js"
        : "https://app.sandbox.midtrans.com/snap/snap.js";
      script.setAttribute("data-client-key", CLIENT_KEY);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Gagal memuat Midtrans Snap"));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

export function openMidtransSnap(token: string, callbacks: SnapCallbacks) {
  if (!window.snap) {
    throw new Error("Midtrans Snap belum dimuat");
  }
  window.snap.pay(token, callbacks);
}

export function isMidtransConfigured() {
  return !!CLIENT_KEY;
}
