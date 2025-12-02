import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { image } = await request.json()

    const { text } = await generateText({
      model: "google/gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: image,
            },
            {
              type: "text",
              text: 'Analyze this image and rate how "performative" it is on a scale of 0-10, where 0 means completely genuine/authentic and 10 means extremely performative/staged/seeking attention. Respond in this exact JSON format:\n{"rating": <number>, "explanation": "<brief explanation of why you gave this rating>"}',
            },
          ],
        },
      ],
    })

    // Parse the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { rating: 5, explanation: text }

    return Response.json(result)
  } catch (error) {
    console.error("Analysis error:", error)
    return Response.json({ error: "Failed to analyze image" }, { status: 500 })
  }
}
