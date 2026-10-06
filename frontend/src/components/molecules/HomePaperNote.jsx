// A small illustrated menu slip, drawn in the same ink and paper as the catalog.
export default function HomePaperNote() {
  return (
    <aside className="home-menu" aria-label="A little food inspiration">
      <span className="home-menu-tape" aria-hidden="true" />
      <span className="home-menu-clip" aria-hidden="true" />
      <div className="home-menu-art" aria-hidden="true">
        <svg viewBox="0 0 180 120" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="87" cy="75" rx="46" ry="30" fill="var(--color-sidebar)" stroke="none" />
          <ellipse cx="86" cy="72" rx="44" ry="29" />
          <ellipse cx="86" cy="72" rx="35" ry="21" />
          <path d="M62 75c5-18 38-26 49-7-9 13-34 19-49 7Z" fill="var(--color-box-orange)" fillOpacity=".45" />
          <path d="m68 72 27-10M74 79l29-12M81 81l23-8" />
          <path d="M85 53c-8-2-13-8-12-16 8 0 14 7 12 16Zm1-1c-1-9 4-15 13-16 0 8-5 15-13 16Z" fill="var(--color-box-mint)" />
          <path d="m29 49 1 49M22 46v17c0 8 14 8 14 0V46M29 45v19M146 45c-9 6-11 21-4 25l-1 29M147 45l-1 54" />
          <path d="m122 23 1 9m-5-4 9-1M48 30l2 6m-5-2 7-2M121 98l2 7m-5-2 8-3" stroke="var(--color-accent)" />
          <path d="M75 22c-6-6 6-9 0-15M94 24c-6-6 6-10 0-15" stroke="var(--color-muted)" />
        </svg>
      </div>
      <div className="home-menu-copy">
        <p className="text-[9px] uppercase tracking-[0.18em] text-muted">On today’s menu</p>
        <p className="mt-2 font-serif text-[28px] italic leading-tight text-brand">A little<br className="hidden lg:block" /> good taste.</p>
        <p className="home-menu-footer mt-4 border-t border-dashed border-line pt-3 text-[9px] uppercase leading-5 tracking-wider text-muted">Try something. Keep the memory.</p>
      </div>
    </aside>
  )
}
