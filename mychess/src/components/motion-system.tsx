"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";

/** Smooth wheel scrolling on the app's own scroll container, not the window. */
export function SmoothScroll({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  useEffect(() => {
    const wrapper = containerRef.current;
    const content = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !content || reduce) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.13,
      smoothWheel: true,
      wheelMultiplier: 1,
      autoRaf: false,
      // Modals, move lists and other nested scrollers opt out with
      // data-lenis-prevent (documented Lenis pattern).
      prevent: node => node.hasAttribute("data-lenis-prevent"),
    });
    let frame = 0;
    const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
    const onPageShow = () => lenis.resize();
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", onPageShow);
      lenis.destroy();
    };
  }, [containerRef, reduce]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [path, containerRef]);
  return null;
}

/** Thin lime scroll-progress line, spring-smoothed. */
export function ScrollProgress({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 32, restDelta: 0.001 });
  const opacity = useTransform(scrollYProgress, [0, 0.008], [0, 1]);
  return <motion.div className="route-progress" style={{ scaleX, opacity }} aria-hidden="true"/>;
}

/** Route-change feedback: a brief bar that sweeps as new content arrives. */
export function RouteProgress() {
  const path = usePathname();
  const reduce = useReducedMotion();
  if (reduce) return null;
  return <div className="route-sweep" aria-hidden="true"><motion.div
    key={path}
    className="route-sweep-inner"
    initial={{ x: "-100%" }}
    animate={{ x: "290%" }}
    transition={{ duration: .85, ease: [.22, 1, .36, 1] }}
  /></div>;
}

/** Shared-element style highlight for segmented/tab controls. */
export function SegmentedHighlight({ id }: { id: string }) {
  const reduce = useReducedMotion();
  return <motion.span layoutId={id} className="segmented-highlight" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true"/>;
}

/** Staggered entrance for card grids; honors reduced motion. */
export function Stagger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{ hidden: {}, visible: { transition: { staggerChildren: reduce ? 0 : 0.055 } } }}
  >{children}</motion.div>;
}

export function StaggerItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: reduce ? 0 : 14, scale: reduce ? 1 : .985 },
      visible: { opacity: 1, y: 0, scale: 1, transition: { duration: .42, ease: [.22, 1, .36, 1] } },
    }}
  >{children}</motion.div>;
}
