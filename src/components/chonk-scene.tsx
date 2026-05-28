import { motion, type MotionProps } from "framer-motion";
import { motions, type SceneItem } from "../lib/chonk";

function toResponsiveStyle(item: SceneItem): React.CSSProperties {
  const {
    x,
    y,
    size,
    z,
    anchorX = "center",
    anchorY = "center",
  } = item.layout;

  const style: React.CSSProperties = {
    position: "absolute",
    width: `clamp(96px, ${size}vw, 1000px)`,
    zIndex: z ?? 1,
    ...item.style,
  };

  if (anchorX === "left") style.left = `${x}%`;
  else if (anchorX === "right") style.right = `${x}%`;
  else style.left = `${x}%`;

  if (anchorY === "top") style.top = `${y}%`;
  else if (anchorY === "bottom") style.bottom = `${y}%`;
  else style.top = `${y}%`;

  const baseTranslateX = anchorX === "center" ? "-50%" : "0";
  const baseTranslateY = anchorY === "center" ? "-50%" : "0";
  style.transform = `translate(${baseTranslateX}, ${baseTranslateY})`;

  return style;
}

function resolveMotion(item: SceneItem, duration: number) {
  if (item.motion) {
    return item.motion;
  }

  if (!item.motionKey) {
    return undefined;
  }

  const motionFactory = motions[item.motionKey] as (
    ...args: any[]
  ) => MotionProps;

  return motionFactory(duration);
}

export default function ChonkScene({
  items,
  sceneKey,
  duration,
}: {
  items: SceneItem[];
  sceneKey?: string;
  duration: number;
}) {
  return (
    <div className="fixed inset-0 z-10 overflow-hidden pointer-events-none">
      <motion.div className="relative h-full w-full" {...motions.fade()}>
        {items.map((item, i) => {
          const image = (
            <img
              src={item.src}
              className="h-auto w-full object-contain"
            />
          );

          const hasOrbit = item.layout.orbitX || item.layout.orbitY;
          const content = hasOrbit ? (
            <div
              style={{
                transform: `translate(${item.layout.orbitX ?? "0px"}, ${item.layout.orbitY ?? "0px"})`,
              }}
            >
              {image}
            </div>
          ) : (
            image
          );

          const motionProps = resolveMotion(item, duration);

          if (motionProps) {
            return (
              <div key={`${sceneKey ?? "scene"}-${item.src}-${i}`} style={toResponsiveStyle(item)}>
                <motion.div
                  {...motionProps}
                >
                  {content}
                </motion.div>
              </div>
            );
          }

          return (
            <div key={`${sceneKey ?? "scene"}-${item.src}-${i}`} style={toResponsiveStyle(item)}>
              {content}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
