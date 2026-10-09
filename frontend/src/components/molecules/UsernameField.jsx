import { CheckIcon } from '../atoms/Icon.jsx'
import { USERNAME_MAX, USERNAME_SPECIALS, normalizeUsername, usernameChecks } from '../../lib/username.js'

const specialNames = {
  _: 'underscore',
  '.': 'dot',
  '-': 'hyphen',
  '!': 'exclamation mark',
  '?': 'question mark',
  '*': 'asterisk',
  '#': 'hash',
  $: 'dollar sign',
  '&': 'ampersand',
}

// Username input with every rule spelled out underneath. Each rule ticks off as it is met,
// so nobody has to guess why a name was refused. `showRules` can hide the checklist
// (the profile editor shows it only once the username is being changed).
export default function UsernameField({ id, value, onChange, showRules = true, invalid = false, ...inputProps }) {
  const rulesId = `${id}-rules`
  return (
    <div>
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-muted">
        Username
      </label>
      <div className="mt-1 flex items-baseline border-b border-dotted border-muted focus-within:border-solid focus-within:border-brand">
        <span className="font-mono text-base text-muted" aria-hidden="true">
          @
        </span>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(normalizeUsername(event.target.value))}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={showRules ? rulesId : undefined}
          aria-invalid={invalid || undefined}
          className="w-full min-w-0 bg-transparent py-1.5 pl-0.5 font-mono text-base text-ink placeholder:text-faint focus:outline-none"
          {...inputProps}
        />
      </div>
      {showRules && (
        <div id={rulesId} className="mt-3">
          <ul className="space-y-1.5 font-mono text-xs leading-5">
            {usernameChecks(value).map((check) => (
              <li key={check.id} className={`flex items-start gap-2 ${check.ok ? 'text-ink' : 'text-muted'}`}>
                <span
                  className={`mt-0.5 inline-grid size-4 shrink-0 place-items-center rounded-full border [&_svg]:size-3 ${
                    check.ok ? 'border-accent bg-accent text-paper' : 'border-faint'
                  }`}
                  aria-hidden="true"
                >
                  {check.ok && <CheckIcon />}
                </span>
                <span>
                  {check.label}
                  {check.id === 'length' && ` (${value.length}/${USERNAME_MAX})`}
                  <span className="sr-only">{check.ok ? ': done' : ': not yet'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-xs text-muted">Special characters you can use:</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {USERNAME_SPECIALS.map((character) => (
              <li key={character}>
                <kbd
                  className="inline-grid min-w-7 place-items-center rounded border border-line bg-badge px-1.5 py-0.5 font-mono text-sm text-ink"
                  aria-hidden="true"
                >
                  {character}
                </kbd>
                <span className="sr-only">{specialNames[character]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
