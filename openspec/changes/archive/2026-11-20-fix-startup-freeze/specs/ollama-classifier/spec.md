## ADDED Requirements

### Requirement: Non-blocking vision request encoding
The system SHALL encode media payloads for Ollama vision requests without synchronously blocking the Extension Background service worker thread.

#### Scenario: Large media payload does not block message handling
- **WHEN** the classifier encodes a large media payload for a vision request
- **THEN** the encoding SHALL be performed in bounded chunks
- **AND** the encoder SHALL yield to the event loop between chunks
- **AND** background message handling SHALL remain responsive during encoding

#### Scenario: Encoding correctness preserved
- **WHEN** a media payload is encoded with the chunked encoder
- **THEN** the resulting base64 SHALL be identical to a whole-buffer base64 encoding of the same bytes

### Requirement: Thumbnail-first representative image
The system SHALL prefer a downscaled thumbnail over the full original media when preparing a representative image for a vision request.

#### Scenario: Prefer thumbnail for vision request
- **WHEN** the classifier prepares a representative image for a vision request
- **THEN** the system SHALL request the thumbnail before the full original
- **AND** it SHALL use the thumbnail when available

#### Scenario: Fall back to original only when thumbnail unavailable
- **WHEN** no thumbnail is available for a media hash
- **THEN** the system SHALL fall back to the original file

