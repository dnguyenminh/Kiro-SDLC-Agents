/**
 * OpenAI-compatible adapter — works for OpenAI, Azure, vLLM, LM Studio, etc.
 */
export class OpenAIAdapter {
    async complete(messages, config) {
        const url = `${config.baseUrl}/chat/completions`;
        const body = {
            model: config.model,
            messages,
            temperature: config.temperature ?? 0.3,
            max_tokens: config.maxTokens ?? 200,
        };
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey)
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok)
            throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: config.model,
            provider: config.provider,
            tokensUsed: data.usage?.total_tokens,
        };
    }
    async isAvailable(config) {
        try {
            const headers = {};
            if (config.apiKey)
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            const res = await fetch(`${config.baseUrl}/models`, { headers, signal: AbortSignal.timeout(3000) });
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=openai-adapter.js.map