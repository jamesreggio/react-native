/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule AnimatedProps
 * @flow
 * @format
 */
'use strict';

const {AnimatedEvent} = require('../AnimatedEvent');
const AnimatedNode = require('./AnimatedNode');
const AnimatedStyle = require('./AnimatedStyle');
const NativeAnimatedHelper = require('../NativeAnimatedHelper');
const ReactNative = require('ReactNative');

const invariant = require('fbjs/lib/invariant');
const deepDiffer = require('deepDiffer');

function animatedKeys(object) {
  return Object.keys(object).filter(key => (
    key === 'style' ||
    object[key] instanceof AnimatedNode ||
    object[key] instanceof AnimatedEvent
  ));
}

function animatedDiff(a, b) {
  let _attachedEvent;
  if (a instanceof AnimatedEvent) {
    ({_attachedEvent, ...a} = a);
  }
  if (b instanceof AnimatedEvent) {
    ({_attachedEvent, ...b} = b);
  }
  return deepDiffer(a, b);
}

function viewLocation(view) {
  return view ? view._reactInternalFiber._debugSource : null;
}

class AnimatedProps extends AnimatedNode {
  _view: any;
  _props: Object;
  _callback: () => void;
  _styleProp: AnimatedStyle;
  _firstValueReturned: Boolean;
  _reattachAll: Boolean;

  constructor(props: Object, callback: () => void) {
    super();
    this._props = props;
    this._callback = callback;
    this.__attach();
  }

  /**
   * Lifecycle methods.
   */

  __attach(): void {
    super.__attach();
    this.__attachValueProps();
    this.__attachEventProps();
  }

  __detach(): void {
    this.__disconnectView();
    this.__detachEventProps();
    this.__detachValueProps();
    super.__detach();
  }

  updateView(nextView: any): void {
    if (this._view === nextView) {
      return;
    }
    this.__detachEventProps();
    this.__disconnectView();
    this._view = nextView;
    this.__connectView();
    this.__attachEventProps();
  }

  __makeNative(): void {
    if (this.__isNative) {
      return;
    }
    if (this._firstValueReturned) {
      if (window.logAnimatedPerf) {
        console.log(
          '[animated]',
          'making native after first values returned',
          viewLocation(this._view),
        );
      }
      this._reattachAll = true;
    }
    this.__isNative = true;
    this.__makeValuePropsNative();
    this.__connectView();
  }

  update(): void {
    this._callback();
  }

  updateProps(nextProps: Object): void {
    // __getValue() excludes values for native animated props.
    //
    // Normally, the component will go native before __getValue() is ever
    // called, and thus the native animated props are never returned by
    // __getValue().
    //
    // In the rare event that the component goes native after __getValue() is
    // called, the result of __getValue() will begin to omit the keys for the
    // newly-native animated props. The React prop diffing algorithm will
    // incorrectly determine that these now-missing native animated values need
    // to be nullified and will send the appropriate native commands.
    //
    // In this scenario, we need to forcibly reattach all of the native
    // animated props in order to avoid their values from being nullified.
    // this._reattachAll signals this scenario.
    const reattachAll = this._reattachAll;

    const lastProps = this._props;
    let lastKeys = animatedKeys(lastProps);
    nextProps = Object.assign({}, nextProps);
    const nextKeys = animatedKeys(nextProps);

    nextKeys.forEach(key => {
      if (reattachAll || animatedDiff(lastProps[key], nextProps[key])) {
        if (window.logAnimatedPerf) {
          console.log(
            '[animated]',
            'updating animated key',
            key,
            viewLocation(this._view),
          );
        }
        this.__replaceProp(key, lastProps[key], nextProps[key]);
      } else {
        if (window.logAnimatedPerf) {
          console.log('[animated]', 'reusing animated key', key);
        }
        nextProps[key] = lastProps[key];
      }
      lastKeys = lastKeys.filter(lastKey => lastKey !== key);
    });

    lastKeys.forEach(key => {
      if (window.logAnimatedPerf) {
        console.log(
          '[animated]',
          'detaching nullified key',
          key,
          viewLocation(this._view),
        );
      }
      this.__detachProp(key, lastProps[key]);
    });

    this._props = nextProps;
    this._reattachAll = false;
  }

  /**
   * View management.
   */

  __scrollableView(): any {
    return this._view.getScrollableNode ?
      this._view.getScrollableNode() :
      this._view;
  }

  __connectView(): void {
    if (!(this.__isNative && this._view)) {
      return;
    }
    const viewTag = ReactNative.findNodeHandle(this._view);
    invariant(viewTag != null, 'Unable to locate view in the native tree');
    NativeAnimatedHelper.API.connectAnimatedNodeToView(this.__getNativeTag(), viewTag);
  }

  __disconnectView(): void {
    if (!(this.__isNative && this._view)) {
      return;
    }
    const viewTag = ReactNative.findNodeHandle(this._view);
    invariant(viewTag != null, 'Unable to locate view in the native tree');
    NativeAnimatedHelper.API.disconnectAnimatedNodeFromView(this.__getNativeTag(), viewTag);
  }

  /**
   * Prop management.
   */

  __replaceProp(key: string, lastValue: any, nextValue: any): void {
    if (key === 'style') {
      invariant(this._styleProp, 'Expected style prop to detach');
      lastValue = this._styleProp;
      this._styleProp = null;
    }
    this.__attachProp(key, nextValue);
    this.__detachProp(key, lastValue);
  }

  __attachProp(key: string, value: any): void {
    this.__attachValueProp(key, value);
    this.__makeValuePropNative(key, value);
    this.__attachEventProp(key, value);
  }

  __attachValueProps(): void {
    Object.entries(this._props).forEach(
      ([key, value]) => this.__attachValueProp(key, value)
    );
  }

  __attachValueProp(key: string, value: any): void {
    if (key === 'style' && !(value instanceof AnimatedStyle)) {
      invariant(!this._styleProp, 'Expected last style prop to be detached');
      value = this._styleProp = new AnimatedStyle(value);
    }
    if (!(value instanceof AnimatedNode)) {
      return;
    }
    value.__addChild(this);
  }

  __attachEventProps(): void {
    Object.entries(this._props).forEach(
      ([key, value]) => this.__attachEventProp(key, value)
    );
  }

  __attachEventProp(key: string, value: any): void {
    if (!(this._view && value instanceof AnimatedEvent && value.__isNative)) {
      return;
    }
    value.__attach(this.__scrollableView(), key);
  }

  __detachProp(key: string, value: any): void {
    this.__detachValueProp(key, value);
    this.__detachEventProp(key, value);
  }

  __detachValueProps(): void {
    Object.entries(this._props).forEach(
      ([key, value]) => this.__detachValueProp(key, value)
    );
  }

  __detachValueProp(key: string, value: any): void {
    if (key === 'style' && !(value instanceof AnimatedStyle)) {
      invariant(this._styleProp, 'Expected style prop to detach');
      value = this._styleProp;
      this._styleProp = null;
    }
    if (!(value instanceof AnimatedNode)) {
      return;
    }
    value.__removeChild(this);
  }

  __detachEventProps(): void {
    Object.entries(this._props).forEach(
      ([key, value]) => this.__detachEventProp(key, value)
    );
  }

  __detachEventProp(key: string, value: any): void {
    if (!(this._view && value instanceof AnimatedEvent && value.__isNative)) {
      return;
    }
    value.__detach(this.__scrollableView(), key);
  }

  __makeValuePropsNative(): void {
    Object.entries(this._props).forEach(
      ([key, value]) => this.__makeValuePropNative(key, value)
    );
  }

  __makeValuePropNative(key: string, value: any): void {
    if (!this.__isNative) {
      return;
    }
    if (key === 'style') {
      invariant(this._styleProp, 'Expected style prop to make native');
      value = this._styleProp;
    }
    if (!(value instanceof AnimatedNode)) {
      return;
    }
    value.__makeNative();
  }

  /**
   * Value accessors.
   */

  __getValue(): Object {
    this._firstValueReturned = true;
    return Object.entries(this._props).reduce((props, [key, value]) => {
      if (key === 'style') {
        invariant(this._styleProp, 'Expected style prop');
        value = this._styleProp;
      }
      if (value instanceof AnimatedNode) {
        if (!value.__isNative || value instanceof AnimatedStyle) {
          // We cannot use value of natively driven nodes this way as the value
          // we have access from JS may not be up to date.
          props[key] = value.__getValue();
        }
      } else if (value instanceof AnimatedEvent) {
        props[key] = value.__getHandler();
      } else {
        props[key] = value;
      }
      return props;
    }, {});
  }

  __getAnimatedValue(): Object {
    return Object.entries(this._props).reduce((props, [key, value]) => {
      if (key === 'style') {
        invariant(this._styleProp, 'Expected style prop');
        value = this._styleProp;
      }
      if (value instanceof AnimatedNode) {
        props[key] = value.__getAnimatedValue();
      }
      return props;
    }, {});
  }

  __getNativeConfig(): Object {
    const props = Object.entries(this._props).reduce((props, [key, value]) => {
      if (key === 'style') {
        invariant(this._styleProp, 'Expected style prop');
        value = this._styleProp;
      }
      if (value instanceof AnimatedNode) {
        props[key] = value.__getNativeTag();
      }
      return props;
    }, {});
    return {type: 'props', props};
  }
}

module.exports = AnimatedProps;
