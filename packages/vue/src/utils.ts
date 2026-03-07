import type { Config as CoreConfig } from "@ionic/core/components";
import {
  LIFECYCLE_DID_ENTER,
  LIFECYCLE_DID_LEAVE,
  LIFECYCLE_WILL_ENTER,
  LIFECYCLE_WILL_LEAVE,
  TAB_ROOT_CLICK,
} from "@ionic/core/components";
import type { Ref, ComponentPublicInstance } from "vue";

type PAGE_EVENTS =
  | typeof LIFECYCLE_WILL_ENTER
  | typeof LIFECYCLE_DID_ENTER
  | typeof LIFECYCLE_WILL_LEAVE
  | typeof LIFECYCLE_DID_LEAVE
  | typeof TAB_ROOT_CLICK;

// TODO(FW-2969): types

export enum LifecycleHooks {
  WillEnter = "onIonViewWillEnter",
  DidEnter = "onIonViewDidEnter",
  WillLeave = "onIonViewWillLeave",
  DidLeave = "onIonViewDidLeave",
  TabRootClick = "onIonTabRootClick",
}
const hookNames: Record<string, LifecycleHooks> = {
  [LIFECYCLE_WILL_ENTER]: LifecycleHooks.WillEnter,
  [LIFECYCLE_DID_ENTER]: LifecycleHooks.DidEnter,
  [LIFECYCLE_WILL_LEAVE]: LifecycleHooks.WillLeave,
  [LIFECYCLE_DID_LEAVE]: LifecycleHooks.DidLeave,
  [TAB_ROOT_CLICK]: LifecycleHooks.TabRootClick,
};

const ids: { [k: string]: number } = { main: 0 };

export const generateId = (type = "main") => {
  const id = (ids[type] ?? 0) + 1;
  ids[type] = id;
  return id.toString();
};

export const fireLifecycle = (
  vueComponent: any,
  vueInstance: Ref<ComponentPublicInstance>,
  lifecycle: PAGE_EVENTS
) => {
  if (vueComponent?.[lifecycle]) {
    vueComponent[lifecycle].bind(vueInstance?.value)();
  }

  const instance = vueInstance?.value as any;
  if (instance?.[lifecycle]) {
    instance[lifecycle]();
  }

  /**
   * Fire any Composition API
   * Ionic Lifecycle hooks
   */
  if (instance) {
    const hook = hookNames[lifecycle];
    const hooks = instance[hook];
    if (hooks) {
      hooks.forEach((hook: Function) => hook());
    }
  }
};

export const getConfig = (): CoreConfig | null => {
  if (typeof (window as any) !== "undefined") {
    const Ionic = (window as any).Ionic;
    if (Ionic && Ionic.config) {
      return Ionic.config;
    }
  }
  return null;
};
