/** JSON extension helpers for V2 tool argument parsing. */
package com.codeintel.memory.tools.v2

import kotlinx.serialization.json.*

/** Get string value from JsonObject by key. */
fun JsonObject.str(key: String): String? =
    this[key]?.jsonPrimitive?.contentOrNull

/** Get int value from JsonObject by key. */
fun JsonObject.int(key: String): Int? =
    this[key]?.jsonPrimitive?.intOrNull

/** Get double value from JsonObject by key. */
fun JsonObject.double(key: String): Double? =
    this[key]?.jsonPrimitive?.doubleOrNull

/** Get boolean value from JsonObject by key (defaults to false). */
fun JsonObject.bool(key: String): Boolean =
    this[key]?.jsonPrimitive?.booleanOrNull ?: false
