import { MAP_COLORS } from './config';
import type { MapMarker } from './types';

/**
 * 모든 엔진이 같은 모양의 마커를 쓰도록 HTML 요소로 만든다.
 * (구글 AdvancedMarker 의 content, 카카오 CustomOverlay 의 content 로 들어감)
 * 스타일은 css/app.css 의 .map-marker
 */
export function markerColor(color: MapMarker['color']): string {
  if (!color || color === 'brand') return MAP_COLORS.brand;
  if (color === 'accent') return MAP_COLORS.accent;
  if (color === 'muted') return MAP_COLORS.muted;
  return color;
}

export function createMarkerElement(marker: MapMarker): HTMLElement {
  const el = document.createElement(marker.onClick ? 'button' : 'div');
  if (el instanceof HTMLButtonElement) el.type = 'button';
  el.className = `map-marker${marker.label ? ' has-label' : ''}${marker.selected ? ' is-selected' : ''}`;
  el.style.setProperty('--marker-color', markerColor(marker.color));
  if (marker.title) {
    el.title = marker.title;
    el.setAttribute('aria-label', marker.label ? `${marker.label}. ${marker.title}` : marker.title);
  }
  const dot = document.createElement('span');
  dot.className = 'map-marker-dot';
  if (marker.label) dot.textContent = marker.label;
  el.appendChild(dot);
  if (marker.onClick) {
    const onClick = marker.onClick;
    el.addEventListener('click', (e) => {
      e.stopPropagation(); // 지도 클릭(onClick)으로 번지지 않게
      onClick();
    });
  }
  return el;
}
