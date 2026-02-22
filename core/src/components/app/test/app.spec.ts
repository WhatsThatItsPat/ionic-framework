import { newSpecPage } from '@stencil/core/testing';

import { App } from '../app';

describe('ion-app: keyboard', () => {
  it('should add keyboard-showing class to ion-app when keyboard opens', async () => {
    const page = await newSpecPage({
      components: [App],
      html: '<ion-app></ion-app>',
    });

    const appEl = page.body.querySelector('ion-app')!;
    expect(appEl.classList.contains('keyboard-showing')).toBe(false);

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-showing')).toBe(true);
  });

  it('should remove keyboard-showing class from ion-app when keyboard closes', async () => {
    const page = await newSpecPage({
      components: [App],
      html: '<ion-app></ion-app>',
    });

    const appEl = page.body.querySelector('ion-app')!;

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-showing')).toBe(true);

    window.dispatchEvent(new Event('keyboardWillHide'));
    await page.waitForChanges();

    expect(appEl.classList.contains('keyboard-showing')).toBe(false);
  });
});
