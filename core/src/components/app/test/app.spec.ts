import { newSpecPage } from '@stencil/core/testing';

import { App } from '../app';

describe('ion-app: keyboard', () => {
  it('should add keyboard-is-open class to ion-app when keyboard opens', async () => {
    const page = await newSpecPage({
      components: [App],
      html: '<ion-app></ion-app>',
    });

    const appEl = page.body.querySelector('ion-app')!;
    expect(appEl.classList.contains('keyboard-is-open')).toBe(false);

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-is-open')).toBe(true);
  });

  it('should remove keyboard-is-open class from ion-app when keyboard closes', async () => {
    const page = await newSpecPage({
      components: [App],
      html: '<ion-app></ion-app>',
    });

    const appEl = page.body.querySelector('ion-app')!;

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-is-open')).toBe(true);

    window.dispatchEvent(new Event('keyboardWillHide'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-is-open')).toBe(false);
  });
});
