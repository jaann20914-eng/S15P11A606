/**
 * 최소 시간이 지난 뒤에 결과를 돌려준다.
 *
 * 응답이 아주 빠르면 로딩 표시가 한 프레임만 스쳐 지나가거나 아예 보이지 않는다. 같은 화면이
 * 어떤 때는 스피너를 보여주고 어떤 때는 곧바로 목록을 띄우면 사용자는 무엇이 바뀐 것인지
 * 알 수 없다. 최소 시간을 두면 항상 같은 방식으로 보인다.
 *
 * 실패도 같은 시간을 기다린다. 성공만 늦추면 오류가 먼저 뜨는 쪽이 더 빨라져 어색해진다.
 *
 * 일부러 느리게 만드는 코드이므로 사용자가 결과를 기다리는 화면 조회에만 쓴다. 목록을 이어
 * 받거나 배경에서 갱신하는 요청에는 쓰지 않는다 — 그쪽은 늦어지는 만큼 손해다.
 */
export async function withMinimumDuration<T>(work: Promise<T>, ms: number): Promise<T> {
  // 결과를 함수로 감싸 둔다. 그대로 두면 Promise.all이 실패 즉시 끝나 최소 시간을 못 지킨다.
  const settled = work.then(
    (value) => () => value,
    (cause: unknown) => () => {
      throw cause;
    },
  );

  const [unwrap] = await Promise.all([
    settled,
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);

  return unwrap();
}
