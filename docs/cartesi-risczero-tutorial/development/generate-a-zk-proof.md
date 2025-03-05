# Generate a ZK Proof

We'll create a program that proves we know two numbers that multiply to a specific result, without revealing those numbers.

## Create a new project

```bash
cargo risczero new multiply_proof --guest-name multiply
```

This command creates a project with the following structure:

```
multiply_proof/
├── Cargo.toml
├── host/
│   └── src/
│       └── main.rs    # Host program that runs the zkVM
└── methods/
    ├── guest/
    │   └── src/
    │       └── main.rs    # Guest program that runs inside zkVM
    └── Cargo.toml
```
Navigate to the host directory and add the [`bincode`](https://docs.rs/bincode/latest/bincode/) crate:

```bash
cd multiply_proof/host
cargo add bincode
```

## Writing the code

**1. Guest program (`methods/guest/src/main.rs`)**

This is the code that will run inside the zkVM and generate a proof:

```rust
use risc0_zkvm::guest::env;

fn main() {
    // Read the two numbers from the host
    let a: u64 = env::read();
    let b: u64 = env::read();

    // Verify numbers are non-trivial
    if a == 1 || b == 1 {
        panic!("Trivial factors!");
    }

    // Multiply the numbers
    let product = a.checked_mul(b).expect("Integer overflow");

    // Commit only the product to the journal
    // The factors (a & b) remain private
    env::commit(&product);
}
```

**2. Host program (`host/src/main.rs`)**

This program runs the zkVM and manages the proof generation:

```rust
use methods::{MULTIPLY_ELF, MULTIPLY_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use std::fs;

fn main() {
    // The two secret numbers we want to multiply
    let a: u64 = 17;
    let b: u64 = 23;

    // Create the execution environment
    let env = ExecutorEnv::builder()
        .write(&a).unwrap()
        .write(&b).unwrap()
        .build().unwrap();

    // Create a prover and generate the proof
    let prover = default_prover();
    let receipt = prover.prove(env, MULTIPLY_ELF).unwrap().receipt;
    let receipt_bytes = bincode::serialize(&receipt).unwrap();
    fs::write("receipt.bin", receipt_bytes).unwrap();

    // Convert MULTIPLY_ID to bytes and save
    let id_bytes: Vec<u8> = MULTIPLY_ID.iter()
        .flat_map(|&id| id.to_le_bytes().to_vec())
        .collect();
    fs::write("multiply_id.bin", id_bytes).unwrap();

    println!("Proof generation complete!");
    println!("Receipt and image ID have been saved for Cartesi verification");
}
```

We serialize and save both the receipt and image ID to files. 

## Running the application

In the root directory, run:

```bash
RISC0_DEV_MODE=0 cargo run --release
```
This command runs the computation and generates a proof (receipt) that the computation was performed correctly.

## Understanding the Outputs

When generating a proof using RiscZero, we save two files that will be used by the Cartesi Machine:

1. `receipt.bin`: Contains the public output (journal) and the cryptographic proof
2. `multiply_id.bin`: Contains the image ID that identifies the guest program used

These files enable Cartesi to verify both the computation's correctness and the program's authenticity.
