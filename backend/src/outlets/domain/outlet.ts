import type {
  Identifier,
  IanaTimeZone,
  MinorUnits,
  ResponsiblePerson,
  UtcTimestamp,
} from '../../shared/domain/value-types.js';
export interface Outlet {
  outlet_id: Identifier;
  name: string;
  time_zone: IanaTimeZone;
  daily_plan_minor: MinorUnits;
  responsible_person: ResponsiblePerson;
  activated_at: UtcTimestamp;
  last_accepted_at: UtcTimestamp | null;
}
export interface OutletSettings {
  outlet_id: Identifier;
  daily_plan_minor: MinorUnits;
  responsible_person: ResponsiblePerson;
}
export interface OutletSettingsPatch {
  daily_plan_minor?: MinorUnits;
  responsible_person?: ResponsiblePerson;
}
