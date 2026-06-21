// Hazel — chocolate cavoodle logo mark + wordmark lockup.
// Three colour variants by background: `dark` (on Kennel surfaces),
// `light` (on cream/marketing) and `icon` (on the chocolate app tile).

export const HAZEL_TONES = {
  dark: { coat: "#6A4529", coat2: "#46301E", beard: "#D9C3A1", nose: "#4A2E1E", eye: "#241710" },
  light: { coat: "#48311F", coat2: "#311E11", beard: "#E0CBA6", nose: "#2C1B0F", eye: "#1E1108" },
  icon: { coat: "#8A5E38", coat2: "#5A3A22", beard: "#EAD6B2", nose: "#42281A", eye: "#241710" },
} as const;

export type HazelVariant = keyof typeof HAZEL_TONES;

export function HazelMark({
  variant = "dark",
  size = 32,
  className = "",
}: {
  variant?: HazelVariant;
  size?: number;
  className?: string;
}) {
  const t = HAZEL_TONES[variant] ?? HAZEL_TONES.dark;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Hazel">
      <path d="M44,38 C31,35 21,46 22,61 C23,74 33,75 45,67 Z" fill={t.coat} />
      <path d="M76,38 C89,35 99,46 98,61 C97,74 87,75 75,67 Z" fill={t.coat} />
      <path d="M40,44 C33,43 28,50 29,59 C30,67 36,67 43,61 Z" fill={t.coat2} opacity=".5" />
      <path d="M80,44 C87,43 92,50 91,59 C90,67 84,67 77,61 Z" fill={t.coat2} opacity=".5" />
      <path
        d="M36,61 C35,47 37,39 42,36 Q45,30 50,36 Q55,29 60,36 Q65,29 70,36 Q75,30 78,36 C83,39 85,47 84,61 C83,81 72,91 60,92 C48,91 37,81 36,61 Z"
        fill={t.coat}
      />
      <path d="M54,75 Q60,73.5 66,75 Q68,83 60,87 Q52,83 54,75 Z" fill={t.beard} />
      <ellipse cx="60" cy="67" rx="5.6" ry="4.4" fill={t.nose} />
      <circle cx="50" cy="55" r="4.1" fill={t.eye} />
      <circle cx="70" cy="55" r="4.1" fill={t.eye} />
      <circle cx="51.3" cy="53.7" r="1.1" fill="#FFF" opacity=".8" />
      <circle cx="71.3" cy="53.7" r="1.1" fill="#FFF" opacity=".8" />
    </svg>
  );
}

// The header lockup: mark + lowercase "hazel" wordmark (Nunito 900, cream).
export function HazelLogo({
  size = 32,
  variant = "dark",
  className = "",
}: {
  size?: number;
  variant?: HazelVariant;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <HazelMark variant={variant} size={size} />
      <span
        className="font-wordmark text-slate-200"
        style={{ fontWeight: 900, fontSize: size * 0.62, letterSpacing: "-0.02em", lineHeight: 1 }}
      >
        hazel
      </span>
    </span>
  );
}
