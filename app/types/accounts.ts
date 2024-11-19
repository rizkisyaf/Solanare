export interface BalanceFilter {
  min: number
  max: number | null
  includeNonZero: boolean
  includeFreezable: boolean
  includeMintable: boolean
  filterType: 'all' | 'zero-only' | 'non-zero-only' | 'custom'
} 
