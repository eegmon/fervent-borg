import React, { useState, memo } from "react";

function MinecraftAvatarComponent({ name, size = 28, style = {} }) {
  const [error, setError] = useState(false);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...style,
  };

  if (!name || error) {
    return (
      <div
        style={{
          ...containerStyle,
          background: style.background || "var(--primary-amber)",
          border: style.border || "none",
          fontWeight: 800,
          fontSize: size * 0.4,
          color: style.color || "#000",
        }}
      >
        {(name || "?")[0]}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <img
        src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{
          width: size,
          height: size,
          display: "block",
          imageRendering: "pixelated",
        }}
        onError={() => setError(true)}
      />
    </div>
  );
}

const MinecraftAvatar = memo(MinecraftAvatarComponent);
export default MinecraftAvatar;
