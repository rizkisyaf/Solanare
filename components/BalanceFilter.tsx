import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import type { BalanceFilter } from "@/app/types/accounts"

interface BalanceFilterProps {
  onFilterChange: (filter: BalanceFilter) => void
}

export function BalanceFilter({ onFilterChange }: BalanceFilterProps) {
  const [filterType, setFilterType] = useState<'all' | 'zero-only' | 'non-zero-only' | 'custom'>('all')
  const [maxBalance, setMaxBalance] = useState(100)
  const [includeFreezable, setIncludeFreezable] = useState(false)
  const [includeMintable, setIncludeMintable] = useState(false)

  const updateFilters = (updates: Partial<BalanceFilter>) => {
    const newFilter: BalanceFilter = {
      min: 0,
      max: filterType === 'custom' ? maxBalance : null,
      includeNonZero: filterType !== 'zero-only',
      includeFreezable,
      includeMintable,
      filterType,
      ...updates
    }
    onFilterChange(newFilter)
  }

  return (
    <div className="bg-black/30 p-6 rounded-lg border border-purple-500/20 mb-4 space-y-6">
      <div>
        <h3 className="text-purple-300 mb-3">Account Filter Options</h3>
        <RadioGroup
          defaultValue="all"
          onValueChange={(value) => {
            setFilterType(value as any)
            updateFilters({ filterType: value as any })
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center">
              <RadioGroupItem value="all" id="all" />
              <Label htmlFor="all" className="ml-2 text-purple-300">Show All Accounts</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="zero-only" id="zero" />
              <Label htmlFor="zero" className="ml-2 text-purple-300">Zero Balance Only</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="non-zero-only" id="non-zero" />
              <Label htmlFor="non-zero" className="ml-2 text-purple-300">Non-Zero Balance Only</Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="ml-2 text-purple-300">Custom Balance Range</Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {filterType === 'custom' && (
        <div className="space-y-4">
          <label className="text-sm text-purple-300">Maximum Balance</label>
          <Slider
            defaultValue={[100]}
            max={1000}
            step={10}
            onValueChange={(value) => {
              setMaxBalance(value[0])
              updateFilters({ max: value[0] })
            }}
          />
          <div className="text-sm text-purple-300/70">
            Max Balance: {maxBalance} tokens
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-purple-300">Include Freezable Tokens</Label>
          <Switch
            checked={includeFreezable}
            onCheckedChange={(checked) => {
              setIncludeFreezable(checked)
              updateFilters({ includeFreezable: checked })
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-purple-300">Include Mintable Tokens</Label>
          <Switch
            checked={includeMintable}
            onCheckedChange={(checked) => {
              setIncludeMintable(checked)
              updateFilters({ includeMintable: checked })
            }}
          />
        </div>
      </div>
    </div>
  )
}