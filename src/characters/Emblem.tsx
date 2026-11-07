// Emblema original que ocupa el hueco de un nivel sin imagen importada.
export function Emblem({ accent, level, size = '100%' }: { accent: string; level: number; size?: string }) {
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} className="stage-emblem" role="img" aria-label={`Emblema del nivel ${level}`}>
      <g className="spin">
        <circle cx="150" cy="150" r="132" fill="none" stroke={accent} strokeOpacity=".25" strokeDasharray="2 7" />
        <path d="M150 18 l5 9 h-10z M150 282 l5 -9 h-10z M18 150 l9 5 v-10z M282 150 l-9 5 v-10z" fill={accent} fillOpacity=".7" />
      </g>
      <circle cx="150" cy="150" r="102" fill="none" stroke={accent} strokeOpacity=".3" strokeWidth="1.5" strokeDasharray="40 14 4 14" />
      <g className="pulse">
        <polygon points="150,78 196,124 196,176 150,222 104,176 104,124" fill="rgba(16,30,50,.85)" stroke={accent} strokeWidth="2" />
        <polygon points="150,100 178,128 178,172 150,200 122,172 122,128" fill="none" stroke={accent} strokeOpacity=".5" />
        <text x="150" y="162" textAnchor="middle" fontSize="34" fontWeight="700" fill={accent} fontFamily="system-ui, sans-serif">
          {level}
        </text>
      </g>
    </svg>
  );
}
