import crypto from 'node:crypto';

export function generateTableToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateOrderPublicId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `AO-${date}-${suffix}`;
}

export function generateRequestKey() {
  return crypto.randomUUID();
}

export function safeCompareHex(expectedHex, receivedHex) {
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');
    if (expected.length !== received.length || expected.length === 0) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
