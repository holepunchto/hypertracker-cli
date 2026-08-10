![CI](https://github.com/holepunchto/hypertracker-cli/actions/workflows/ci.yml/badge.svg)

# Hypertracker CLI

CLI to run a [hypertracker](https://github.com/holepunchto/hypertracker) peer-discovery service backed by HyperDHT, with optional Prometheus instrumentation via a [hyperdht-prometheus](https://github.com/holepunchto/hyperdht-prometheus) scraper.

Supports both Node.js and Bare.

## Installation

```shell
npm i -g hypertracker-cli
```

## Usage

```shell
hypertracker run --help
hypertracker-bare run --help
```

### Flags

- `--storage, -s <path>` — Storage path, defaults to `./hypertracker-storage`
- `--scraper-public-key <key>` — Public key of a hyperdht-prometheus scraper. Can be hex or z32.
- `--scraper-secret <secret>` — Secret of the hyperdht-prometheus scraper. Can be hex or z32.
- `--scraper-alias <alias>` — (optional) Alias with which to register to the scraper.
- `--bootstrap <nodes>` — (optional) Bootstrap nodes for the DHT, as a JSON array.

## Example

```shell
hypertracker run --storage ./my-hypertracker-store
```

## License

Apache-2.0
