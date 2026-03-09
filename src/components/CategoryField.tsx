import { useState } from 'react'

const NEW_CATEGORY = '__new_category__'

type CategoryFieldProps = {
  categories: string[]
  label?: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}

export function CategoryField({
  categories,
  label = 'Categoria',
  onChange,
  placeholder = 'Digite a nova categoria',
  value,
}: CategoryFieldProps) {
  const [customMode, setCustomMode] = useState(() => value.length > 0 && !categories.includes(value))
  const isCustomValue = value.length > 0 && !categories.includes(value)
  const showCustomInput = customMode || isCustomValue

  return (
    <label className="field">
      <span>{label}</span>
      <select
        onChange={(event) => {
          const nextValue = event.target.value

          if (nextValue === NEW_CATEGORY) {
            setCustomMode(true)
            onChange(categories.includes(value) ? '' : value)
            return
          }

          setCustomMode(false)
          onChange(nextValue)
        }}
        value={showCustomInput ? NEW_CATEGORY : value}
      >
        <option disabled value="">
          Selecione uma categoria
        </option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value={NEW_CATEGORY}>Criar nova categoria</option>
      </select>

      {showCustomInput && (
        <input
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={categories.includes(value) ? '' : value}
        />
      )}
    </label>
  )
}
