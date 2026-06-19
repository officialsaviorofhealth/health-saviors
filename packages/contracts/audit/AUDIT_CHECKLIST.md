# Smart Contract Audit Checklist

## Contracts
| Contract | LOC | Complexity | Priority |
|----------|-----|-----------|----------|
| H2EToken.sol | ~60 | Low | P0 |
| HealthReward.sol | ~120 | High | P0 |
| HealthBadge.sol | ~70 | Low | P1 |
| DataConsent.sol | ~80 | Medium | P1 |
| DataMarketplace.sol | ~100 | High | P0 |
| H2EVesting.sol | ~80 | Medium | P2 |

## Security Checks
- [x] Reentrancy guards (ReentrancyGuard on all state-changing functions)
- [x] Access control (OpenZeppelin AccessControl/Ownable)
- [x] Integer overflow (Solidity 0.8+ built-in)
- [x] Signature replay prevention (nonce tracking)
- [x] EIP-712 typed data signing
- [x] Daily emission cap (anti-inflation)
- [x] Pausable emergency stop
- [x] SBT non-transferability enforcement
- [ ] CertiK/Hacken formal audit (PENDING)
- [ ] Slither static analysis
- [ ] Mythril symbolic execution

## Known Risks
1. Backend signer key compromise → single point of failure → Mitigated by timelock + multisig admin
2. Daily emission cap can be changed by owner → Mitigated by timelock on admin functions
3. DataMarketplace transferFrom pattern → Uses approval model, verify allowance handling

## Gas Optimization
- `via_ir = true` in foundry.toml for IR-based optimization
- optimizer_runs = 200 for balanced deployment/runtime cost
- Struct packing in DataConsent.Consent

## Pre-Audit Static Analysis Commands
```bash
slither packages/contracts/src/ --config-file slither.config.json
mythril analyze packages/contracts/src/HealthReward.sol --solv 0.8.20
forge test --gas-report
```
