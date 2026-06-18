"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type HeroBanner = {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
};

type Props = {
  banners: HeroBanner[];
};

const HERO_BG = "/images/hero-home.png";

const defaultSlides: HeroBanner[] = [
  {
    id: "default",
    title: "Beli Tiket Event & Konser dengan Mudah",
    subtitle: "Konser, festival, workshop — aman, cepat, dan terpercaya.",
    image_url: HERO_BG,
    link_url: "/events",
  },
];

export function HeroCarousel({ banners }: Props) {
  const slides = banners.length > 0 ? banners : defaultSlides;
  const [active, setActive] = useState(0);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(next, 7000);
    return () => clearInterval(id);
  }, [slides.length, next]);

  const slide = slides[active];

  return (
    <section className="relative overflow-hidden bg-slate-950">
      {/* Background layers for crossfade */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== active}
        >
          {s.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image_url} alt="" className="h-full w-full object-cover object-center" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={HERO_BG} alt="" className="h-full w-full object-cover object-center" />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-linear-to-r from-slate-950/90 via-slate-900/55 to-slate-900/25" />
      <div className="absolute inset-0 bg-linear-to-t from-slate-950/60 via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[260px] max-w-7xl items-center px-4 py-10 sm:min-h-[320px] sm:px-6 sm:py-14 lg:min-h-[380px]">
        <div key={slide.id} className="max-w-xl animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200/80">
            Eventra — #LoKetagihan Event
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.75rem]">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
              {slide.subtitle}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={slide.link_url || "/events"}>
              <Button size="lg" className="shadow-lg shadow-blue-900/25">
                Cari Event
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/20! bg-white/10! text-white! hover:bg-white/20!"
              >
                Daftar
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
