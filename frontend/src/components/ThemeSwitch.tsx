import { type ThemeChoice, setThemeChoice, useThemeChoice } from '../lib/theme';
import Icon, { type IconName } from './Icon';
import { Seg } from './ui';

const OPTIONS: { value: ThemeChoice; label: string; short: string; icon: IconName }[] = [
  { value: 'system', label: 'Match device', short: 'Auto', icon: 'device' },
  { value: 'light', label: 'Light', short: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', short: 'Dark', icon: 'moon' },
];

/** Three icon buttons in the desktop header: match device (the default), light and dark. */
export default function ThemeSwitch() {
  const choice = useThemeChoice();
  return (
    <div className="theme-sw" role="group" aria-label="Theme">
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

/** The same choice with words, for the phone menu. */
export function ThemeSeg() {
  const choice = useThemeChoice();
  return (
    <Seg
      label="Theme"
      value={choice}
      onChange={setThemeChoice}
      options={OPTIONS.map((option) => ({
        value: option.value,
        label: (
          <>
            <Icon name={option.icon} size={16} />
            {option.short}
          </>
        ),
      }))}
    />
  );
}
