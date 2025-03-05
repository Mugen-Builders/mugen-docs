# Installation


**1. Install Rust & Cargo**  
Install Rust and Cargo using the official [Rust installation guide](https://www.rust-lang.org/tools/install).  

**Optional but highly recommended:**

Install [Cross](https://github.com/cross-rs/cross) for multi-platform builds, especially if you want to build for the Cartesi Machine(RISC-V) with ease.

```bash
cargo install cross
```

:::note
Cross has the exact same CLI as Cargo but relies on Docker. Install [Docker Desktop](https://docs.docker.com/get-docker/) and start the Docker daemon to use it.
:::

**2. RISC Zero zkVM**  
Set up the RISC Zero zkVM toolchain by following the [RISC Zero installation guide](https://dev.risczero.com/api/zkvm/install).  

**3. Cartesi Machine**  

- **Download the Latest Release**  
   Go to the [Cartesi Machine releases page](https://github.com/edubart/cartesi-machine-everywhere/releases/latest) and download the archive for your platform.  

   **Examples**:  
   - Linux (amd64): `cartesi-machine-linux-musl-amd64.tar.xz`  
   - macOS (arm64): `cartesi-machine-macos-arm64.tar.gz`  

- **Extract the Archive**  
   Extract the downloaded archive:  
   ```bash  
   tar -xf <archive-name>  
   cd <extracted-folder>  
   ```  

- **Make the Installation Persistent**  
   Add the `bin` directory to your system's `PATH` so `cartesi-machine` is accessible from any terminal:  

   - **Bash**:  
     ```bash  
     echo 'export PATH="$PATH:'$(pwd)'/bin"' >> ~/.bashrc  
     source ~/.bashrc  
     ```  

   - **Zsh**:  
     ```bash  
     echo 'export PATH="$PATH:'$(pwd)'/bin"' >> ~/.zshrc  
     source ~/.zshrc  
     ```  

-  **Verify Installation**  
   Run the following command to ensure `cartesi-machine` is installed correctly:  
   ```bash  
   cartesi-machine  
   ```  

   **Expected Output**:  
   ```  
         .
        / \
      /    \
   \---/---\  /----\
    \       X       \
     \----/  \---/---\
          \    / CARTESI
           \ /   MACHINE
            '

   Nothing to do.

   Halted
   Cycles: 42051629
   ```  

**Next**: Write and compile a RISC Zero program.





