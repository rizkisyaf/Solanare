import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import type { BalanceFilter } from "@/app/types/accounts"
import { motion } from "framer-motion"

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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-950/30 to-black/40 backdrop-blur-sm p-8 rounded-2xl border border-purple-500/20 mb-6 space-y-8"
    >
      <div className="space-y-4">
        <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
          Filter Settings
        </h3>
        <RadioGroup
          defaultValue="all"
          onValueChange={(value) => {
            setFilterType(value as any)
            updateFilters({ filterType: value as any })
          }}
          className="grid grid-cols-2 gap-4"
        >
          {[
            { value: 'all', label: 'All Accounts' },
            { value: 'zero-only', label: 'Zero Balance' },
            { value: 'non-zero-only', label: 'Non-Zero Balance' },
            { value: 'custom', label: 'Custom Range' }
          ].map(({ value, label }) => (
            <div key={value} className="relative">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group"
              >
                <RadioGroupItem
                  value={value}
                  id={value}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={value}
                  className="flex items-center justify-center p-4 rounded-xl border border-purple-500/20 bg-black/20 
                    cursor-pointer transition-all duration-200 
                    hover:bg-purple-950/20 hover:border-purple-400/30
                    peer-checked:bg-purple-950/40 peer-checked:border-purple-400/50
                    text-purple-300/70 peer-checked:text-purple-200"
                >
                  {label}
                </Label>
              </motion.div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {filterType === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 pt-4 border-t border-purple-500/20"
        >
          <label className="text-sm text-purple-300/80">Maximum Balance</label>
          <Slider
            defaultValue={[100]}
            max={1000}
            step={10}
            className="py-4"
            onValueChange={(value) => {
              setMaxBalance(value[0])
              updateFilters({ max: value[0] })
            }}
          />
          <div className="text-sm text-purple-400">
            Max Balance: <span className="text-purple-300">{maxBalance} tokens</span>
          </div>
        </motion.div>
      )}

      <div className="space-y-4 pt-4 border-t border-purple-500/20">
        <div className="flex items-center justify-between group p-2 rounded-lg hover:bg-purple-950/20 transition-colors">
          <Label className="text-purple-300/80 group-hover:text-purple-300 transition-colors">
            Include Freezable Tokens
          </Label>
          <Switch
            checked={includeFreezable}
            onCheckedChange={(checked) => {
              setIncludeFreezable(checked)
              updateFilters({ includeFreezable: checked })
            }}
          />
        </div>
        <div className="flex items-center justify-between group p-2 rounded-lg hover:bg-purple-950/20 transition-colors">
          <Label className="text-purple-300/80 group-hover:text-purple-300 transition-colors">
            Include Mintable Tokens
          </Label>
          <Switch
            checked={includeMintable}
            onCheckedChange={(checked) => {
              setIncludeMintable(checked)
              updateFilters({ includeMintable: checked })
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}