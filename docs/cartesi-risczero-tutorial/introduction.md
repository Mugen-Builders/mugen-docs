# Introduction

[RISC Zero](https://dev.risczero.com/api) is a zero-knowledge virtual machine (zkVM) that enables developers to prove the correctness of computations without revealing sensitive input data. Using zero-knowledge proofs (ZKPs), it allows anyone to verify that a program executed honestly, even on untrusted hardware, while keeping inputs private—critical for applications like confidential financial transactions or private identity verification.  

[Cartesi](https://docs.cartesi.io/) scales blockchain applications by enabling complex computations to run off-chain in a deterministic Linux environment. The Cartesi Machine bridges blockchain smart contracts with off-chain processing, ensuring verifiable results without blockchain performance constraints.  

**Why Integrate Them?**  

By combining RISC Zero’s privacy-preserving proofs with Cartesi’s scalable off-chain compute, developers can:  
- **Verify private computations**: Prove a result is valid (e.g., a credit score check) without exposing underlying data.  
- **Scale trustlessly**: Run intensive computations off-chain (e.g., ML inference) and prove correctness on-chain.  
- **Build hybrid dApps**: Leverage ZKPs for privacy-critical steps and Cartesi for resource-heavy tasks.  


In this document, we will walk through the process of integrating RISC Zero and Cartesi to create a proof-of-concept that verifies a RISC Zero-generated proof *inside* a Cartesi Machine.
  



