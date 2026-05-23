export function plainText(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'close',
    },
  });
}

export function success(text = 'success') {
  return plainText(text);
}

export function failure(reason, status = 400) {
  return plainText(`failure\n${reason}`, status);
}

export function xml(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'close',
    },
  });
}
