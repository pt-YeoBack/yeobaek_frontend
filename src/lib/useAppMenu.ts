import { useMemo } from 'react';
import { useNav } from './navigation';

/**
 * 상단 "더보기(…)" 메뉴. Figma에는 아이콘만 있고 메뉴 내용이 정의되어 있지 않아
 * 최소 항목만 넣었습니다.
 */
export function useAppMenu() {
  const { reset } = useNav();
  return useMemo(() => [{ label: '처음 화면으로', onSelect: () => reset({ name: 'onboarding' }) }], [reset]);
}