# Third-Party Notices

Slide Cut is licensed under the MIT License. This file summarizes third-party
software, assets, and external tools that may be included in or used with
distributed builds.

## Bundled Assets and Frontend Packages

- Pretendard font files are provided by the `pretendard` npm package and are
  licensed under the SIL Open Font License 1.1 (`OFL-1.1`).
- JetBrains Mono font files are bundled for Git slide code rendering and are
  licensed under the SIL Open Font License 1.1 (`OFL-1.1`).
- Lucide icons and the bundled `lucide.min.js` runtime are provided by the
  `lucide` npm package and are licensed under the ISC License.

## Framework and Build Dependencies

- Tauri, Rust crates, npm packages, and related build dependencies remain under
  their own licenses. See `Cargo.lock`, `package-lock.json`, and the upstream
  package repositories for the complete dependency list and license metadata.

## External Tools and Services

- FFmpeg and ffprobe are used as external command-line tools for video export.
  They are not bundled with this repository; their own licenses apply when users
  install or distribute them.
- OpenAI and MiniMax services are optional API providers for narration features.
  Their service terms apply separately from this project's source code license.
