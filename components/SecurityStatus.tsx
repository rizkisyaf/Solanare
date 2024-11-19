import { motion } from "framer-motion"

interface SecurityStatusProps {
  isScanning: boolean
  securityCheck?: {
    isScam: boolean
    risk: 'low' | 'medium' | 'high'
    details?: string
  }
}

export function SecurityStatus({ isScanning, securityCheck }: SecurityStatusProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed top-20 left-4 z-50"
    >
      <div className="bg-black/40 backdrop-blur-md rounded-lg border border-purple-500/20 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`h-3 w-3 rounded-full ${
              isScanning ? 'bg-yellow-400 animate-pulse' :
              securityCheck?.isScam ? 'bg-red-400' :
              securityCheck?.risk === 'low' ? 'bg-green-400' :
              securityCheck?.risk === 'medium' ? 'bg-yellow-400' :
              'bg-purple-400'
            }`} />
          </div>
          
          <div>
            <p className="text-sm font-medium text-purple-100">
              {isScanning ? 'Scanning for Security Threats...' :
               securityCheck?.isScam ? 'Security Risk Detected!' :
               securityCheck?.risk === 'low' ? 'Secure Transaction' :
               securityCheck?.risk === 'medium' ? 'Moderate Risk' :
               'Awaiting Scan'}
            </p>
            {securityCheck?.details && (
              <p className="text-xs text-purple-300/70 mt-1">
                {securityCheck.details}
              </p>
            )}
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-purple-500/20">
          <div className="flex items-center gap-2">
            <img 
              src="/scamsniffers-logo.svg" 
              alt="ScamSniffers" 
              className="h-4" 
            />
            <span className="text-xs text-purple-300/70">
              Protected by ScamSniffers
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
} 