import { expect } from '@playwright/test';
import { configs, test } from '@utils/test/playwright';

/**
 * Keyboard state applies globally to ion-app and does not vary
 * across modes or layout directions.
 */
configs({ modes: ['ios'], directions: ['ltr'] }).forEach(({ title, config }) => {
  test.describe(title('app: keyboard'), () => {
    test('should add keyboard-showing class when keyboard opens', async ({ page }) => {
      await page.setContent(`<ion-app></ion-app>`, config);

      const ionApp = page.locator('ion-app');
      await expect(ionApp).not.toHaveClass(/keyboard-showing/);

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(ionApp).toHaveClass(/keyboard-showing/);
    });

    test('should remove keyboard-showing class when keyboard closes', async ({ page }) => {
      await page.setContent(`<ion-app></ion-app>`, config);

      const ionApp = page.locator('ion-app');

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(ionApp).toHaveClass(/keyboard-showing/);

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillHide')));
      await page.waitForChanges();

      await expect(ionApp).not.toHaveClass(/keyboard-showing/);
    });
  });
});
