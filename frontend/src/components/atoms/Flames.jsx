// Flames along the bottom of a card whose item scored past 10.
// level 1 is 11/10, level 2 is 12/10 (taller, more flames). Purely decorative.
const HEIGHTS = [30, 38, 26, 42, 33, 28, 40, 31, 36, 27, 41, 29, 35]

export default function Flames({ level = 1, className = '' }) {
  const count = level > 1 ? 13 : 9
  const grow = level > 1 ? 1.35 : 1
  return (
    <div aria-hidden="true" className={`flames ${level > 1 ? 'flames-high' : ''} ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="flame"
          style={{
            height: `${Math.round(HEIGHTS[index % HEIGHTS.length] * grow)}px`,
            animationDuration: `${0.85 + (index % 4) * 0.14}s`,
            animationDelay: `${-index * 0.17}s`,
          }}
        />
      ))}
    </div>
  )
}
