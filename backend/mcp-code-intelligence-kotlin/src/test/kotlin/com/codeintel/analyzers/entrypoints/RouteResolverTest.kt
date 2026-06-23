package com.codeintel.analyzers.entrypoints

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RouteResolverTest {
    private val resolver = RouteResolver()

    @Test fun `resolve with prefix and path`() {
        assertEquals("/api/users", resolver.resolve("/api", "/users"))
    }

    @Test fun `resolve with null prefix`() {
        assertEquals("/users", resolver.resolve(null, "/users"))
    }

    @Test fun `resolve with empty path`() {
        assertEquals("/api", resolver.resolve("/api", ""))
    }

    @Test fun `resolve root path`() {
        assertEquals("/api", resolver.resolve("/api", "/"))
    }

    @Test fun `normalize params express style`() {
        assertEquals("/users/{id}", resolver.normalizeParams("/users/:id"))
    }

    @Test fun `normalize params flask style`() {
        assertEquals("/users/{id}", resolver.normalizeParams("/users/<int:id>"))
    }

    @Test fun `extract path from arg`() {
        assertEquals("/users/{id}", resolver.extractPathFromArg("'/users/:id'"))
    }
}
