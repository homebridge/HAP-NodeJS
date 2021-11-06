
export function PromiseTimeout(timeout: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(() => resolve(), timeout);
  });
}
