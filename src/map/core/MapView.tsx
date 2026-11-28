// [지도] //추가 카카오api 넣어야함
// 지도 액자: 화면은 이 부품 하나만 쓰고, 안에 어느 회사 지도를 끼울지는 액자가 정해요.
//  useState  = 바뀌면 화면을 다시 그리는 메모
//  useRef    = 바뀌어도 다시 그리지 않는 주머니 메모
//  useEffect = 화면이 뜬 뒤에 할 일 (돌려준 함수는 치울 때 실행)
import { CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import { DEFAULT_CENTER, DEFAULT_ZOOM, FIT_PADDING } from './config';
import { getEngine } from './engines';
import { resolveProvider } from './region';
import type { LatLng, MapHandle, MapMarker, MapPolyline, MapProviderId } from './types';

export interface MapViewProps {
  /** 나라 코드. KR → 카카오, 그 외 → 구글 */
  country?: string | null;
  /** 직접 지정 (country 보다 우선) */
  provider?: MapProviderId;
  /** 처음 중심 */
  center?: LatLng;
  /** 처음 확대 (구글 기준, 기본 14) */
  zoom?: number;
  /** useMemo 로 만들어서 넘기기 */
  markers?: MapMarker[];
  /** useMemo 로 만들어서 넘기기 */
  polylines?: MapPolyline[];
  /** 마커 · 선의 위치가 바뀌면 전부 보이게 맞춤 */
  fitToContent?: boolean;
  onMapClick?: (at: LatLng) => void;
  onReady?: (map: MapHandle) => void;
  /** 지도 위에 겹칠 버튼 등 */
  children?: ReactNode;
  className?: string;
  /** 기본 높이 320px */
  style?: CSSProperties;
}

const NO_MARKERS: MapMarker[] = []; // 매번 새 [] 를 만들면 계속 다시 그려서 하나를 돌려 씀
const NO_LINES: MapPolyline[] = [];

// :where() = 우선순위 0 → 화면이 준 className · style 이 항상 이겨요
const CSS = [
  ':where(.yb-map){position:relative;flex-shrink:0;width:100%;height:320px;overflow:hidden;background:#eef3fa;isolation:isolate}',
  ':where(.yb-map-canvas){position:absolute;inset:0;z-index:0}',
  '.yb-map-canvas img{max-width:none}', // 지도 타일이 찌그러지지 않게
  ':where(.yb-map-message){position:absolute;inset:0;display:flex;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center;font-size:13px;color:#59677a;pointer-events:none}',
  ':where(.yb-map-overlay){position:absolute;inset:0;z-index:1;pointer-events:none}',
  ':where(.yb-map-overlay > *){pointer-events:auto}',
].join('');

type Status = { handle: MapHandle } | { error: true } | null; // null = 불러오는 중

export function MapView(props: MapViewProps) {
  const { markers = NO_MARKERS, polylines = NO_LINES, fitToContent, className, style, children } = props;

  const firstPoint = props.center ?? markers[0]?.position ?? polylines[0]?.path[0];
  const provider = props.provider ?? resolveProvider(props.country, firstPoint);
  const engine = getEngine(provider);
  const hasKey = engine.hasKey();

  const canvas = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const handle = status && 'handle' in status ? status.handle : null;

  // 최신 props 를 주머니에 보관 → 콜백이 바뀌어도 지도를 새로 만들지 않음
  const latest = useRef({ props, firstPoint });
  useEffect(() => {
    latest.current = { props, firstPoint };
  });

  // ① 지도 만들기. 회사가 바뀌면 치우고 다시 만듦
  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    let cleanup = () => {};

    engine
      .load()
      .then(() => {
        if (cancelled || !canvas.current) return;
        const el = document.createElement('div');
        el.style.width = '100%';
        el.style.height = '100%';
        canvas.current.append(el);
        cleanup = () => el.remove();

        const now = latest.current;
        const map = engine.create(el, {
          center: now.firstPoint ?? DEFAULT_CENTER[provider],
          zoom: now.props.zoom ?? DEFAULT_ZOOM,
        });
        const stopClick = map.handle.onClick((at) => latest.current.props.onMapClick?.(at));
        cleanup = () => {
          stopClick();
          map.destroy();
          el.remove();
        };

        setStatus({ handle: map.handle });
        now.props.onReady?.(map.handle);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('지도를 불러오지 못했어요.', error);
        setStatus({ error: true });
      });

    return () => {
      cancelled = true;
      cleanup();
      setStatus(null);
    };
  }, [engine, hasKey, provider]);

  // ② 핀 · 선 갈아 끼우기
  useEffect(() => {
    handle?.setMarkers(markers);
  }, [handle, markers]);

  useEffect(() => {
    handle?.setPolylines(polylines);
  }, [handle, polylines]);

  // ③ 전부 보이게. 핀을 '선택'만 한 때는 위치가 그대로라 확대가 튀지 않아요
  const pointsKey = fitToContent
    ? JSON.stringify([...markers.map((m) => m.position), ...polylines.flatMap((l) => l.path)])
    : '[]';

  useEffect(() => {
    if (!handle) return;
    const points = JSON.parse(pointsKey) as LatLng[];
    if (points.length && canvas.current?.clientWidth) handle.fitBounds(points, FIT_PADDING);
  }, [handle, pointsKey]);

  // ④ 크기가 바뀌면 다시 그리기
  useEffect(() => {
    const box = canvas.current;
    if (!handle || !box) return;
    let wasHidden = !box.clientWidth || !box.clientHeight;
    const observer = new ResizeObserver(() => {
      if (!box.clientWidth || !box.clientHeight) {
        wasHidden = true;
        return;
      }
      handle.relayout();
      if (!wasHidden) return;
      wasHidden = false;
      const points = JSON.parse(pointsKey) as LatLng[];
      if (points.length) handle.fitBounds(points, FIT_PADDING); // 숨어 있다가 나타나면 다시 맞춤
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [handle, pointsKey]);

  let message = '';
  if (!hasKey) message = '지도 키가 설정되지 않았어요';
  else if (status && 'error' in status) message = '지도를 불러오지 못했어요';
  else if (!status) message = '지도를 불러오는 중…';

  return (
    <div className={className ? `yb-map ${className}` : 'yb-map'} style={style} data-provider={provider}>
      <style href="yb-map" precedence="default">
        {CSS}
      </style>
      <div className="yb-map-canvas" ref={canvas} />
      {message && (
        <p className="yb-map-message" role="status">
          {message}
        </p>
      )}
      {children && <div className="yb-map-overlay">{children}</div>}
    </div>
  );
}
