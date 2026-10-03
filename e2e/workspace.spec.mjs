import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('bookmark persistence, search, transfer, and safe URL handling', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New collection', exact: true }).click();
  await page.getByLabel('Collection name').fill('Reading');
  await page.locator('#collection-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Add bookmark', exact: true }).click();
  await page.getByLabel('URL', { exact: true }).fill('javascript:alert(1)');
  await page.getByLabel('Title', { exact: true }).fill('Reference');
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.locator('#bookmark-dialog')).toBeVisible();
  await expect(page.locator('#url-feedback')).not.toHaveText('Paste a web address to save a page.');
  await page.getByLabel('URL', { exact: true }).fill('https://example.org/reference?utm_source=test');
  await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption({ label: 'Reading' });
  await page.getByLabel('Tags', { exact: true }).fill('engineering, reading');
  await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Reference', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Reference', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('missing-result');
  await expect(page.getByRole('link', { name: 'Reference', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('engineering');
  await expect(page.getByRole('link', { name: 'Reference', exact: true })).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON', exact: true }).click()]);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.format).toBe('linkshelf');
  expect(backup.bookmarks).toHaveLength(1);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#import-preview')).toContainText('1 duplicate');
  await expect(page.getByRole('button', { name: 'Import bookmarks', exact: true })).toBeDisabled();
  await page.locator('#import-dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(errors).toEqual([]);
});

test('advanced search, accessible bulk changes, validation, and deletion confirmation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New collection', exact: true }).click();
  await page.getByLabel('Collection name').fill('Reading list');
  await page.locator('#collection-form button[type=submit]').click();

  async function addBookmark({ title, url, tags, collection = 'Reading list' }) {
    const previousCount = Number(await page.locator('#bookmark-count').textContent());
    await page.getByRole('button', { name: 'Add bookmark', exact: true }).click();
    await page.getByLabel('URL', { exact: true }).fill(url);
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption({ label: collection });
    await page.getByLabel('Tags', { exact: true }).fill(tags);
    await page.getByRole('button', { name: 'Save bookmark', exact: true }).click();
    await expect(page.locator('#bookmark-count')).toHaveText(String(previousCount + 1));
  }

  await addBookmark({ title: 'Design systems guide', url: 'https://docs.example.org/design-systems', tags: 'research, systems' });
  await addBookmark({ title: 'Design systems draft', url: 'https://docs.example.org/draft', tags: 'draft, research' });
  await addBookmark({ title: 'Weekend plan', url: 'https://travel.example.com/weekend', tags: 'travel', collection: 'Unsorted' });

  const searchbox = page.getByRole('searchbox');
  const mixedQuery = '"Design systems" collection:"Reading list" site:example.org tag:research -tag:draft';
  await searchbox.fill(mixedQuery);
  await expect(searchbox).toHaveValue(mixedQuery);
  await expect(page.getByRole('link', { name: 'Design systems guide', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Design systems draft', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox').fill('tag:');
  await expect(page.getByRole('alert')).toContainText("Add a value after 'tag:'.");
  await expect(page.locator('#bookmarks .bookmark-card')).toHaveCount(0);

  await page.getByRole('searchbox').fill('tag:research');
  const guideCheckbox = page.getByRole('checkbox', { name: 'Select Design systems guide' });
  await guideCheckbox.focus();
  await guideCheckbox.press('Space');
  const restoredGuideCheckbox = page.getByRole('checkbox', { name: 'Select Design systems guide' });
  await expect(restoredGuideCheckbox).toBeFocused();
  await expect(page.locator('#selection-count')).toHaveText('1 selected');
  await page.getByRole('button', { name: 'Edit Design systems guide' }).click();
  await page.getByLabel('Tags', { exact: true }).fill('systems, revised');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Design systems guide', exact: true })).toHaveCount(0);
  await expect(page.locator('#selection-count')).toHaveText('0 selected');

  await page.getByRole('searchbox').fill('collection:"Reading list"');
  await page.getByRole('checkbox', { name: 'Select visible results' }).check();
  await expect(page.locator('#selection-count')).toHaveText('2 selected');
  await page.getByRole('combobox', { name: 'Move selected bookmarks to' }).selectOption({ label: 'Unsorted' });
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(page.getByText('2 bookmarks moved.')).toBeVisible();
  await expect(page.locator('#selection-count')).toHaveText('0 selected');

  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: /^All bookmarks/ }).click();
  await page.getByRole('searchbox').fill('site:example.org');
  await page.getByRole('checkbox', { name: 'Select visible results' }).check();
  const tooLong = 'x'.repeat(33);
  await page.locator('#bulk-tags').fill(tooLong);
  await page.getByRole('button', { name: 'Add tags', exact: true }).click();
  await expect(page.getByText('Each tag must be 32 characters or fewer.')).toBeVisible();
  await expect(page.getByRole('button', { name: tooLong, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Design systems guide', exact: true })).toBeVisible();
  await page.locator('#bulk-tags').fill('reviewed, follow-up');
  await page.getByRole('button', { name: 'Add tags', exact: true }).click();
  await expect(page.getByText('Tags added to 2 bookmarks.')).toBeVisible();

  const pageWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.content).toBeLessThanOrEqual(pageWidth.viewport);

  await page.reload();
  await page.getByRole('searchbox').fill('site:example.org');
  await expect(page.locator('#bookmarks').getByRole('button', { name: 'reviewed', exact: true })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Select visible results' }).check();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete selected bookmarks?' })).toBeVisible();
  await expect(page.locator('#bulk-delete-copy')).toContainText('2 selected bookmarks will be permanently deleted');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete selected bookmarks?' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Design systems guide', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await page.getByRole('button', { name: 'Delete bookmarks', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Design systems guide', exact: true })).toHaveCount(0);
  await expect(page.getByText('2 bookmarks deleted.')).toBeVisible();
  expect(errors).toEqual([]);
});
