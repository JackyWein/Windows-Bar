// ============================================================
// Media Bus — shared now-playing state + control routing.
//
// App polls the active media plugin (getState) and pushes the result here;
// the compact bar and the media panel subscribe. Controls are routed through
// a controller registered by the active MediaPanel (it forwards to the plugin).
// ============================================================

export interface MediaTrack {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
}

export interface MediaState {
  isPlaying: boolean;
  track: MediaTrack | null;
  volume: number;
  currentTime: number;
  duration: number;
  likeStatus: string;
}

const EMPTY: MediaState = { isPlaying: false, track: null, volume: 100, currentTime: 0, duration: 0, likeStatus: '' };

type Controller = (action: string, value?: number) => void;

let state: MediaState = EMPTY;
let controller: Controller | null = null;
const listeners = new Set<(s: MediaState) => void>();

function emit() {
  for (const l of listeners) l(state);
}

export const mediaBus = {
  get(): MediaState {
    return state;
  },
  set(s: MediaState): void {
    state = s;
    emit();
  },
  reset(): void {
    state = EMPTY;
    emit();
  },
  subscribe(fn: (s: MediaState) => void): () => void {
    listeners.add(fn);
    fn(state);
    return () => { listeners.delete(fn); };
  },
  setController(c: Controller | null): void {
    controller = c;
  },
  control(action: string, value?: number): void {
    controller?.(action, value);
    // Optimistic UI for instant feedback; the next poll reconciles with reality.
    if (action === 'playpause') {
      state = { ...state, isPlaying: !state.isPlaying };
      emit();
    } else if (action === 'volume') {
      state = { ...state, volume: Math.max(0, Math.min(100, Number(value) || 0)) };
      emit();
    } else if (action === 'like') {
      state = { ...state, likeStatus: state.likeStatus === 'LIKE' ? '' : 'LIKE' };
      emit();
    } else if (action === 'dislike') {
      state = { ...state, likeStatus: state.likeStatus === 'DISLIKE' ? '' : 'DISLIKE' };
      emit();
    }
  },
};
