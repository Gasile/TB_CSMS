import React from "react";

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, className = "", style }) => {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontFamily: "'Material Symbols Outlined'",
        userSelect: "none",
        WebkitUserSelect: "none",
        lineHeight: 1,
        fontWeight: "normal",
        fontStyle: "normal",
        textTransform: "none",
        letterSpacing: "normal",
        wordWrap: "normal",
        whiteSpace: "nowrap",
        direction: "ltr",
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
    >
      {name}
    </span>
  );
};
