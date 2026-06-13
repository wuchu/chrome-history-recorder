## REMOVED Requirements

### Requirement: Directory monitoring
**Reason**: Directory watching belonged to the retired standalone `ai-classify` CLI. The supported workflow captures media through the Chrome Extension network listener.
**Migration**: Use the Extension capture flow instead of monitoring an input directory.

### Requirement: Watcher configuration
**Reason**: Watcher glob configuration is no longer needed after removing the standalone directory watcher.
**Migration**: Use Extension capture defaults and DevTools controls.

### Requirement: Watcher events
**Reason**: File-system watcher events are no longer part of the active runtime architecture.
**Migration**: Use Extension capture events and VFS queue events.
