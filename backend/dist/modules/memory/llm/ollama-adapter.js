/**
 * Ollama LLM adapter — local inference via REST API.
 * Handles qwen3 "thinking" mode: appends /no_think and falls back to thinking field.
 */
export class OllamaAdapter {
    async complete(messages, config) {
        const url = `${config.baseUrl}/api/chat`;
        // For qwen3 models: disable thinking mode by appending /no_think
        const isQwen3 = config.model.includes('qwen3');
        const processedMessages = messages.map(m => {
            if (isQwen3 && m.role === 'system') {
                return { role: m.role, content: m.content + ' /no_think' };
            }
            return { role: m.role, content: m.content };
        });
        if (isQwen3 && !messages.some(m => m.role === 'system')) {
            processedMessages.unshift({ role: 'system', content: 'Be concise. /no_think' });
        }
        const body = {
            model: config.model,
            messages: processedMessages,
            stream: false,
            options: {
                temperature: config.temperature ?? 0.3,
                num_predict: config.maxTokens ?? 200,
            },
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        // qwen3 puts response in "thinking" when content is empty
        const content = data.message?.content || data.message?.thinking || '';
        return {
            content,
            model: config.model,
            provider: 'ollama',
            tokensUsed: data.eval_count,
        };
    }
    async isAvailable(config) {
        try {
            const res = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=ollama-adapter.js.map