package com.codeintel.parsers.languages

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ApexParserTest {
    private val parser = ApexParser()

    @Test fun `parse simple class`() {
        val source = "public class AccountService { }"
        val result = parser.parse(source, "AccountService.cls")
        assertEquals(1, result.symbols.size)
        assertEquals("AccountService", result.symbols[0].name)
        assertEquals("class", result.symbols[0].kind)
        assertTrue(result.symbols[0].isExported == true)
    }

    @Test fun `parse class with methods`() {
        val source = """
            public class MyService {
                public void doSomething(String name) { }
                private Integer calculate(Integer a, Integer b) { }
                public static List<Account> getAccounts() { }
            }
        """.trimIndent()
        val result = parser.parse(source, "MyService.cls")
        val methods = result.symbols.filter { it.kind == "method" }
        assertEquals(3, methods.size)
        assertEquals("doSomething", methods[0].name)
        assertEquals("MyService", methods[0].parentName)
    }

    @Test fun `parse DML operations`() {
        val source = """
            public class AccountHandler {
                public void createAccounts() {
                    insert accounts;
                    update contacts;
                }
            }
        """.trimIndent()
        val result = parser.parse(source, "AccountHandler.cls")
        val dmlRels = result.relationships.filter { it.kind == "dml" }
        assertEquals(2, dmlRels.size)
        assertEquals("INSERT", dmlRels[0].metadata?.get("operation"))
        assertEquals("UPDATE", dmlRels[1].metadata?.get("operation"))
    }

    @Test fun `parse SOQL queries`() {
        val source = """
            public class QueryService {
                public void run() {
                    List<Account> accs = [SELECT Id, Name FROM Account WHERE Active__c = true];
                    List<Contact> cons = [SELECT Id FROM Contact];
                }
            }
        """.trimIndent()
        val result = parser.parse(source, "QueryService.cls")
        val soqlRels = result.relationships.filter { it.kind == "soql" }
        assertEquals(2, soqlRels.size)
        assertEquals("Account", soqlRels[0].targetSymbol)
        assertEquals("Contact", soqlRels[1].targetSymbol)
    }

    @Test fun `parse trigger`() {
        val source = "trigger AccountTrigger on Account (before insert, after update) { }"
        val result = parser.parse(source, "AccountTrigger.trigger")
        assertEquals(1, result.symbols.size)
        assertEquals("AccountTrigger", result.symbols[0].name)
        assertTrue(result.symbols[0].modifiers?.contains("trigger") == true)
        val triggerRel = result.relationships.find { it.kind == "trigger-on" }
        assertEquals("Account", triggerRel?.targetSymbol)
        assertTrue(triggerRel?.metadata?.get("events")?.contains("before insert") == true)
    }

    @Test fun `parse inheritance`() {
        val source = "public class MyController extends BaseController implements IHandler, ILogger { }"
        val result = parser.parse(source, "MyController.cls")
        val inherits = result.relationships.filter { it.kind == "inherits" }
        val implements = result.relationships.filter { it.kind == "implements" }
        assertEquals(1, inherits.size)
        assertEquals("BaseController", inherits[0].targetSymbol)
        assertEquals(2, implements.size)
    }

    @Test fun `parse interface`() {
        val source = "public interface IAccountService { }"
        val result = parser.parse(source, "IAccountService.cls")
        assertEquals(1, result.symbols.size)
        assertEquals("interface", result.symbols[0].kind)
    }

    @Test fun `parse enum`() {
        val source = "public enum Season { WINTER, SPRING, SUMMER, FALL }"
        val result = parser.parse(source, "Season.cls")
        assertEquals(1, result.symbols.size)
        assertEquals("enum", result.symbols[0].kind)
    }

    @Test fun `parse annotations`() {
        val source = """
            @IsTest
            private class AccountServiceTest {
                @IsTest
                static void testCreate() { }
            }
        """.trimIndent()
        val result = parser.parse(source, "AccountServiceTest.cls")
        val method = result.symbols.find { it.kind == "method" }
        assertTrue(method?.decorators?.any { it.contains("@IsTest") } == true)
    }

    @Test fun `parse global with sharing class`() {
        val source = "global with sharing class SecureService { }"
        val result = parser.parse(source, "SecureService.cls")
        assertEquals(1, result.symbols.size)
        assertTrue(result.symbols[0].modifiers?.contains("global") == true)
    }

    @Test fun `supported extensions`() {
        assertEquals(listOf(".cls", ".trigger"), parser.getSupportedExtensions())
    }
}
