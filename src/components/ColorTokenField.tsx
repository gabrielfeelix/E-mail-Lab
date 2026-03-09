type ColorTokenFieldProps = {
  label: string
  onChange: (value: string) => void
  value: string
}

export function ColorTokenField({ label, onChange, value }: ColorTokenFieldProps) {
  const colorValue = value.trim() || '#000000'

  return (
    <label className="field">
      <span>{label}</span>
      <div className="color-token">
        <label className="color-token__swatch" style={{ background: colorValue }}>
          <input
            aria-label={`${label} picker`}
            className="color-token__picker"
            onChange={(event) => onChange(event.target.value)}
            type="color"
            value={colorValue}
          />
        </label>
        <input
          className="color-token__input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="#000000"
          value={value}
        />
      </div>
    </label>
  )
}
