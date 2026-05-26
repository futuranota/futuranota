export const CUBE_M_SRC = "/uploads/cube-m.png";
export const CUBE_SMALL_SRC = "/uploads/cube-small.png";

export function ObjectIcon({ variant = "md", className = "" }) {
  const src = variant === "sm" ? CUBE_SMALL_SRC : CUBE_M_SRC;
  const sizeClass =
    variant === "sm" ? "obj-icon-img--sm" : variant === "lg" ? "obj-icon-img--lg" : "obj-icon-img--md";
  return (
    <img
      src={src}
      alt=""
      className={`obj-icon-img ${sizeClass}${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}
