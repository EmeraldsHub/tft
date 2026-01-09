"use client";

import Image from "next/image";
import { useState } from "react";

type TftIconProps = {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  title?: string;
};

export function TftIcon({
  src,
  alt,
  width,
  height,
  className,
  title
}: TftIconProps) {
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
      title={title}
      onError={() => {
        if (!hasErrored) {
          setHasErrored(true);
        }
      }}
    />
  );
}
