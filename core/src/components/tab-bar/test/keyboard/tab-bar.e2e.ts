import { expect } from '@playwright/test';
import { configs, test } from '@utils/test/playwright';

/**
 * Tab bar keyboard-hiding behavior does not vary across modes or directions.
 * The CSS :host-context() rule applies regardless of mode/RTL.
 *
 * These tests verify the CSS hiding behavior driven by ion-app.keyboard-showing,
 * and the backward-compatible tab-bar-hidden class. Both require a real browser
 * to exercise the :host-context() selector inside the shadow DOM, which is why
 * these are e2e tests rather than spec tests.
 */
configs({ modes: ['ios'], directions: ['ltr'] }).forEach(({ title, config }) => {
  test.describe(title('tab-bar: keyboard'), () => {
    test('should hide via CSS when keyboard opens', async ({ page }) => {
      await page.setContent(
        `
        <ion-app>
          <ion-tab-bar>
            <ion-tab-button tab="1"><ion-label>Tab 1</ion-label></ion-tab-button>
          </ion-tab-bar>
        </ion-app>
      `,
        config
      );

      const tabBar = page.locator('ion-tab-bar');
      await expect(tabBar).toBeVisible();

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(tabBar).toBeHidden();
    });

    test('should show again when keyboard closes', async ({ page }) => {
      await page.setContent(
        `
        <ion-app>
          <ion-tab-bar>
            <ion-tab-button tab="1"><ion-label>Tab 1</ion-label></ion-tab-button>
          </ion-tab-bar>
        </ion-app>
      `,
        config
      );

      const tabBar = page.locator('ion-tab-bar');

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(tabBar).toBeHidden();

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillHide')));
      await page.waitForChanges();

      await expect(tabBar).toBeVisible();
    });

    test('should not hide when slot="top" and keyboard opens', async ({ page }) => {
      await page.setContent(
        `
        <ion-app>
          <ion-tab-bar slot="top">
            <ion-tab-button tab="1"><ion-label>Tab 1</ion-label></ion-tab-button>
          </ion-tab-bar>
        </ion-app>
      `,
        config
      );

      const tabBar = page.locator('ion-tab-bar');
      await expect(tabBar).toBeVisible();

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(tabBar).toBeVisible();
    });

    /**
     * @deprecated - This test verifies that the deprecated `tab-bar-hidden` class
     * is still emitted for backward compatibility. Remove when `tab-bar-hidden`
     * is removed in a future major version of Ionic.
     */
    test('should still set deprecated tab-bar-hidden class when keyboard opens', async ({ page }) => {
      await page.setContent(
        `
        <ion-app>
          <ion-tab-bar>
            <ion-tab-button tab="1"><ion-label>Tab 1</ion-label></ion-tab-button>
          </ion-tab-bar>
        </ion-app>
      `,
        config
      );

      const tabBar = page.locator('ion-tab-bar');
      await expect(tabBar).not.toHaveClass(/tab-bar-hidden/);

      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();

      await expect(tabBar).toHaveClass(/tab-bar-hidden/);
    });
  });
});
