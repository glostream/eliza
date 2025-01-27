import { IAgentRuntime } from "./types";

/**
 * Gets an embedding vector for text using the Voyage AI API
 * @param runtime - The agent runtime instance
 * @param recentMessages - Text to generate embeddings for
 * @returns Embedding response from Voyage AI API
 */
export async function getEmbedding(
    runtime: IAgentRuntime,
    recentMessages: string
) {
    const embedding = await runtime
        .fetch("https://api.voyageai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
            },
            body: JSON.stringify({
                model: "voyage-3",
                input: [recentMessages],
                input_type: "query",
            }),
        })
        .then((res) => res.json());

    return embedding;
}

/**
 * Searches for similar documents in Qdrant vector database using an embedding
 * @param runtime - The agent runtime instance
 * @param embedding - Embedding vector to search with
 * @returns Search response from Qdrant API containing similar documents
 */
export async function searchSimilar(runtime: IAgentRuntime, embedding: any) {
    const search_response = await runtime
        .fetch(`${process.env.QDRANT_URL}/collections/rag/points/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": process.env.QDRANT_API_KEY,
            },
            body: JSON.stringify({
                vector: embedding.data[0].embedding,
                limit: runtime.character.numRagDocuments || 5, // Get top 5 most similar documents
                with_payload: true,
            }),
        })
        .then((res) => res.json());

    return search_response;
}

/**
 * Reranks search results using Voyage AI's reranking model
 * @param runtime - The agent runtime instance
 * @param recentMessages - Original query text
 * @param search_response - Search results from Qdrant to rerank
 * @returns Reranking response from Voyage AI API with reordered results
 */
export async function rerankResults(
    runtime: IAgentRuntime,
    recentMessages: string,
    search_response: any
) {
    const rerank_response = await runtime
        .fetch("https://api.voyageai.com/v1/rerank", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
            },
            body: JSON.stringify({
                query: recentMessages,
                documents: search_response.result.map(
                    (result: any) => result.payload.text
                ),
                model: "rerank-2",
                top_k: runtime.character.numRerankedDocuments || 3,
            }),
        })
        .then((res) => res.json());

    // Sort the search results based on reranking scores
    const rerankIndices = rerank_response.data.map((doc: any) => doc.index);

    const rerankedResults = rerankIndices.map(
        (index: number) => search_response.result[index]
    );

    return rerankedResults;
}
