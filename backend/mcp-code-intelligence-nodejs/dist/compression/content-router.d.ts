/**
 * ContentRouter — Content Type Detection
 * KSA-244: Classifies message content for compression routing
 *
 * Fast path: check first char before JSON.parse.
 * Budget: < 0.5ms per message.
 */
import { ContentClassification, ContentType } from './types.js';
export declare class ContentRouter {
    /**
     * Detect content type and determine if compression should be applied.
     * Only JSON arrays trigger compression in v1.
     */
    detect(content: string, hint?: ContentType): ContentClassification;
}
//# sourceMappingURL=content-router.d.ts.map