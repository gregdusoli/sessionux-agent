# Sessionux Agent

Secure local workstation unlocking system for Linux.

## Overview

The Sessionux Agent is a background service and UI for Linux that allows users to unlock their sessions using a paired mobile device via a local network.

## Features

- mDNS discovery for zero-config setup.
- Secure Ed25519 cryptographic signing.
- Persistent system tray integration.
- Secure local storage for trusted device keys.

## Tech Stack

- **Framework:** Electron + Node.js
- **Server:** Fastify
- **Language:** TypeScript
- **Communication:** mDNS (_sessionux._tcp)

## Development

Currently in Phase 0.
