import type { OutletSettings, OutletSettingsPatch } from '../types/outlets';

export interface SettingsFields {
  daily_plan_minor: string;
  name: string;
  email: string;
}

export function buildSettingsPatch(
  saved: OutletSettings,
  fields: SettingsFields,
): OutletSettingsPatch {
  const patch: OutletSettingsPatch = {};
  if (fields.daily_plan_minor !== saved.daily_plan_minor) {
    if (
      !/^[1-9]\d*$/.test(fields.daily_plan_minor) ||
      BigInt(fields.daily_plan_minor) > 9223372036854775807n
    ) {
      throw new Error(
        'Daily plan must be a positive integer string no greater than 9223372036854775807 minor units.',
      );
    }
    patch.daily_plan_minor = fields.daily_plan_minor;
  }
  const name = fields.name.trim();
  const email = fields.email.trim();
  if (
    name !== saved.responsible_person.name ||
    email !== saved.responsible_person.email
  ) {
    if (!name || !email)
      throw new Error('Responsible person name and email are required.');
    patch.responsible_person = { name, email };
  }
  if (Object.keys(patch).length === 0)
    throw new Error('There are no settings changes to save.');
  return patch;
}
