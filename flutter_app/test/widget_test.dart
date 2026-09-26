import 'package:flutter_test/flutter_test.dart';

import 'package:mobiduka_pos/main.dart';

void main() {
  testWidgets('renders the MobiDuka application shell',
      (WidgetTester tester) async {
    await tester.pumpWidget(const MobiDukaApp());

    expect(find.byType(MobiDukaApp), findsOneWidget);
  });
}
