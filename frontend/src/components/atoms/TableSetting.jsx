// A place setting seen from above: a gingham tablecloth, a plate, a napkin and cutlery.
// The entry ticket lies on the plate, as if you were sitting at the table. Purely decorative.
export default function TableSetting({ children }) {
  return (
    <div className="dining-table relative overflow-hidden rounded-[28px] px-3 pt-10 pb-14 sm:px-8 lg:px-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="plate" />
        <div className="napkin" />
        <svg viewBox="0 0 34 260" className="cutlery cutlery-fork">
          <path d="M7 4h3v44h3.5V4h3v44h3V4h3v44h3.5V4h3v52c0 8-5 13-10 15v26h-5V71c-5-2-7-7-7-15Z" />
          <rect x="11" y="95" width="11" height="160" rx="5.5" />
        </svg>
        <svg viewBox="0 0 34 260" className="cutlery cutlery-knife">
          <path d="M12 6c9 0 14 11 14 40v76H12Z" />
          <rect x="10.5" y="118" width="14" height="137" rx="7" />
        </svg>
        <svg viewBox="0 0 40 260" className="cutlery cutlery-spoon">
          <ellipse cx="20" cy="36" rx="15" ry="31" />
          <path d="M16 64h8l1 22h-10Z" />
          <rect x="14.5" y="82" width="11" height="173" rx="5.5" />
        </svg>
      </div>
      <div className="relative z-10 mx-auto max-w-2xl">{children}</div>
    </div>
  )
}
