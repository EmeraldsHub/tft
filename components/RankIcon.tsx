import Image from "next/image";

type RankIconProps = {
  tier?: string | null;
  size?: number;
};

export function RankIcon({ tier, size = 18 }: RankIconProps) {
  if (!tier) {
    return null;
  }

  const normalized = tier.toUpperCase();
  return (
    <Image
      src={`/ranks/${normalized}.png`}
      alt={`${normalized} rank icon`}
      width={size}
      height={size}
    />
  );
}
