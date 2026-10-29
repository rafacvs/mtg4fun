import { test, expect, openHand, choosePreparationDeck } from './fixtures';

test('inicia com sete na mão e o comandante no comando', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill('amigo');
  await page.getByLabel('Senha', { exact: true }).fill('senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByLabel('Arquivo .cod').setInputFiles({
    name: 'inicio.cod',
    mimeType: 'application/xml',
    buffer: Buffer.from('<cockatrice_deck><deckname>Início</deckname><zone name="main"><card number="9" name="Island"/><card number="1" name="Gargos, Vicious Watcher"/></zone></cockatrice_deck>'),
  });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  await page.getByLabel('Buscar carta').fill('Gargos');
  await page.getByRole('button', { name: 'Marcar comandante Gargos, Vicious Watcher', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Comandante', exact: true })).toContainText('1 × Gargos, Vicious Watcher');
  await page.getByRole('link', { name: 'Salas', exact: true }).click();
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Montar a mesa' });
  await panel.getByLabel('Nome da mesa').fill('Mesa de início');
  await panel.getByRole('button', { name: 'Criar e sentar' }).click();
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Mesa de início', exact: true }) }).getByRole('link', { name: 'Entrar na mesa', exact: true }).click();
  await choosePreparationDeck(page, { label: 'Início' });
  await page.getByRole('button', { name: 'Estou pronto', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
  const board = page.getByRole('region', { name: 'Mesa da partida', exact: true });
  await expect(board).toBeVisible();
  await openHand(page);
  await expect(board.getByRole('region', { name: 'Mão', exact: true }).getByRole('button', { name: 'Island', exact: true })).toHaveCount(7);
  if (testInfo.project.name === 'celular') await page.setViewportSize({ width: 839, height: 393 });
  await expect(board.getByRole('region', { name: 'Comando', exact: true }).getByRole('button', { name: 'Gargos, Vicious Watcher', exact: true })).toBeVisible();
  const roomId = Number(page.url().split('/').at(-1));
  const { match } = await (await page.request.get(`/api/rooms/${roomId}/match`)).json();
  const player = match.players.find((item: { userId: number }) => item.userId === match.viewerId);
  expect(player.libraryCount).toBe(2);
  expect(player.handCount).toBe(7);
  expect(player.commandCount).toBe(1);
  expect(player.command[0].name).toBe('Gargos, Vicious Watcher');
});
