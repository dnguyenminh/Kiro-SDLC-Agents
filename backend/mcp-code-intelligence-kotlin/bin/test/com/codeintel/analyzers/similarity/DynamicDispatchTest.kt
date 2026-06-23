package com.codeintel.analyzers.similarity

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DynamicDispatchTest {
    private val recognizer = DynamicDispatchRecognizer()

    @Test
    fun `getattr detected`() {
        assertTrue(recognizer.isDynamicallyDispatched("result = getattr(obj, name)"))
    }

    @Test
    fun `decorator detected`() {
        assertTrue(recognizer.isDynamicallyDispatched("@app.route('/api')"))
    }

    @Test
    fun `normal code not detected`() {
        assertFalse(recognizer.isDynamicallyDispatched("def hello(): return 'world'"))
    }

    @Test
    fun `deprecated marker`() {
        assertTrue(recognizer.hasDeprecatedMarker("@deprecated\ndef old_func(): pass"))
        assertFalse(recognizer.hasDeprecatedMarker("def new_func(): pass"))
    }

    @Test
    fun `config reference`() {
        val config = "handler: my_handler\ncallback: on_event"
        assertTrue(recognizer.isConfigReferenced("my_handler", config))
        assertFalse(recognizer.isConfigReferenced("unknown_func", config))
    }

    @Test
    fun `spring annotations detected`() {
        assertTrue(recognizer.isDynamicallyDispatched("@Service\nclass MyService"))
        assertTrue(recognizer.isDynamicallyDispatched("@Component class Foo"))
    }
}
