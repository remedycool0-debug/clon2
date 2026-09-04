const VISITOR_ID_KEY = 'customer-chat-visitor-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fallbackUuid(cryptoApi) {
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getVisitorId(storage = globalThis.localStorage, cryptoApi = globalThis.crypto) {
  try {
    const savedId = storage.getItem(VISITOR_ID_KEY);
    if (UUID_PATTERN.test(savedId || '')) return savedId;
  } catch {
    /* Storage can be unavailable in private or restricted browser contexts. */
  }

  const visitorId = cryptoApi.randomUUID ? cryptoApi.randomUUID() : fallbackUuid(cryptoApi);
  try {
    storage.setItem(VISITOR_ID_KEY, visitorId);
  } catch {
    /* The ID remains valid for this page even when it cannot be persisted. */
  }
  return visitorId;
}

export function visitorDisplayName(visitorId) {
  return `Visitor ${visitorId.replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}
