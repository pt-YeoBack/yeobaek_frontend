// [지도] //추가 카카오api 넣어야함
// 핀 도장: 카카오와 구글에 똑같이 생긴 핀을 찍어요.
import { MAP_COLORS } from './config';
import type { MapMarker } from './types';

/**
 * @param interactive true 면 button. 구글은 마커 자체가 클릭을 받아서 false (button 안에 button 방지)
 */
export function createMarkerElement(marker: MapMarker, interactive: boolean): HTMLElement {
  const asButton = interactive && Boolean(marker.onClick);
  const el = document.createElement(asButton ? 'button' : 'div');
  const size = (marker.label ? 28 : 20) + (marker.selected ? 8 : 0);

  el.className = 'yb-marker';
  el.textContent = marker.label ?? ''; // textContent: 사용자가 쓴 글자가 HTML 로 실행되지 않게
  Object.assign(el.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    width: `${size}px`,
    height: `${size}px`,
    padding: '0',
    border: `${marker.selected ? 4 : 3}px solid ${MAP_COLORS.text}`,
    borderRadius: '50%',
    background: marker.color ?? MAP_COLORS.marker,
    color: MAP_COLORS.text,
    font: '700 12px/1 sans-serif',
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.35)',
    cursor: marker.onClick ? 'pointer' : 'default',
  });

  if (marker.title) {
    el.title = marker.title;
    el.setAttribute('aria-label', marker.title);
  }
  if (asButton) {
    (el as HTMLButtonElement).type = 'button'; // form 을 제출하지 않게
    el.addEventListener('click', () => marker.onClick?.());
  }
  return el;
}
