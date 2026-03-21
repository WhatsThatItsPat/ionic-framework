/**
 *  https://ionicframework.com/docs/api/router-outlet#life-cycle-hooks
 */

export interface ViewWillEnter {
  /**
   * Fired when the component routing to is about to animate into view.
   */
  ionViewWillEnter(): void;
}

export interface ViewDidEnter {
  /**
   * Fired when the component routing to has finished animating.
   */
  ionViewDidEnter(): void;
}

export interface ViewWillLeave {
  /**
   * Fired when the component routing from is about to animate.
   */
  ionViewWillLeave(): void;
}

export interface ViewDidLeave {
  /**
   * Fired when the component routing to has finished animating.
   */
  ionViewDidLeave(): void;
}

/**
 * Not a lifecycle hook, but uses the same auto-binding mechanism.
 * Fired when the user taps the active tab button while already
 * at the root page of that tab's navigation stack.
 */
export interface TabRootTap {
  ionTabRootTap(): void;
}
