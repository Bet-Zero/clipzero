import { timingSafeEqual } from "crypto";

export function passwordMatches(
  candidate: string,
  expected: string | undefined,
): boolean {
  if (!expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  const maxLength = Math.max(candidateBuffer.length, expectedBuffer.length);
  const paddedCandidateBuffer = Buffer.alloc(maxLength);
  const paddedExpectedBuffer = Buffer.alloc(maxLength);

  candidateBuffer.copy(paddedCandidateBuffer);
  expectedBuffer.copy(paddedExpectedBuffer);

  return (
    timingSafeEqual(paddedCandidateBuffer, paddedExpectedBuffer) &&
    candidateBuffer.length === expectedBuffer.length
  );
}
