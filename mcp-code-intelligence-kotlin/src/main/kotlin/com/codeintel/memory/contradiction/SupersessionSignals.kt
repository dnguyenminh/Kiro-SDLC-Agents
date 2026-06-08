/** Keyword signals indicating information supersession/contradiction. */
package com.codeintel.memory.contradiction

/** Keywords that indicate new content supersedes existing content. */
val SUPERSESSION_SIGNALS = listOf(
    // Vietnamese
    "hủy bỏ", "hủy", "bãi bỏ", "thay thế", "không còn", "đã xóa",
    "cập nhật lại", "sửa lại", "thay đổi", "chuyển sang", "dừng",
    "ngừng", "loại bỏ", "deprecated", "đã cũ", "không dùng nữa",
    // English
    "cancel", "cancelled", "revoke", "revoked", "supersede", "superseded",
    "replace", "replaced", "override", "overridden", "deprecate",
    "no longer", "removed", "deleted", "instead of", "changed to",
    "updated to", "migrated to", "switched to", "stop using",
    "do not use", "obsolete", "invalid", "was wrong", "correction"
)

/** Strong signals get higher confidence boost. */
val STRONG_SIGNALS = listOf(
    "hủy bỏ", "cancel", "replace", "supersede", "deprecated", "obsolete", "revoke"
)

/** Detect first matching supersession signal in content. */
fun detectSupersessionSignal(content: String): String? {
    val lower = content.lowercase()
    return SUPERSESSION_SIGNALS.firstOrNull { lower.contains(it) }
}
