/**
 * KSA-162: Route Resolver — Resolves full routes from controller prefix + method path.
 */
export declare class RouteResolver {
    /** Resolve full route: controller prefix + method path. */
    resolve(controllerPrefix: string | null, methodPath: string): string;
    /** Normalize route params: :id, {id}, <int:id> → {id}. */
    normalizeParams(path: string): string;
    /** Extract route path from a decorator/annotation argument string. */
    extractPathFromArg(arg: string): string;
    private normalizePath;
}
