"use client";

import { useEffect, useState } from "react";
import { TypewriterText } from "@/components/marketing/TypewriterText";

export function HeroDeliveredWord() {
  const [italic, setItalic] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      const reducedTimer = window.setTimeout(() => {
        setItalic(true);
        setAnimate(false);
      }, 0);
      return () => window.clearTimeout(reducedTimer);
    }

    const SWEEP_START_MS = 560;
    const SWEEP_DURATION_MS = 860;
    const startTimer = window.setTimeout(() => setAnimate(true), SWEEP_START_MS);
    const italicTimer = window.setTimeout(() => setItalic(true), SWEEP_START_MS + SWEEP_DURATION_MS);
    const finishTimer = window.setTimeout(
      () => setAnimate(false),
      SWEEP_START_MS + SWEEP_DURATION_MS + 120
    );

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(italicTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  return (
    <span className={`hero-delivered relative inline-flex items-center overflow-hidden ${animate ? "hero-delivered-animate" : ""}`}>
      <span aria-hidden className="hero-send-track pointer-events-none absolute bottom-[0.12em] left-0 right-0 z-10" />
      <span aria-hidden className="hero-send-streak pointer-events-none absolute bottom-[0.08em] left-0 z-20" />
      <span aria-hidden className="hero-send-glow pointer-events-none absolute inset-y-[0.08em] left-0 z-0" />

      <TypewriterText
        text="delivered."
        loop={false}
        className={`hero-delivered-word relative z-30 text-[var(--mk-accent)] ${
          animate ? "hero-delivered-word-morphing" : ""
        } ${italic ? "hero-delivered-word-elegant" : ""}`}
      />

      <style jsx>{`
        .hero-send-track {
          height: 1.5px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(65, 149, 255, 0) 0%,
            rgba(65, 149, 255, 0.18) 18%,
            rgba(65, 149, 255, 0.34) 50%,
            rgba(65, 149, 255, 0.12) 82%,
            rgba(65, 149, 255, 0) 100%
          );
          opacity: 0;
        }

        .hero-send-streak {
          width: 18%;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(65, 149, 255, 0.06) 0%,
            rgba(65, 149, 255, 0.95) 50%,
            rgba(65, 149, 255, 0.1) 100%
          );
          opacity: 0;
          transform: translateX(-120%);
        }

        .hero-send-glow {
          width: 20%;
          border-radius: 999px;
          background: radial-gradient(
            circle at center,
            rgba(65, 149, 255, 0.16) 0%,
            rgba(65, 149, 255, 0.06) 45%,
            rgba(65, 149, 255, 0) 100%
          );
          opacity: 0;
          transform: translateX(-130%);
        }

        .hero-delivered-animate .hero-send-track {
          animation: send-track 0.86s ease-out forwards;
        }

        .hero-delivered-animate .hero-send-streak {
          animation: send-streak 0.86s cubic-bezier(0.25, 0.72, 0.25, 1) forwards;
        }

        .hero-delivered-animate .hero-send-glow {
          animation: send-glow 0.86s cubic-bezier(0.25, 0.72, 0.25, 1) forwards;
        }

        .hero-delivered-word {
          letter-spacing: 0;
          transform: translateY(0) skewX(0deg);
          text-shadow: none;
          transform-origin: 60% 70%;
        }

        .hero-delivered-word-elegant {
          letter-spacing: 0.012em;
          transform: translateY(-0.02em) skewX(-10deg);
          text-shadow: 0 0.015em 0.2em rgba(65, 149, 255, 0.18);
        }

        .hero-delivered-word-morphing {
          animation: word-into-italic 0.86s cubic-bezier(0.25, 0.72, 0.25, 1) forwards;
        }

        @keyframes send-track {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            opacity: 0.35;
          }
        }

        @keyframes send-streak {
          0% {
            opacity: 0;
            transform: translateX(-120%);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(560%);
          }
        }

        @keyframes send-glow {
          0% {
            opacity: 0;
            transform: translateX(-130%);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(600%);
          }
        }

        @keyframes word-into-italic {
          0% {
            letter-spacing: 0;
            transform: translateY(0) skewX(0deg);
            text-shadow: none;
          }
          45% {
            letter-spacing: 0.006em;
            transform: translateY(-0.008em) skewX(-5deg);
            text-shadow: 0 0.012em 0.15em rgba(65, 149, 255, 0.12);
          }
          100% {
            letter-spacing: 0.012em;
            transform: translateY(-0.02em) skewX(-10deg);
            text-shadow: 0 0.015em 0.2em rgba(65, 149, 255, 0.18);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-send-track,
          .hero-send-streak,
          .hero-send-glow {
            opacity: 0 !important;
            animation: none !important;
          }        
        }
      `}</style>
    </span>
  );
}
