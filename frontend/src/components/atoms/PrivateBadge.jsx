import { LockIcon } from './Icon.jsx'

export default function PrivateBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-1 text-[10px] font-medium text-muted"><LockIcon />Private account</span>
}
