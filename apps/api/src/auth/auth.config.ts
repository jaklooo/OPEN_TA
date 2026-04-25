const DEV_ACCESS_SECRET = 'dev-access-secret';
const DEV_REFRESH_SECRET = 'dev-refresh-secret';

function requireProductionSecret(name: string, value: string | undefined, devFallback: string) {
  if (process.env.NODE_ENV === 'production' && (!value || value === devFallback || value.startsWith('change-me'))) {
    throw new Error(`${name} must be set to a strong unique value in production`);
  }

  return value ?? devFallback;
}

export function getJwtAccessSecret() {
  return requireProductionSecret('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET, DEV_ACCESS_SECRET);
}

export function getJwtRefreshSecret() {
  return requireProductionSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET, DEV_REFRESH_SECRET);
}
