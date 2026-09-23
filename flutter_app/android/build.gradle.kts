allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Flutter plugins are separate Android library projects. Some older plugins
// declare compileSdk 31 even when the host app targets a newer Android API.
// Align every library with the app/CI SDK so AAR metadata can be linked.
subprojects {
    plugins.withId("com.android.library") {
        afterEvaluate {
            val android = extensions.findByName("android")
            val setter = android?.javaClass?.methods?.firstOrNull { method ->
                (method.name == "setCompileSdk" ||
                    method.name == "setCompileSdkVersion" ||
                    method.name == "compileSdkVersion") &&
                    method.parameterCount == 1
            }
            if (android != null && setter != null) {
                val argument: Any =
                    if (setter.parameterTypes.single() == String::class.java) {
                        "36"
                    } else {
                        36
                    }
                setter.invoke(android, argument)
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
