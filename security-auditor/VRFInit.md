### VRF initialization guide (frontend)

This project uses Switchboard VRF for secure randomness in the `defai_swap` program. VRF is auto-enabled on initialize; swaps/rerolls will revert with `VrfNotReady` until VRF is primed once.

### Roles and safety
- The program owns the VRF configuration on-chain. Only `config.admin` may set/modify it.
- Frontend must pass the correct Switchboard accounts exactly once to bootstrap; subsequent calls are strictly validated and must match.

### Required accounts (from Switchboard)
- `vrf` (VRF account pubkey)
- `oracleQueue` (queue used when creating VRF)
- `queueAuthority` (from queue data)
- `dataBuffer` (from queue data)
- `permission` (PDA derived from queue + vrf + queueAuthority)
- `escrow` (VRF’s escrow token account from VRF data)
- `payerWallet` (an ATA for `queue.mint` that funds requests; often your admin’s ATA)
- `recentBlockhashes` (sysvar)
- `switchboardProgram` = `SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f`
- `tokenProgram` = SPL Token program

Program PDAs (defai_swap):
- `vrfState` PDA: seeds `["vrf_state"]`
- `config` PDA: seeds `["config"]`
- `escrow` PDA (swap escrow, unrelated to VRF’s escrow): seeds `["escrow"]`

### One-time priming flow (admin)
1) Initialize VRF state (store VRF account; other fields default)
```
await program.methods.initializeVrfState(new PublicKey(process.env.VRF_ACCOUNT))
  .accounts({ authority: admin })
  .rpc()
```

2) Request VRF randomness (bootstraps and stores queue/permission/escrow/payerWallet)
```
await program.methods.requestVrfRandomness()
  .accounts({
    authority: admin,
    config: configPda,
    vrfState: vrfStatePda,
    vrf: new PublicKey(process.env.VRF_ACCOUNT),
    oracleQueue: new PublicKey(process.env.SB_QUEUE),
    queueAuthority: new PublicKey(process.env.SB_QUEUE_AUTHORITY),
    dataBuffer: new PublicKey(process.env.SB_DATA_BUFFER),
    permission: new PublicKey(process.env.SB_PERMISSION),
    escrow: new PublicKey(process.env.SB_VRF_ESCROW),
    payerWallet: new PublicKey(process.env.SB_PAYER_WALLET),
    recentBlockhashes: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
    switchboardProgram: new PublicKey('SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f'),
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc()
```

3) Consume VRF result (writes 32-byte randomness to `vrfState.resultBuffer`)
```
await program.methods.consumeVrfRandomness()
  .accounts({ vrfState: vrfStatePda, vrf: new PublicKey(process.env.VRF_ACCOUNT) })
  .rpc()

const state = await program.account.vrfState.fetch(vrfStatePda)
const ready = state.resultBuffer.some((b: number) => b !== 0)
console.log('VRF ready:', ready)
```

Once primed, normal swaps/rerolls will use VRF randomness automatically (and will revert if VRF is enabled but not ready).

### How to get these Switchboard accounts
Using `@switchboard-xyz/solana.js` (or CLI) when you create/load a VRF:
- Load your `QueueAccount` to get `queueAuthority`, `dataBuffer`, and `queue.mint`.
- Load your `VrfAccount` to get `escrow`.
- Derive `permission` PDA from `(queueAuthority, oracleQueue, vrf)` using `PermissionAccount.fromSeed`.
- Choose `payerWallet` as an associated token account for `queue.mint` owned by the admin; fund it appropriately.

### Environment variables (example)
```
VRF_ACCOUNT=...
SB_QUEUE=...
SB_QUEUE_AUTHORITY=...
SB_DATA_BUFFER=...
SB_PERMISSION=...
SB_VRF_ESCROW=...
SB_PAYER_WALLET=...
```

### Common pitfalls
- Wrong accounts: after bootstrap, any mismatch will be rejected on-chain.
- Unfunded payer wallet: VRF request will fail silently at Switchboard; ensure `payerWallet` has the queue mint.
- Skipping consume: `resultBuffer` stays zero; swaps/rerolls will raise `VrfNotReady`.

### Localnet vs mainnet
- Program IDs are the same; Switchboard program is `SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f` on mainnet.
- Use the appropriate queue/VRF for your environment.


