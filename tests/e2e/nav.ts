import type { Page } from '@playwright/test';

/** Etapa a la que pertenece cada pestaña del editor (igual que en la app). */
const GROUP: Record<string, string> = {
  model: 'design',
  parts: 'build', cut: 'build', hardware: 'build', machining: 'build', assembly: 'build', workshop: 'build',
  price: 'sell', quote: 'sell', offers: 'sell',
  qc: 'deliver', export: 'deliver', history: 'deliver',
};

/** Abre una pestaña del editor: primero su etapa y, si hay varias, la pestaña. */
export async function openTab(page: Page, id: string) {
  const g = GROUP[id]!;
  await page.getByTestId(`group-${g}`).click();
  if (g !== 'design') await page.getByTestId(`tab-${id}`).click();
}
