"use client"
import { PerformativeAnalyzer } from "@/components/performative-analyzer"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center p-4 md:p-8">
      <PerformativeAnalyzer />
    </main>
  )
}
