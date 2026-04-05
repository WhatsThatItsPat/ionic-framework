import type { ComponentInterface, EventEmitter } from '@stencil/core';
import { Component, Element, Event, Host, Prop, State, Watch, h } from '@stencil/core';
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
   * Whether the tab bar should be hidden because the keyboard is open.
   * Updated by the MutationObserver watching `ion-app` for the
   * `keyboard-showing` class (set by `ion-app`'s KeyboardController).
   */
  @State() keyboardHidden = false;

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
     * Watch `ion-app` for the `keyboard-showing` class (set by `ion-app`'s
     * own KeyboardController when the soft keyboard opens). When detected,
     * set `keyboardHidden` state so the `tab-bar-hidden` host class is
     * applied via render(), which triggers the CSS `:host(.tab-bar-hidden)`
     * rule to hide this element.
     *
     * NOTE: We use `:host(.tab-bar-hidden)` rather than
     * `:host-context(ion-app.keyboard-showing)` because `:host-context()`
     * is not supported on Safari/WebKit (iOS). See:
     * https://caniuse.com/?search=host-context
     * https://github.com/w3c/csswg-drafts/issues/1914
     */
    const ionApp = this.el.closest('ion-app');
    if (ionApp) {
      this.keyboardObserver = new MutationObserver(() => {
        this.keyboardHidden = ionApp.classList.contains('keyboard-showing') && this.el.getAttribute('slot') !== 'top';
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
    const { color, translucent, keyboardHidden } = this;
    const mode = getIonMode(this);

    return (
      <Host
        role="tablist"
        class={createColorClasses(color, {
          [mode]: true,
          'tab-bar-translucent': translucent,
          'tab-bar-hidden': keyboardHidden,
        })}
      >
        <slot></slot>
      </Host>
    );
  }
}
