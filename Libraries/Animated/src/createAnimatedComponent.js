/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createAnimatedComponent
 * @flow
 * @format
 */
'use strict';

const {AnimatedEvent} = require('./AnimatedEvent');
const AnimatedProps = require('./nodes/AnimatedProps');
const AnimatedNode = require('./nodes/AnimatedNode');
const React = require('React');
const ViewStylePropTypes = require('ViewStylePropTypes');
const deepDiffer = require('deepDiffer');

function animatedValueKeys(object) {
  return Object.keys(object).filter(key => (
    key === 'style' ||
    object[key] instanceof AnimatedNode
  ));
}

function animatedEventKeys(object) {
  return Object.keys(object).filter(key => (
    object[key] instanceof AnimatedEvent
  ));
}

function animatedValueDiff(a, b) {
  return deepDiffer(a, b);
}

function animatedEventDiff(a, b) {
  let _attachedEvent;
  if (a instanceof AnimatedEvent) {
    ({_attachedEvent, ...a} = a);
  }
  if (b instanceof AnimatedEvent) {
    ({_attachedEvent, ...b} = b);
  }
  return deepDiffer(a, b);
}

function animatedPropsChanged(lastProps, nextProps, getKeys, diff) {
  const lastKeys = getKeys(lastProps);
  const nextKeys = getKeys(nextProps);

  if (!deepDiffer(lastKeys, nextKeys)) {
    for (const key of lastKeys) {
      if (diff(lastProps[key], nextProps[key])) {
        return key;
      }
    }

    return false;
  }

  return true;
}

function animatedValuePropsChanged(lastProps, nextProps) {
  return animatedPropsChanged(lastProps, nextProps, animatedValueKeys, animatedValueDiff);
}

function animatedEventPropsChanged(lastProps, nextProps) {
  return animatedPropsChanged(lastProps, nextProps, animatedEventKeys, animatedEventDiff);
}

function createAnimatedComponent(Component: any): any {
  class AnimatedComponent extends React.Component<Object> {
    _component: any;
    _invokeAnimatedPropsCallbackOnMount: boolean = false;
    _prevComponent: any;
    _propsAnimated: AnimatedProps;
    _eventDetachers: Array<Function> = [];
    _setComponentRef: Function;

    static __skipSetNativeProps_FOR_TESTS_ONLY = false;

    constructor(props: Object) {
      super(props);
      this._setComponentRef = this._setComponentRef.bind(this);
    }

    componentWillUnmount() {
      this._propsAnimated && this._propsAnimated.__detach();
      this._detachNativeEvents();
    }

    setNativeProps(props) {
      this._component.setNativeProps(props);
    }

    componentWillMount() {
      this._attachProps(this.props);
    }

    componentDidMount() {
      if (this._invokeAnimatedPropsCallbackOnMount) {
        this._invokeAnimatedPropsCallbackOnMount = false;
        this._animatedPropsCallback();
      }

      this._attachProps(this.props, true);
      this._propsAnimated.setNativeView(this._component);
      this._attachNativeEvents();
      this.forceUpdate();
    }

    _attachNativeEvents() {
      // Make sure to get the scrollable node for components that implement
      // `ScrollResponder.Mixin`.
      const scrollableNode = this._component.getScrollableNode
        ? this._component.getScrollableNode()
        : this._component;

      for (const key in this.props) {
        const prop = this.props[key];
        if (prop instanceof AnimatedEvent && prop.__isNative) {
          prop.__attach(scrollableNode, key);
          this._eventDetachers.push(() => prop.__detach(scrollableNode, key));
        }
      }
    }

    _detachNativeEvents() {
      this._eventDetachers.forEach(remove => remove());
      this._eventDetachers = [];
    }

    // The system is best designed when setNativeProps is implemented. It is
    // able to avoid re-rendering and directly set the attributes that changed.
    // However, setNativeProps can only be implemented on leaf native
    // components. If you want to animate a composite component, you need to
    // re-render it. In this case, we have a fallback that uses forceUpdate.
    _animatedPropsCallback = () => {
      if (this._component == null) {
        // AnimatedProps is created in will-mount because it's used in render.
        // But this callback may be invoked before mount in async mode,
        // In which case we should defer the setNativeProps() call.
        // React may throw away uncommitted work in async mode,
        // So a deferred call won't always be invoked.
        this._invokeAnimatedPropsCallbackOnMount = true;
      } else if (
        AnimatedComponent.__skipSetNativeProps_FOR_TESTS_ONLY ||
        typeof this._component.setNativeProps !== 'function'
      ) {
        this.forceUpdate();
      } else if (!this._propsAnimated.__isNative) {
        this._component.setNativeProps(
          this._propsAnimated.__getAnimatedValue(),
        );
      } else {
        throw new Error(
          'Attempting to run JS driven animation on animated ' +
            'node that has been moved to "native" earlier by starting an ' +
            'animation with `useNativeDriver: true`',
        );
      }
    };

    _attachProps(nextProps, force = !this._propsAnimated) {
      const changed = animatedValuePropsChanged(this.props, nextProps);

      if (force || changed) {
        if (changed && window.logAnimatedPerf) {
          console.log(
            '[animated]',
            'reattaching values for prop',
            changed,
            this.props[changed],
            nextProps[changed],
          );
        }

        const oldPropsAnimated = this._propsAnimated;

        this._propsAnimated = new AnimatedProps(
          nextProps,
          this._animatedPropsCallback,
        );

        // When you call detach, it removes the element from the parent list
        // of children. If it goes to 0, then the parent also detaches itself
        // and so on.
        // An optimization is to attach the new elements and THEN detach the old
        // ones instead of detaching and THEN attaching.
        // This way the intermediate state isn't to go to 0 and trigger
        // this expensive recursive detaching to then re-attach everything on
        // the very next operation.
        oldPropsAnimated && oldPropsAnimated.__detach();
      } else {
        if (window.logAnimatedPerf) {
          console.log('[animated]', 'reusing value props');
        }

        this._propsAnimated.updateProps(nextProps);
      }
    }

    componentWillReceiveProps(newProps) {
      this._attachProps(newProps);
    }

    componentDidUpdate(prevProps) {
      const componentChanged = (this._component !== this._prevComponent);
      const propsChanged = animatedEventPropsChanged(prevProps, this.props);

      if (componentChanged) {
        this._propsAnimated.setNativeView(this._component);
      }

      if (componentChanged || propsChanged) {
        if (propsChanged && window.logAnimatedPerf) {
          console.log(
            '[animated]',
            'reattaching events for prop',
            propsChanged,
          );
        }

        this._detachNativeEvents();
        this._attachNativeEvents();
      }
    }

    render() {
      const props = this._propsAnimated.__getValue();
      return (
        <Component
          {...props}
          ref={this._setComponentRef}
          // The native driver updates views directly through the UI thread so we
          // have to make sure the view doesn't get optimized away because it cannot
          // go through the NativeViewHierachyManager since it operates on the shadow
          // thread.
          collapsable={
            this._propsAnimated.__isNative ? false : props.collapsable
          }
        />
      );
    }

    _setComponentRef(c) {
      this._prevComponent = this._component;
      this._component = c;
    }

    // A third party library can use getNode()
    // to get the node reference of the decorated component
    getNode() {
      return this._component;
    }
  }

  const propTypes = Component.propTypes;

  AnimatedComponent.propTypes = {
    style: function(props, propName, componentName) {
      if (!propTypes) {
        return;
      }

      for (const key in ViewStylePropTypes) {
        if (!propTypes[key] && props[key] !== undefined) {
          console.warn(
            'You are setting the style `{ ' +
              key +
              ': ... }` as a prop. You ' +
              'should nest it in a style object. ' +
              'E.g. `{ style: { ' +
              key +
              ': ... } }`',
          );
        }
      }
    },
  };

  return AnimatedComponent;
}

module.exports = createAnimatedComponent;
