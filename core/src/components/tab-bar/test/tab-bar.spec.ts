import { newSpecPage } from '@stencil/core/testing';

import { TabBar } from '../tab-bar';

/**
 * @deprecated - This test verifies the deprecation warning for `tab-bar-hidden`.
 * It should be removed when `tab-bar-hidden` is removed in a future
 * major version of Ionic.
 *
 * The add/remove class behavior is covered by the e2e tests in
 * core/src/components/tab-bar/test/keyboard/tab-bar.e2e.ts.
 */
describe('ion-tab-bar: tab-bar-hidden (deprecated)', () => {
  it('should warn about tab-bar-hidden deprecation when keyboard first opens', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const page = await newSpecPage({
      components: [TabBar],
      html: '<ion-tab-bar></ion-tab-bar>',
    });

    expect(warnSpy).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('tab-bar-hidden');

    // Second keyboard open should not re-warn
    window.dispatchEvent(new Event('keyboardWillHide'));
    await page.waitForChanges();
    window.dispatchEvent(new Event('keyboardWillShow'));
    await page.waitForChanges();

    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
