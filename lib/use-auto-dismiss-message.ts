import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

export function useAutoDismissMessage(
  timeoutMs = 6000,
): [string, Dispatch<SetStateAction<string>>] {
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!message) return
    const timeoutId = window.setTimeout(() => setMessage(""), timeoutMs)
    return () => window.clearTimeout(timeoutId)
  }, [message, timeoutMs])

  return [message, setMessage]
}
