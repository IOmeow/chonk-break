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
  motion?: any;
  motionKey?: "rotate" | "slide";
};

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
};
