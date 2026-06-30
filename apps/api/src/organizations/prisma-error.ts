export function isPrismaError(err: unknown, errorCode: string): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === errorCode
  );
}
