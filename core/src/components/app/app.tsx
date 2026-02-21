import type { ComponentInterface } from '@stencil/core';
import { Build, Component, Element, Host, Method, State, h } from '@stencil/core';
import type { FocusVisibleUtility } from '@utils/focus-visible';
import { shouldUseCloseWatcher } from '@utils/hardware-back-button';
import type { KeyboardController } from '@utils/keyboard/keyboard-controller';
import { createKeyboardController } from '@utils/keyboard/keyboard-controller';
import { printIonWarning } from '@utils/logging';
import { isPlatform } from '@utils/platform';

import { config } from '../../global/config';
import { getIonMode } from '../../global/ionic-global';

@Component({
  tag: 'ion-app',
  styleUrl: 'app.scss',
})
export class App implements ComponentInterface {
  private focusVisible?: FocusVisibleUtility;
  private loadTimeout?: ReturnType<typeof setTimeout> | undefined;
  private keyboardCtrl: KeyboardController | null = null;
  private keyboardCtrlPromise: Promise<KeyboardController> | null = null;

  @Element() el!: HTMLElement;

  @State() keyboardVisible = false;

  async connectedCallback() {
    const promise = createKeyboardController(async (keyboardOpen, waitForResize) => {
      /**
       * If the keyboard is hiding, then we need to wait
       * for the webview to resize. Otherwise, content relying
       * on the keyboard-is-open class will reflow before
       * the webview resizes.
       */
      if (keyboardOpen === false && waitForResize !== undefined) {
        await waitForResize;
      }

      this.keyboardVisible = keyboardOpen; // trigger re-render by updating state
    });
    this.keyboardCtrlPromise = promise;

    const keyboardCtrl = await promise;

    /**
     * Only assign if this is still the current promise.
     * Otherwise, a new connectedCallback has started or
     * disconnectedCallback was called, so destroy this instance.
     */
    if (this.keyboardCtrlPromise === promise) {
      this.keyboardCtrl = keyboardCtrl;
      this.keyboardCtrlPromise = null;
    } else {
      keyboardCtrl.destroy();
    }
  }

  componentDidLoad() {
    if (Build.isBrowser) {
      this.rIC(async () => {
        const isHybrid = isPlatform(window, 'hybrid');
        if (!config.getBoolean('_testing')) {
          import('../../utils/tap-click').then((module) => module.startTapClick(config));
        }
        if (config.getBoolean('statusTap', isHybrid)) {
          import('../../utils/status-tap').then((module) => module.startStatusTap());
        }
        if (config.getBoolean('inputShims', needInputShims())) {
          /**
           * needInputShims() ensures that only iOS and Android
           * platforms proceed into this block.
           */
          const platform = isPlatform(window, 'ios') ? 'ios' : 'android';
          import('../../utils/input-shims/input-shims').then((module) => module.startInputShims(config, platform));
        }
        const hardwareBackButtonModule = await import('../../utils/hardware-back-button');
        const supportsHardwareBackButtonEvents = isHybrid || shouldUseCloseWatcher();
        if (config.getBoolean('hardwareBackButton', supportsHardwareBackButtonEvents)) {
          hardwareBackButtonModule.startHardwareBackButton();
        } else {
          /**
           * If an app sets hardwareBackButton: false and experimentalCloseWatcher: true
           * then the close watcher will not be used.
           */
          if (shouldUseCloseWatcher()) {
            printIonWarning(
              '[ion-app] - experimentalCloseWatcher was set to `true`, but hardwareBackButton was set to `false`. Both config options must be `true` for the Close Watcher API to be used.'
            );
          }

          hardwareBackButtonModule.blockHardwareBackButton();
        }
        if (typeof (window as any) !== 'undefined') {
          import('../../utils/keyboard/keyboard').then((module) => module.startKeyboardAssist(window));
        }
        import('../../utils/focus-visible').then((module) => (this.focusVisible = module.startFocusVisible()));
      });
    }
  }

  disconnectedCallback() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    if (this.keyboardCtrlPromise) {
      this.keyboardCtrlPromise.then((ctrl) => ctrl.destroy());
      this.keyboardCtrlPromise = null;
    }

    if (this.keyboardCtrl) {
      this.keyboardCtrl.destroy();
      this.keyboardCtrl = null;
    }
  }

  /**
   * Used to set focus on an element that uses `ion-focusable`.
   * Do not use this if focusing the element as a result of a keyboard
   * event as the focus utility should handle this for us. This method
   * should be used when we want to programmatically focus an element as
   * a result of another user action. (Ex: We focus the first element
   * inside of a popover when the user presents it, but the popover is not always
   * presented as a result of keyboard action.)
   *
   * @param elements An array of HTML elements to set focus on.
   */
  @Method()
  async setFocus(elements: HTMLElement[]) {
    if (this.focusVisible) {
      this.focusVisible.setFocus(elements);
    }
  }

  private rIC(callback: () => void) {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback);
    } else {
      this.loadTimeout = setTimeout(callback, 32);
    }
  }

  render() {
    const mode = getIonMode(this);
    return (
      <Host
        class={{
          [mode]: true,
          'ion-page': true,
          'force-statusbar-padding': config.getBoolean('_forceStatusbarPadding'),
          'keyboard-is-open': this.keyboardVisible,
        }}
      ></Host>
    );
  }
}

const needInputShims = () => {
  /**
   * iOS always needs input shims
   */
  const needsShimsIOS = isPlatform(window, 'ios') && isPlatform(window, 'mobile');
  if (needsShimsIOS) {
    return true;
  }

  /**
   * Android only needs input shims when running
   * in the browser and only if the browser is using the
   * new Chrome 108+ resize behavior: https://developer.chrome.com/blog/viewport-resize-behavior/
   */
  const isAndroidMobileWeb = isPlatform(window, 'android') && isPlatform(window, 'mobileweb');
  if (isAndroidMobileWeb) {
    return true;
  }

  return false;
};
