/**
 * JSON-RPC 2.0 over stdio pipes — sends requests to child process stdin,
 * reads responses from child process stdout. Thread-safe via coroutines.
 */
package com.codeintel.orchestration.local

import com.codeintel.log
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import java.io.BufferedReader
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class StdioJsonRpc {
    private val requestId = AtomicLong(1)
    private val pending = ConcurrentHashMap<Long, CompletableDeferred<JsonElement?>>()
    private var outputStream: OutputStream? = null
    private var readerJob: Job? = null
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    /** Attach to a process's stdin (output) and stdout (input). Starts reader coroutine. */
    fun attach(output: OutputStream, input: BufferedReader, scope: CoroutineScope) {
        outputStream = output
        readerJob = scope.launch(Dispatchers.IO) { readLoop(input) }
    }

    /** Detach from process — cancel reader, reject pending requests. */
    fun detach() {
        readerJob?.cancel()
        readerJob = null
        outputStream = null
        rejectAll("Connection closed")
    }

    /** Send a JSON-RPC request and await response with timeout. */
    suspend fun sendRequest(method: String, params: JsonElement?, timeoutMs: Long): JsonElement? {
        val id = requestId.getAndIncrement()
        val deferred = CompletableDeferred<JsonElement?>()
        pending[id] = deferred

        val request = buildRequest(id, method, params)
        writeMessage(request)

        return try {
            withTimeout(timeoutMs) { deferred.await() }
        } catch (e: TimeoutCancellationException) {
            pending.remove(id)
            throw RuntimeException("Timeout after ${timeoutMs}ms waiting for $method")
        }
    }

    /** Send a JSON-RPC notification (no response expected). */
    fun sendNotification(method: String, params: JsonElement?) {
        val msg = buildNotification(method, params)
        writeMessage(msg)
    }

    /** Reject all pending requests with an error reason. */
    fun rejectAll(reason: String) {
        pending.forEach { (_, deferred) ->
            deferred.completeExceptionally(RuntimeException(reason))
        }
        pending.clear()
    }

    private fun buildRequest(id: Long, method: String, params: JsonElement?): JsonObject {
        return buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", id)
            put("method", method)
            if (params != null) put("params", params)
        }
    }

    private fun buildNotification(method: String, params: JsonElement?): JsonObject {
        return buildJsonObject {
            put("jsonrpc", "2.0")
            put("method", method)
            if (params != null) put("params", params)
        }
    }

    private fun writeMessage(msg: JsonObject) {
        val out = outputStream ?: throw RuntimeException("Not attached")
        val bytes = (json.encodeToString(JsonObject.serializer(), msg) + "\n").toByteArray()
        synchronized(out) {
            out.write(bytes)
            out.flush()
        }
    }

    private suspend fun readLoop(input: BufferedReader) {
        try {
            while (currentCoroutineContext().isActive) {
                val line = withContext(Dispatchers.IO) { input.readLine() } ?: break
                if (line.isBlank()) continue
                handleIncoming(line)
            }
        } catch (e: CancellationException) {
            // Normal shutdown
        } catch (e: Exception) {
            log("StdioJsonRpc read error: ${e.message}")
        }
    }

    private fun handleIncoming(line: String) {
        val element = try {
            json.parseToJsonElement(line).jsonObject
        } catch (e: Exception) {
            log("StdioJsonRpc parse error: ${e.message}")
            return
        }
        val id = element["id"]?.jsonPrimitive?.longOrNull
        if (id != null) resolveResponse(id, element) else handleNotification(element)
    }

    private fun resolveResponse(id: Long, response: JsonObject) {
        val deferred = pending.remove(id) ?: return
        val error = response["error"]
        if (error != null && error != JsonNull) {
            val msg = error.jsonObject["message"]?.jsonPrimitive?.content ?: "Unknown error"
            deferred.completeExceptionally(RuntimeException(msg))
        } else {
            deferred.complete(response["result"])
        }
    }

    private fun handleNotification(msg: JsonObject) {
        val method = msg["method"]?.jsonPrimitive?.content ?: return
        log("Child notification: $method")
    }
}
