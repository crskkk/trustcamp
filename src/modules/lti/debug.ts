// Debug utilities for LTI module visual checkpoint
// Logs LTI launch events to console overlay

export function logLaunchOk(sub: string): void {
  console.log("[LTI] launch-ok sub=", sub);
}

export function logLaunchError(error: string): void {
  console.error("[LTI] launch-error:", error);
}

export function logGradePush(sessionId: string, score: number): void {
  console.log("[LTI] grade-push session=", sessionId, "score=", score);
}

export function logGroupsFetched(sessionId: string, groups: string[]): void {
  console.log("[LTI] groups session=", sessionId, "count=", groups.length);
}