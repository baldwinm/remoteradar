import type { Units } from '../api/types';
import { Seg } from './ui';

interface Props {
  units: Units;
  onChange: (units: Units) => void;
  /** Frosted, for the city sky. */
  glass?: boolean;
}

/** °C or °F. */
export default function UnitsToggle({ units, onChange, glass = false }: Props) {
  return (
    <Seg
      label="Temperature units"
      className={glass ? 'glass' : undefined}
      value={units}
      onChange={onChange}
      options={[
        { value: 'metric', label: '°C' },
        { value: 'imperial', label: '°F' },
      ]}
    />
  );
}
