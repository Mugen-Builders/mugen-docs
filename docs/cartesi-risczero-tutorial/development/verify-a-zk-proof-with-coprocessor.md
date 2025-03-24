# Verify a ZK Proof with Cartesi Coprocessor

This guide demonstrates how to create a Cartesi Coprocessor application that verifies RISC Zero zero-knowledge proofs. We'll build a complete application that receives ZK proofs as inputs and verifies them within the Cartesi Machine.

## Prerequisites

- [Cartesi Coprocessor CLI and Cartesi Machine](../../cartesi-co-processor-tutorial/installation.md) installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Cast](https://book.getfoundry.sh/cast/) (part of Foundry) for sending transactions
- Basic understanding of Rust and zero-knowledge proofs

## 1. Creating a Cartesi Coprocessor Project

First, create a new Cartesi Coprocessor project with Rust template:

```bash
cartesi-coprocessor create --dapp-name coprocessor-verifier --template rust
cd coprocessor-verifier
```

## 2. Setting Up Dependencies

Update the `Cargo.toml` file with the necessary dependencies:

```toml
[package]
name = "dapp"
version = "0.1.0"
edition = "2021"

[dependencies]
json = "0.12"
hyper = { version = "0.14", features = ["http1", "runtime", "client"] }
tokio = { version = "1.32", features = ["macros", "rt-multi-thread"] }
bincode = "1.3"
risc0-zkvm = { version = "1.2.5" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
hex = "0.4"
```

## 3. Implementing the Verifier

Replace the contents of `src/main.rs` with:

```rust
use hex;
use json::{object, JsonValue};
use risc0_zkvm::Receipt;
use serde::Deserialize;
use serde_json;
use std::env;

// This is the image ID of the RISC Zero program we want to verify
// You should replace this with your own image ID
const AGE_VERIFY_ID: [u32; 8] = [
    0x48a22539,
    0x62c92ee4,
    0x3eb929c8,
    0xd930e83d,
    0xe79c784a,
    0xe6df700e,
    0x39566542,
    0xecd80864
];

#[derive(Deserialize)]
struct ProofData {
    input: String, // o match host program output
}

async fn verify_zkp(payload: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Remove '0x' prefix if present
    let clean_payload = payload.trim_start_matches("0x");

    // Decode the hex-encoded payload
    let combined_bytes = hex::decode(clean_payload)?;

    // Debug output
    println!("Received payload length: {} bytes", combined_bytes.len());
    
    // The image ID is 8 u32 values (32 bytes)
    const IMAGE_ID_SIZE: usize = 32;
    
    // Make sure we have enough data
    if combined_bytes.len() <= IMAGE_ID_SIZE {
        return Err("Payload too small to contain receipt and image ID".into());
    }

    // Split the payload into receipt and image ID
    let receipt_bytes = &combined_bytes[..combined_bytes.len() - IMAGE_ID_SIZE];
    let image_id_bytes = &combined_bytes[combined_bytes.len() - IMAGE_ID_SIZE..];

    println!("Receipt length: {} bytes", receipt_bytes.len());
    println!("Image ID length: {} bytes", image_id_bytes.len());

  // Deserialize and get receipt
    let receipt: Receipt = match bincode::deserialize(receipt_bytes) {
        Ok(r) => r,
        Err(e) => {
            println!("Deserialization error: {}", e);
            return Err(format!("Failed to deserialize receipt: {}", e).into());
        }
    };

    // Verify the receipt against the expected image ID
    match receipt.verify(AGE_VERIFY_ID) {
        Ok(_) => {
            // Extract and log the result from the journal
            let result: bool = receipt.journal.decode()?;
            println!("Verified journal data: {}", result);
            Ok(())
        },
        Err(e) => {
            println!("Receipt verification failed: {}", e);
            
            // Try to extract the image ID from the payload and compare
            let extracted_id = if image_id_bytes.len() == 32 {
                let mut id = [0u32; 8];
                for i in 0..8 {
                    let bytes = &image_id_bytes[i*4..(i+1)*4];
                    id[i] = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                }
                
                println!("Extracted image ID: {:?}", id);
                println!("Expected image ID: {:?}", AGE_VERIFY_ID);
                
                if id != AGE_VERIFY_ID {
                    return Err("Image ID mismatch".into());
                }
            };
            
            Err(format!("Receipt verification failed: {}", e).into())
        }
    }
}

pub async fn handle_advance(
    _client: &hyper::Client<hyper::client::HttpConnector>,
    _server_addr: &str,
    request: JsonValue,
) -> Result<&'static str, Box<dyn std::error::Error>> {
    println!("Received advance request data {}", &request);
    let payload = request["data"]["payload"]
        .as_str()
        .ok_or("Missing payload")?;

    match verify_zkp(payload).await {
        Ok(()) => {
            println!("Proof verified successfully!");
            Ok("accept")
        }
        Err(e) => {
            println!("Proof verification failed: {}", e);
            Ok("reject")
        }
    }
}

pub async fn handle_inspect(
    _client: &hyper::Client<hyper::client::HttpConnector>,
    _server_addr: &str,
    request: JsonValue,
) -> Result<&'static str, Box<dyn std::error::Error>> {
    println!("Received inspect request data {}", &request);
    let _payload = request["data"]["payload"]
        .as_str()
        .ok_or("Missing payload")?;
    // TODO: add application logic here
    Ok("accept")
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = hyper::Client::new();
    let server_addr = env::var("ROLLUP_HTTP_SERVER_URL")?;

    let mut status = "accept";
    loop {
        println!("Sending finish");
        let response = object! {"status" => status};
        let request = hyper::Request::builder()
            .method(hyper::Method::POST)
            .header(hyper::header::CONTENT_TYPE, "application/json")
            .uri(format!("{}/finish", &server_addr))
            .body(hyper::Body::from(response.dump()))?;
        let response = client.request(request).await?;
        println!("Received finish status {}", response.status());

        if response.status() == hyper::StatusCode::ACCEPTED {
            println!("No pending rollup request, trying again");
        } else {
            let body = hyper::body::to_bytes(response).await?;
            let utf = std::str::from_utf8(&body)?;
            let req = json::parse(utf)?;

            let request_type = req["request_type"]
                .as_str()
                .ok_or("request_type is not a string")?;
            status = match request_type {
                "advance_state" => handle_advance(&client, &server_addr[..], req).await?,
                "inspect_state" => handle_inspect(&client, &server_addr[..], req).await?,
                &_ => {
                    eprintln!("Unknown request type");
                    "reject"
                }
            };
        }
    }
}
```

## 4. Start the local development environment

```bash
cartesi-coprocessor start-devnet
```

## 5. Building the Application

Build your Cartesi Coprocessor application:

```bash
cartesi-coprocessor build
```

## 6. Publishing the Application

Publish your application to the local devnet:

```bash
cartesi-coprocessor publish --network devnet
```

## 7. Deploying the Contract

Change directory to the `contracts` directory and deploy your contract with the coprocessor address and machine hash:

```bash
cd contracts
```


:::tip
You can get the machine hash and coprocessor address by running `cartesi-coprocessor address-book`. It will return the machine hash and coprocessor address for the devnet.

Example output:
```
Machine Hash         0xb2c1e21828d4db58bccf61b6ddf3071b83064f02cd87df3b11fcce35091cf7d1
Devnet_task_issuer   0x95401dc811bb5740090279Ba06cfA8fcF6113778
Testnet_task_issuer  0xff35E413F5e22A9e1Cc02F92dcb78a5076c1aaf3
payment_token        0xc5a5C42992dECbae36851359345FE25997F5C42d
```
:::

Deploy the contract with the coprocessor address and machine hash:

```bash 
cartesi-coprocessor deploy \
    --contract-name MyContract \
    --network devnet \
    --constructor-args <COPROCESSOR_ADDRESS> <MACHINE_HASH>
```

Save the deployed contract address for the next step. 

## 8. Sending a ZK Proof

To send a ZK proof to our application, we'll create a script that prepares the proof data and sends it using Cast.

Create a file named `coprocessor.sh` in the `generate_proof`(proof generator directory) with the following content:

```bash
#!/bin/bash

# Replace with your deployed contract address
CONTRACT_ADDRESS="<YOUR_CONTRACT_ADDRESS>"

# Send the proof using cast
cast send $CONTRACT_ADDRESS "runExecution(bytes)" $(cat proof_input.json | jq -r '.input') \
    --rpc-url http://localhost:8545 \
    --private-key $PRIVATE_KEY
```

Make it executable:

```bash
chmod +x coprocessor.sh
```

Run the script:

```bash
./coprocessor.sh
```

## 9. Monitoring Results

Monitor the coprocessor logs in real-time:

```bash
docker logs -f cartesi-coprocessor-operator
```

You should see output like:

```
Received payload length: 219958 bytes
Receipt length: 219926 bytes
Image ID length: 32 bytes
Verified journal data: true
Proof verified successfully!
Sending finish
```


## Working with Journal Data

The journal data contains the public outputs from your ZK proof. Here are some examples of working with journal data:

1. **Extract multiple values**:

```rust
let (value1, value2): (u64, String) = receipt.journal.decode()?;
```

2. **Extract custom structs**:

```rust
#[derive(Deserialize)]
struct ProofOutput {
    result: u64,
    timestamp: u64,
}

let output: ProofOutput = receipt.journal.decode()?;
```

## Customizing for Your Own Proofs

To use this verifier with your own RISC Zero proofs:

1. Replace `AGE_VERIFY_ID` with your program's image ID
2. Modify the journal decoding to match your proof's output format
3. Adjust the verification logic if needed


## Important Links

- [Source Code](https://github.com/masiedu4/cartesi-risczero/tree/main/coprocessor-verifier)
- [Cartesi Coprocessor](https://docs.mugen.builders/cartesi-co-processor-tutorial/introduction)
