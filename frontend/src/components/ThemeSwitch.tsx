import { type ThemeChoice, setThemeChoice, useThemeChoice } from '../lib/theme';
import Icon, { type IconName } from './Icon';

const OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Match device', icon: 'device' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export default function ThemeSwitch() {
  const choice = useThemeChoice();
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={choice === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setThemeChoice(option.value)}
        >
          <Icon name={option.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
