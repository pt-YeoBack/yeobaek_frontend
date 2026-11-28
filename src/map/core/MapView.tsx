import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CENTER, DEFAULT_ZOOM, hasKey } from './config';
import { getEngine } from './engines';
import { resolveProvider } from './region';
import type { LatLng, MapHandle, MapMarker, MapPolyline, MapProviderId } from './types';

export interface MapViewProps {
  /** 나라 코드(KR → 카카오, 그 외 → 구글). provider 를 직접 주면 무시 */
  country?: string | null;
  /** 공급자를 직접 지정할 때 */
  provider?: MapProviderId;
  /** 처음 중심 (없으면 공급자 기본 중심). 나라 코드가 없으면 이 좌표로 공급자를 고른다 */
  center?: LatLng;
  /** 구글 기준 zoom (기본 14) */
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  /** true 면 마커 · 선이 바뀔 때마다 모두 보이도록 화면을 맞춘다 */
  fitToContent?: boolean;
  /** 지도 빈 곳을 눌렀을 때 (위치 고르기 등) */
  onMapClick?: (at: LatLng) => void;
  /** 지도가 만들어지면 손잡이를 받는다 (직접 이동 · 맞추기 등) */
  onReady?: (map: MapHandle) => void;
  className?: string;
  style?: CSSProperties;
  /** 지도 위에 겹쳐 올릴 화면 요소 (검색창 · 버튼 등) */
  children?: ReactNode;
}

type Status = 'loading' | 'ready' | 'error' | 'no-key';

const STATUS_TEXT: Record<Exclude<Status, 'ready'>, string> = {
  loading: '지도를 불러오는 중…',
  error: '지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  'no-key': '지도 키가 설정되지 않았어요. (.env.local 확인)',
};

/**
 * 지도 하나를 그리는 공통 컴포넌트.
 * 공급자(구글 · 카카오)가 달라도 같은 props 로 쓰고, 마커 · 선은 선언형으로 넘긴다.
 *
 *   <MapView country="KR" markers={[...]} polylines={[...]} fitToContent />
 */
export function MapView({
  country,
  provider,
  center,
  zoom = DEFAULT_ZOOM,
  markers,
  polylines,
  fitToContent = false,
  onMapClick,
  onReady,
  className,
  style,
  children,
}: MapViewProps) {
  const providerId = provider ?? resolveProvider({ country, at: center });
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MapHandle | null>(null);
  const [status, setStatus] = useState<Status>(hasKey(providerId) ? 'loading' : 'no-key');

  // 처음 값 · 최신 콜백은 ref 로 들고 있어 지도를 다시 만들지 않는다
  const initialView = useRef({ center, zoom });
  initialView.current = { center, zoom };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // 1. 공급자가 정해지면 SDK 로드 → 지도 생성 (공급자가 바뀌면 새로 만든다)
  useEffect(() => {
    if (!hasKey(providerId)) {
      setStatus('no-key');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    const engine = getEngine(providerId);
    engine
      .load()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const view = initialView.current;
        const handle = engine.createMap(containerRef.current, {
          center: view.center ?? DEFAULT_CENTER[providerId],
          zoom: view.zoom,
        });
        handleRef.current = handle;
        setStatus('ready');
        onReadyRef.current?.(handle);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error(e);
        setStatus('error');
      });
    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [providerId]);

  const ready = status === 'ready';

  // 2. 중심 · 확대 변경 (fitToContent 일 때는 내용에 맞추므로 따라가지 않는다)
  useEffect(() => {
    if (!ready || fitToContent || !center) return;
    handleRef.current?.setCenter(center, zoom);
  }, [ready, fitToContent, center?.lat, center?.lng, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. 마커 · 선
  useEffect(() => {
    if (ready) handleRef.current?.setMarkers(markers ?? []);
  }, [ready, markers]);
  useEffect(() => {
    if (ready) handleRef.current?.setPolylines(polylines ?? []);
  }, [ready, polylines]);

  // 4. 내용에 화면 맞추기
  const contentPoints = useMemo(
    () => [...(markers ?? []).map((m) => m.position), ...(polylines ?? []).flatMap((l) => l.path)],
    [markers, polylines],
  );
  useEffect(() => {
    if (ready && fitToContent && contentPoints.length > 0) handleRef.current?.fitBounds(contentPoints);
  }, [ready, fitToContent, contentPoints]);

  // 5. 지도 클릭
  useEffect(() => {
    if (!ready || !onMapClick || !handleRef.current) return undefined;
    return handleRef.current.onClick(onMapClick);
  }, [ready, onMapClick]);

  // 6. 컨테이너 크기 변화 (바텀시트 열림 등) → 다시 그리기
  useEffect(() => {
    const el = containerRef.current;
    if (!ready || !el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => handleRef.current?.relayout());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div className={`map-view${className ? ` ${className}` : ''}`} style={style} data-provider={providerId}>
      <div ref={containerRef} className="map-view-canvas" />
      {status !== 'ready' && (
        <div className={`map-view-status is-${status}`} role={status === 'loading' ? 'status' : 'alert'}>
          {STATUS_TEXT[status]}
        </div>
      )}
      {children}
    </div>
  );
}
