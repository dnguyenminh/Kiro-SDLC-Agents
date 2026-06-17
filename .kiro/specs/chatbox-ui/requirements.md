# Requirements Document

## Introduction

A chatbox UI component inspired by the Kiro IDE chatbox interface. Unlike traditional floating chat widgets, this component replicates the IDE-integrated chat panel style: dark theme, structured action blocks, collapsible sections, tabbed conversations, and markdown-rich responses. It will be built as a reusable frontend component using TypeScript and integrated into the existing Express-based application.

## Glossary

- **Chat_Panel**: The main vertical panel occupying the right side of the viewport, containing header tabs, message area, and input area
- **Tab_Bar**: The horizontal tab strip at the top allowing multiple concurrent conversations
- **Message_Area**: The scrollable region displaying conversation content (user prompts and agent responses)
- **Action_Block**: A collapsible/expandable section within agent responses showing discrete operations (file reads, searches, hook executions, file creations)
- **Input_Area**: The bottom input section with text field, context controls, model selector, and autopilot toggle
- **User_Prompt**: A user-submitted message displayed as plain text in the message area
- **Agent_Response**: A structured response containing prose text, action blocks, navigation links, and formatted content
- **Navigation_Link**: A clickable purple-colored text link that triggers spec workflow actions
- **Status_Footer**: The bottom bar showing credits used, elapsed time, and revert controls
- **Markdown_Renderer**: The component rendering markdown within agent prose (headings, bold, italic, lists, code blocks, links)
- **Code_Block**: A syntax-highlighted code section within agent responses with copy functionality
- **Auto_Scroll**: The behavior where the message area scrolls to show the latest content
- **Context_Menu**: The popup menu triggered by typing "#" that lists context sources (Files, Spec, Git Diff, Terminal, Problems, Folder, Current File, Steering, MCP)
- **Slash_Command_Menu**: The popup menu triggered by typing "/" that lists available agents and steering files as executable commands
- **Model_Selector**: The dropdown in the control row that allows choosing the LLM model, showing model name and credit multiplier
- **Context_Usage_Panel**: The info panel showing how much of the context window is used, broken down by category (Conversation, MCP tools, Steering files)

## Requirements

### Requirement 1: Chat Panel Layout

**User Story:** As a user, I want an IDE-style integrated chat panel on the right side, so that I can interact with the AI assistant in a familiar developer-tool interface.

#### Acceptance Criteria

1. THE Chat_Panel SHALL render as a vertical panel anchored to the right edge of the viewport with a dark background theme (#1e1e2e or equivalent dark color)
2. THE Chat_Panel SHALL occupy 100% of the viewport height and have a configurable width between 360px and 500px (default 420px)
3. THE Chat_Panel SHALL be composed of three stacked sections in order: Tab_Bar at top, Message_Area in the middle (flex-grow), and Input_Area fixed at the bottom
4. THE Chat_Panel SHALL display a Status_Footer below the Input_Area showing estimated credits used, elapsed time, a "Revert" button, and a close (X) button
5. THE Chat_Panel SHALL support resizing by dragging the left edge, with a minimum width of 320px and maximum width of 600px
6. WHEN the page loads, THE Chat_Panel SHALL display in its visible (open) state with the most recent conversation tab active

### Requirement 2: Tab Bar and Conversation Management

**User Story:** As a user, I want to manage multiple conversations via tabs, so that I can work on different tasks in parallel.

#### Acceptance Criteria

1. THE Tab_Bar SHALL display one tab per conversation, showing a truncated conversation title (max 20 characters with ellipsis)
2. THE Tab_Bar SHALL display a "+" button at the end of the tab strip to create a new conversation
3. WHEN the "+" button is clicked, THE Tab_Bar SHALL create a new empty conversation tab and switch to it
4. WHEN a tab is clicked, THE Chat_Panel SHALL switch to display that conversation's message history and input state
5. EACH tab SHALL display a close (X) icon on hover that removes that conversation
6. THE Tab_Bar SHALL display action icons on the right side: pin icon, notification bell icon, and a close panel (X) icon
7. WHEN the close panel icon is clicked, THE Chat_Panel SHALL collapse/hide the entire panel
8. WHILE the Chat_Panel is hidden, THE Chat_Panel SHALL display a toggle button to reopen it
9. THE Tab_Bar SHALL support horizontal scrolling when tabs exceed the available width

### Requirement 3: Message Area — User Prompts

**User Story:** As a user, I want my messages displayed clearly in the conversation flow, so that I can track what I asked.

#### Acceptance Criteria

1. THE Message_Area SHALL display User_Prompt items as plain white text on the dark background, without chat bubble styling
2. THE User_Prompt SHALL NOT use right-alignment or bubble-wrap — it appears inline in the conversation flow
3. THE Message_Area SHALL display messages in chronological order from oldest at top to newest at bottom
4. WHEN a new message is added, THE Auto_Scroll SHALL scroll the Message_Area to the bottom
5. WHILE the user has manually scrolled up (at least 50px above the bottom), THE Auto_Scroll SHALL NOT override the user scroll position
6. WHEN the user scrolls back to the bottom, THE Auto_Scroll SHALL resume automatic scrolling behavior

### Requirement 4: Message Area — Agent Responses

**User Story:** As a user, I want agent responses displayed with structured action blocks and rich formatting, so that I can understand what the agent did and what it's recommending.

#### Acceptance Criteria

1. THE Agent_Response SHALL display as a combination of Action_Block elements and prose text sections
2. THE Agent_Response prose text SHALL be rendered using the Markdown_Renderer with support for headings, bold, italic, lists, inline code, code blocks, and links
3. THE Navigation_Link elements SHALL render as clickable text in purple/magenta color (#c792ea or equivalent)
4. THE Agent_Response SHALL NOT use chat bubble styling — content flows directly on the dark background
5. WHEN an Agent_Response is being generated, THE Message_Area SHALL show content streaming in real-time (token by token) for prose sections
6. THE Agent_Response SHALL display a copy icon and a link/share icon aligned to the right of the response block

### Requirement 5: Action Blocks

**User Story:** As a user, I want to see discrete agent operations (file reads, searches, file creations) as collapsible blocks, so that I can focus on results without being overwhelmed by process details.

#### Acceptance Criteria

1. EACH Action_Block SHALL display as a horizontal bar with: an icon (left), a label describing the action, and optionally a file/resource badge
2. THE Action_Block SHALL be collapsible — clicking it toggles between expanded (showing details) and collapsed (showing only the summary bar)
3. THE Action_Block SHALL default to collapsed state for completed actions
4. THE Action_Block icon SHALL indicate the action type: magnifying glass for search, document icon for file read, checkmark/X for accepted/rejected creation, key icon for hook execution
5. WHEN a file creation is accepted, THE Action_Block SHALL display a green checkmark icon and "Accepted creation of" label with the filename badge
6. WHEN a file creation is rejected, THE Action_Block SHALL display a red X icon and "Rejected creation of" label with the filename badge
7. THE Action_Block for "Refined requirements" or batch operations SHALL display a counter badge (e.g., "9/9") on the right side
8. WHEN expanded, THE Action_Block SHALL reveal bullet-point details or sub-content relevant to that operation
9. THE Action_Block SHALL display accept (checkmark) and reject (X) action buttons on the right for file creation operations that need user approval

### Requirement 6: Input Area

**User Story:** As a user, I want a rich input area with context controls and model selection, so that I can compose messages with full control over the AI interaction.

#### Acceptance Criteria

1. THE Input_Area SHALL provide a multi-line text field with placeholder text "Ask a question or describe a task..."
2. THE text field SHALL start at 1 line height, expand as the user types up to a maximum of 6 visible lines, and scroll vertically when content exceeds 6 lines
3. WHEN the user presses Enter without Shift and the input contains at least one non-whitespace character, THE Input_Area SHALL submit the message
4. WHEN the user presses Shift+Enter, THE Input_Area SHALL insert a new line
5. THE Input_Area SHALL display a send button (arrow-up icon) to the right of the text field
6. WHEN the input is empty or contains only whitespace, THE send button SHALL be disabled (dimmed)
7. THE Input_Area SHALL display a row of control icons below the text field: "#" (context selector), paperclip (attachment), and a circle icon (settings/options)
8. THE Input_Area SHALL display a model selector dropdown (e.g., "Auto ▼") on the left of the bottom control row
9. THE Input_Area SHALL display an "Autopilot" toggle switch on the right of the bottom control row, with a colored indicator (blue/green) when enabled
10. WHEN a message is submitted, THE Input_Area SHALL clear the text field and return focus to it

### Requirement 7: Markdown Rendering in Agent Responses

**User Story:** As a user, I want agent prose responses rendered with proper markdown formatting, so that I can read structured content clearly.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL render headings (h1 through h6), bold, italic, ordered lists, and unordered lists
2. THE Markdown_Renderer SHALL render inline code with a monospace font and a slightly lighter background
3. THE Markdown_Renderer SHALL render Code_Block elements with syntax highlighting when the language is specified
4. THE Code_Block SHALL display a copy button that copies the code content to the clipboard
5. IF the Code_Block specifies a programming language, THEN THE Code_Block SHALL display that language label in the header
6. IF the Code_Block does not specify a language, THEN THE Markdown_Renderer SHALL render the code block without highlighting and without a language label
7. THE Markdown_Renderer SHALL render hyperlinks as clickable elements in a distinct color that open in a new browser tab
8. IF the clipboard copy action fails, THEN THE Code_Block SHALL display a transient error indication for 2-5 seconds

### Requirement 8: Loading and Streaming Indicator

**User Story:** As a user, I want to see real-time streaming of agent responses and clear indicators for background processing, so that I know the system is working.

#### Acceptance Criteria

1. WHEN a user message is submitted, THE Message_Area SHALL begin showing agent response content (action blocks or streaming text) within 500 milliseconds
2. WHILE the agent is processing, THE Action_Block items SHALL appear sequentially as operations complete
3. WHILE the agent is generating prose text, THE text SHALL stream in token-by-token with a visible cursor/caret at the end
4. WHILE the agent is responding, THE Input_Area SHALL hide the send button and display a stop button (square icon)
5. WHEN the stop button is clicked, THE Chat_Panel SHALL cancel the ongoing generation, preserve any partial response, re-enable the send button, and hide the stop button
6. IF no response data is received within 30 seconds of submission, THEN THE Chat_Panel SHALL display a timeout error and restore the Input_Area to ready state

### Requirement 9: Conversation Persistence

**User Story:** As a user, I want my conversations to persist across page reloads, so that I can continue work without losing context.

#### Acceptance Criteria

1. WHEN a message is sent or a response is received, THE Chat_Panel SHALL persist the conversation to browser local storage within 1 second
2. WHEN the Chat_Panel loads, THE Message_Area SHALL restore and display all previously stored conversations and their messages
3. THE Chat_Panel SHALL persist for each conversation: tab title, all messages (user prompts + agent responses including action blocks), and input field draft text
4. THE Chat_Panel SHALL support a maximum of 200 messages per conversation before removing the oldest messages
5. IF browser local storage is unavailable or quota is exceeded, THEN THE Chat_Panel SHALL display a warning and continue functioning for the current session without persistence
6. THE Tab_Bar close (X) on a tab SHALL remove that conversation from storage after a confirmation prompt

### Requirement 10: Responsive Behavior

**User Story:** As a user, I want the chat panel to adapt gracefully to different viewport sizes.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768px, THE Chat_Panel SHALL render as a full-screen overlay occupying 100% viewport width and height
2. WHILE the viewport width is 768px or greater, THE Chat_Panel SHALL render as the right-side panel with configurable width
3. WHEN the viewport is resized across the 768px breakpoint, THE Chat_Panel SHALL transition between modes within 300ms
4. WHEN the layout transitions between modes, THE Chat_Panel SHALL preserve all conversation state and input field content
5. WHILE on touch devices, ALL interactive elements SHALL have a minimum touch target of 44x44 CSS pixels

### Requirement 11: Accessibility

**User Story:** As a user with accessibility needs, I want the chat panel to be fully accessible with keyboard and screen readers.

#### Acceptance Criteria

1. THE Chat_Panel SHALL use ARIA roles: role="log" on the Message_Area, role="textbox" on the input field, role="tablist" on the Tab_Bar, role="tab" on each tab
2. THE Chat_Panel SHALL support keyboard navigation: Tab to move between interactive elements, Enter to activate, Escape to close expanded Action_Blocks
3. WHEN a new agent response appears, THE Chat_Panel SHALL announce it via an aria-live="polite" region
4. ALL interactive elements SHALL have accessible labels (aria-label or visible label)
5. THE Input_Area SHALL have a visible focus indicator with minimum 3:1 contrast ratio (WCAG 2.1 AA)
6. WHILE high-contrast mode is enabled, THE Chat_Panel SHALL use system color keywords for all text and controls

### Requirement 12: Error Handling

**User Story:** As a user, I want clear feedback when something goes wrong.

#### Acceptance Criteria

1. IF a message fails to send due to network error, THEN THE Chat_Panel SHALL display an error indicator on the failed message with a retry button
2. WHEN the retry button is clicked, THE Chat_Panel SHALL attempt to resend, up to a maximum of 3 attempts
3. IF all 3 retry attempts fail, THEN THE Chat_Panel SHALL disable the retry button and display a persistent error state
4. IF the agent response fails, THEN THE Chat_Panel SHALL display an error message with a "Try Again" option
5. IF local storage quota is exceeded, THEN THE Chat_Panel SHALL remove oldest conversations (excluding the active one) until 10% capacity is freed

### Requirement 13: Context Menu ("#" Trigger)

**User Story:** As a user, I want to quickly attach context sources to my message by typing "#", so that I can reference files, specs, terminal output, and other resources without leaving the input field.

#### Acceptance Criteria

##### General Behavior

1. WHEN the user types "#" in the Input_Area text field, THE Chat_Panel SHALL display a Context_Menu popup directly above the input field within 100 milliseconds
2. THE Context_Menu SHALL display a vertical list of 9 context source categories, each with a distinct icon (left) and label (right)
3. THE Context_Menu SHALL filter the displayed items in real-time as the user continues typing after "#" (fuzzy match against item labels)
4. THE Context_Menu SHALL support keyboard navigation: Arrow Up/Down to highlight items, Enter to select the highlighted item, Escape to dismiss
5. WHEN the user presses Escape or clicks outside the Context_Menu, THE Context_Menu SHALL close without inserting anything into the input
6. AFTER the user selects an item and completes the selection flow, THE Chat_Panel SHALL insert a visible context tag badge (e.g., "#File: main.ts") into the input field, styled as a non-editable inline chip
7. THE context tag badge SHALL be removable by pressing Backspace when the cursor is adjacent to it, or by clicking an (X) icon on the badge

##### Item: Files (folder icon)

8. WHEN the user selects "Files", THE Context_Menu SHALL display a secondary file picker panel showing the workspace file tree
9. THE file picker SHALL support fuzzy search — the user can type a filename to filter the tree in real-time
10. WHEN the user selects a file from the picker, THE Chat_Panel SHALL insert a tag badge "#File: {relative_path}" and close the Context_Menu
11. THE file picker SHALL allow selecting multiple files by holding Ctrl/Cmd and clicking, inserting one tag badge per selected file

##### Item: Spec (document icon)

12. WHEN the user selects "Spec", THE Context_Menu SHALL display a list of available specs from the .kiro/specs/ directory, showing spec folder names
13. WHEN the user selects a spec, THE Chat_Panel SHALL insert a tag badge "#Spec: {spec-name}" and close the Context_Menu
14. THE spec item SHALL attach the full content of requirements.md, design.md, and tasks.md from the selected spec folder as context

##### Item: Git Diff (+ icon)

15. WHEN the user selects "Git Diff", THE Chat_Panel SHALL immediately insert a tag badge "#Git Diff" and close the Context_Menu (no secondary picker needed)
16. THE Git Diff context SHALL attach the current unstaged and staged changes (equivalent to `git diff` + `git diff --staged`) to the message context

##### Item: Terminal (terminal icon)

17. WHEN the user selects "Terminal", THE Context_Menu SHALL immediately insert a tag badge "#Terminal" and close the Context_Menu
18. THE Terminal context SHALL attach the most recent terminal output (last 100 lines or configurable) from the active terminal instance

##### Item: Problems (warning triangle icon)

19. WHEN the user selects "Problems", THE Chat_Panel SHALL immediately insert a tag badge "#Problems" and close the Context_Menu
20. THE Problems context SHALL attach the current list of errors, warnings, and diagnostics from the active file or workspace diagnostics panel

##### Item: Folder (folder icon)

21. WHEN the user selects "Folder", THE Context_Menu SHALL display a folder picker showing the workspace directory tree (folders only)
22. WHEN the user selects a folder, THE Chat_Panel SHALL insert a tag badge "#Folder: {relative_path}" and close the Context_Menu
23. THE Folder context SHALL attach a recursive listing of all files within the selected folder as context (file names and optionally content summaries)

##### Item: Current File (document icon)

24. WHEN the user selects "Current File", THE Chat_Panel SHALL immediately insert a tag badge "#Current File: {filename}" and close the Context_Menu
25. THE Current File context SHALL attach the full content of the file currently active/open in the editor

##### Item: Steering (steering wheel icon)

26. WHEN the user selects "Steering", THE Context_Menu SHALL display a list of available steering files from .kiro/steering/*.md
27. EACH steering file item SHALL display the filename (without path and extension) as its label
28. WHEN the user selects a steering file, THE Chat_Panel SHALL insert a tag badge "#Steering: {filename}" and close the Context_Menu
29. THE Steering context SHALL attach the full content of the selected steering markdown file to the message context

##### Item: MCP (gem/diamond icon)

30. THE MCP item SHALL display a secondary label "Model Context Protocol →" on the right side indicating it opens a submenu
31. WHEN the user selects "MCP", THE Context_Menu SHALL display a secondary panel listing available MCP resources/tools from configured MCP servers
32. WHEN the user selects an MCP resource, THE Chat_Panel SHALL insert a tag badge "#MCP: {resource_name}" and close the Context_Menu
33. THE MCP context SHALL attach the selected MCP resource content (tool schema, resource data, or prompt template) to the message context

### Requirement 14: Slash Command Menu ("/" Trigger)

**User Story:** As a user, I want to invoke agents and steering commands by typing "/", so that I can quickly delegate tasks to specialized agents or apply workflow rules.

#### Acceptance Criteria

##### General Behavior

1. WHEN the user types "/" at the beginning of the input or after a space, THE Chat_Panel SHALL display a Slash_Command_Menu popup directly above the input field within 100 milliseconds
2. THE Slash_Command_Menu SHALL display a scrollable vertical list of available commands, each with an icon (left), command name (bold), and optionally a short description (dimmed, truncated at 60 characters)
3. THE Slash_Command_Menu SHALL filter items in real-time as the user continues typing after "/" (fuzzy match against command names and descriptions)
4. THE Slash_Command_Menu SHALL support keyboard navigation: Arrow Up/Down to highlight items, Enter to select, Escape to dismiss
5. WHEN the user presses Escape or clicks outside the Slash_Command_Menu, THE menu SHALL close without modifying the input
6. THE Slash_Command_Menu SHALL be scrollable with a visible scrollbar when items exceed the visible area (max height ~400px)

##### Command Categories and Display Order

7. THE Slash_Command_Menu SHALL display commands in two visually distinct groups: Agent commands (robot/globe icon) listed first, followed by Steering commands (steering wheel icon)
8. Agent commands SHALL be sorted alphabetically within their group
9. Steering commands SHALL be sorted alphabetically within their group
10. THE first item in the list SHALL be highlighted by default when the menu opens

##### Agent Commands — Selection Behavior

11. WHEN the user selects an agent command, THE Chat_Panel SHALL replace the "/" text with the agent's name as a command prefix (e.g., "/sm-agent") displayed as a non-editable styled tag in the input
12. AFTER selecting an agent, THE Input_Area SHALL retain focus with the cursor positioned after the agent tag, allowing the user to type the task/instruction for that agent
13. WHEN the message is submitted with an agent command prefix, THE Chat_Panel SHALL route the message to the specified agent for execution instead of the default assistant
14. THE agent command tag SHALL be removable by pressing Backspace when the cursor is adjacent to it

##### Available Agent Commands

15. THE Slash_Command_Menu SHALL list the following agent commands with their descriptions:
    - **general-task-execution**: "General-purpose sub-agent with access to all tools for executing arbitrary tasks"
    - **context-gatherer**: "Analyzes repository structure to identify relevant files and content"
    - **custom-agent-creator**: "Specialized agent for creating and configuring new custom agents"
    - **requirement-detailer**: "Specialized subagent for detailing a single requirement through QA analysis"
    - **ba-agent**: "Business Analyst agent — reads Jira tickets, builds BRD/FSD"
    - **dev-agent**: "Developer agent — implements code from TDD"
    - **devops-agent**: "DevOps agent — creates Deployment Guide, CI/CD, Docker config"
    - **qa-agent**: "QA Engineer agent — creates Test Plan (STP) and Test Cases (STC)"
    - **sa-agent**: "Solution Architect agent — creates Technical Design Document (TDD)"
    - **security-agent**: "Security expert — reviews code, detects vulnerabilities"
    - **sm-agent**: "Scrum Master agent — coordinates full SDLC pipeline"

##### Steering Commands — Selection Behavior

16. WHEN the user selects a steering command, THE Chat_Panel SHALL replace the "/" text with the steering file reference as a non-editable styled tag (e.g., "/agent-self-learning")
17. AFTER selecting a steering command, THE Input_Area SHALL retain focus with the cursor positioned after the steering tag
18. WHEN the message is submitted with a steering command prefix, THE Chat_Panel SHALL load the referenced steering file's content as additional instructions for the current message processing
19. THE steering command tag SHALL be removable by pressing Backspace when the cursor is adjacent to it

##### Available Steering Commands

20. THE Slash_Command_Menu SHALL list the following steering commands (loaded dynamically from .kiro/steering/*.md):
    - **agent-self-learning**: Rules for agent self-learning from knowledge base
    - **jira-rules**: Jira integration and workflow rules
    - **manual-web-test**: Manual web testing procedures
    - **orchestration**: Multi-agent orchestration rules
    - **release-versioning**: Release and versioning conventions

##### Edge Cases

21. IF no commands match the user's filter text after "/", THE Slash_Command_Menu SHALL display an empty state message "No matching commands"
22. IF the user types "/" in the middle of a word (not at start or after space), THE Slash_Command_Menu SHALL NOT open
23. WHEN the user selects a command and then deletes the command tag, THE input SHALL return to normal text mode without any command routing

### Requirement 15: Model Selector

**User Story:** As a user, I want to choose which LLM model powers my conversation, so that I can balance between quality, speed, and credit cost.

#### Acceptance Criteria

1. THE Model_Selector SHALL display as a clickable dropdown in the bottom control row of the Input_Area, showing the currently selected model name and a down-arrow indicator (e.g., "Auto ▼")
2. WHEN the Model_Selector is clicked, THE Chat_Panel SHALL display a dropdown list of available models, each showing: model name (bold), credit multiplier (dimmed text, e.g., "2.2x Credit"), and optionally a quality badge (e.g., "xHigh")
3. THE model list SHALL include a default "Auto" option at the top with "1x Credit" label and a radio/check indicator showing it is the default
4. EACH non-Auto model item SHALL display an "Edit" button on hover that allows configuring that model's parameters
5. WHEN the user clicks a model from the list, THE Model_Selector SHALL update the displayed label to show the selected model name and close the dropdown
6. THE selected model SHALL persist across messages within the same conversation but MAY differ between conversation tabs
7. THE Model_Selector dropdown SHALL be scrollable when the list exceeds the available viewport height
8. THE bottom of the Model_Selector dropdown SHALL display the Context_Usage_Panel showing current context window utilization

### Requirement 16: Context Usage Panel

**User Story:** As a user, I want to see how much of the context window is being used, so that I can manage conversation length and attached resources effectively.

#### Acceptance Criteria

##### Display and Location

1. THE Context_Usage_Panel SHALL display as a popup panel that appears above the Status_Footer when the user clicks/hovers on the context indicator (circle icon in the bottom control row)
2. THE Context_Usage_Panel SHALL have a dark background consistent with the Chat_Panel theme, with a subtle border or shadow separating it from surrounding content
3. THE Context_Usage_Panel SHALL display a header label "Context usage" in bold white text at the top of the panel

##### Category Breakdown

4. THE Context_Usage_Panel SHALL display the following categories as separate rows, each with the category label on the left and the percentage value right-aligned:
    - **Conversation**: percentage of the context window consumed by message history (user prompts + agent responses)
    - **MCP tools**: percentage consumed by MCP tool definitions and schemas loaded into context
    - **Steering files**: percentage consumed by steering file content automatically included in context
5. EACH category percentage SHALL be displayed as an integer followed by "%" (e.g., "11%", "0%", "2%")
6. THE category rows SHALL be separated by consistent vertical spacing (8-12px between rows)

##### Total Row

7. THE Context_Usage_Panel SHALL display a "Total" row below the category rows, separated by visual whitespace or a subtle divider
8. THE Total row SHALL display "Total" label (bold) on the left and the sum of all category percentages right-aligned (bold)
9. THE Total percentage SHALL always equal the arithmetic sum of all individual category percentages

##### Relationship to Status Footer

10. THE Status_Footer (above the Context_Usage_Panel trigger) SHALL display "Est. Credits Used: {value}" and "Elapsed time: {duration}" as static text
11. THE "Est. Credits Used" value SHALL display as a decimal number with 2 decimal places (e.g., "1.95", "6.75")
12. THE "Elapsed time" value SHALL display in human-readable format: "{minutes}m {seconds}s" for durations under 1 hour, or "{hours}h {minutes}m" for longer durations

##### Real-time Updates

13. THE Context_Usage_Panel percentages SHALL update in real-time after each of the following events: message sent, response received, context item added (#tag), context item removed, steering file loaded/unloaded
14. THE "Est. Credits Used" in the Status_Footer SHALL increment in real-time as the agent processes (not only after response completes)
15. THE "Elapsed time" SHALL count up from the moment the first message in the current turn was submitted until the agent finishes responding

##### Warning Thresholds

16. WHILE the Total context usage is between 0% and 79%, THE Total percentage SHALL display in the default text color (white/light gray)
17. WHILE the Total context usage is between 80% and 94%, THE Total percentage SHALL display in a warning color (yellow/amber) to indicate approaching limits
18. WHILE the Total context usage is 95% or above, THE Total percentage SHALL display in an error color (red/orange) AND THE Chat_Panel SHALL display an inline warning message below the panel: "Context window is nearly full. Consider starting a new conversation."
19. IF the Total context usage reaches 100%, THE Chat_Panel SHALL display a blocking warning indicating that no more context can be added, and suggest starting a new conversation

##### Interaction Behavior

20. THE Context_Usage_Panel SHALL be dismissible by clicking anywhere outside of it or pressing Escape
21. THE Context_Usage_Panel SHALL NOT block user interaction with the Input_Area while visible (non-modal)
22. WHEN the user hovers over an individual category row, THE Context_Usage_Panel MAY display a tooltip showing the exact token count (e.g., "11,234 / 100,000 tokens")
