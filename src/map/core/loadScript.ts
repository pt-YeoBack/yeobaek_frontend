// [지도] //추가 카카오api 넣어야함
// 지도 프로그램(SDK) 배달 담당: 지도가 여러 장이어도 SDK 는 한 번만 받아 와요.
// Promise = "나중에 결과를 줄게" 라는 교환권. 같은 교환권을 나눠 주면 배달도 한 번이에요.

const TIMEOUT_MS = 15000; // 15초 안에 안 오면 실패
const jobs = new Map<string, Promise<void>>();

/** 같은 id 의 일은 한 번만. 실패하면 다음에 다시 시도할 수 있게 지움 */
export function loadOnce(id: string, job: () => Promise<void>): Promise<void> {
  const running = jobs.get(id);
  if (running) return running;

  let timer: number | undefined;
  const timeout = new Promise<void>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${id} 지도 SDK 시간 초과`)), TIMEOUT_MS);
  });
  const result = Promise.race([job(), timeout]) // race: 먼저 끝나는 쪽을 따름
    .catch((error) => {
      jobs.delete(id);
      throw error;
    })
    .finally(() => window.clearTimeout(timer));

  jobs.set(id, result);
  return result;
}

/** <script> 태그를 붙이고 다 받을 때까지 기다림 */
export function addScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('지도 SDK 를 받지 못했어요.')); // 키가 보이지 않게 주소는 남기지 않음
    };
    document.head.append(script);
  });
}
