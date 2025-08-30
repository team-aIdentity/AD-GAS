# Gasless Wallet SDK

## Project Overview

This project aims to develop a Gasless Wallet SDK using EIP-4337 Account Abstraction. The core purpose is to allow users to execute blockchain transactions without paying for gas fees directly. Instead, the gas fees are sponsored, and the cost is covered by an advertising-based revenue model.

The project is designed to be developer-friendly and support multiple EVM-compatible chains.

**Key Technologies:**
*   **Smart Contracts:** Solidity, EIP-4337, OpenZeppelin Contracts.
*   **SDK:** TypeScript, Ethers.js v6.
*   **Infrastructure:** UserOperation Bundler (e.g., Stackup, Alchemy), multi-chain RPC endpoints.

**Architecture:**
The system consists of two main components:
1.  A **Paymaster Smart Contract** that handles gas fee payments and transaction validation.
2.  A **TypeScript SDK** that allows developers to integrate the gasless transaction functionality into their applications. The SDK will provide APIs for smart account creation, transaction submission, and batching.

## Building and Running

**TODO:** This section should be updated once the project structure is in place.

It is expected that the project will use a standard Node.js/TypeScript setup. The following commands are placeholders based on common practices:

*   **Install Dependencies:**
    ```bash
    npm install
    ```

*   **Build the SDK:**
    ```bash
    npm run build
    ```

*   **Run Tests:**
    ```bash
    npm run test
    ```

*   **Compile Smart Contracts (using Hardhat):**
    ```bash
    npx hardhat compile
    ```

## Development Conventions

*   **Smart Contracts:**
    *   Use Solidity `^0.8.20`.
    *   Follow the EIP-4337 standard for Account Abstraction.
    *   Incorporate OpenZeppelin Contracts for security best practices.
    *   The development environment will be Hardhat.
    *   Security is paramount: contracts must be audited and include features like re-entrancy guards and emergency stops.

*   **SDK:**
    *   Written in TypeScript for type safety.
    *   Built on top of Ethers.js v6.
    *   Provide a simple, intuitive API for developers (target: 3 lines of code for integration).
    *   Include detailed documentation, API references, and example code.

*   **Code Style:**
    *   While not explicitly defined, a consistent code style should be maintained. It is recommended to use Prettier and ESLint for the TypeScript codebase.
