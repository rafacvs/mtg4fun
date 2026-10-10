export type Room = {
  id: number;
  title: string;
  creatorId: number;
  status: string;
  participants: { id: number; name: string }[];
  vacancies: number;
};

async function change(path: string): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  }
}

export const roomsApi = {
  create: () => change('/api/rooms'),
  join: (id: number) => change(`/api/rooms/${id}/participants`),
};
