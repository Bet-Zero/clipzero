/**
 * Single-flight deduplication for async operations.
 *
 * If a request for a given key is already in-flight, the second caller
 * receives the same promise rather than triggering a duplicate upstream fetch.
 * Once the promise settles (resolve or reject), the key is removed so the
 * next call starts a fresh request.
 */
export class SingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Execute `fn` for the given `key`, or join the existing in-flight promise
   * if one already exists for that key.
   *
   * @returns A promise that resolves/rejects with the same result as `fn()`.
   */
  call<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  /** Returns true if a request for this key is currently in-flight. */
  has(key: string): boolean {
    return this.inFlight.has(key);
  }
}
