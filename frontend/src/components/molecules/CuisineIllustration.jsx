const drawings = {
  plate: 'M17 19h30v22H17z M21 24h22 M24 28v9m8-9v9m8-9v9 M9 18v30m-4-30v9h8V18 M53 18v30m0-30c9 4 9 13 0 14',
  noodles: 'M10 30h44c-2 17-10 22-22 22S12 47 10 30Z M8 30h48 M23 25V14m8 11V11m8 14V9 M18 17 50 5 M20 22 54 12',
  grill: 'M10 22h44v24H10z M17 46v7m30-7v7 M16 28h32m-32 6h32m-32 6h32 M22 16c-5-5 5-5 0-10m10 10c-5-5 5-5 0-10m10 10c-5-5 5-5 0-10',
  pizza: 'M12 15Q32 2 52 15L32 55Z M15 21q17-10 34 0 M23 24a3 3 0 1 0 0 .1 M36 25a3 3 0 1 0 0 .1 M30 37a3 3 0 1 0 0 .1',
  dumpling: 'M8 38Q32-5 56 38Q32 59 8 38Z M8 38l9-4-1-9 10 3 6-11 6 11 10-3-1 9 9 4 M18 47h28',
  bowl: 'M9 30h46c-3 18-12 20-23 20S12 48 9 30Z M7 30h50 M22 24c-9-8 9-9 0-17m11 17c-9-8 9-9 0-17m11 17c-9-8 9-9 0-17 M23 54h18',
  taco: 'M7 45C9 7 55 7 57 45H7Z M14 40c4-23 32-23 36 0 M13 25l5-8 8 2 6-8 8 8 8-2 5 8 M22 32l3 2m10-7 3 2m3 8 3 2',
  burger: 'M11 27c0-23 42-23 42 0H11Z M8 33h48l-9 6-8-5-8 6-10-6-13 4 M10 44h44v5c-2 8-42 8-44 0Z M23 17h1m8-3h1m8 4h1',
  croissant: 'M7 27 17 21 24 11h16l7 10 10 6-3 17-10 8-5-12H25l-5 12-10-8Z M17 21l8 19m-1-29 4 29m12-29-4 29m11-19-8 19',
  olive: 'M16 54Q38 38 41 10 M27 43C8 43 8 26 27 33Z M34 31C49 32 55 15 39 21Z M38 21C24 20 24 7 40 12Z M17 48c-10 2-12-8-5-10s12 5 5 10',
}

export default function CuisineIllustration({ type, className = '' }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={drawings[type] || drawings.plate} /></svg>
}
