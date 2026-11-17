import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function createProject(page: Page, _name: string, family = 'kitchen_base') {
  await page.goto('/');
  await page.getByTestId(`family-${family}`).click();
  await page.waitForURL(/\/editor\/?\?id=/);
  await expect(page.getByTestId('model-svg')).toBeVisible();
}

test('crear proyecto, cambiar medidas, cajones, proveedor, precio pendiente, guardar, revisión y exportar', async ({ page }) => {
  await createProject(page, 'E2E Cocina');

  // Cambiar medidas: el SVG y el despiece se actualizan
  await page.getByTestId('mod-width').fill('900');
  await expect(page.getByTestId('model-svg')).toContainText('900 mm · ANCHO');
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-HORIZONTAL');
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-HORIZONTAL' })).toContainText('864');

  // Medidas de corte con compensación de canto y verificación dimensional
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-HORIZONTAL' })).toContainText('558.55');
  await page.getByTestId('tab-qc').click();
  await expect(page.getByTestId('dimension-checks')).toContainText('Ancho exterior');
  await expect(page.getByTestId('checks-errors')).toHaveText('0');
  await page.getByText('Ajustes del taller').click();
  await page.getByTestId('edge-compensation').uncheck();
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-HORIZONTAL' })).not.toContainText('558.55');
  await page.getByTestId('tab-qc').click();
  await page.getByText('Ajustes del taller').click();
  await page.getByTestId('edge-compensation').check();
  await page.getByTestId('tab-model').click();
  await expect(page.getByTestId('checks-summary')).toHaveText('Todo cuadra');

  // Ruta de taller con equipo y fichas
  await page.getByTestId('tab-workshop').click();
  await expect(page.getByTestId('route-flow')).toContainText('Corte de tableros');
  await expect(page.getByTestId('route-flow')).toContainText('Canteado');
  await expect(page.getByTestId('tool-table')).toContainText('Seccionadora');
  await expect(page.getByTestId('equipment-seccionadora')).toContainText('Kerf 4 mm');
  const [routeSvg] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-route').click()]);
  expect(routeSvg.suggestedFilename()).toMatch(/ruta-de-taller\.svg$/);
  // Dónde se usa la canteadora en el modelo
  await page.getByTestId('equipment-model-canteadora').click();
  await expect(page.getByTestId('model-sheet')).toBeVisible();
  await expect(page.getByTestId('model-sheet').locator('line[data-kind="edge"]').first()).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('model-sheet')).toBeHidden();
  await page.getByTestId('tab-model').click();

  // Error bloqueante si W <= 2T
  await page.getByTestId('tab-model').click();
  await page.getByTestId('mod-width').fill('30');
  await expect(page.getByRole('alert').filter({ hasText: 'no existe plan fabricable' })).toBeVisible();
  await page.getByTestId('mod-width').fill('800');
  await expect(page.getByRole('alert').filter({ hasText: 'no existe plan fabricable' })).toHaveCount(0);

  // Agregar cajones; sin corredera no se calcula caja
  await page.getByTestId('mod-front').selectOption('drawers');
  await page.getByTestId('mod-drawers').fill('3');
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_FRONT');
  await expect(page.getByTestId('parts-table')).not.toContainText('M01-DRAWER_SIDE');
  await page.getByTestId('mod-slide').selectOption('slide-generic-telescopic');
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_SIDE');
  await expect(page.getByTestId('parts-table').locator('tr', { hasText: 'M01-DRAWER_SIDE' })).toContainText('Pendiente validación');

  // Precio pendiente => cotización INCOMPLETA
  await page.getByTestId('tab-quote').click();
  await expect(page.getByTestId('quote-status')).toHaveText('INCOMPLETO');

  // Elegir proveedor: corredera SmartSlide con oferta estimada del prototipo
  await page.getByTestId('mod-slide').selectOption('slide-samet-smartslide-350');
  await page.getByTestId('tab-offers').click();
  await page.getByTestId('offer-demo-tym-slide-smart').check();
  await page.getByTestId('offer-demo-pajaro-mel18').check();
  await page.getByTestId('tab-quote').click();
  const table = page.getByTestId('quote-table');
  await expect(table.locator('tr', { hasText: 'SmartSlide' })).toContainText('ESTIMATED');
  await expect(table.locator('tr', { hasText: 'Melamina 18 mm' })).toContainText('PENDING');
  await expect(page.getByTestId('quote-status')).toHaveText('INCOMPLETO');

  // Guardar y congelar revisión
  await expect(page.getByTestId('save-state')).toHaveText('Guardado', { timeout: 10_000 });
  await page.getByTestId('tab-history').click();
  await page.getByTestId('revision-note').fill('Primera revisión E2E');
  await page.getByTestId('create-revision').click();
  await expect(page.getByRole('cell', { name: 'Primera revisión E2E' })).toBeVisible();

  // Descargar exportaciones
  await page.getByTestId('tab-export').click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-parts-csv').click()]);
  expect(csv.suggestedFilename()).toMatch(/-despiece\.csv$/);
  const text = await readFile((await csv.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('M01-DRAWER_FRONT');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-pdf').click()]);
  expect(pdf.suggestedFilename()).toMatch(/-expediente\.pdf$/);
  const bytes = await readFile((await pdf.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // El proyecto guardado se reabre sin cambios
  await page.reload();
  await page.getByTestId('tab-parts').click();
  await expect(page.getByTestId('parts-table')).toContainText('M01-DRAWER_FRONT');
});

test('clóset y escritorio con herrería exigen validación', async ({ page }) => {
  await createProject(page, 'E2E Recámara');
  await page.getByTestId('add-module').selectOption('wardrobe');
  await page.getByTestId('add-module').selectOption('desk');
  await page.getByTestId('mod-desk-structure').selectOption('steel');
  await page.getByTestId('tab-qc').click();
  await expect(page.getByTestId('issues-list')).toContainText('anclaje antivuelco');
  await expect(page.getByTestId('issues-list')).toContainText('validar cargas');
  await expect(page.getByTestId('release-status')).toHaveText('Pendiente de validación');
  await page.getByTestId('tab-hardware').click();
  await expect(page.getByText(/barra\(s\) de 6.1 m/)).toBeVisible();
});

test('proveedores: captura manual y CSV', async ({ page }) => {
  await page.goto('/proveedores');
  await page.getByLabel('SKU').fill('MEL18-E2E');
  await page.getByLabel('Precio por presentación (MXN)').fill('1160');
  await page.getByLabel('Folio de cotización').fill('F-E2E-1');
  await page.getByRole('button', { name: 'Registrar oferta' }).click();
  await expect(page.getByText('Oferta registrada.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /MEL18-E2E/ })).toBeVisible();
  await page.getByLabel('Contenido CSV').fill('supplierId;productKey;sku;description;packQuantity;purchaseUnit;price;taxIncluded;taxRatePct;priceStatus;verifiedAt;validUntil;sourceUrl;quoteReference;available;reliability;capturedBy;notes\ntym_forest;edge:pvc19x045;CANTO-E2E;Canto 19 mm rollo 50 m;50;rollo;"450,00";si;16;COTIZADO;2026-01-10;;;F-2;;media;E2E;\n');
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText(/Importadas 1 oferta/)).toBeVisible();
});

test('página general del taller', async ({ page }) => {
  await page.goto('/taller');
  await expect(page.getByTestId('route-flow')).toContainText('Instalación en obra');
  await expect(page.getByTestId('equipment-canteadora')).toContainText('Seguridad');
  await page.getByTestId('equipment-model-medidor-diagonales').click();
  await expect(page.getByTestId('model-sheet').locator('line[data-kind="diag"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByText('Canteado').first().click();
  await page.getByTestId('station-model-canteado').click();
  await expect(page.getByTestId('model-sheet')).toContainText('canto');
});

test('portada: catálogo con búsqueda, categorías y proyectos recientes', async ({ page }) => {
  await page.goto('/');
  const grid = page.getByTestId('catalog-grid');
  await expect(grid.locator('li')).toHaveCount(19);
  await expect(grid.locator('svg').first()).toBeVisible();
  await page.getByTestId('catalog-search').fill('closet');
  await expect(grid.locator('li')).toHaveCount(1);
  await expect(grid).toContainText('Clóset');
  await page.getByTestId('catalog-search').fill('');
  await page.getByTestId('cat-kitchen').click();
  await expect(grid.locator('li')).toHaveCount(4);
  await page.getByTestId('cat-all').click();
  await page.getByTestId('family-desk').click();
  await page.waitForURL(/\/editor\/?\?id=/);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Continuar' })).toContainText('Escritorio');
  await page.goto('/proyectos');
  await expect(page.getByTestId('project-list')).toContainText('Escritorio');
});

test('editor: medidas rápidas junto al dibujo y guardado automático', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('family-bookcase').click();
  await page.waitForURL(/\/editor\/?\?id=/);
  await page.getByTestId('quick-width').fill('1200');
  await expect(page.getByTestId('model-svg')).toContainText('1200 mm · ANCHO');
  await expect(page.getByTestId('mod-width')).toHaveValue('1200');
  await expect(page.getByTestId('save-state')).toHaveText('Guardado', { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId('quick-width')).toHaveValue('1200');
  await page.getByTestId('checks-summary').click();
  await expect(page.getByTestId('dimension-checks')).toBeVisible();

  // Editar justo mientras se guarda: el último cambio no se pierde
  await page.getByTestId('tab-model').click();
  await page.getByTestId('quick-height').fill('1800');
  await page.waitForTimeout(1250);
  await page.getByTestId('quick-height').fill('1750');
  await expect(page.getByTestId('save-state')).toHaveText('Guardado', { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId('quick-height')).toHaveValue('1750');
});
test('render 3D del mueble', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('family-kitchen_base').click();
  await page.getByTestId('view-render').click();
  await expect(page.getByTestId('render-canvas').or(page.getByTestId('render-unavailable'))).toBeVisible({ timeout: 20_000 });
  if (await page.getByTestId('render-canvas').isVisible()) {
    await page.getByRole('radio', { name: 'Nogal (veta)' }).click();
    await page.getByTestId('render-doors').click();
    await expect(page.getByTestId('render-doors')).toHaveText('Cerrar puertas');
    const [img] = await Promise.all([page.waitForEvent('download'), page.getByTestId('render-snapshot').click()]);
    expect(img.suggestedFilename()).toMatch(/-render\.png$/);
  }
  await page.getByRole('radio', { name: 'Isométrico' }).click();
  await expect(page.getByTestId('model-svg')).toBeVisible();
});


test('LED con router y precio de venta para Monterrey', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('family-kitchen_wall').click();
  await page.getByText('Iluminación LED').first().click();
  await page.getByTestId('mod-led').selectOption('under_cabinet');
  await expect(page.getByTestId('led-legend')).toContainText('Ranura LED');
  await expect(page.getByTestId('model-svg').locator('line[data-kind="led"]')).toHaveCount(1);

  // Taller: el router aparece como esencial y señala la ranura en el modelo
  await page.getByTestId('tab-workshop').click();
  await expect(page.getByTestId('equipment-router')).toBeVisible();
  await page.getByTestId('equipment-model-router').click();
  await expect(page.getByTestId('model-sheet').locator('line[data-kind="led"]')).toHaveCount(1);
  await page.keyboard.press('Escape');

  // Precio de venta
  await page.getByTestId('tab-price').click();
  await expect(page.getByTestId('price-tab')).toBeVisible();
  await expect(page.getByTestId('market-bar')).toBeVisible();
  await expect(page.getByTestId('tier-saludable')).toContainText('Sin LED');
  await expect(page.getByRole('radiogroup', { name: 'Nivel de precio' })).toContainText('Recomendado');
  const estimated = await page.getByTestId('price-recommended').textContent();
  await page.getByTestId('input-cost').fill('9000');
  await expect(page.getByTestId('price-recommended')).not.toHaveText(estimated ?? '');
  await expect(page.getByTestId('price-breakdown')).toContainText('lo que capturaste');
  await expect(page.getByTestId('price-health')).toContainText('Utilidad neta');
  await page.getByTestId('tier-premium').click();
  await expect(page.getByTestId('tier-premium')).toHaveAttribute('aria-checked', 'true');
  const before = await page.getByTestId('price-recommended').textContent();
  await page.getByTestId('price-settings').locator('summary').click();
  await page.getByTestId('market-margin-2').fill('35');
  await expect(page.getByTestId('price-recommended')).not.toHaveText(before ?? '');
  await expect(page.getByTestId('price-materials')).toContainText('Referencia MTY');
  // Se guarda con el proyecto
  await expect(page.getByTestId('save-state')).toContainText('Guardado', { timeout: 10_000 });
  await page.reload();
  await page.getByTestId('tab-price').click();
  await expect(page.getByTestId('input-cost')).toHaveValue('9000');
});
