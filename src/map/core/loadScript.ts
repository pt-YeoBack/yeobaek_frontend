/** 외부 SDK 스크립트를 한 번만 넣는다 (같은 src 는 같은 Promise 를 돌려줌) */
const pending = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending.delete(src); // 실패하면 다음에 다시 시도할 수 있게
      script.remove();
      reject(new Error(`지도 스크립트를 불러오지 못했어요: ${new URL(src).host}`));
    };
    document.head.appendChild(script);
  });
  pending.set(src, promise);
  return promise;
}
