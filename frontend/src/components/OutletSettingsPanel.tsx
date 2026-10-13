import { useCallback } from 'react';
import { getOutletSettings } from '../api/outlets';
import { useApiResource } from '../api/useApiResource';
import { OutletSettingsForm } from './OutletSettingsForm';
import { Icon } from './Icon';

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
    <section aria-label="Outlet settings" className="panel form-layout">
      <div className="panel-heading">
        <div>
          <h2>Settings</h2>
          <p className="panel-description">
            Sales targets and outlet responsibility
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          aria-label="Reload settings"
        >
          <Icon name="refresh" size={15} />
          Reload
        </button>
      </div>
      {loading && (
        <p className="notice" role="status">
          Loading settings…
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          Could not load settings: {error}
        </p>
      )}
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
