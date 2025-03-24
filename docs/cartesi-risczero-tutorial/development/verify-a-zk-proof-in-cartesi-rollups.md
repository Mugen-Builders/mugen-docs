# Verify a ZK Proof in Cartesi Rollups

This guide walks you through creating a Cartesi Rollups application that can verify RISC Zero zero-knowledge proofs. We'll build a complete application that receives ZK proofs as inputs and verifies them within the Cartesi Machine.

## Prerequisites

- [Cartesi CLI](https://docs.cartesi.io/cartesi-rollups/1.5/development/installation/) installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Cast](https://book.getfoundry.sh/cast/) (part of Foundry) for sending transactions
- Basic understanding of Rust and zero-knowledge proofs

## 1. Creating a Cartesi Rollups Project

First, let's create a new Cartesi Rollups project with Rust template using the Cartesi CLI:

```bash
cartesi create rollups-verifier --template rust
cd rollups-verifier
```

This command creates a new directory with a template Rust application that we'll modify to verify ZK proofs.

## 2. Setting Up Dependencies

Update the `Cargo.toml` file to include the necessary dependencies for working with RISC Zero proofs:

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

Replace the contents of `src/main.rs` with the following code:

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
    input: String, // To match host program output
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

### Code Explanation

The code above implements a Cartesi Rollups application that:

1. Receives hex-encoded ZK proofs as inputs
2. Decodes the proof data
3. Verifies the proof against an expected RISC Zero image ID


The `verify_zkp` function handles the core verification logic:

- It decodes the hex-encoded payload
- Splits it into the receipt and image ID parts
- Deserializes the receipt using bincode
- Verifies the receipt against the expected image ID
- Extracts and logs the result from the journal

## 4. Building the Application

Now that we have our code ready, let's build the Cartesi application:

```bash
cartesi build
```

This command builds a Cartesi machine with our Rust application inside. The build process may take a few minutes the first time as it downloads and builds all the necessary dependencies.

## 5. Running the Application

Once the build is complete, we can run our application:

```bash
cartesi run
```

This starts a local Anvil node on port 8545 and deploys the necessary contracts for our Cartesi Rollups application. The rollups verifer is now ready to receive ZK proofs as inputs.

## 6. Sending a ZK Proof to the Application

To send a ZK proof to our application, we'll create a script that prepares the proof data and sends it using Cast.

Create a file named `rollups.sh` in the `generate_proof`(proof generator directory) with the following content:

```bash
#!/bin/bash

# Hardcoded addresses that we know work in Anvil
export INPUT_BOX_ADDRESS="0x59b22D57D4f067708AB0c00552767405926dc768"
export DAPP_ADDRESS="0xab7528bb862fB57E8A2BCd567a2e929a0Be56a5e"
export MNEMONIC="test test test test test test test test test test test junk"

# Extract proof input
INPUT=$(cat proof_input.json | jq -r '.input')

# Validate hex input
if [ $((${#INPUT} % 2)) -eq 1 ] || ! [[ $INPUT =~ ^[0-9a-fA-F]+$ ]]; then
    echo "Error: Invalid hex input"
    exit 1
fi

# Send the transaction
cast send $INPUT_BOX_ADDRESS "addInput(address,bytes)" $DAPP_ADDRESS "0x$INPUT" --mnemonic "$MNEMONIC"
```

Make the script executable:

```bash
chmod +x rollups.sh
```

:::tip Proof Input
The script `rollups.sh` uses the `proof_input.json` created in the [previous step](./generate-a-zk-proof.md) with your ZK proof data. The format should be:

```json
{
  "input": "your_hex_encoded_proof_data_here"
}
```

:::

### Sending the Proof

Now you can send the proof to your Cartesi Rollups application:

```bash
./rollups.sh
```

## 7. Monitoring the Application

You can monitor the application's logs to see if the proof verification was successful:

```bash
validator-1  | Received payload length: 219958 bytes
validator-1  | Receipt length: 219926 bytes
validator-1  | Image ID length: 32 bytes
validator-1  | Verified journal data: true
validator-1  | Proof verified successfully!
validator-1  | Sending finish
```

Look for messages like "Proof verified successfully!" or "Proof verification failed" in the logs.

## Customizing for Your Own Proofs

To use this verifier with your own RISC Zero proofs:

1. Replace the `AGE_VERIFY_ID` constant with your own image ID
2. Adjust the `verify_zkp` function if your proof format is different
3. Modify the journal decoding if your proof outputs different data

## Working with Journal Data

The journal data is the output of the RISC Zero program. It is the data that is verified by the verifier.

The journal data is encoded in the receipt.

The journal in a RISC Zero receipt contains the public outputs from the ZK proof execution. In our example, we're extracting a single `u64` value:

```rust
let result: u64 = receipt.journal.decode()?;
println!("Verified journal data: {}", result);
```

You can extract more complex data types from the journal, depending on what your RISC Zero guest program outputs. Here are some examples:

1. **Extract multiple values**:

   ```rust
   let (value1, value2, value3): (u64, String, bool) = receipt.journal.decode()?;
   ```

2. **Extract custom structs** (requires the struct to implement `Decode`):

   ```rust
   #[derive(Deserialize, Encode, Decode)]
   struct MyJournalData {
       user_id: String,
       score: u64,
       verified: bool,
   }

   let data: MyJournalData = receipt.journal.decode()?;
   ```

3. **Use journal data for additional computation**:

   ```rust
   let score: u64 = receipt.journal.decode()?;

   // Perform additional computation with the verified data
   let reward = calculate_reward(score);
   ```

4. **Create a notice with journal data**:

   ```rust
   let result: u64 = receipt.journal.decode()?;

   // Create a notice with the verified result
   let notice_payload = format!("{{\"verified_result\":{}}}", result);
   let notice_request = hyper::Request::builder()
       .method(hyper::Method::POST)
       .header(hyper::header::CONTENT_TYPE, "application/json")
       .uri(format!("{}/notice", server_addr))
       .body(hyper::Body::from(notice_payload))?;

   let notice_response = client.request(notice_request).await?;
   println!("Notice status: {}", notice_response.status());
   ```

   By creating notices from the verified journal data, you make the ZK proof results available on-chain in a verifiable way.


## Important Links

- [Source Code](https://github.com/masiedu4/cartesi-risczero/tree/main/rollups-verifier)