import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Photo from '../atoms/Photo.jsx'
import { api } from '../../lib/api.js'

// Pick one friend (someone you follow who follows you back) to co-author a review with you.
export default function CoauthorPicker({ selectedId, onSelect, disabled = false }) {
  const [friends, setFriends] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api('/api/profiles/friends')
      .then((data) => active && setFriends(data.friends))
      .catch((failure) => active && setError(failure.message))
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <p role="alert" className="text-xs text-brand">
        {error}
      </p>
    )
  }
  if (!friends) {
    return (
      <p role="status" className="text-xs text-muted">
        Finding your friends…
      </p>
    )
  }
  if (!friends.length) {
    return (
      <p className="text-xs leading-6 text-muted">
        Co-reviews are for friends: people you follow who follow you back.{' '}
        <Link to="/friends" className="text-accent underline underline-offset-4">
          Find your friends →
        </Link>
      </p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Choose a friend to co-author with">
      {friends.map((friend) => {
        const selected = friend.id === selectedId
        return (
          <li key={friend.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : friend)}
              className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs transition-colors disabled:opacity-50 ${
                selected ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-card hover:border-brand'
              }`}
            >
              <Photo
                id={friend.avatarId}
                alt=""
                fallback={friend.name.slice(0, 1)}
                className="size-7 rounded-full text-sm"
              />
              <span className="max-w-32 truncate">{friend.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
