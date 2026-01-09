"use client";

import Image from "next/image";
import { useState } from "react";

type TftIconProps = {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
};

export function TftIcon({ src, alt, width, height, className }: TftIconProps) {
  const [hasErrored, setHasErrored] = useState(false);

  if (!src || hasErrored) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => {
        if (!hasErrored) {
          setHasErrored(true);
        }
      }}
    />
  );
}
