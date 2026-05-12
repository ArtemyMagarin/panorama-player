# Yandex Metrika goals helper

This folder contains a small helper for creating JavaScript action goals in Yandex Metrika without adding them manually in the UI.

## Files

- [`add-goals.sh`](add-goals.sh) — creates goals for every counter listed in [`counters.json`](counters.json), skipping goals that already exist.
- [`counters.json`](counters.json) — list of Yandex Metrika counter IDs.
- [`goals.json`](goals.json) — list of goals to create.

## Prerequisites

1. Get a Yandex Metrika OAuth token [here](https://oauth.yandex.ru/authorize?response_type=token&client_id=24837799f3704b7a8e160da1e7a89de9)
2. Export it as `YANDEX_METRIKA_TOKEN`:

```sh
export YANDEX_METRIKA_TOKEN="your_token"
```

You can also put this export into your shell profile, for example `.zshrc`.

## Goal format

Each item in [`goals.json`](goals.json) should use this shape:

```json
{
  "name": "Human-readable goal name",
  "conditions": [
    {
      "type": "exact",
      "url": "reach_goal_key"
    }
  ]
}
```

For JavaScript action goals, keep `type` set to `exact`. The `url` value must match the key passed to `reachGoal()` in the demo code.

Example:

```js
ym(109155448, 'reachGoal', 'select_gallery_image');
```

Requires this goal condition:

```json
{
  "type": "exact",
  "url": "select_gallery_image"
}
```

## Usage

Run the script from this directory because it reads [`counters.json`](counters.json) and [`goals.json`](goals.json) via relative paths:

```sh
cd scripts/metrika
./add-goals.sh
```

The script prints a per-counter report with created, already existing, and failed goals.

## Notes

- Existing goals are detected by condition `url`, with goal `name` as a fallback.
- The script uses `curl` and basic shell tools only.
- The current goals mirror analytics keys used by the demo page in [`../../demo/demo.js`](../../demo/demo.js).
