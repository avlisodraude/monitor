/**
 * Caps the number of concurrently in-flight calls made through the returned
 * function to `concurrency`. Extra calls queue in FIFO order.
 */
export function createLimiter(concurrency: number) {
  if (concurrency < 1) throw new Error('concurrency must be >= 1')

  let active = 0
  const queue: (() => void)[] = []

  function release(): void {
    active--
    const resume = queue.shift()
    if (resume) resume()
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active++
    try {
      return await fn()
    } finally {
      release()
    }
  }
}
