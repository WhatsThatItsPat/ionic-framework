import { TAB_ROOT_TAP } from '@ionic/core/components';
import type { RefObject } from 'react';
import { useContext, useEffect, useRef } from 'react';

import type { LifeCycleCallback } from '../contexts/IonLifeCycleContext';
import { IonLifeCycleContext } from '../contexts/IonLifeCycleContext';

export const useIonViewWillEnter = (callback: LifeCycleCallback, deps: any[] = []) => {
  const context = useContext(IonLifeCycleContext);
  const id = useRef<number | undefined>();
  id.current = id.current || Math.floor(Math.random() * 1000000);
  useEffect(() => {
    callback.id = id.current!;
    context.onIonViewWillEnter(callback);
    return () => {
      context.cleanupIonViewWillEnter(callback);
    };
  }, deps);
};

export const useIonViewDidEnter = (callback: LifeCycleCallback, deps: any[] = []) => {
  const context = useContext(IonLifeCycleContext);
  const id = useRef<number | undefined>();
  id.current = id.current || Math.floor(Math.random() * 1000000);
  useEffect(() => {
    callback.id = id.current!;
    context.onIonViewDidEnter(callback);
    return () => {
      context.cleanupIonViewDidEnter(callback);
    };
  }, deps);
};

export const useIonViewWillLeave = (callback: LifeCycleCallback, deps: any[] = []) => {
  const context = useContext(IonLifeCycleContext);
  const id = useRef<number | undefined>();
  id.current = id.current || Math.floor(Math.random() * 1000000);
  useEffect(() => {
    callback.id = id.current!;
    context.onIonViewWillLeave(callback);
    return () => {
      context.cleanupIonViewWillLeave(callback);
    };
  }, deps);
};

export const useIonViewDidLeave = (callback: LifeCycleCallback, deps: any[] = []) => {
  const context = useContext(IonLifeCycleContext);
  const id = useRef<number | undefined>();
  id.current = id.current || Math.floor(Math.random() * 1000000);
  useEffect(() => {
    callback.id = id.current!;
    context.onIonViewDidLeave(callback);
    return () => {
      context.cleanupIonViewDidLeave(callback);
    };
  }, deps);
};

/**
 * Listens for the `ionTabRootTap` event, which fires when the user taps
 * the active tab button while already at the root page of that tab's stack.
 *
 * Unlike the lifecycle hooks above, this does not use the lifecycle context.
 * Instead it listens for the DOM event directly via capture on `document`,
 * scoped to the page containing the provided element ref.
 *
 * @param elementRef - Ref to any element inside the page (e.g. IonContent).
 *   Used to determine which page this hook belongs to.
 * @param callback - Called when the active tab root is tapped.
 * @param deps - Dependency array (same semantics as `useEffect`).
 */
export const useIonTabRootTap = (
  elementRef: RefObject<HTMLElement | null>,
  callback: () => void,
  deps: any[] = []
) => {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const handler = (ev: Event) => {
      const pageEl = ev.target as HTMLElement;
      if (elementRef.current && pageEl.contains(elementRef.current)) {
        savedCallback.current();
      }
    };
    document.addEventListener(TAB_ROOT_TAP, handler, true);
    return () => document.removeEventListener(TAB_ROOT_TAP, handler, true);
  }, deps);
};
