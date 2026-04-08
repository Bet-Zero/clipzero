import { timingSafeEqual } from "crypto";

const LENGTH_PREFIX_BYTES = 4;

export function passwordMatches(
  candidate: string,
  expected: string | undefined,
): boolean {
  if (!expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  const maxLength =
    Math.max(candidateBuffer.length, expectedBuffer.length) + LENGTH_PREFIX_BYTES;
  const paddedCandidateBuffer = Buffer.alloc(maxLength);
  const paddedExpectedBuffer = Buffer.alloc(maxLength);

  paddedCandidateBuffer.writeUInt32BE(candidateBuffer.length, 0);
  paddedExpectedBuffer.writeUInt32BE(expectedBuffer.length, 0);
  candidateBuffer.copy(paddedCandidateBuffer, LENGTH_PREFIX_BYTES);
  expectedBuffer.copy(paddedExpectedBuffer, LENGTH_PREFIX_BYTES);

  return timingSafeEqual(paddedCandidateBuffer, paddedExpectedBuffer);
}
