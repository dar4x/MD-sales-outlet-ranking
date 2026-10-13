import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { patchOutletSettings } from '../api/outlets';
import { buildSettingsPatch } from '../outlets/settings';
import type { SettingsFields } from '../outlets/settings';
import type { OutletSettings } from '../types/outlets';

interface SaveState {
  status: 'idle' | 'saving' | 'success' | 'error';
  message: string | null;
}

export function OutletSettingsForm({
  settings,
  onSaved,
}: {
  settings: OutletSettings;
  onSaved: () => void;
}) {
  const [saved, setSaved] = useState(settings);
  const [fields, setFields] = useState<SettingsFields>({
    daily_plan_minor: settings.daily_plan_minor,
    ...settings.responsible_person,
  });
  const [state, setState] = useState<SaveState>({
    status: 'idle',
    message: null,
  });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const changed =
    fields.daily_plan_minor !== saved.daily_plan_minor ||
    fields.name.trim() !== saved.responsible_person.name ||
    fields.email.trim() !== saved.responsible_person.email;

  function change(field: keyof SettingsFields, value: string): void {
    setFields((current) => ({ ...current, [field]: value }));
    setState({ status: 'idle', message: null });
  }
  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    let patch;
    try {
      patch = buildSettingsPatch(saved, fields);
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Invalid settings.',
      });
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ status: 'saving', message: 'Saving settings…' });
    void patchOutletSettings(settings.outlet_id, patch, controller.signal)
      .then((updated) => {
        if (controller.signal.aborted) return;
        setSaved(updated);
        setFields({
          daily_plan_minor: updated.daily_plan_minor,
          ...updated.responsible_person,
        });
        setState({ status: 'success', message: 'Settings saved.' });
        onSaved();
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not save settings.',
          });
      });
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={state.status === 'saving'}>
        <legend>Outlet settings</legend>
        <p>
          <label htmlFor="daily-plan">Daily plan (minor units) </label>
          <input
            id="daily-plan"
            type="text"
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            required
            value={fields.daily_plan_minor}
            onChange={(event) => change('daily_plan_minor', event.target.value)}
          />
        </p>
        <p>
          <label htmlFor="responsible-name">Responsible person name </label>
          <input
            id="responsible-name"
            required
            value={fields.name}
            onChange={(event) => change('name', event.target.value)}
          />
        </p>
        <p>
          <label htmlFor="responsible-email">Responsible person email </label>
          <input
            id="responsible-email"
            type="email"
            required
            value={fields.email}
            onChange={(event) => change('email', event.target.value)}
          />
        </p>
        <button type="submit" disabled={!changed || state.status === 'saving'}>
          Save settings
        </button>
      </fieldset>
      {state.message && (
        <p role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      )}
    </form>
  );
}
