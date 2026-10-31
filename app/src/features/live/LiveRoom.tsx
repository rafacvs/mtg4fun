import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LiveClient, type LiveMessage } from './liveClient';

const LiveRoomContext = createContext<LiveClient | null>(null);

function roomURL(roomId: number) {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/api/rooms/${roomId}/live`;
}

export function LiveRoomProvider({ roomId, children }: { roomId: number; children: ReactNode }) {
  const [client] = useState(() => new LiveClient(roomURL(roomId)));
  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);
  return <LiveRoomContext.Provider value={client}>{children}</LiveRoomContext.Provider>;
}

export function useLiveClient() {
  const client = useContext(LiveRoomContext);
  if (!client) throw new Error('useLiveClient exige LiveRoomProvider.');
  return client;
}

export function useLiveChannel(game: string, handler: (message: LiveMessage<any>) => void) {
  const client = useLiveClient();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => client.subscribe(game, message => latest.current(message)), [client, game]);
}

export function useLiveStatus() {
  const client = useLiveClient();
  return useSyncExternalStore(client.subscribeStatus, () => client.status);
}
