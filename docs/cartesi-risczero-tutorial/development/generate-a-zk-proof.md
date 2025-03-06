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

Navigate to the host directory and add the required crates:

```bash
cd multiply_proof/host
cargo add bincode base64 serde
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
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use methods::{MULTIPLY_ELF, MULTIPLY_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
struct ProofData {
    receipt: String,
    image_id: String,
}

fn main() {
    // The two secret numbers we want to multiply
    let a: u64 = 17;
    let b: u64 = 23;

    // Create the execution environment
    let env = ExecutorEnv::builder()
        .write(&a)
        .unwrap()
        .write(&b)
        .unwrap()
        .build()
        .unwrap();

    // Create a prover and generate the proof
    let prover = default_prover();
    let receipt = prover.prove(env, MULTIPLY_ELF).unwrap().receipt;
    let receipt_bytes = bincode::serialize(&receipt).unwrap();

    // Convert MULTIPLY_ID to bytes
    let id_bytes: Vec<u8> = MULTIPLY_ID
        .iter()
        .flat_map(|&id| id.to_le_bytes().to_vec())
        .collect();

    // Create the proof data structure with base64 encoded values
    let proof_data = ProofData {
        receipt: BASE64.encode(receipt_bytes),
        image_id: BASE64.encode(id_bytes),
    };

    // Serialize to JSON and save to file
    let json_data = serde_json::to_string_pretty(&proof_data).unwrap();
    fs::write("proof.json", json_data).unwrap();

    println!("Proof generation complete!");
    println!("Proof data has been saved to proof.json");
}
```

## Running the application

In the root directory, run:

```bash
RISC0_DEV_MODE=0 cargo run --release
```

This command runs the computation and generates a proof (receipt) that the computation was performed correctly.

## Understanding the Output

When generating a proof using RiscZero, we save a single JSON file that will be used by the Cartesi Machine:

`proof.json`: Contains both the receipt (public output and cryptographic proof) and the image ID (identifies the guest program) in base64 encoded format. The JSON structure looks like:

```json
{
  "receipt": "base64_encoded_receipt_data",
  "image_id": "base64_encoded_image_id"
}
```

This file enables Cartesi to verify both the computation's correctness and the program's authenticity.
