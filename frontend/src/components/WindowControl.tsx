import { rankingWindows } from '../types/rankings';
import type { RankingWindow } from '../types/rankings';

export function WindowControl({
  value,
  onChange,
  label = 'Time window',
}: {
  value: RankingWindow;
  onChange: (value: RankingWindow) => void;
  label?: string;
}) {
  return (
    <fieldset className="segmented-control">
      <legend className="sr-only">{label}</legend>
      {rankingWindows.map((window) => (
        <label
          key={window}
          className={value === window ? 'segment selected' : 'segment'}
        >
          <input
            className="sr-only"
            type="radio"
            name={label}
            value={window}
            checked={value === window}
            onChange={() => onChange(window)}
          />
          {window === 'hour' ? 'Last hour' : 'Business day'}
        </label>
      ))}
    </fieldset>
  );
}
