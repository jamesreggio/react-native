/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

package com.facebook.react.views.scroll;

import com.facebook.infer.annotation.Assertions;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.PixelUtil;
import java.util.Map;
import javax.annotation.Nullable;

/**
 * Helper for view managers to handle commands like 'scrollTo'.
 * Shared by {@link ReactScrollViewManager} and {@link ReactHorizontalScrollViewManager}.
 */
public class ReactScrollViewCommandHelper {

  public static final int COMMAND_SCROLL_TO = 1;
  public static final int COMMAND_SCROLL_TO_END = 2;
  public static final int COMMAND_FLASH_SCROLL_INDICATORS = 3;
  public static final int COMMAND_BEGIN_NESTED_SCROLLING = 10;
  public static final int COMMAND_END_NESTED_SCROLLING = 11;
  public static final int COMMAND_SET_BOUNCES_TOP = 20;
  public static final int COMMAND_SET_BOUNCES_BOTTOM = 21;
  public static final int COMMAND_SET_BOUNCES_LEFT = 22;
  public static final int COMMAND_SET_BOUNCES_RIGHT = 23;

  public interface ScrollCommandHandler<T> {
    void scrollTo(T scrollView, ScrollToCommandData data);
    void scrollToEnd(T scrollView, ScrollToEndCommandData data);
    void flashScrollIndicators(T scrollView);
    void beginNestedScrolling(T scrollView);
    void endNestedScrolling(T scrollView);
    void setBouncesTop(T scrollView, boolean bounces);
    void setBouncesBottom(T scrollView, boolean bounces);
    void setBouncesLeft(T scrollView, boolean bounces);
    void setBouncesRight(T scrollView, boolean bounces);
  }

  public static class ScrollToCommandData {

    public final int mDestX, mDestY;
    public final boolean mAnimated;

    ScrollToCommandData(int destX, int destY, boolean animated) {
      mDestX = destX;
      mDestY = destY;
      mAnimated = animated;
    }
  }

  public static class ScrollToEndCommandData {

    public final boolean mAnimated;

    ScrollToEndCommandData(boolean animated) {
      mAnimated = animated;
    }
  }

  public static Map<String,Integer> getCommandsMap() {
    return MapBuilder.of(
        "scrollTo",
        COMMAND_SCROLL_TO,
        "scrollToEnd",
        COMMAND_SCROLL_TO_END,
        "flashScrollIndicators",
        COMMAND_FLASH_SCROLL_INDICATORS,
        "beginNestedScrolling",
        COMMAND_BEGIN_NESTED_SCROLLING,
        "endNestedScrolling",
        COMMAND_END_NESTED_SCROLLING,
        "setBouncesTop",
        COMMAND_SET_BOUNCES_TOP,
        "setBouncesBottom",
        COMMAND_SET_BOUNCES_BOTTOM,
        "setBouncesLeft",
        COMMAND_SET_BOUNCES_LEFT,
        "setBouncesRight",
        COMMAND_SET_BOUNCES_RIGHT
      );
  }

  public static <T> void receiveCommand(
      ScrollCommandHandler<T> viewManager,
      T scrollView,
      int commandType,
      @Nullable ReadableArray args) {
    Assertions.assertNotNull(viewManager);
    Assertions.assertNotNull(scrollView);
    Assertions.assertNotNull(args);
    switch (commandType) {
      case COMMAND_SCROLL_TO: {
        int destX = Math.round(PixelUtil.toPixelFromDIP(args.getDouble(0)));
        int destY = Math.round(PixelUtil.toPixelFromDIP(args.getDouble(1)));
        boolean animated = args.getBoolean(2);
        viewManager.scrollTo(scrollView, new ScrollToCommandData(destX, destY, animated));
        return;
      }
      case COMMAND_SCROLL_TO_END: {
        boolean animated = args.getBoolean(0);
        viewManager.scrollToEnd(scrollView, new ScrollToEndCommandData(animated));
        return;
      }
      case COMMAND_FLASH_SCROLL_INDICATORS:
        viewManager.flashScrollIndicators(scrollView);
        return;
      case COMMAND_BEGIN_NESTED_SCROLLING:
        viewManager.beginNestedScrolling(scrollView);
        return;
      case COMMAND_END_NESTED_SCROLLING:
        viewManager.endNestedScrolling(scrollView);
        return;
      case COMMAND_SET_BOUNCES_TOP:
        viewManager.setBouncesTop(scrollView, args.getBoolean(0));
        return;
      case COMMAND_SET_BOUNCES_BOTTOM:
        viewManager.setBouncesBottom(scrollView, args.getBoolean(0));
        return;
      case COMMAND_SET_BOUNCES_LEFT:
        viewManager.setBouncesLeft(scrollView, args.getBoolean(0));
        return;
      case COMMAND_SET_BOUNCES_RIGHT:
        viewManager.setBouncesRight(scrollView, args.getBoolean(0));
        return;

      default:
        throw new IllegalArgumentException(String.format(
            "Unsupported command %d received by %s.",
            commandType,
            viewManager.getClass().getSimpleName()));
    }
  }
}
