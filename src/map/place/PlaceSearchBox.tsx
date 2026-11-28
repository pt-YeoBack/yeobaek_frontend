// [지도] //추가 카카오api 넣어야함
// 장소 검색창 + 결과 목록
import { useRef, useState } from 'react'; // useState: 화면이 기억할 값, useRef: 바뀌어도 다시 그리지 않는 메모
import type { Place, PlaceSearcher } from '../core/types';

interface Props {
  searcher: PlaceSearcher;
  /** 지도 SDK 준비 전에는 true */
  disabled?: boolean;
  onSelect: (place: Place) => void;
}

export function PlaceSearchBox({ searcher, disabled, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [message, setMessage] = useState('');
  const latest = useRef(0); // 검색 순번: 늦게 도착한 예전 답은 버려요

  const search = async () => {
    if (disabled || !query.trim()) return;
    const turn = ++latest.current;
    setMessage('찾는 중…');
    try {
      const found = await searcher.search(query.trim());
      if (turn !== latest.current) return;
      setResults(found);
      setMessage(found.length ? '' : '검색 결과가 없어요.');
    } catch {
      if (turn !== latest.current) return;
      setResults([]);
      setMessage('장소를 검색하지 못했어요.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="soft-input"
          value={query}
          disabled={disabled}
          aria-label="장소 검색"
          placeholder={disabled ? '지도를 준비하고 있어요' : '장소 이름으로 검색'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: 한글을 조합하는 중의 Enter 는 무시 (두 번 검색 방지)
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void search();
          }}
        />
        <button type="button" className="chip chip-outline" disabled={disabled} onClick={search}>
          검색
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <ul style={{ maxHeight: 180, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
        {results.map((p, i) => (
          <li key={`${p.providerPlaceId}-${i}`}>
            <button
              type="button"
              style={{ width: '100%', padding: 8, textAlign: 'left' }}
              onClick={() => {
                onSelect(p);
                setResults([]);
              }}
            >
              <strong>{p.name}</strong>
              <br />
              <small>{p.address}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
