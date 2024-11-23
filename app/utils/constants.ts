import { PublicKey } from "@solana/web3.js"

export const PLATFORM_FEE_PERCENTAGE = 0.05 // 5%
export const RENT_EXEMPTION = 0.00203928
export const RENT_AFTER_FEE = RENT_EXEMPTION * (1 - PLATFORM_FEE_PERCENTAGE)
export const TREASURY_WALLET = new PublicKey("8QAUgSFQxMcuYCn3yDN28HuqBsbXq2Ac1rADo5AWh8S5") 