# Introduction

[RISC Zero](https://dev.risczero.com/api) is a zero-knowledge virtual machine (zkVM) that enables developers to prove the correctness of computations while keeping input data private. [Cartesi](https://docs.cartesi.io/) provides scalable off-chain computation in a deterministic Linux environment, bridging blockchain smart contracts with powerful off-chain processing.

## Understanding Zero-Knowledge Proofs

Zero-knowledge proofs (ZKPs) are cryptographic methods that enable one party (the prover) to convince another party (the verifier) that a statement is true without revealing any information beyond the statement's validity. In RISC Zero's implementation, the prover executes a program within the zkVM and generates a cryptographic proof that mathematically guarantees correct execution. The verifier can validate this execution without access to private inputs or performing re-computation, with the proof size being substantially smaller than the original computation.

### Receipt Types and Their Trade-offs

RISC Zero implements a proving system with three receipt variants, each optimized for different use cases:

1. **Composite Receipt** - Contains multiple STARK proofs for program segments (>100kb). Best for development and testing.

2. **Succinct Receipt** - Compressed using STARK recursion with a single unified proof for the entire computation (>100kb). Ideal for production systems with moderate size constraints.

3. **Groth16 Receipt** - Uses STARK-to-SNARK conversion for maximum compression with trusted setup (less than 1kb). Optimal for on-chain verification and storage-constrained systems.

:::important
Groth16 receipt generation requires x86 architecture due to the STARK-to-SNARK prover implementation. Apple Silicon users must use remote proving services or x86 servers.
:::

## Proving Infrastructure

### Local Proving

Local proving offers native execution on developer hardware with full control over the proving process. It requires 16GB+ RAM (32GB+ recommended for complex computations) and x86 architecture for Groth16 receipts, making it suitable for development and small-scale deployments.

### Remote Proving

1. **Bonsai Proving Service** - A managed, scalable infrastructure supporting all receipt types with automatic hardware optimization and usage-based pricing. Requires API key.

2. **Custom Proving Server** - Self-hosted infrastructure with configurable hardware allocation and custom queue management, providing full control over proving parameters but with higher operational overhead.

## Integration Patterns with Cartesi

This tutorial explores two powerful integration patterns:

1. **Cartesi Rollups Integration** - Verifies RISC Zero proofs within Cartesi's Linux runtime, enabling privacy-preserving computations in rollups while handling complex verification logic off-chain.

2. **Cartesi Machine as Coprocessor** - Leverages Cartesi Machine for computation-heavy tasks while generating RISC Zero proofs for privacy-sensitive operations, creating hybrid solutions with optimal resource allocation.

### Key Benefits

The RISC Zero + Cartesi integration enables privacy-preserving computation with cryptographic guarantees, scalable off-chain processing with on-chain verifiability, and complex computations without blockchain resource constraints. This combination provides flexible proof generation strategies and supports sophisticated dApp architectures.

The following chapters provide a step-by-step guide to implementing a proof-of-concept that demonstrates these capabilities through practical examples and real-world use cases.
