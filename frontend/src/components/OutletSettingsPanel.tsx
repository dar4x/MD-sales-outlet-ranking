import { useCallback } from 'react';
import { getOutletSettings } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { OutletSettingsForm } from './OutletSettingsForm';

export function OutletSettingsPanel({
  id,
  onSaved,
}: {
  id: string;
  onSaved: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getOutletSettings(id, signal),
    [id],
  );
  const { data, loading, error, reload } = useApiResource(load);
  return (
    <section aria-label="Outlet settings">
      <h2>Settings</h2>
      <button type="button" onClick={reload} disabled={loading}>
        Reload settings
      </button>
      {loading && <p role="status">Loading settings…</p>}
      {error && <p role="alert">Could not load settings: {error}</p>}
      {data && !loading && (
        <OutletSettingsForm
          key={`${data.daily_plan_minor}/${data.responsible_person.name}/${data.responsible_person.email}`}
          settings={data}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}
