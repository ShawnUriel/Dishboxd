// Small uppercase typewriter label ("VISIT HISTORY", "ITEMS", "TOP DISHES")
export default function SectionLabel({ as: Tag = 'h2', children, className = '', ...props }) {
  return (
    <Tag className={`font-mono text-sm uppercase tracking-widest text-muted ${className}`} {...props}>
      {children}
    </Tag>
  )
}
