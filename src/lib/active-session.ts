let businessMutationsBlocked = false;
let pendingBusinessMutations = 0;
const idleWaiters = new Set<() => void>();

export function blockBusinessMutations(): void {
  businessMutationsBlocked = true;
}

export function allowBusinessMutations(): void {
  businessMutationsBlocked = false;
}

export function areBusinessMutationsBlocked(): boolean {
  return businessMutationsBlocked;
}

export function isActiveStatusRequest(input: RequestInfo | URL): boolean {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return url.includes("/rest/v1/rpc/is_current_user_active");
}

export function isBusinessMutationRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return url.includes("/rest/v1/") && method !== "GET" && method !== "HEAD" && !isActiveStatusRequest(input);
}

export function beginBusinessMutation(): void {
  pendingBusinessMutations += 1;
}

export function finishBusinessMutation(): void {
  pendingBusinessMutations = Math.max(0, pendingBusinessMutations - 1);
  if (pendingBusinessMutations === 0) {
    for (const resolve of idleWaiters) resolve();
    idleWaiters.clear();
  }
}

export function waitForPendingBusinessMutations(): Promise<void> {
  if (pendingBusinessMutations === 0) return Promise.resolve();
  return new Promise((resolve) => idleWaiters.add(resolve));
}

export function inactiveMutationResponse(): Response {
  return new Response(
    JSON.stringify({
      code: "ACCOUNT_INACTIVE",
      message: "บัญชีผู้ใช้ถูกปิดใช้งาน",
    }),
    {
      status: 403,
      headers: { "content-type": "application/json" },
    },
  );
}

