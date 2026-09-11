# MobiDuka POS

This project is a Next.js App Router implementation of the MobiDuka POS prototype. The original UI logic remains preserved in the app shell, while the modular screens continue to live in the app component tree.

## App structure

- `app/` – Next.js App Router entry and page shell
- `app/components/` – UI screens and modular view components
- `app/global.css` – shared styling and design tokens
- `flutter_app/` – existing Flutter implementation kept alongside the web app

## Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to view the app.

## Notes

The Flutter implementation remains available in the `flutter_app/` directory for native/mobile experimentation and should be treated as a parallel project to this Next.js web app.
