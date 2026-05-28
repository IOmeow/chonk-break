import { MotionProps } from "framer-motion";

export type ChonkProps = {
  workMinutes: number;
  breakMinutes: number;
  skipMode?: boolean;
};

export type SceneLayout = {
  x: number;
  y: number;
  size: number;
  z?: number;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "center" | "bottom";
  offsetX?: string;
  offsetY?: string;
  orbitX?: string;
  orbitY?: string;
};

export type SceneItem = {
  src: string;
  layout: SceneLayout;
  style?: React.CSSProperties;
  motion?: MotionProps;
  motionKey?: MotionKey;
};

export type MotionKey = keyof typeof motions;

export function getChonkDuration(
  workMinutes: number,
  breakMinutes: number,
) {
  if (breakMinutes >= 20) return 10;
  if (workMinutes >= 60) return 3;
  if (workMinutes <= 15) return 7;
  return 5;
}

export const motions = {
  fade() {
    return {
      initial: {
        opacity: 0,
      },
      animate: {
        opacity: 1,
      },
      exit: {
        opacity: 0,
      },
      transition: {
        duration: 1,
      },
    } as const;
  },
  
  rotate(duration: number) {
    return {
      animate: {
        rotate: 360,
      },
      transition: {
        repeat: Infinity,
        ease: "linear",
        duration,
      },
    } as const;
  },

  slide() {
    return {
      animate: {
        x: [200, 0, 200],
      },
      transition: {
        repeat: Infinity,
        duration: 10,
        ease: "easeInOut",
      },
    } as const;
  },

  zoom(duration = 3, scale = 1.2) {
    return {
      animate: {
        scale: [1, scale, 1],
      },
      transition: {
        repeat: Infinity,
        duration,
        ease: "easeInOut",
      },
    } as const;
  },
};