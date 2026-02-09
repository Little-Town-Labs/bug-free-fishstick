import { createOpenAI } from '@ai-sdk/openai'
import { embed, embedMany } from 'ai'

const EMBEDDING_MODEL = 'text-embedding-ada-002'
const EMBEDDING_DIMENSIONS = 1536

function getEmbeddingModel(apiKey?: string) {
  const openai = createOpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  })
  return openai.embedding(EMBEDDING_MODEL)
}

export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<number[]> {
  const model = getEmbeddingModel(apiKey)
  const { embedding } = await embed({ model, value: text })
  return embedding
}

export async function generateEmbeddings(
  texts: string[],
  apiKey?: string
): Promise<number[][]> {
  if (texts.length === 0) return []
  const model = getEmbeddingModel(apiKey)
  const { embeddings } = await embedMany({ model, values: texts })
  return embeddings
}

export { EMBEDDING_DIMENSIONS }
