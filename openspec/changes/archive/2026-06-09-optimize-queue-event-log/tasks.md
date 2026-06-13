## 1. Create eventLog.ts module

- [x] 1.1 Create src/eventLog.ts with type definitions (EventType, Event, StateSnapshot, RecoveredState)
- [x] 1.2 Implement initEventLog() - ensure log file exists
- [x] 1.3 Implement appendEvent() with writeLock for concurrent protection
- [x] 1.4 Implement parseEvent() - parse single JSON line
- [x] 1.5 Implement replayEvents() - rebuild state from event list
- [x] 1.6 Implement handleZombieTask() - check index and clean residual files
- [x] 1.7 Implement loadState() - read log, replay events, handle zombie tasks
- [x] 1.8 Implement compact() - write COMPACT event and truncate old events
- [x] 1.9 Implement clearEventLog() - delete log file
- [x] 1.10 Add LOG_FILE constant and compact thresholds

## 2. Modify hashIndex.ts

- [x] 2.1 Remove loadIndex() function
- [x] 2.2 Remove saveIndex() function
- [x] 2.3 Remove clearIndex() function
- [x] 2.4 Remove INDEX_FILE constant
- [x] 2.5 Keep computeFileHash(), hasBeenProcessed(), addProcessedRecord(), getProcessedRecord()

## 3. Modify index.ts to use eventLog

- [x] 3.1 Import eventLog functions (initEventLog, loadState, appendEvent, compact)
- [x] 3.2 Remove import of loadQueue, saveQueue from queue.ts
- [x] 3.3 Remove import of loadIndex, saveIndex from hashIndex.ts
- [x] 3.4 Change initialize() to call loadState() instead of loadQueue/loadIndex
- [x] 3.5 Add eventCount tracking for compact threshold
- [x] 3.6 Modify addTask() to append ENQUEUE event
- [x] 3.7 Modify processTask() to append START event at beginning
- [x] 3.8 Modify processTask() to append COMPLETE event at success
- [x] 3.9 Modify processTask() to append FAIL event at failure
- [x] 3.10 Add shouldCompact() method to check event count
- [x] 3.11 Add compact() method to call eventLog.compact()
- [x] 3.12 Modify stop() to call compact() on normal exit
- [x] 3.13 Remove saveState() method (no longer needed)
- [x] 3.14 Handle state.needsCompact in initialize()
- [x] 3.15 Add input file existence check in processTask()

## 4. Deprecate queue.ts

- [x] 4.1 Remove import of queue.ts from index.ts
- [x] 4.2 Mark queue.ts as deprecated or delete it
- [x] 4.3 Remove enqueue, dequeue, markComplete, markFailed usage

## 5. Update types.ts if needed

- [x] 5.1 Ensure Task and Queue types are compatible with event log format
- [x] 5.2 Add any new types needed for event log (if not in eventLog.ts)

## 6. Verification and testing

- [x] 6.1 Verify watch mode works with event log
- [x] 6.2 Verify batch mode works with event log
- [x] 6.3 Test crash recovery - simulate processing interruption
- [x] 6.4 Test zombie task handling - verify residual file cleanup
- [x] 6.5 Test compact functionality - verify log size reduction
- [x] 6.6 Test concurrent write protection - multiple tasks completing simultaneously
- [x] 6.7 Test corrupted log handling - verify graceful recovery