import type { Units } from '../api/types';

interface Props {
  units: Units;
  onChange: (units: Units) => void;
}

export default function UnitsToggle({ units, onChange }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Temperature units">
      {(['imperial', 'metric'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={units === option}
          onClick={() => onChange(option)}
        >
          {option === 'imperial' ? '°F' : '°C'}
        </button>
      ))}
    </div>
  );
}
