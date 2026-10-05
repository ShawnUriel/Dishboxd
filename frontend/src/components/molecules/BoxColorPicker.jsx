import { BOX_PRESETS, MORE_SWATCHES, boxHex } from '../../lib/colors.js'

const SWATCHES = [...BOX_PRESETS, ...MORE_SWATCHES.map((swatch) => ({ ...swatch, hex: swatch.value }))]

// The box's colour: one of the swatches, or any colour from the picker
export default function BoxColorPicker({ value, onChange }) {
  const custom = !SWATCHES.some((swatch) => swatch.value === value)
  return (
    <fieldset>
      <legend className="text-xs font-medium">Box colour</legend>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {SWATCHES.map((swatch) => {
          const selected = swatch.value === value
          return (
            <button
              key={swatch.value}
              type="button"
              aria-pressed={selected}
              aria-label={swatch.label}
              title={swatch.label}
              onClick={() => onChange(swatch.value)}
              style={{ background: swatch.hex }}
              className={`size-9 rounded-full border-2 transition-transform hover:scale-110 ${
                selected ? 'border-ink ring-2 ring-ink/25 ring-offset-2 ring-offset-card' : 'border-white shadow-[0_1px_3px_#2b282340]'
              }`}
            />
          )
        })}
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs ${custom ? 'border-ink' : 'border-line'}`}
        >
          <input
            type="color"
            value={boxHex(value)}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          Any colour
        </label>
      </div>
    </fieldset>
  )
}
