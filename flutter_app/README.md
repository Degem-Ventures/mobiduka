# MobiDuka POS Flutter Replica

A self-contained Flutter replica of the MobiDuka mobile POS prototype. It includes the phone-style shell, seeded Kenyan retail data, dashboard, POS, inventory, customers, More navigation, and interactive Reports & Analytics charts.

## Requirements

- Flutter 3.19 or newer
- Dart 3.3 or newer
- An Android emulator, iOS simulator, or Chrome

## Run

```bash
cd flutter_app
flutter pub get
flutter run
```

For a browser preview:

```bash
flutter run -d chrome
```

## Included screens

- Login landing screen with Get Started and Quick PIN Login
- Dashboard with sales, profit, till, M-Pesa, top products, transactions, and low-stock data
- POS product list with the supplied 12-item dataset
- Inventory and customer registry views
- More menu with linked store-management destinations
- Reports & Analytics with Daily, Monthly, and Profit tabs
- `fl_chart` area, bar, and pie charts with current/future data states

## Project structure

```text
flutter_app/
  lib/
    main.dart
  pubspec.yaml
  README.md
```

The app is intentionally local-only and uses demo data. No backend or credentials are required.
