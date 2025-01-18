const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, TOKEN_2022_PROGRAM_ID } = require('@solana/spl-token');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Solana Devnet connection with confirmed commitment level
const connection = new Connection('https://api.devnet.solana.com', {
  commitment: 'confirmed', // Ensure confirmation of account creation and transaction
});

// Replace with your token mint address
const TOKEN_MINT_ADDRESS = 'mnts9NMk2ZPtcUjtcRtHgXz2ungkrrCQzXsCFPTGTae';
const DISTRIBUTOR_PRIVATE_KEY = [120,56,148,31,132,5,11,165,29,129,28,18,124,191,220,8,37,161,233,62,251,36,198,189,91,69,210,155,158,207,250,206,11,50,202,68,224,240,110,18,165,176,221,155,230,219,242,8,15,98,160,3,76,208,179,196,15,139,56,45,40,23,100,218];
const distributorKeypair = Keypair.fromSecretKey(Uint8Array.from(DISTRIBUTOR_PRIVATE_KEY));

// Initialize userScores (replace with actual logic to update scores)
let userScores = [];

// API to update user scores
app.post('/update-scores', (req, res) => {
  const { scores } = req.body;

  if (!Array.isArray(scores)) {
    return res.status(400).send('Invalid input format');
  }

  userScores = scores;
  res.send('Scores updated successfully');
});

// Function to create Associated Token Account (ATA)
async function createATA(connection, payer, mint, owner) {
  try {
    // Get the ATA address
    let ata = await getAssociatedTokenAddress(mint, owner, false);
    console.log(`ATA Address: ${ata.toBase58()}`);

    // Check if the ATA already exists
    const accountInfo = await connection.getAccountInfo(ata);
    if (accountInfo) {
      console.log(`ATA already exists: ${ata.toBase58()}`);
      return ata; // Return existing ATA
    }

    // Prepare the transaction
    let tx = new Transaction();
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey, // payer
        ata, // ATA address to be created
        owner, // owner of the ATA
        mint, // mint address of the token
        TOKEN_2022_PROGRAM_ID // Ensure the correct program ID is used
      )
    );

    // Send the transaction
    const signature = await connection.sendTransaction(tx, [payer]);
    console.log(`Create ATA Transaction Hash: ${signature}`);
    await connection.confirmTransaction(signature, 'confirmed');
    return ata; // Return newly created ATA
  } catch (error) {
    console.error("Error creating ATA:", error);
    throw error; // Rethrow error for further handling
  }
}

// Function to distribute tokens
async function distributeTokens() {
  try {
    for (let { wallet, carbonScore } of userScores) {
      if (carbonScore > 0) {
        const mintPublicKey = new PublicKey(TOKEN_MINT_ADDRESS);
        const tokensToDistribute = carbonScore * 10;

        const recipientWallet = new PublicKey(wallet);
        
        // Ensure recipient's associated token account is created
        await createATA(connection, distributorKeypair, mintPublicKey, recipientWallet);

        // Ensure distributor's associated token account is created
        await createATA(connection, distributorKeypair, mintPublicKey, distributorKeypair.publicKey);

        // Get the recipient's associated token account
        const recipientTokenAccount = await getAssociatedTokenAddress(mintPublicKey, recipientWallet);

        // Get the distributor's associated token account
        const distributorTokenAccount = await getAssociatedTokenAddress(mintPublicKey, distributorKeypair.publicKey);

        // Create the transfer instruction
        const transferInstruction = createTransferInstruction(
          distributorTokenAccount, // Source token account
          recipientTokenAccount,    // Destination token account
          distributorKeypair.publicKey, // Owner of source account
          tokensToDistribute * 1e9 // Convert to smallest unit (lamports)
        );

        // Create and send the transaction
        const transaction = new Transaction().add(transferInstruction);
        const signature = await connection.sendTransaction(transaction, [distributorKeypair]);
        await connection.confirmTransaction(signature, 'confirmed');

        console.log(`Transferred ${tokensToDistribute} tokens to ${wallet}`);
      }
    }
  } catch (error) {
    console.error('Error during token distribution:', error);
  }
}

// API to transfer tokens
app.post('/transfer-tokens', async (req, res) => {
  const { wallet, carbonScore } = req.body;

  if (!wallet || !carbonScore || carbonScore <= 0) {
    return res.status(400).send('Invalid input: wallet address or carbon score is missing/invalid');
  }

  try {
    const mintPublicKey = new PublicKey(TOKEN_MINT_ADDRESS);
    const tokensToDistribute = carbonScore * 10;

    const recipientWallet = new PublicKey(wallet);

    // Ensure recipient's associated token account is created
    await createATA(connection, distributorKeypair, mintPublicKey, recipientWallet);

    // Ensure distributor's associated token account is created
    await createATA(connection, distributorKeypair, mintPublicKey, distributorKeypair.publicKey);

    // Get the recipient's associated token account
    const recipientTokenAccount = await getAssociatedTokenAddress(mintPublicKey, recipientWallet);

    // Get the distributor's associated token account
    const distributorTokenAccount = await getAssociatedTokenAddress(mintPublicKey, distributorKeypair.publicKey);

    const transferInstruction = createTransferInstruction(
      distributorTokenAccount, // Source token account
      recipientTokenAccount,    // Destination token account
      distributorKeypair.publicKey, // Owner of source account
      tokensToDistribute * 1e9 // Convert to smallest unit (lamports)
    );

    // Create and send the transaction
    const transaction = new Transaction().add(transferInstruction);
    const signature = await connection.sendTransaction(transaction, [distributorKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return res.status(200).json({
      message: 'Tokens transferred successfully',
      transaction: signature
    });
  } catch (error) {
    console.error('Token transfer failed:', error);
    return res.status(500).send('Error during token transfer');
  }
});

// Start server
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
