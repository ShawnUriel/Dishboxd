// A flat, illustrated fire along the bottom of a card whose item scored past 10:
// overlapping tongues in layers (salmon and peach at the back, red and orange in the middle,
// yellow in front), each swaying on its own, with sparks rising out of it.
// level 1 is 11/10, level 2 is 12/10 (a taller strip, so a taller fire). Purely decorative.

// Tongue shapes in a 100 × 140 box, base on the bottom edge, tips curling over
const SHAPES = [
  'M4 140C-2 108 14 92 22 76C30 60 24 42 34 26C40 16 52 10 58 2C52 18 54 30 62 44C72 60 80 76 78 98C77 112 82 126 86 140Z',
  'M0 140C0 112 10 98 20 84C28 72 22 56 30 40C34 50 40 56 44 52C50 44 44 24 52 6C60 26 72 42 72 62C72 74 66 82 70 92C76 86 80 78 80 70C92 86 96 112 92 140Z',
  'M0 140C2 116 18 104 26 92C32 82 30 70 38 58C42 70 50 74 56 68C60 62 58 54 54 46C68 52 80 68 82 86C84 104 92 122 90 140Z',
  'M10 140C6 116 16 100 26 88C38 74 36 54 30 36C28 26 22 18 14 12C30 14 44 26 50 44C56 62 52 80 60 96C66 108 68 124 66 140Z',
]

// The art is 1200 × 200 and is scaled to the strip's height, so narrow cards crop it at the
// sides but never at the top: no tongue is taller than 200.
const WIDTH = 1200
const HEIGHT = 200

// [first x, gap, count, height scales (× 140), colours, opacity, shape order]
const LAYERS = [
  [-46, 60, 22, [1.32, 1.12, 1.24, 1.05, 1.36, 1.16], ['#ffb199', '#ffa86b', '#ff9e83'], 0.78, [0, 1, 3]],
  [-24, 52, 25, [1.02, 0.86, 1.12, 0.94, 0.8, 1.08], ['#ff5e57', '#ff7f3f', '#ff6a4d', '#ff9238'], 0.93, [1, 0, 3, 2]],
  [-6, 46, 28, [0.68, 0.52, 0.74, 0.58, 0.64], ['#ffc94a', '#ffdd57', '#ffb340'], 0.95, [2, 3, 0]],
  [14, 88, 15, [0.34, 0.28, 0.38], ['#fff2a8'], 0.9, [2]],
]

const SPARKS = [
  [12, '#ff7f3f', 0],
  [24, '#ffc94a', 1.1],
  [37, '#ff5e57', 0.5],
  [51, '#ffdd57', 1.7],
  [63, '#ff9238', 0.8],
  [76, '#ffc94a', 2.2],
  [88, '#ff6a4d', 1.4],
]

export default function Flames({ level = 1, className = '' }) {
  return (
    <div aria-hidden="true" className={`flames ${level > 1 ? 'flames-high' : ''} ${className}`}>
      <svg className="flames-art" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" focusable="false">
        {LAYERS.map(([start, gap, count, heights, colours, opacity, shapes], layer) =>
          Array.from({ length: count }, (_, index) => {
            const height = heights[index % heights.length]
            const width = 0.8 + ((index * 7) % 5) * 0.08
            const flip = (index + layer) % 2 === 1
            const x = start + index * gap
            return (
              <g
                key={`${layer}-${index}`}
                transform={`translate(${flip ? x + 100 * width : x} ${HEIGHT - 140 * height}) scale(${flip ? -width : width} ${height})`}
              >
                <path
                  className="flame-tongue"
                  d={SHAPES[shapes[index % shapes.length]]}
                  fill={colours[index % colours.length]}
                  opacity={opacity}
                  style={{
                    animationDuration: `${1.5 + layer * 0.25 + (index % 4) * 0.18}s`,
                    animationDelay: `${-(index * 0.31 + layer * 0.2)}s`,
                  }}
                />
              </g>
            )
          }),
        )}
      </svg>
      {SPARKS.map(([left, colour, delay], index) => (
        <span
          key={left}
          className="flame-spark"
          style={{
            left: `${left}%`,
            background: colour,
            animationDelay: `${-delay}s`,
            animationDuration: `${2.4 + (index % 3) * 0.5}s`,
            '--drift': `${index % 2 ? 10 : -8}px`,
          }}
        />
      ))}
    </div>
  )
}
