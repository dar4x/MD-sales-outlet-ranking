import type { PipeTransform } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Matches,
  ValidateNested,
  IsDefined,
  validateSync,
} from 'class-validator';
import type { OutletSettingsPatch } from '../domain/outlet.js';
import { EventValidationError } from '../../events/domain/event-errors.js';

class ContactDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
}
class SettingsDto {
  @IsOptional() @IsString() @Matches(/^[1-9][0-9]*$/) daily_plan_minor?: string;
  @IsOptional()
  @ValidateNested()
  @IsDefined()
  @Type(() => ContactDto)
  responsible_person?: ContactDto;
}
export class ParseOutletSettingsPipe implements PipeTransform<
  unknown,
  OutletSettingsPatch
> {
  transform(body: unknown): OutletSettingsPatch {
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length === 0
    ) {
      throw new EventValidationError(
        'invalid_request',
        'Expected a nonempty settings object.',
      );
    }
    // null must not silently mean "omitted" via IsOptional.
    if (
      ('daily_plan_minor' in body && body.daily_plan_minor === null) ||
      ('responsible_person' in body &&
        (body.responsible_person === null ||
          Array.isArray(body.responsible_person)))
    ) {
      throw new EventValidationError(
        'invalid_request',
        'Settings fields cannot be null or arrays.',
      );
    }
    const dto = plainToInstance(SettingsDto, body);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
        .length > 0 ||
      dto.responsible_person?.name.trim() === ''
    ) {
      throw new EventValidationError(
        'invalid_request',
        'Invalid outlet settings.',
      );
    }
    const patch: OutletSettingsPatch = {};
    if (dto.daily_plan_minor !== undefined)
      patch.daily_plan_minor = BigInt(dto.daily_plan_minor);
    if (dto.responsible_person !== undefined)
      patch.responsible_person = {
        name: dto.responsible_person.name.trim(),
        email: dto.responsible_person.email,
      };
    return patch;
  }
}
