import { test, expect } from './fixtures';

test('cria, filtra, edita e salva um deck do catálogo compartilhado', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill(process.env.E2E_LOGIN || 'amigo');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_PASSWORD || 'senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByRole('button', { name: '+ Criar deck', exact: true }).click();
  const editor = page.locator('.deck-editor-modal');
  await expect(editor).toBeVisible();
  await editor.getByLabel('Nome do deck').fill('Ilhas do amanhecer');
  if (await editor.locator('.editor-tabs').getByRole('button', { name: 'Buscar cartas', exact: true }).isVisible()) await editor.locator('.editor-tabs').getByRole('button', { name: 'Buscar cartas', exact: true }).click();
  await editor.getByLabel('Buscar catálogo').fill('Llanowar Elves');
  await editor.locator('.editor-filters summary').click();
  await editor.getByRole('button', { name: 'Criatura', exact: true }).click();
  await editor.getByRole('button', { name: 'Verde', exact: true }).click();
  await editor.getByLabel('Filtrar catálogo por valor de mana').selectOption('1');
  const island = editor.locator('.editor-results li').filter({ has: editor.getByRole('button', { name: /^Llanowar Elves / }) });
  await expect(island).toBeVisible();
  await island.getByRole('button', { name: /^Llanowar Elves / }).click();
  await island.getByRole('button', { name: /^Llanowar Elves / }).click();
  if (await editor.getByRole('button', { name: /Meu deck/ }).isVisible()) await editor.getByRole('button', { name: /Meu deck/ }).click();
  await expect(editor.getByRole('button', { name: 'Diminuir Llanowar Elves' })).toBeVisible();
  await editor.getByRole('button', { name: 'Comandante', exact: true }).click();
  await expect(editor.getByText('Comandante', { exact: true })).toBeVisible();
  await expect(editor.getByText('Identidade · G')).toBeVisible();
  await editor.getByRole('button', { name: 'Salvar deck' }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ilhas do amanhecer', exact: true })).toBeVisible();
  await expect(page.getByText('2 cartas · 1 nomes')).toBeVisible();

  await page.getByRole('button', { name: 'Editar deck', exact: true }).click();
  await expect(editor.getByLabel('Quantidade de Llanowar Elves')).toHaveValue('2');
  await editor.getByLabel('Quantidade de Llanowar Elves').fill('3');
  await editor.getByRole('button', { name: 'Salvar deck' }).click();
  await expect(page.getByText('3 cartas · 1 nomes')).toBeVisible();
  await page.screenshot({ path: info.outputPath('editor-deck-salvo.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('permite descartar alterações não salvas com aviso', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill(process.env.E2E_LOGIN || 'amigo');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_PASSWORD || 'senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByRole('button', { name: '+ Criar deck', exact: true }).click();
  const editor = page.locator('.deck-editor-modal');
  await editor.getByLabel('Nome do deck').fill('Mudança ainda não salva');
  page.once('dialog', dialog => dialog.dismiss());
  await editor.getByRole('button', { name: 'Fechar editor' }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByText('Alterações não salvas', { exact: false })).toBeVisible();
});

test('importa pendência, troca qualquer carta, remove e persiste alterações', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill(process.env.E2E_LOGIN || 'amigo');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_PASSWORD || 'senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir importação de deck' }).click();
  const deckName = `QA troca ${Date.now()}`;
  await page.getByLabel('Arquivo .cod').setInputFiles({ name: 'pendente.cod', mimeType: 'application/xml', buffer: Buffer.from(`<cockatrice_deck><deckname>${deckName}</deckname><zone name="main"><card number="3" name="Island"/><card number="2" name="Ausente QA"/><card number="1" name="Counterspell"/></zone></cockatrice_deck>`) });
  await page.getByRole('button', { name: 'Importar deck', exact: true }).click();
  await expect(page.getByText(/2× Ausente QA/)).toBeVisible();
  await page.getByRole('button', { name: 'Corrigir no editor' }).click();
  const editor = page.locator('.deck-editor-modal');
  await editor.getByRole('button', { name: 'Trocar', exact: true }).first().click();
  await editor.getByLabel('Buscar catálogo').fill('Sol Ring');
  await editor.locator('.editor-result').filter({ has: page.getByText('Sol Ring', { exact: true }) }).click();
  if (await editor.locator('.editor-tabs').isVisible()) await editor.getByRole('button', { name: /Meu deck/ }).click();
  await expect(editor.getByLabel('Quantidade de Sol Ring')).toHaveValue('3');
  await editor.locator('.pending-card').getByRole('button', { name: 'Remover' }).click();
  await editor.getByRole('button', { name: 'Salvar deck' }).click();
  await page.reload();
  await page.getByRole('button', { name: `Abrir ${deckName}` }).click();
  await expect(page.getByText('3 × Sol Ring', { exact: true })).toBeVisible();
  await expect(page.getByText('Ausente QA')).toHaveCount(0);
  await page.getByRole('button', { name: 'Excluir deck', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
});

test('paginação limita resultados e busca retorna à primeira página', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Login', { exact: true }).fill(process.env.E2E_LOGIN || 'amigo');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.E2E_PASSWORD || 'senha-do-navegador');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('link', { name: 'Meus decks', exact: true }).click();
  await page.getByRole('button', { name: '+ Criar deck', exact: true }).click();
  const editor = page.locator('.deck-editor-modal');
  if (await editor.locator('.editor-tabs').isVisible()) await editor.locator('.editor-tabs').getByRole('button', { name: 'Buscar cartas' }).click();
  const next = editor.getByRole('button', { name: 'Próxima →' });
  await expect(editor.locator('.editor-results li').first()).toBeVisible();
  expect(await editor.locator('.editor-results li').count()).toBeLessThanOrEqual(50);
  if (await next.isEnabled()) {
    await next.click();
    await expect(editor.locator('.editor-pagination')).toContainText('51–');
    await editor.getByLabel('Buscar catálogo').fill('Island');
    await expect(editor.locator('.editor-pagination')).toContainText('1–');
    await expect(editor.getByRole('button', { name: '← Anterior' })).toBeDisabled();
  }
  await editor.getByRole('button', { name: 'Fechar editor' }).click();
});
