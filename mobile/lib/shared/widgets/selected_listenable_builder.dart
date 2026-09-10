import 'package:flutter/widgets.dart';

/// Rebuilds only when the selected immutable value changes. Records are useful
/// for selecting several primitive fields without copying controller state.
class SelectedListenableBuilder<T> extends StatefulWidget {
  final Listenable listenable;
  final T Function() select;
  final Widget Function(BuildContext context, T value) builder;
  const SelectedListenableBuilder({
    super.key,
    required this.listenable,
    required this.select,
    required this.builder,
  });

  @override
  State<SelectedListenableBuilder<T>> createState() =>
      _SelectedListenableBuilderState<T>();
}

class _SelectedListenableBuilderState<T>
    extends State<SelectedListenableBuilder<T>> {
  late T value;

  @override
  void initState() {
    super.initState();
    value = widget.select();
    widget.listenable.addListener(changed);
  }

  void changed() {
    final next = widget.select();
    if (next != value) setState(() => value = next);
  }

  @override
  void didUpdateWidget(covariant SelectedListenableBuilder<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.listenable != widget.listenable) {
      oldWidget.listenable.removeListener(changed);
      widget.listenable.addListener(changed);
    }
    value = widget.select();
  }

  @override
  void dispose() {
    widget.listenable.removeListener(changed);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, value);
}
