import { useOutletContext } from 'react-router-dom'
import type { Person } from '../../domain/person'

/** The person whose page is open, provided by PersonLayout. */
export function usePerson(): Person {
  return useOutletContext<{ person: Person }>().person
}
