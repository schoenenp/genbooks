'use client'
import { api } from '@/trpc/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function Countdown({
  duration = 5,
  session = "",
  onCountEnded = () => console.log("count ended. redirecting to route."),
  redirect = '/',
}) {
  const [count, setCount] = useState<number>()
  const router = useRouter()
  const hasValidated = useRef(false)
  
  const validateOrder = api.order.validate.useMutation({
    onSuccess:(data) => {
      console.log("DATA: ", data)
      if(data){
        hasValidated.current = true
        setCount(duration)
      }
    },
  }) 

  useEffect(() => {
    if(session && !hasValidated.current){
      hasValidated.current = true
      validateOrder.mutate({session})
    }
  },[session, validateOrder])

  useEffect(() => {
    if (count !== undefined && count <= 0) {
      onCountEnded?.()
      router.push(redirect)
      return
    }

    const id = setTimeout(() => setCount(c => c && c - 1), 1000)
    return () => clearTimeout(id)
  }, [count, onCountEnded, redirect, router])

  return <span>{count}</span>
}