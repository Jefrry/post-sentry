import { errors } from 'telegram';

export function describeTelegramError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'error=unknown code=unknown rpcStatus=n/a';
  }

  const rpcError = error instanceof errors.RPCError ? error : undefined;
  const code =
    rpcError?.errorMessage ??
    ('code' in error ? error.code : undefined) ??
    error.message;
  const name = error.name === 'Error' ? error.constructor.name : error.name;
  const safeName = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ? name : 'unknown';
  const safeCode =
    typeof code === 'number' ||
    (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code))
      ? code
      : 'unknown';
  const constructorId =
    error instanceof errors.TypeNotFoundError
      ? ` constructorId=0x${(error.invalidConstructorId >>> 0).toString(16)}`
      : '';

  return `error=${safeName} code=${safeCode} rpcStatus=${rpcError?.code ?? 'n/a'}${constructorId}`;
}
