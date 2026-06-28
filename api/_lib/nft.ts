/**
 * Demo NFT mint (server-side). Like the token faucet, the NFT's `mint` is
 * owner-gated, so the owner (FAUCET_SECRET — same keypair as the token) mints a
 * collectible to a connected wallet. Testnet only.
 */
import {
  Keypair,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  scValToNative,
  rpc,
} from '@stellar/stellar-sdk'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const PASSPHRASE = Networks.TESTNET
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The shared Demo NFT collection (must match DEMO_NFT_ID in src/lib/project.ts). */
export const DEMO_NFT_ID =
  'CD4HFX54Y3WIUYZUYRYK5LMNIYSX27CNDFYSZLEVE66MJCVVPSCYA3CU'

/** Mint one NFT to `to`. Returns { hash, tokenId }. */
export async function mintNft(
  to: string,
  secret = process.env.FAUCET_SECRET,
): Promise<{ hash: string; tokenId: number | null }> {
  if (!secret) throw new Error('FAUCET_SECRET not set')
  const server = new rpc.Server(RPC_URL)
  const owner = Keypair.fromSecret(secret)
  const contract = new Contract(DEMO_NFT_ID)

  for (let i = 0; ; i++) {
    const source = await server.getAccount(owner.publicKey())
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(contract.call('mint', new Address(to).toScVal()))
      .setTimeout(60)
      .build()
    try {
      const prepared = await server.prepareTransaction(tx)
      prepared.sign(owner)
      const sent = await server.sendTransaction(prepared)
      if (sent.status === 'ERROR') throw new Error(JSON.stringify(sent.errorResult))
      let got = await server.getTransaction(sent.hash)
      for (let j = 0; got.status === 'NOT_FOUND' && j < 30; j++) {
        await sleep(1000)
        got = await server.getTransaction(sent.hash)
      }
      if (got.status !== 'SUCCESS') throw new Error(`mint ${got.status}`)
      let tokenId: number | null = null
      try {
        if (got.returnValue) tokenId = Number(scValToNative(got.returnValue))
      } catch {
        // return value not decodable — caller falls back to events/balance
      }
      return { hash: sent.hash, tokenId }
    } catch (err) {
      if (!/txBadSeq|txNoAccount/.test(String(err)) || i >= 10) throw err
      await sleep(1000)
    }
  }
}
