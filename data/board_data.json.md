# board_data.json

This file is a snapshot of the **Plankers Bingo 2026** board data exported from Praynr.

## Source

The data was retrieved from the Praynr board:

- Board: https://praynr.com/#/bingo/Plankers%20Bingo%202026

using the Praynr backend API endpoint:

```text
GET https://praynr.com/getBoard/Plankers%20Bingo%202026/Plankers/general
```

The endpoint returns the JSON representation of the bingo board used by the web application.

## Why this file exists

This repository includes a local copy of the board data so that:

- development does not depend on the Praynr service being available
- changes to the upstream board do not unexpectedly affect this project
- the board can be analyzed, transformed, or tested offline
- the exact data used by this project is versioned in Git

## API documentation

The `getBoard` endpoint is implemented by the Praynr Flask API server and is documented in the project architecture documentation:

https://github.com/PattyRich/github-pages/blob/3e87f8903d940e86930d9aea6884714bf1888a2e/docs/architecture.md#flask-api-serverpy

## Regenerating this file

To refresh the snapshot, download the JSON from:

```text
https://praynr.com/getBoard/Plankers%20Bingo%202026/Plankers/general
```

and replace `board_data.json` with the latest response.