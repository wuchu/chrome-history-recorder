## 1. Status Indicators

- [x] 1.1 Replace VFS and Ollama character-based status icons with the shared CSS status dot.
- [x] 1.2 Ensure status dot size is consistent across service, VFS, and Ollama status items.

## 2. Media Detail Viewer

- [x] 2.1 Remove download action from the focused original-image viewer toolbar.
- [x] 2.2 Remove the rotate/requeue-style action icon from the focused original-image viewer toolbar.
- [x] 2.3 Add a top-left viewer title that uses the AI-renamed filename when available and otherwise uses the media hash.

## 3. Feedback Consistency

- [x] 3.1 Verify extension UI code does not call `window.alert` or native `alert`.
- [x] 3.2 Preserve Ant Design feedback usage for Options-page messages and modals.

## 4. Verification

- [x] 4.1 Run `pnpm --filter extension compile`.
- [x] 4.2 Search for remaining native alert usage.

