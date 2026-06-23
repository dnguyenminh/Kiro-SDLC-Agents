/**
 * agent_log meta-tool — logs agent activity (ticket, agent, step, status, message)
 * to .code-intel/agent-log.jsonl for SM/DEV tracking. Task 32.
 */
package com.codeintel.orchestration.meta

import com.codeintel.Config
import kotlinx.serialization.json.*
import java.io.File
import java.time.Instant

class AgentLogTool {
    private val json = Json { encodeDefaults = true }

    /** Execute — append agent log entry to jsonl file. */
    fun execute(args: JsonObject): String {
        val ticketKey = args["ticket_key"]?.jsonPrimitive?.content ?: ""
        val agentName = args["agent_name"]?.jsonPrimitive?.content ?: ""
        val step = args["step"]?.jsonPrimitive?.content ?: ""
        val status = args["status"]?.jsonPrimitive?.content ?: ""
        val message = args["message"]?.jsonPrimitive?.content ?: ""
        val artifacts = args["artifacts"]?.jsonPrimitive?.content

        if (ticketKey.isBlank() || agentName.isBlank() || status.isBlank()) {
            return errorJson("ticket_key, agent_name, status are required")
        }

        val entry = buildLogEntry(ticketKey, agentName, step, status, message, artifacts)
        appendToLog(entry)
        return """{"success":true,"logged":"$ticketKey/$agentName/$step/$status"}"""
    }

    /** Tool definition for tools/list registration. */
    fun definition(): JsonObject = buildJsonObject {
        put("name", "agent_log")
        put("description", buildDescription())
        putJsonObject("inputSchema") { buildInputSchema() }
    }

    private fun buildDescription(): String {
        return "Write an execution log entry for agent activity tracking."
    }

    private fun JsonObjectBuilder.buildInputSchema() {
        put("type", "object")
        putJsonObject("properties") {
            stringProp("ticket_key", "Jira ticket key (e.g. MTO-12)")
            stringProp("agent_name", "Agent: SM, BA, TA, SA, QA, DEV, DEVOPS")
            stringProp("step", "Step ID (e.g. Step-1, Self-Check)")
            stringProp("status", "START|DONE|ARTIFACT|SKIP|ERROR|WARN|VERIFY")
            stringProp("message", "What happened")
            stringProp("artifacts", "Optional JSON of artifact paths")
        }
        putJsonArray("required") {
            add("ticket_key"); add("agent_name"); add("step")
            add("status"); add("message")
        }
    }

    private fun JsonObjectBuilder.stringProp(name: String, desc: String) {
        putJsonObject(name) { put("type", "string"); put("description", desc) }
    }

    private fun buildLogEntry(
        ticket: String, agent: String, step: String,
        status: String, message: String, artifacts: String?
    ): String {
        val entry = buildJsonObject {
            put("timestamp", Instant.now().toString())
            put("ticket_key", ticket)
            put("agent_name", agent)
            put("step", step)
            put("status", status)
            put("message", message)
            if (artifacts != null) put("artifacts", artifacts)
        }
        return json.encodeToString(JsonObject.serializer(), entry)
    }

    private fun appendToLog(jsonLine: String) {
        val logDir = File(Config.load().workspace, ".code-intel")
        logDir.mkdirs()
        File(logDir, "agent-log.jsonl").appendText("$jsonLine\n")
    }

    private fun errorJson(msg: String) = """{"error":"$msg"}"""
}
