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
const React = require('React');
const ViewStylePropTypes = require('ViewStylePropTypes');

function createAnimatedComponent(Component: any): any {
  class AnimatedComponent extends React.Component<Object> {
    _component: any;
    _prevComponent: any;
    _animatedProps: AnimatedProps;
    _eventDetachers: Array<Function> = [];
    _setComponentRef: Function;

    static __skipSetNativeProps_FOR_TESTS_ONLY = false;

    constructor(props: Object) {
      super(props);
      this._setComponentRef = this._setComponentRef.bind(this);
    }

    componentWillUnmount() {
      this._animatedProps.__detach();
    }

    setNativeProps(props) {
      this._component.setNativeProps(props);
    }

    componentWillMount() {
      this._attachProps(this.props);
    }

    componentDidMount() {
      this._animatedProps.updateView(this._component);
    }

    _attachProps(nextProps) {
      // The system is best designed when setNativeProps is implemented. It is
      // able to avoid re-rendering and directly set the attributes that
      // changed. However, setNativeProps can only be implemented on leaf
      // native components. If you want to animate a composite component, you
      // need to re-render it. In this case, we have a fallback that uses
      // forceUpdate.
      const callback = () => {
        if (this._component.setNativeProps) {
          if (!this._animatedProps.__isNative) {
            this._component.setNativeProps(this._animatedProps.__getAnimatedValue());
          } else {
            throw new Error([
              'Attempting to run JS driven animation on animated node that',
              'has been moved to "native" earlier by starting an animation',
              'with `useNativeDriver: true`'
            ].join(' '));
          }
        } else {
          this.forceUpdate();
        }
      };

      this._animatedProps = new AnimatedProps(this.props, callback);
    }

    componentWillReceiveProps(nextProps) {
      this._animatedProps.updateProps(nextProps);
    }

    componentDidUpdate(prevProps) {
      if (this._component !== this._prevComponent) {
        this._animatedProps.updateView(this._component);
      }
    }

    render() {
      const props = this._animatedProps.__getValue();

      // The native driver updates views directly through the UI thread so we
      // have to make sure the view doesn't get optimized away because it
      // cannot go through the NativeViewHierachyManager since it operates on
      // the shadow thread.
      const collapsible = (
        this._animatedProps.__isNative ? false : props.collapsable
      );

      return (
        <Component
          {...props}
          ref={this._setComponentRef}
          collapsable={collapsible}
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

  // ReactNative `View.propTypes` have been deprecated in favor of
  // `ViewPropTypes`. In their place a temporary getter has been added with a
  // deprecated warning message. Avoid triggering that warning here by using
  // temporary workaround, __propTypesSecretDontUseThesePlease.
  // TODO (bvaughn) Revert this particular change any time after April 1
  const propTypes =
    Component.__propTypesSecretDontUseThesePlease || Component.propTypes;

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
