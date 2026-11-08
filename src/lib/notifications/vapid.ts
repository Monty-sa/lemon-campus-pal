import { createSign, generateKeyPairSync } from "node:crypto";

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Generates an RFC 8292 compliant NIST P-256 keypair for Web Push VAPID authentication.
 */
export function generateVapidKeys(): VapidKeys {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: {
      type: "spki",
      format: "der",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // Extract raw uncompressed 65-byte public key (0x04 + X + Y) from SPKI DER
  // SPKI header for prime256v1 is exactly 26 bytes
  const rawPublicKey = publicKey.subarray(26);

  return {
    publicKey: toBase64Url(rawPublicKey),
    privateKey,
  };
}

/**
 * Signs a VAPID JWT token (ES256) per RFC 8292 for Web Push endpoint authorization.
 */
export function createVapidJwt(options: {
  audience: string;
  subject: string;
  privateKeyPem: string;
  expirationSeconds?: number;
}): string {
  const header = {
    typ: "JWT",
    alg: "ES256",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: options.audience,
    sub: options.subject,
    exp: now + (options.expirationSeconds ?? 12 * 3600),
  };

  const encodedHeader = toBase64Url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("SHA256");
  signer.update(unsignedToken);
  signer.end();

  // IEEE P1363 format yields the 64-byte R || S signature required by ES256
  const signature = signer.sign({
    key: options.privateKeyPem,
    dsaEncoding: "ieee-p1363",
  });

  return `${unsignedToken}.${toBase64Url(signature)}`;
}

/**
 * Builds the Authorization and Crypto-Key / Vapid header for a Web Push request.
 */
export function buildVapidHeaders(options: {
  endpoint: string;
  subject: string;
  publicKey: string;
  privateKeyPem: string;
}): Record<string, string> {
  const endpointUrl = new URL(options.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const token = createVapidJwt({
    audience,
    subject: options.subject,
    privateKeyPem: options.privateKeyPem,
  });

  return {
    Authorization: `vapid t=${token}, k=${options.publicKey}`,
  };
}
