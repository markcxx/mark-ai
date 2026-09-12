import 'package:flutter/cupertino.dart';

/// A full-page route whose horizontal back gesture reveals the previous route.
/// Child sliders and horizontal scrollers keep priority in the gesture arena.
class SwipeBackRoute<T> extends CupertinoPageRoute<T> {
  SwipeBackRoute({required super.builder, this.reduceMotion = false});
  final bool reduceMotion;
  bool dragging = false;

  @override
  Duration get transitionDuration =>
      reduceMotion ? Duration.zero : const Duration(milliseconds: 280);
  @override
  Duration get reverseTransitionDuration => transitionDuration;

  void start() {
    if (!popGestureEnabled) return;
    dragging = true;
    navigator!.didStartUserGesture();
  }

  void update(double delta, double width) {
    if (dragging) controller!.value -= delta / width;
  }

  void finish({double velocity = 0, bool cancel = false}) {
    if (!dragging) return;
    dragging = false;
    final nav = navigator!;
    final pop =
        !cancel &&
        (velocity.abs() > 600 ? velocity > 0 : controller!.value < .5);
    if (pop && isCurrent) {
      nav.pop();
    } else {
      controller!.animateTo(
        1,
        duration: transitionDuration,
        curve: Curves.easeOutCubic,
      );
    }
    if (controller!.isAnimating) {
      late AnimationStatusListener done;
      done = (_) {
        controller!.removeStatusListener(done);
        nav.didStopUserGesture();
      };
      controller!.addStatusListener(done);
    } else {
      nav.didStopUserGesture();
    }
  }

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return CupertinoPageTransition(
      primaryRouteAnimation: animation,
      secondaryRouteAnimation: secondaryAnimation,
      linearTransition: popGestureInProgress,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragStart: (_) => start(),
        onHorizontalDragUpdate: (event) =>
            update(event.delta.dx, MediaQuery.sizeOf(context).width),
        onHorizontalDragEnd: (event) =>
            finish(velocity: event.primaryVelocity ?? 0),
        onHorizontalDragCancel: () => finish(cancel: true),
        child: child,
      ),
    );
  }
}
