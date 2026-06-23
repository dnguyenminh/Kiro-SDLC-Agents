"use strict";
/**
 * KSA-75: File Attachments for knowledge entries.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MIME_MAP = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
    '.pdf': 'application/pdf', '.md': 'text/markdown', '.txt': 'text/plain',
    '.json': 'application/json', '.drawio': 'application/xml',
};
class AttachmentManager {
    db;
    constructor(db) {
        this.db = db;
    }
    execute(args) {
        const action = args.action ?? 'list';
        if (action === 'attach')
            return this.attach(args);
        if (action === 'remove')
            return this.remove(args);
        if (action === 'search')
            return this.searchByType(args);
        return this.listAttachments(args);
    }
    attach(args) {
        const entryId = args.entry_id;
        const filePath = args.file_path ?? '';
        if (!entryId || !filePath)
            return 'Error: entry_id and file_path required';
        const desc = args.description ?? null;
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_MAP[ext] ?? 'application/octet-stream';
        let fileSize = 0;
        try {
            fileSize = fs.statSync(filePath).size;
        }
        catch { /* file may not exist locally */ }
        const info = this.db.prepare('INSERT INTO entry_attachments (entry_id, file_path, file_name, mime_type, file_size, description) VALUES (?, ?, ?, ?, ?, ?)').run(entryId, filePath, fileName, mime, fileSize, desc);
        return JSON.stringify({ id: info.lastInsertRowid, entry_id: entryId, file_name: fileName, mime_type: mime });
    }
    remove(args) {
        const attId = args.attachment_id;
        if (!attId)
            return 'Error: attachment_id required';
        this.db.prepare('DELETE FROM entry_attachments WHERE id = ?').run(attId);
        return JSON.stringify({ deleted: attId });
    }
    searchByType(args) {
        const mime = args.mime_prefix ?? 'image/';
        const rows = this.db.prepare('SELECT id, entry_id, file_name, mime_type, file_size FROM entry_attachments WHERE mime_type LIKE ? ORDER BY attached_at DESC LIMIT 50').all(`${mime}%`);
        return JSON.stringify(rows, null, 2);
    }
    listAttachments(args) {
        const entryId = args.entry_id;
        if (!entryId)
            return 'Error: entry_id required for list';
        const rows = this.db.prepare('SELECT id, file_path, file_name, mime_type, file_size, description, attached_at FROM entry_attachments WHERE entry_id = ? ORDER BY attached_at').all(entryId);
        return JSON.stringify(rows, null, 2);
    }
}
exports.AttachmentManager = AttachmentManager;
//# sourceMappingURL=attachment-manager.js.map