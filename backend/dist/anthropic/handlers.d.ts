import { Request, Response } from 'express';
import { ConversationHistory } from '../history/conversation';
import { KiroQResponse, ContinuationRequest } from './types';
/**
 * Creates a handler with injectable dependencies for testability.
 */
export declare function createChatCompletionsHandler(history: ConversationHistory, forwardToKiroQ: (request: ContinuationRequest) => Promise<KiroQResponse>): (req: Request, res: Response) => Promise<void>;
