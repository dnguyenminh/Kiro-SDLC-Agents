package com.codeintel.parsers

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class IncrementalParserTest {

    private fun createParser(): IncrementalParser {
        val config = GrammarRegistryConfig(languages = DEFAULT_LANGUAGE_CONFIGS)
        val registry = GrammarRegistry(config)
        registry.initialize()
        return IncrementalParser(registry, maxCacheSize = 10)
    }

    @Test
    fun `parse kotlin file extracts symbols`() {
        val parser = createParser()
        val source = """
            package com.example
            
            import java.io.File
            
            class MyService {
                fun doWork(input: String): String {
                    return input.uppercase()
                }
            }
        """.trimIndent()

        val result = parser.parse("src/MyService.kt", source)
        assertTrue(result.symbols.isNotEmpty(), "Should extract symbols from Kotlin")
        assertTrue(result.symbols.any { it.kind == "class" && it.name == "MyService" })
        assertTrue(result.symbols.any { it.kind == "function" && it.name == "doWork" })
    }

    @Test
    fun `cache returns same result for same content`() {
        val parser = createParser()
        val source = "class Foo { fun bar() {} }"

        val result1 = parser.parse("test.kt", source)
        val result2 = parser.parse("test.kt", source)

        assertEquals(result1, result2)
        assertTrue(parser.isCached("test.kt"))
        assertEquals(1, parser.cacheSize())
    }

    @Test
    fun `invalidates cache on content change`() {
        val parser = createParser()
        val source1 = "class Foo { fun bar() {} }"
        val source2 = "class Foo { fun baz() {} }"

        parser.parse("test.kt", source1)
        assertTrue(parser.isCached("test.kt"))

        val result2 = parser.parse("test.kt", source2)
        assertTrue(result2.symbols.any { it.name == "baz" })
    }

    @Test
    fun `invalidate removes from cache`() {
        val parser = createParser()
        parser.parse("test.kt", "class X {}")
        assertTrue(parser.isCached("test.kt"))

        parser.invalidate("test.kt")
        assertFalse(parser.isCached("test.kt"))
        assertNull(parser.getCachedResult("test.kt"))
    }

    @Test
    fun `invalidateAll clears cache`() {
        val parser = createParser()
        parser.parse("a.kt", "class A {}")
        parser.parse("b.kt", "class B {}")
        assertEquals(2, parser.cacheSize())

        parser.invalidateAll()
        assertEquals(0, parser.cacheSize())
    }

    @Test
    fun `evicts oldest entries when max cache size reached`() {
        val parser = createParser() // maxCacheSize = 10
        for (i in 1..12) {
            parser.parse("file$i.kt", "class File$i {}")
        }
        assertTrue(parser.cacheSize() <= 10)
    }

    @Test
    fun `returns empty ParseResult for unsupported extension`() {
        val parser = createParser()
        val result = parser.parse("file.xyz", "some content")
        assertTrue(result.symbols.isEmpty())
        assertTrue(result.relationships.isEmpty())
    }

    @Test
    fun `computeHash produces consistent results`() {
        val hash1 = IncrementalParser.computeHash("hello world")
        val hash2 = IncrementalParser.computeHash("hello world")
        assertEquals(hash1, hash2)

        val hash3 = IncrementalParser.computeHash("hello world!")
        assertTrue(hash1 != hash3)
    }

    @Test
    fun `parse python file extracts symbols`() {
        val parser = createParser()
        val source = """
            import os
            from pathlib import Path
            
            class DataProcessor:
                def process(self, data):
                    return data
            
            def main():
                dp = DataProcessor()
        """.trimIndent()

        val result = parser.parse("processor.py", source)
        assertTrue(result.symbols.any { it.kind == "class" && it.name == "DataProcessor" })
        assertTrue(result.symbols.any { it.kind == "function" && it.name == "process" })
        assertTrue(result.symbols.any { it.kind == "function" && it.name == "main" })
        assertTrue(result.relationships.any { it.kind == "imports" })
    }

    @Test
    fun `parse typescript file extracts symbols`() {
        val parser = createParser()
        val source = """
            import { Router } from 'express';
            
            export interface UserService {
                getUser(id: string): Promise<User>;
            }
            
            export class UserController {
                constructor(private service: UserService) {}
            }
            
            export async function createApp() {
                return new UserController(new MockService());
            }
        """.trimIndent()

        val result = parser.parse("user.ts", source)
        assertTrue(result.symbols.any { it.kind == "class" && it.name == "UserController" })
        assertTrue(result.symbols.any { it.kind == "interface" && it.name == "UserService" })
        assertTrue(result.symbols.any { it.name == "createApp" })
        assertTrue(result.relationships.any { it.kind == "imports" })
    }
}
