---
name: Browser checks on Nix
description: Choosing a runnable Chromium for local browser verification in this environment.
---

Use the provided system Chromium rather than assuming a newly downloaded
Playwright Chromium binary will run on this Nix environment.

**Why:** The downloaded browser failed at startup because its Linux shared
libraries were not available through the standard loader; the supplied Chromium
wrapper launched successfully.

**How to apply:** Check `command -v chromium` and use that executable with
Playwright's `executablePath` for local authenticated UI checks. Do not add an auth
bypass for screenshots, and do not install unsupported apt dependencies.
