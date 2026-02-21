import { newSpecPage } from '@stencil/core/testing';

import { TabBar } from '../tab-bar';

/**
 * @deprecated - These tests verify that `tab-bar-hidden` continues to be
 * emitted during the deprecation period for backward compatibility.
 * They should be removed when `tab-bar-hidden` is removed in a future
 * major version of Ionic.
 */
describe('ion-tab-bar: tab-bar-hidden (deprecated)', () => {
  it('should add tab-bar-hidden class when keyboard opens', async () => {
    const page = await newSpecPage({
      components: [TabBar],
      html: '<ion-tab-bar></ion-tab-bar>',
    });

    const tabBarEl = page.body.querySelector('ion-tab-bar')!;
    expect(tabBarEl.classList.contains('tab-bar-hidden')).toBe(false);

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(tabBarEl.classList.contains('tab-bar-hidden')).toBe(true);
  });

  it('should remove tab-bar-hidden class when keyboard closes', async () => {
    const page = await newSpecPage({
      components: [TabBar],
      html: '<ion-tab-bar></ion-tab-bar>',
    });

    const tabBarEl = page.body.querySelector('ion-tab-bar')!;

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(tabBarEl.classList.contains('tab-bar-hidden')).toBe(true);

    window.dispatchEvent(new Event('keyboardWillHide'));
    await page.waitForChanges();

    expect(tabBarEl.classList.contains('tab-bar-hidden')).toBe(false);
  });
});
