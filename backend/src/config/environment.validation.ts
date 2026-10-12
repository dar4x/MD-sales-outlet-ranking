import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV!: 'development' | 'production' | 'test';

  @IsString()
  @IsNotEmpty()
  BACKEND_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  BACKEND_PORT!: number;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  FRONTEND_ORIGIN!: string;
}

export function validateEnvironment(
  configuration: Record<string, unknown>,
): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, configuration);
  const errors = validateSync(environment, { skipMissingProperties: false });

  if (errors.length > 0) {
    const invalidNames = errors.map((error) => error.property).join(', ');
    throw new Error(`Invalid environment variables: ${invalidNames}`);
  }

  if (
    new URL(environment.FRONTEND_ORIGIN).origin !== environment.FRONTEND_ORIGIN
  ) {
    throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin without a path');
  }

  return environment;
}
