const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(time: number): string {
  let value = time;
  let output = "";
  for (let i = 0; i < TIME_LENGTH; i += 1) {
    output = ENCODING[value % 32] + output;
    value = Math.floor(value / 32);
  }
  return output;
}

function encodeBytesToBase32(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += ENCODING[(buffer >> bits) & 31];
    }
  }

  if (bits > 0) {
    output += ENCODING[(buffer << (5 - bits)) & 31];
  }

  return output;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  throw new Error("无法生成随机数：缺少加密随机源");
}

export function generateUlid(): string {
  const timePart = encodeTime(Date.now());
  const randomPart = encodeBytesToBase32(randomBytes(10)).slice(
    0,
    RANDOM_LENGTH,
  );
  return `${timePart}${randomPart}`;
}
