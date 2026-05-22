plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.shadow)
    `maven-publish`
    application
}

group = "com.codeintel"
version = "0.6.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.sqlite.jdbc)
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.serialization.json)
    implementation(libs.ktor.server.cors)
    implementation(libs.ktor.server.websockets)
    implementation(libs.onnxruntime)

    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}

application {
    mainClass.set("com.codeintel.MainKt")
}

kotlin {
    jvmToolchain(21)
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

tasks.withType<JavaCompile> {
    sourceCompatibility = "11"
    targetCompatibility = "11"
}

tasks.test {
    useJUnitPlatform()
}

// Copy shared/viewer/ into JAR resources so static files are bundled
val copyViewer = tasks.register<Copy>("copyViewer") {
    from(rootProject.file("../shared/viewer"))
    into(layout.buildDirectory.dir("resources/main/viewer"))
}

tasks.named("processResources") {
    dependsOn(copyViewer)
}

tasks.shadowJar {
    dependsOn(copyViewer)
    archiveBaseName.set("mcp-code-intelligence")
    archiveClassifier.set("")
    archiveVersion.set("latest")
    mergeServiceFiles()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            groupId = "com.codeintel"
            artifactId = "mcp-code-intelligence-kotlin"
            version = project.version.toString()
            artifact(tasks.shadowJar)
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/dnguyenminh/Kiro-SDLC-Agents")
            credentials {
                username = System.getenv("GITHUB_ACTOR") ?: project.findProperty("gpr.user") as String?
                password = System.getenv("GITHUB_TOKEN") ?: project.findProperty("gpr.key") as String?
            }
        }
    }
}
