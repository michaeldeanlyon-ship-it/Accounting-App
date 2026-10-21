import { HOUR_OPTIONS, MINUTE_OPTIONS, splitMinutes, toMinutes } from '../domain/duration'
import { inputClass } from './ui'

/** Hours and minutes as two dropdowns. Value and onChange are whole minutes. */
export function DurationPicker({ minutes, onChange, compact }: { minutes: number; onChange: (minutes: number) => void; compact?: boolean }) {
  const { hours, minutes: mins } = splitMinutes(Math.max(0, minutes))
  const hourOptions = hours > 24 ? [...HOUR_OPTIONS, hours] : HOUR_OPTIONS
  const minuteOptions = MINUTE_OPTIONS.includes(mins) ? MINUTE_OPTIONS : [...MINUTE_OPTIONS, mins].sort((a, b) => a - b)
  const select = `${inputClass} ${compact ? 'w-[5.75rem] pl-2 pr-1' : 'w-28'}`
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Hours" className={select} value={hours} onChange={(e) => onChange(toMinutes(Number(e.target.value), mins))}>
        {hourOptions.map((h) => <option key={h} value={h}>{h} h</option>)}
      </select>
      <select aria-label="Minutes" className={select} value={mins} onChange={(e) => onChange(toMinutes(hours, Number(e.target.value)))}>
        {minuteOptions.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')} min</option>)}
      </select>
    </div>
  )
}
