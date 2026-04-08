import { timingSafeEqual } from "crypto";

export function passwordMatches(
  candidate: string,
  expected: string | undefined,
): boolean {
  if (!expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  const maxLength = Math.max(candidateBuffer.length, expectedBuffer.length) + 4;
  const paddedCandidateBuffer = Buffer.alloc(maxLength);
  const paddedExpectedBuffer = Buffer.alloc(maxLength);

  paddedCandidateBuffer.writeUInt32BE(candidateBuffer.length, 0);
  paddedExpectedBuffer.writeUInt32BE(expectedBuffer.length, 0);
  candidateBuffer.copy(paddedCandidateBuffer, 4);
  expectedBuffer.copy(paddedExpectedBuffer, 4);

  return timingSafeEqual(paddedCandidateBuffer, paddedExpectedBuffer);
}
