export type Period = 'all' | 'month' | 'week';
export type RankedPlayer = {
  id: number; name: string; played: number; decided: number; wins: number;
  damage: number; healing: number; turnSeconds: number; turns: number;
  draws: number; mulligans: number; tokens: number; rolls: number;
  streak: number; winLife: number;
};
export type Leaderboard = {
  period: Period; matches: number; players: RankedPlayer[];
  recentWins: { playerId: number; name: string; life: number; at: string }[];
};

export async function fetchLeaderboard(period: Period, signal: AbortSignal): Promise<Leaderboard> {
  const response = await fetch(`/api/leaderboards?period=${period}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o placar da zoeira.');
  return data;
}
