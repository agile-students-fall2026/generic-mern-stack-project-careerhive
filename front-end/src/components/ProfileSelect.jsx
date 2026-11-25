import { useId } from 'react'

export default function ProfileSelect({ label, name, value, onChange, options }) {
  const id = useId()
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} className="ui-field" name={name} value={value} onChange={onChange}>
        <option value="">Select {label.toLowerCase()}</option>
        {value && !options.some(option => option.value === value) ? <option value={value}>{value}</option> : null}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </>
  )
}
