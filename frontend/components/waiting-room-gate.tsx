"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export type QueueStatus = "loading" | "disabled" | "idle" | "waiting" | "admitted";

type Props = {
  slug: string;
  onStatusChange: (status: QueueStatus) => void;
};

export function WaitingRoomGate({ slug, onStatusChange }: Props) {
  const [status, setStatus] = useState<QueueStatus>("loading");
  const [token, setToken] = useState("");
  const [position, setPosition] = useState(0);
  const [eta, setEta] = useState(0);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateStatus = (next: QueueStatus) => {
    setStatus(next);
    onStatusChangeRef.current(next);
  };

  useEffect(() => {
    let cancelled = false;

    api
      .getQueueConfig(slug)
      .then((c) => {
        if (cancelled) return;
        if (!c.enabled) {
          updateStatus("disabled");
          return;
        }

        const saved = sessionStorage.getItem(`wr:${slug}`);
        if (saved) {
          return api.getQueueStatus(slug, saved).then((res) => {
            if (cancelled) return;
            if (res.status === "admitted") {
              updateStatus("admitted");
            } else {
              setToken(saved);
              updateStatus("waiting");
              setPosition(res.position || 0);
              setEta(res.estimated_seconds || 0);
            }
          });
        }

        updateStatus("idle");
      })
      .catch(() => {
        if (!cancelled) updateStatus("disabled");
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (status !== "waiting" || !token) return;
    const id = setInterval(async () => {
      try {
        const res = await api.getQueueStatus(slug, token);
        if (res.status === "admitted") {
          sessionStorage.setItem(`wr:${slug}`, token);
          updateStatus("admitted");
        } else {
          setPosition(res.position || 0);
          setEta(res.estimated_seconds || 0);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [status, token, slug]);

  async function join() {
    const res = await api.joinQueue(slug);
    setToken(res.token);
    if (res.status === "admitted") {
      sessionStorage.setItem(`wr:${slug}`, res.token);
      updateStatus("admitted");
    } else {
      updateStatus("waiting");
      setPosition(res.position);
      setEta(res.estimated_seconds);
    }
  }

  if (status === "loading" || status === "disabled" || status === "admitted") {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">
          ⏳
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Antrean Virtual</h3>
          {status === "idle" ? (
            <>
              <p className="mt-1 text-sm text-amber-800">
                Event populer ini menggunakan waiting room. Gabung antrean dulu sebelum memilih tiket.
              </p>
              <button
                type="button"
                onClick={join}
                className="mt-4 rounded-(--radius) bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Gabung Antrean
              </button>
            </>
          ) : (
            <div className="mt-2 text-sm text-amber-900">
              <p className="text-2xl font-bold">#{position}</p>
              <p className="mt-1 text-amber-800">Estimasi tunggu ~{Math.max(1, Math.ceil(eta / 60))} menit</p>
              <p className="mt-2 text-xs text-amber-700">Halaman diperbarui otomatis…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
