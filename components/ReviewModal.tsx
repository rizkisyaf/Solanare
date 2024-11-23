import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function ReviewModal() {
  const [open, setOpen] = useState(true)
  const [hasSeenModal, setHasSeenModal] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenReviewModal')
    if (seen) {
      setHasSeenModal(true)
      setOpen(false)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem('hasSeenReviewModal', 'true')
    setHasSeenModal(true)
    setOpen(false)
  }

  if (hasSeenModal) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-black/90 border border-purple-500/20">
        <DialogHeader>
          <DialogTitle className="text-xl text-purple-300">🛡️ Security Review In Progress</DialogTitle>
          <DialogDescription className="text-purple-300/70 space-y-4">
            <p>
              We are currently undergoing security review with Phantom and Blowfish to ensure the highest safety standards for our users.
            </p>
            <p>
              Our dApp is fully functional and safe to use. We maintain complete transparency:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Open source code</li>
              <li>Standard Solana token account operations</li>
              <li>Transparent 5% platform fee</li>
              <li>Real-time transaction feedback</li>
            </ul>
            <p>
              Questions or concerns? Reach out to our founder directly:
              <a 
                href="https://twitter.com/kisra_fistya" 
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-purple-400 hover:text-purple-300"
              >
                @kisra_fistya
              </a>
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            onClick={handleClose}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            I Understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}