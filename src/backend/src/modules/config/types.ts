/**
 * Config module types.
 * Implements TDD §5.2 modules/config/types.ts, FSD §3.8 UC-9.
 */

export interface McpServerConfig {
  jira?: JiraConfig;
  drawio?: DrawioConfig;
  export?: ExportConfig;
}

export interface JiraConfig {
  url: string;
  username: string;
  token?: string;       // Only present on PUT (write), never on GET (read)
  project_key?: string;
}

export interface DrawioConfig {
  path?: string;
  format?: string;
}

export interface ExportConfig {
  output_dir?: string;
}

export interface McpConfigResponse {
  servers: {
    jira?: JiraConfigPublic;
    drawio?: DrawioConfig;
    export?: ExportConfig;
  };
  last_updated: string | null;
}

export interface JiraConfigPublic {
  url: string;
  username: string;
  token_configured: boolean;  // BR-17: never return plaintext
  project_key?: string;
}

export interface McpConfigRecord {
  id: string;
  user_id: string;
  server_name: 'jira' | 'drawio' | 'export';
  config_data: string; // JSON (sensitive fields encrypted)
  created_at: string;
  updated_at: string;
}

export interface TestConnectionRequest {
  server: 'jira' | 'drawio' | 'export';
}

export interface TestConnectionResponse {
  server: string;
  status: 'success' | 'failed';
  message: string;
}
