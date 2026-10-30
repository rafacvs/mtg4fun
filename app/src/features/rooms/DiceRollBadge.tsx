import { useId } from "react";

export function DiceRollBadge({ value }: { value: number }) {
  const shadeId = useId();
  return (
    <svg
      className="dice-result-icon"
      viewBox="0 0 48 52"
      role="img"
      aria-label={`D20: ${value}`}
    >
      <defs>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="currentColor" stopOpacity=".85" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <path
        d="M24 2 45 14v24L24 50 3 38V14Z"
        fill={`url(#${shadeId})`}
        stroke="#cbb47a"
        strokeWidth="1.5"
      />
      <path
        d="m24 2-9 30 9 18 9-18ZM3 14l21 7 21-7M3 38l12-6 18 0 12 6M15 32l9-11 9 11"
        fill="none"
        stroke="#d6c18d"
        strokeOpacity=".65"
        strokeWidth="1"
      />
      <path d="m15 19 18 0 3 15H12Z" fill="#14201d" fillOpacity=".5" />
      <text
        x="24"
        y="32"
        textAnchor="middle"
        fill="#fff3d1"
        fontFamily="Georgia,serif"
        fontSize="17"
        fontWeight="bold"
      >
        {value}
      </text>
    </svg>
  );
}
