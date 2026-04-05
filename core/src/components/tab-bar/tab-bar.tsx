import type { ComponentInterface, EventEmitter } from '@stencil/core';
import { Component, Element, Event, Host, Prop, Watch, h } from '@stencil/core';
import { createColorClasses } from '@utils/theme';

import { getIonMode } from '../../global/ionic-global';
import type { Color } from '../../interface';

import type { TabBarChangedEventDetail } from './tab-bar-interface';

/**
 * @virtualProp {"ios" | "md"} mode - The mode determines which platform styles to use.
 */
@Component({
  tag: 'ion-tab-bar',
  styleUrls: {
    ios: 'tab-bar.ios.scss',
    md: 'tab-bar.md.scss',
  },
  shadow: true,
})
export class TabBar implements ComponentInterface {
  private keyboardObserver: MutationObserver | null = null;
  private didLoad = false;

  @Element() el!: HTMLElement;

  /**
   * The color to use from your application's color palette.
   * Default options are: `"primary"`, `"secondary"`, `"tertiary"`, `"success"`, `"warning"`, `"danger"`, `"light"`, `"medium"`, and `"dark"`.
   * For more information on colors, see [theming](/docs/theming/basics).
   */
  @Prop({ reflect: true }) color?: Color;

  /**
   * The selected tab component
   */
  @Prop() selectedTab?: string;
  @Watch('selectedTab')
  selectedTabChanged() {
    // Skip the initial watcher call that happens during component load
    // We handle that in componentDidLoad to ensure children are ready
    if (!this.didLoad) {
      return;
    }

    if (this.selectedTab !== undefined) {
      this.ionTabBarChanged.emit({
        tab: this.selectedTab,
      });
    }
  }

  /**
   * If `true`, the tab bar will be translucent.
   * Only applies when the mode is `"ios"` and the device supports
   * [`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter#Browser_compatibility).
   */
  @Prop() translucent = false;

  /** @internal */
  @Event() ionTabBarChanged!: EventEmitter<TabBarChangedEventDetail>;

  /**
   * @internal
   * This event is used in IonContent to correctly
   * calculate the fullscreen content offsets
   * when IonTabBar is used.
   */
  @Event() ionTabBarLoaded!: EventEmitter<void>;

  componentDidLoad() {
    this.ionTabBarLoaded.emit();
    // Set the flag to indicate the component has loaded
    // This allows the watcher to emit changes from this point forward
    this.didLoad = true;

    // Emit the initial selected tab after the component is fully loaded
    // This ensures all child components (ion-tab-button) are ready
    if (this.selectedTab !== undefined) {
      this.ionTabBarChanged.emit({
        tab: this.selectedTab,
      });
    }
  }

  connectedCallback() {
    /**
     * @deprecated - The `tab-bar-hidden` class is deprecated.
     * The tab bar is now hidden via the
     * `:host-context(ion-app.keyboard-showing)` CSS selector
     * (the `keyboard-showing` class is set on `ion-app` by its own
     * KeyboardController).
     *
     * This observer watches `ion-app` for the `keyboard-showing` class
     * and mirrors it as the legacy `tab-bar-hidden` class on this element
     * for backward compatibility. It will be removed in a future major
     * version of Ionic.
     */
    const ionApp = this.el.closest('ion-app');
    if (ionApp) {
      this.keyboardObserver = new MutationObserver(() => {
        const shouldHide = ionApp.classList.contains('keyboard-showing') && this.el.getAttribute('slot') !== 'top';
        this.el.classList.toggle('tab-bar-hidden', shouldHide);
      });
      this.keyboardObserver.observe(ionApp, { attributes: true, attributeFilter: ['class'] });
    }
  }

  disconnectedCallback() {
    if (this.keyboardObserver) {
      this.keyboardObserver.disconnect();
      this.keyboardObserver = null;
    }
  }

  render() {
    const { color, translucent } = this;
    const mode = getIonMode(this);

    return (
      <Host
        role="tablist"
        class={createColorClasses(color, {
          [mode]: true,
          'tab-bar-translucent': translucent,
        })}
      >
        <slot></slot>
      </Host>
    );
  }
}
