export function getRequestId(context) {
  return context.get('requestId') ?? 'unknown';
}
