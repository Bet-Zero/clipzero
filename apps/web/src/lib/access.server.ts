import { timingSafeEqual } from "crypto";

export function passwordMatches(
  candidate: string,
  expected: string | undefined,
): boolean {
  if (!expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
