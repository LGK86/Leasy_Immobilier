'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Feature {
  properties: {
    label: string
    housenumber?: string
    street?: string
    name: string
    postcode: string
    city: string
    context: string
  }
}

interface Props {
  value: string
  onChange: (address: string, city: string, postalCode: string) => void
  placeholder?: string
  className?: string
  required?: boolean
}

export default function AddressAutocomplete({ value, onChange, placeholder, className, required }: Props) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Feature[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 3) { setSuggestions([]); return }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5&type=housenumber`)
        const json = await res.json()
        setSuggestions(json.features ?? [])
        setOpen(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (f: Feature) => {
    const p = f.properties
    const address = p.name
    onChange(address, p.city, p.postcode)
    setQuery(address)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={placeholder ?? '12 rue de la Paix'}
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value, '', '') }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={className}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border border-leasy-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((f, i) => (
            <li
              key={i}
              className={cn('px-3 py-2 text-sm cursor-pointer text-leasy-dark hover:bg-leasy-bg', i > 0 && 'border-t border-leasy-border')}
              onMouseDown={() => select(f)}
            >
              <span className="font-medium">{f.properties.name}</span>
              <span className="text-leasy-muted ml-1">{f.properties.postcode} {f.properties.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
