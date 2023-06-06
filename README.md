# FuseFi Interface

[![Tests](https://github.com/fuseio/fusefi-interface/workflows/Tests/badge.svg)](https://github.com/fuseio/fusefi-interface/actions?query=workflow%3ATests)
[![Styled With Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io/)

An open source interface for FuseFi -- a protocol for decentralized exchange of Fuse tokens.

- Website: [fuse.io](https://fuse.io/)
- Interface: [app.fuse.fi](https://app.fuse.fi)
- Twitter: [fuse_network](https://twitter.com/fuse_network)
- Discord: [Uniswap](https://discord.com/invite/jpPMeSZ)

## Accessing the Uniswap Interface

To access the Uniswap Interface, use an IPFS gateway link from the
[latest release](https://github.com/fuseio/fusefi-interface/releases/latest), 
or visit [app.uniswap.org](https://app.fuse.fi).

## Development

### Install Dependencies

```bash
yarn
```

### Run

```bash
yarn start
```

### Configuring the environment (optional)

To have the interface default to a different network when a wallet is not connected:

1. Make a copy of `.env` named `.env.local`
2. Change `REACT_APP_NETWORK_ID` to `"{YOUR_NETWORK_ID}"`
3. Change `REACT_APP_NETWORK_URL` to e.g. `"https://{YOUR_NETWORK_ID}.infura.io/v3/{YOUR_INFURA_KEY}"` 
