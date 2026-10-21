import { useState, type InputHTMLAttributes } from 'react'
import { inputClass } from './ui'

/**
 * A number field that keeps what you type (so "12," or "" while editing works) and reports a number.
 * `scale` 100 turns kronor into whole öre for money fields; scale 1 keeps decimals (quantities, percent).
 */
export function NumberInput({
  value, onValueChange, scale = 1, className, ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: number; onValueChange: (value: number) => void; scale?: number }) {
  const toValue = (text: string) => (scale === 1 ? parse(text) : Math.round(parse(text) * scale))
  const shown = (v: number) => (v === 0 ? '' : String(Number((v / scale).toFixed(4))))
  const [text, setText] = useState(shown(value))
  const [lastValue, setLastValue] = useState(value)

  // Accept outside changes without fighting the user's typing.
  if (value !== lastValue) {
    setLastValue(value)
    if (toValue(text) !== value) setText(shown(value))
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      className={`${inputClass} tabular-nums ${className ?? ''}`}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValueChange(toValue(e.target.value))
      }}
    />
  )
}

function parse(text: string): number {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
